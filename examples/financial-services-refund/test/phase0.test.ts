import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTION_CONTEXT_SCHEMA_VERSION,
  createActionBinding,
  type ActionContext,
  type ControlReviewRecord,
} from "@turnkeeper/sdk";

import {
  clearActionRecords,
  loadActionRecord,
  parseActionContext,
  persistActionRecord,
  serializeActionContext,
} from "../src/actionContextStore.ts";
import {
  assertTerminalReviewBound,
  buildSupportRefundActionContext,
  checkSupportRefund,
  resumeApprovedRefund,
  type HostedRefundDeps,
} from "../src/hostedIntegration.ts";
import { buildActionContext, evaluateSupportRefund } from "../src/index.ts";
import {
  assertProposalSignalConsistency,
  validateSupportRefundProposal,
  validateSupportRefundSignals,
} from "../src/validation.ts";

const BINDING_SECRET = "synthetic-test-only-binding-secret-000001";

const validProposal = {
  amountCents: 50_000,
  customerRef: "cus_29F8",
  transactionRef: "txn_84K2M",
};

const validSignals = {
  amount_cents: 50_000,
  customer_verified: true,
  prior_refunds_30d: 1,
  refund_preflight_complete: true,
  within_refund_window: true,
};

test("validates positive integer cents, opaque refs, and exact signal shapes", () => {
  assert.equal(validateSupportRefundProposal(validProposal).ok, true);
  assert.equal(validateSupportRefundSignals(validSignals).ok, true);

  assert.equal(validateSupportRefundProposal({ ...validProposal, amountCents: 0 }).ok, false);
  assert.equal(validateSupportRefundProposal({ ...validProposal, amountCents: 12.5 }).ok, false);
  assert.equal(
    validateSupportRefundProposal({ ...validProposal, customerRef: "Customer Alice" }).ok,
    false,
  );

  const withThreshold = validateSupportRefundSignals({
    ...validSignals,
    amount_threshold_cents: 25_000,
  });
  assert.equal(withThreshold.ok, false);

  const missingKey = validateSupportRefundSignals({
    amount_cents: 50_000,
    customer_verified: true,
    prior_refunds_30d: 1,
    refund_preflight_complete: true,
  });
  assert.equal(missingKey.ok, false);
});

test("rejects proposal/signal amount inconsistency", () => {
  assert.throws(
    () =>
      assertProposalSignalConsistency(
        { ...validProposal, amountCents: 50_001 },
        validSignals,
      ),
    /proposal_signal_amount_mismatch/u,
  );
});

test("persists and reloads ActionContext without drift", () => {
  const context = buildActionContext(validProposal, validSignals, ["support_agent"]);
  const serialized = serializeActionContext(context);
  const reloaded = parseActionContext(serialized);
  assert.deepEqual(reloaded, context);
  assert.equal(reloaded.schemaVersion, ACTION_CONTEXT_SCHEMA_VERSION);
});

test("binds terminal reviews to review.actionRef and rebound ActionContext", () => {
  const context = buildActionContext(validProposal, validSignals, ["support_agent"]);
  const actionBinding = createActionBinding(context, BINDING_SECRET);
  const actionRef = "act_demo_refund_bound_01";
  const review: ControlReviewRecord = {
    actionRef,
    conversationExternalId: null,
    id: "rev_demo_00000000000000000000000000000001",
    policy: null,
    priority: 700,
    requestedAt: "2026-07-26T15:44:02.000Z",
    requestId: "req_demo_00000000000000000000000000000001",
    resolution: {
      decidedAt: "2026-07-26T15:45:00.000Z",
      outcomeCode: "approved",
      reasonCode: "reviewer_approved",
    },
    sourceEventId: null,
    status: "approved",
    traceId: null,
    turnExternalId: null,
    version: 1,
    workflow: "support.refund",
  };

  assert.doesNotThrow(() =>
    assertTerminalReviewBound({
      bindingSecret: BINDING_SECRET,
      expectedActionRef: actionRef,
      expectedBinding: actionBinding,
      reloadedContext: context,
      review,
    }),
  );

  assert.throws(
    () =>
      assertTerminalReviewBound({
        bindingSecret: BINDING_SECRET,
        expectedActionRef: "act_other",
        expectedBinding: actionBinding,
        reloadedContext: context,
        review,
      }),
    /review_action_ref_mismatch/u,
  );

  const mutated: ActionContext = {
    ...context,
    parameters: { ...context.parameters, amount_cents: 50_001 },
  };
  assert.throws(
    () =>
      assertTerminalReviewBound({
        bindingSecret: BINDING_SECRET,
        expectedActionRef: actionRef,
        expectedBinding: actionBinding,
        reloadedContext: mutated,
        review,
      }),
    /proposal_binding_mismatch/u,
  );
});

test("hosted check path persists ActionContext and resume requires approved bound review", async () => {
  clearActionRecords();
  const context = buildSupportRefundActionContext({
    actor: { actorId: "actor_fs_demo", roles: ["support_agent"], subjectId: "subject_fs_demo" },
    conversationId: "conversation_fs_demo",
    proposal: validProposal,
    proposalVersion: 1,
    scope: { environment: "test", projectId: "project_fs_demo", tenantId: "tenant_fs_demo" },
    signals: validSignals,
    turnId: "turn_fs_demo",
  });
  const actionBinding = createActionBinding(context, BINDING_SECRET);
  const actionRef = "act_demo_refund_bound_01";
  const reviewId = "rev_demo_00000000000000000000000000000001";

  const deps: HostedRefundDeps = {
    applicationAuthorizesRefund: async () => true,
    callPaymentProvider: async () => ({ providerRef: "provider_ref_demo_01" }),
    control: {
      check: async () => ({
        actionBinding,
        checkId: "chk_demo_01",
        decision: "review",
        evidence: null,
        idempotencyKey: `tk-check-${actionBinding}`,
        matched: true,
        reasonCode: "refund_amount_review",
        requestId: "req_demo_01",
        review: { id: reviewId, status: "open", version: 1 },
        source: "turnkeeper",
      }),
      getReview: async () => ({
        actionRef,
        conversationExternalId: null,
        id: reviewId,
        policy: null,
        priority: 700,
        requestedAt: "2026-07-26T15:44:02.000Z",
        requestId: "req_demo_01",
        resolution: {
          decidedAt: "2026-07-26T15:45:00.000Z",
          outcomeCode: "approved",
          reasonCode: "reviewer_approved",
        },
        sourceEventId: null,
        status: "approved",
        traceId: null,
        turnExternalId: null,
        version: 1,
        workflow: "support.refund",
      }),
    },
    deriveTrustedRefundSignals: async () => validSignals,
    enqueueMetadataOnlyReplay: async () => undefined,
    loadImmutableProposal: async () => ({ ...validProposal, proposalVersion: 1 }),
    persistExactProposal: async () => ({ proposalId: "prop_demo_01", proposalVersion: 1 }),
    recordDownstreamOutcome: async () => undefined,
  };

  const checked = await checkSupportRefund(deps, {
    actor: { actorId: "actor_fs_demo", roles: ["support_agent"], subjectId: "subject_fs_demo" },
    bindingSecret: BINDING_SECRET,
    conversationId: "conversation_fs_demo",
    proposal: validProposal,
    scope: { environment: "test", projectId: "project_fs_demo", tenantId: "tenant_fs_demo" },
    turnId: "turn_fs_demo",
  });
  assert.equal(checked.applicationState, "held_for_review");
  const stored = loadActionRecord("prop_demo_01");
  assert.ok(stored);
  assert.equal(stored.actionBinding, actionBinding);
  assert.equal(stored.reviewId, reviewId);

  persistActionRecord({ ...stored, actionRef });

  const resumed = await resumeApprovedRefund(deps, {
    bindingSecret: BINDING_SECRET,
    proposalId: "prop_demo_01",
    reviewId,
  });
  assert.equal(resumed.applicationState, "executed_by_application");
});

test("local simulation still evaluates high-value refund to review", () => {
  const result = evaluateSupportRefund(validProposal, validSignals, ["support_agent"], BINDING_SECRET);
  assert.equal(result.decision, "review");
  assert.equal(result.reasonCode, "refund_amount_review");
});
