import { pathToFileURL } from "node:url";

import {
  ACTION_CONTEXT_SCHEMA_VERSION,
  POLICY_SCHEMA_VERSION,
  simulateAction,
  type ActionContext,
  type PolicyBundle,
  type PolicyDecision,
} from "@turnkeeper/sdk";

export const ACCOUNT_CONTACT_CHANGE_ACTION = "account.contact_information.change";
export const RECENT_PROFILE_CHANGES_THRESHOLD = 3;

export type AccountChangeSignals = {
  account_restriction_present: boolean;
  customer_verified: boolean;
  preflight_complete: boolean;
  recent_profile_changes: number;
  requested_channel: string;
  step_up_complete: boolean;
};

export type ScenarioId =
  | "verified-low-risk"
  | "missing-step-up"
  | "restricted-account"
  | "excessive-changes"
  | "incomplete-preflight";

export type ScenarioFixture = {
  expectedDecision: PolicyDecision;
  expectedMatchedRuleCode: string | null;
  expectedReasonCode: string;
  id: ScenarioId;
  name: string;
  signals: AccountChangeSignals;
};

/**
 * Local PolicyBundle correlated to hosted account.contact_information.change templates.
 * Preflight uses priority 1 so the always→block fallback does not win when complete.
 */
export const accountContactChangeBundle: PolicyBundle = {
  actionName: ACCOUNT_CONTACT_CHANGE_ACTION,
  allowedRoles: ["support_agent"],
  approvalRequired: false,
  parameterRestrictions: [
    { kind: "required", parameter: "account_ref" },
    { kind: "required", parameter: "requested_channel" },
  ],
  policies: [
    {
      decision: "block",
      description: "Blocks when step_up_complete is false.",
      name: "Missing step-up authentication",
      operator: "equals",
      priority: 1000,
      reasonCode: "step_up_required",
      ruleCode: "account.contact_information.change.missing_step_up",
      signalKey: "step_up_complete",
      signalValue: "false",
      status: "active",
      valueType: "boolean",
      workflow: ACCOUNT_CONTACT_CHANGE_ACTION,
    },
    {
      decision: "review",
      description: "Requires review when account_restriction_present is true.",
      name: "Account restriction present",
      operator: "equals",
      priority: 800,
      reasonCode: "account_restriction_review",
      ruleCode: "account.contact_information.change.restriction_present",
      signalKey: "account_restriction_present",
      signalValue: "true",
      status: "active",
      valueType: "boolean",
      workflow: ACCOUNT_CONTACT_CHANGE_ACTION,
    },
    {
      decision: "review",
      description: "Requires review when recent_profile_changes reaches threshold.",
      name: "Excessive recent profile changes",
      operator: "gte",
      priority: 700,
      reasonCode: "excessive_profile_changes",
      ruleCode: "account.contact_information.change.excessive_recent_changes",
      signalKey: "recent_profile_changes",
      signalValue: String(RECENT_PROFILE_CHANGES_THRESHOLD),
      status: "active",
      valueType: "number",
      workflow: ACCOUNT_CONTACT_CHANGE_ACTION,
    },
    {
      decision: "audit",
      description: "Records preflight when preflight_complete is true.",
      name: "Contact change preflight complete",
      operator: "equals",
      priority: 1,
      reasonCode: "contact_change_preflight_observed",
      ruleCode: "account.contact_information.change.preflight_complete",
      signalKey: "preflight_complete",
      signalValue: "true",
      status: "active",
      valueType: "boolean",
      workflow: ACCOUNT_CONTACT_CHANGE_ACTION,
    },
    {
      decision: "block",
      description: "Local fail-closed fallback.",
      name: "No policy match",
      operator: "always",
      priority: 0,
      reasonCode: "no_policy_match",
      ruleCode: "account.contact_information.change.no_policy_match",
      signalKey: "",
      signalValue: "",
      status: "active",
      valueType: "string",
      workflow: ACCOUNT_CONTACT_CHANGE_ACTION,
    },
  ],
  riskLevel: "medium",
  schemaVersion: POLICY_SCHEMA_VERSION,
};

export const SCENARIOS: readonly ScenarioFixture[] = Object.freeze([
  {
    expectedDecision: "audit",
    expectedMatchedRuleCode: "account.contact_information.change.preflight_complete",
    expectedReasonCode: "contact_change_preflight_observed",
    id: "verified-low-risk",
    name: "Verified low-risk change",
    signals: {
      account_restriction_present: false,
      customer_verified: true,
      preflight_complete: true,
      recent_profile_changes: 1,
      requested_channel: "email_update",
      step_up_complete: true,
    },
  },
  {
    expectedDecision: "block",
    expectedMatchedRuleCode: "account.contact_information.change.missing_step_up",
    expectedReasonCode: "step_up_required",
    id: "missing-step-up",
    name: "Missing step-up authentication",
    signals: {
      account_restriction_present: false,
      customer_verified: true,
      preflight_complete: true,
      recent_profile_changes: 0,
      requested_channel: "phone_update",
      step_up_complete: false,
    },
  },
  {
    expectedDecision: "review",
    expectedMatchedRuleCode: "account.contact_information.change.restriction_present",
    expectedReasonCode: "account_restriction_review",
    id: "restricted-account",
    name: "Restricted account",
    signals: {
      account_restriction_present: true,
      customer_verified: true,
      preflight_complete: true,
      recent_profile_changes: 1,
      requested_channel: "email_update",
      step_up_complete: true,
    },
  },
  {
    expectedDecision: "review",
    expectedMatchedRuleCode: "account.contact_information.change.excessive_recent_changes",
    expectedReasonCode: "excessive_profile_changes",
    id: "excessive-changes",
    name: "Excessive recent changes",
    signals: {
      account_restriction_present: false,
      customer_verified: true,
      preflight_complete: true,
      recent_profile_changes: 4,
      requested_channel: "mailing_update",
      step_up_complete: true,
    },
  },
  {
    expectedDecision: "block",
    expectedMatchedRuleCode: "account.contact_information.change.no_policy_match",
    expectedReasonCode: "no_policy_match",
    id: "incomplete-preflight",
    name: "Incomplete preflight",
    signals: {
      account_restriction_present: false,
      customer_verified: true,
      preflight_complete: false,
      recent_profile_changes: 1,
      requested_channel: "email_update",
      step_up_complete: true,
    },
  },
]);

function buildActionContext(
  signals: AccountChangeSignals,
  actorRoles: string[],
): ActionContext {
  return {
    actionName: ACCOUNT_CONTACT_CHANGE_ACTION,
    actorId: "actor_acct_demo",
    actorRoles,
    conversationId: "conversation_acct_demo",
    environment: "test",
    parameters: {
      account_ref: "acct_29F8",
      requested_channel: signals.requested_channel,
    },
    projectId: "project_acct_demo",
    proposalVersion: 1,
    schemaVersion: ACTION_CONTEXT_SCHEMA_VERSION,
    signals,
    tenantId: "tenant_acct_demo",
    turnId: "turn_acct_demo",
    userId: "subject_acct_demo",
  };
}

export function evaluateAccountContactChange(
  signals: AccountChangeSignals,
  actorRoles: string[] = ["support_agent"],
  bindingSecret = process.env.TURNKEEPER_BINDING_SECRET,
) {
  if (!bindingSecret) throw new Error("TURNKEEPER_BINDING_SECRET is required.");
  const result = simulateAction(
    accountContactChangeBundle,
    buildActionContext(signals, actorRoles),
    { bindingSecret },
  );
  return {
    actionBinding: result.actionBinding,
    decision: result.decision,
    matchedPolicyRuleCode: result.matchedPolicy?.ruleCode ?? null,
    reasonCode: result.reasonCode,
    source: result.source,
  } as const;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const results = SCENARIOS.map((scenario) => ({
    id: scenario.id,
    ...evaluateAccountContactChange(scenario.signals),
  }));
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
}
