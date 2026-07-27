/**
 * Compilable hosted integration helpers for support.refund.
 * Default `npm run demo` does not call these. Runtime network use requires env credentials.
 */

import {
  ACTION_CONTEXT_SCHEMA_VERSION,
  ControlClient,
  createActionBinding,
  deriveIdempotencyKey,
  type ActionContext,
  type ControlCheckResult,
  type ControlReviewRecord,
} from "@turnkeeper/sdk";

import { loadActionRecord, persistActionRecord, type PersistedActionRecord } from "./actionContextStore.ts";
import {
  AMOUNT_THRESHOLD_CENTS,
  SUPPORT_REFUND_ACTION,
  supportRefundBundle,
  type SupportRefundProposal,
  type SupportRefundSignals,
} from "./index.ts";
import {
  assertProposalSignalConsistency,
  validateSupportRefundProposal,
  validateSupportRefundSignals,
} from "./validation.ts";

export type HostedRefundScope = {
  environment: "production" | "staging" | "test";
  projectId: string;
  tenantId: string;
};

export type HostedRefundActor = {
  actorId: string;
  roles: string[];
  subjectId: string;
};

export type HostedRefundDeps = {
  applicationAuthorizesRefund: (proposal: SupportRefundProposal) => Promise<boolean>;
  callPaymentProvider: (proposal: SupportRefundProposal) => Promise<{ providerRef: string }>;
  control: Pick<ControlClient, "check" | "getReview">;
  deriveTrustedRefundSignals: (proposalId: string) => Promise<SupportRefundSignals>;
  enqueueMetadataOnlyReplay: (input: {
    actionName: string;
    outcome: string;
    proposalId: string;
  }) => Promise<void>;
  loadImmutableProposal: (proposalId: string) => Promise<SupportRefundProposal & { proposalVersion: number }>;
  persistExactProposal: (
    proposal: SupportRefundProposal,
  ) => Promise<{ proposalId: string; proposalVersion: number }>;
  recordDownstreamOutcome: (input: {
    proposalId: string;
    provider: { providerRef: string };
  }) => Promise<void>;
};

export { AMOUNT_THRESHOLD_CENTS };

export function buildSupportRefundActionContext(input: {
  actor: HostedRefundActor;
  conversationId: string;
  proposal: SupportRefundProposal;
  proposalVersion: number;
  scope: HostedRefundScope;
  signals: SupportRefundSignals;
  turnId: string;
}): ActionContext {
  const proposal = validateSupportRefundProposal(input.proposal);
  if (!proposal.ok) throw new Error(`invalid_proposal:${proposal.errors[0]?.code ?? "unknown"}`);
  const signals = validateSupportRefundSignals(input.signals);
  if (!signals.ok) throw new Error(`invalid_signals:${signals.errors[0]?.code ?? "unknown"}`);
  assertProposalSignalConsistency(proposal.value, signals.value);

  return {
    actionName: SUPPORT_REFUND_ACTION,
    actorId: input.actor.actorId,
    actorRoles: input.actor.roles,
    conversationId: input.conversationId,
    environment: input.scope.environment,
    parameters: {
      amount_cents: proposal.value.amountCents,
      customer_ref: proposal.value.customerRef,
      transaction_ref: proposal.value.transactionRef,
    },
    projectId: input.scope.projectId,
    proposalVersion: input.proposalVersion,
    schemaVersion: ACTION_CONTEXT_SCHEMA_VERSION,
    signals: signals.value,
    tenantId: input.scope.tenantId,
    turnId: input.turnId,
    userId: input.actor.subjectId,
  };
}

/**
 * Recompute the action binding from a reloaded ActionContext and bind a terminal
 * review to review.actionRef when the hosted review supplies one.
 */
export function assertTerminalReviewBound(input: {
  bindingSecret: string | Uint8Array;
  expectedActionRef: string | null;
  expectedBinding: string;
  reloadedContext: ActionContext;
  review: ControlReviewRecord;
}): void {
  const rebound = createActionBinding(input.reloadedContext, input.bindingSecret);
  if (rebound !== input.expectedBinding) {
    throw new Error("proposal_binding_mismatch");
  }
  if (input.review.actionRef != null) {
    if (input.expectedActionRef == null || input.review.actionRef !== input.expectedActionRef) {
      throw new Error("review_action_ref_mismatch");
    }
  }
}

export function createHostedControlClientFromEnv(): ControlClient {
  const apiKey = process.env.TURNKEEPER_API_KEY;
  const baseUrl = process.env.TURNKEEPER_BASE_URL;
  if (!apiKey) throw new Error("TURNKEEPER_API_KEY is required for hosted Control calls.");
  if (!baseUrl) throw new Error("TURNKEEPER_BASE_URL is required for hosted Control calls.");
  return new ControlClient({ apiKey, baseUrl });
}

export async function checkSupportRefund(
  deps: HostedRefundDeps,
  input: {
    actor: HostedRefundActor;
    bindingSecret: string | Uint8Array;
    conversationId: string;
    proposal: SupportRefundProposal;
    scope: HostedRefundScope;
    turnId: string;
  },
): Promise<{
  applicationState:
    | "permanently_stopped"
    | "held_for_review"
    | "requires_application_authorization";
  decision: ControlCheckResult;
  persisted: PersistedActionRecord;
}> {
  const stored = await deps.persistExactProposal(input.proposal);
  const signals = await deps.deriveTrustedRefundSignals(stored.proposalId);
  const action = buildSupportRefundActionContext({
    actor: input.actor,
    conversationId: input.conversationId,
    proposal: input.proposal,
    proposalVersion: stored.proposalVersion,
    scope: input.scope,
    signals,
    turnId: input.turnId,
  });
  const actionBinding = createActionBinding(action, input.bindingSecret);
  deriveIdempotencyKey(actionBinding);

  const decision = await deps.control.check(supportRefundBundle, action, {
    bindingSecret: input.bindingSecret,
  });

  const persisted: PersistedActionRecord = {
    actionBinding,
    actionRef: null,
    context: action,
    proposalId: stored.proposalId,
    reviewId: decision.review?.id ?? null,
  };
  persistActionRecord(persisted);

  if (decision.decision === "block") {
    return { applicationState: "permanently_stopped", decision, persisted };
  }
  if (decision.decision === "review") {
    return { applicationState: "held_for_review", decision, persisted };
  }
  return { applicationState: "requires_application_authorization", decision, persisted };
}

export async function resumeApprovedRefund(
  deps: HostedRefundDeps,
  input: {
    bindingSecret: string | Uint8Array;
    proposalId: string;
    reviewId: string;
  },
): Promise<{
  applicationState: "permanently_stopped" | "executed_by_application" | "ready_for_revalidation";
}> {
  const stored = loadActionRecord(input.proposalId);
  if (!stored) throw new Error("missing_persisted_action_context");

  const review = await deps.control.getReview(input.reviewId);
  if (review.status !== "approved") {
    return { applicationState: "permanently_stopped" };
  }

  const proposal = await deps.loadImmutableProposal(input.proposalId);
  const signals = await deps.deriveTrustedRefundSignals(input.proposalId);
  const reloaded = {
    ...stored.context,
    parameters: {
      amount_cents: proposal.amountCents,
      customer_ref: proposal.customerRef,
      transaction_ref: proposal.transactionRef,
    },
    proposalVersion: proposal.proposalVersion,
    signals,
  };

  const expectedActionRef = stored.actionRef ?? review.actionRef;
  assertTerminalReviewBound({
    bindingSecret: input.bindingSecret,
    expectedActionRef,
    expectedBinding: stored.actionBinding,
    reloadedContext: reloaded,
    review,
  });

  if (review.actionRef != null && stored.actionRef == null) {
    persistActionRecord({ ...stored, actionRef: review.actionRef });
  }

  if (!(await deps.applicationAuthorizesRefund(proposal))) {
    return { applicationState: "permanently_stopped" };
  }

  const provider = await deps.callPaymentProvider(proposal);
  await deps.recordDownstreamOutcome({ proposalId: input.proposalId, provider });
  await deps.enqueueMetadataOnlyReplay({
    actionName: SUPPORT_REFUND_ACTION,
    outcome: "executed",
    proposalId: input.proposalId,
  });
  return { applicationState: "executed_by_application" };
}
