import { pathToFileURL } from "node:url";

import {
  ACTION_CONTEXT_SCHEMA_VERSION,
  POLICY_SCHEMA_VERSION,
  simulateAction,
  type ActionContext,
  type PolicyBundle,
  type PolicyDecision,
} from "@turnkeeper/sdk";

export const SUPPORT_REFUND_ACTION = "support.refund";
export const AMOUNT_THRESHOLD_CENTS = 25_000;
export const VELOCITY_THRESHOLD = 3;

export type SupportRefundSignals = {
  amount_cents: number;
  customer_verified: boolean;
  prior_refunds_30d: number;
  refund_preflight_complete: boolean;
  within_refund_window: boolean;
};

export type SupportRefundProposal = {
  amountCents: number;
  customerRef: string;
  transactionRef: string;
};

export type ScenarioId =
  | "eligible-low-value"
  | "high-value-refund"
  | "refund-window-exception"
  | "unverified-customer"
  | "repeated-refund-activity"
  | "incomplete-preflight";

export type ScenarioFixture = {
  expectedDecision: PolicyDecision;
  expectedMatchedRuleCode: string | null;
  expectedReasonCode: string;
  id: ScenarioId;
  name: string;
  proposal: SupportRefundProposal;
  signals: SupportRefundSignals;
};

/**
 * Local PolicyBundle correlated to hosted support.refund templates.
 * Preflight uses priority 1 so the required always→block fallback (priority 0)
 * does not win when refund_preflight_complete is true. Hosted template priority
 * for preflight remains 0; fail-closed unmatched hosted responses use
 * matched:false / no_policy_match without an always policy in the same set.
 */
export const supportRefundBundle: PolicyBundle = {
  actionName: SUPPORT_REFUND_ACTION,
  allowedRoles: ["support_agent"],
  approvalRequired: false,
  parameterRestrictions: [
    { kind: "required", parameter: "amount_cents" },
    { kind: "required", parameter: "transaction_ref" },
    { kind: "required", parameter: "customer_ref" },
    { kind: "max_number", maximum: 1_000_000_000_000, parameter: "amount_cents" },
  ],
  policies: [
    {
      decision: "block",
      description: "Blocks a refund when trusted customer verification is false.",
      name: "Identity verification required",
      operator: "equals",
      priority: 1000,
      reasonCode: "customer_not_verified",
      ruleCode: "support.refund.identity_required",
      signalKey: "customer_verified",
      signalValue: "false",
      status: "active",
      valueType: "boolean",
      workflow: SUPPORT_REFUND_ACTION,
    },
    {
      decision: "review",
      description: "Requires review when the trusted refund window signal is false.",
      name: "Refund-window exception",
      operator: "equals",
      priority: 800,
      reasonCode: "refund_window_exception",
      ruleCode: "support.refund.window_exception",
      signalKey: "within_refund_window",
      signalValue: "false",
      status: "active",
      valueType: "boolean",
      workflow: SUPPORT_REFUND_ACTION,
    },
    {
      decision: "review",
      description: "Requires review when amount_cents reaches the configured threshold.",
      name: "High-value refund review",
      operator: "gte",
      priority: 700,
      reasonCode: "refund_amount_review",
      ruleCode: "support.refund.amount_threshold",
      signalKey: "amount_cents",
      signalValue: String(AMOUNT_THRESHOLD_CENTS),
      status: "active",
      valueType: "number",
      workflow: SUPPORT_REFUND_ACTION,
    },
    {
      decision: "review",
      description: "Requires review when prior_refunds_30d reaches the configured limit.",
      name: "Refund velocity review",
      operator: "gte",
      priority: 600,
      reasonCode: "refund_velocity_review",
      ruleCode: "support.refund.velocity_threshold",
      signalKey: "prior_refunds_30d",
      signalValue: String(VELOCITY_THRESHOLD),
      status: "active",
      valueType: "number",
      workflow: SUPPORT_REFUND_ACTION,
    },
    {
      decision: "audit",
      description:
        "Records successful trusted preflight. Observational only—not refund authorization.",
      name: "Refund preflight complete",
      operator: "equals",
      priority: 1,
      reasonCode: "refund_preflight_observed",
      ruleCode: "support.refund.preflight_complete",
      signalKey: "refund_preflight_complete",
      signalValue: "true",
      status: "active",
      valueType: "boolean",
      workflow: SUPPORT_REFUND_ACTION,
    },
    {
      decision: "block",
      description: "Local fail-closed fallback when no support.refund policy matches.",
      name: "No policy match",
      operator: "always",
      priority: 0,
      reasonCode: "no_policy_match",
      ruleCode: "support.refund.no_policy_match",
      signalKey: "",
      signalValue: "",
      status: "active",
      valueType: "string",
      workflow: SUPPORT_REFUND_ACTION,
    },
  ],
  riskLevel: "medium",
  schemaVersion: POLICY_SCHEMA_VERSION,
};

export const SCENARIOS: readonly ScenarioFixture[] = Object.freeze([
  {
    expectedDecision: "audit",
    expectedMatchedRuleCode: "support.refund.preflight_complete",
    expectedReasonCode: "refund_preflight_observed",
    id: "eligible-low-value",
    name: "Eligible low-value refund",
    proposal: {
      amountCents: 7500,
      customerRef: "cus_29F8",
      transactionRef: "txn_84K2M",
    },
    signals: {
      amount_cents: 7500,
      customer_verified: true,
      prior_refunds_30d: 1,
      refund_preflight_complete: true,
      within_refund_window: true,
    },
  },
  {
    expectedDecision: "review",
    expectedMatchedRuleCode: "support.refund.amount_threshold",
    expectedReasonCode: "refund_amount_review",
    id: "high-value-refund",
    name: "High-value refund",
    proposal: {
      amountCents: 50_000,
      customerRef: "cus_29F8",
      transactionRef: "txn_84K2M",
    },
    signals: {
      amount_cents: 50_000,
      customer_verified: true,
      prior_refunds_30d: 1,
      refund_preflight_complete: true,
      within_refund_window: true,
    },
  },
  {
    expectedDecision: "review",
    expectedMatchedRuleCode: "support.refund.window_exception",
    expectedReasonCode: "refund_window_exception",
    id: "refund-window-exception",
    name: "Refund-window exception",
    proposal: {
      amountCents: 12_000,
      customerRef: "cus_29F8",
      transactionRef: "txn_84K2M",
    },
    signals: {
      amount_cents: 12_000,
      customer_verified: true,
      prior_refunds_30d: 1,
      refund_preflight_complete: true,
      within_refund_window: false,
    },
  },
  {
    expectedDecision: "block",
    expectedMatchedRuleCode: "support.refund.identity_required",
    expectedReasonCode: "customer_not_verified",
    id: "unverified-customer",
    name: "Unverified customer",
    proposal: {
      amountCents: 9000,
      customerRef: "cus_29F8",
      transactionRef: "txn_84K2M",
    },
    signals: {
      amount_cents: 9000,
      customer_verified: false,
      prior_refunds_30d: 0,
      refund_preflight_complete: true,
      within_refund_window: true,
    },
  },
  {
    expectedDecision: "review",
    expectedMatchedRuleCode: "support.refund.velocity_threshold",
    expectedReasonCode: "refund_velocity_review",
    id: "repeated-refund-activity",
    name: "Repeated refund activity",
    proposal: {
      amountCents: 11_000,
      customerRef: "cus_29F8",
      transactionRef: "txn_84K2M",
    },
    signals: {
      amount_cents: 11_000,
      customer_verified: true,
      prior_refunds_30d: 4,
      refund_preflight_complete: true,
      within_refund_window: true,
    },
  },
  {
    expectedDecision: "block",
    expectedMatchedRuleCode: "support.refund.no_policy_match",
    expectedReasonCode: "no_policy_match",
    id: "incomplete-preflight",
    name: "Incomplete preflight",
    proposal: {
      amountCents: 7500,
      customerRef: "cus_29F8",
      transactionRef: "txn_84K2M",
    },
    signals: {
      amount_cents: 7500,
      customer_verified: true,
      prior_refunds_30d: 1,
      refund_preflight_complete: false,
      within_refund_window: true,
    },
  },
]);

export function buildActionContext(
  proposal: SupportRefundProposal,
  signals: SupportRefundSignals,
  actorRoles: string[],
  options: {
    conversationId?: string;
    environment?: ActionContext["environment"];
    projectId?: string;
    proposalVersion?: number;
    tenantId?: string;
    turnId?: string;
    userId?: string;
    actorId?: string;
  } = {},
): ActionContext {
  return {
    actionName: SUPPORT_REFUND_ACTION,
    actorId: options.actorId ?? "actor_fs_demo",
    actorRoles,
    conversationId: options.conversationId ?? "conversation_fs_demo",
    environment: options.environment ?? "test",
    parameters: {
      amount_cents: proposal.amountCents,
      customer_ref: proposal.customerRef,
      transaction_ref: proposal.transactionRef,
    },
    projectId: options.projectId ?? "project_fs_demo",
    proposalVersion: options.proposalVersion ?? 1,
    schemaVersion: ACTION_CONTEXT_SCHEMA_VERSION,
    signals,
    tenantId: options.tenantId ?? "tenant_fs_demo",
    turnId: options.turnId ?? "turn_fs_demo",
    userId: options.userId ?? "subject_fs_demo",
  };
}

export function evaluateSupportRefund(
  proposal: SupportRefundProposal,
  signals: SupportRefundSignals,
  actorRoles: string[] = ["support_agent"],
  bindingSecret = process.env.TURNKEEPER_BINDING_SECRET,
) {
  if (!bindingSecret) throw new Error("TURNKEEPER_BINDING_SECRET is required.");
  const result = simulateAction(
    supportRefundBundle,
    buildActionContext(proposal, signals, actorRoles),
    { bindingSecret },
  );

  const applicationState =
    result.decision === "review"
      ? "held_for_review"
      : result.decision === "block"
        ? "permanently_stopped"
        : "requires_application_authorization";

  return {
    actionBinding: result.actionBinding,
    applicationState,
    decision: result.decision,
    matchedPolicyRuleCode: result.matchedPolicy?.ruleCode ?? null,
    reasonCode: result.reasonCode,
    source: result.source,
  } as const;
}

export function evaluateScenario(
  scenarioId: ScenarioId,
  actorRoles: string[] = ["support_agent"],
  bindingSecret = process.env.TURNKEEPER_BINDING_SECRET,
) {
  const scenario = SCENARIOS.find((item) => item.id === scenarioId);
  if (!scenario) throw new Error(`Unknown scenario: ${scenarioId}`);
  return {
    ...evaluateSupportRefund(scenario.proposal, scenario.signals, actorRoles, bindingSecret),
    scenarioId: scenario.id,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const results = SCENARIOS.map((scenario) => ({
    id: scenario.id,
    ...evaluateSupportRefund(
      scenario.proposal,
      scenario.signals,
      ["support_agent"],
      process.env.TURNKEEPER_BINDING_SECRET,
    ),
  }));
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
}
