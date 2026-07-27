import { pathToFileURL } from "node:url";

import {
  ACTION_CONTEXT_SCHEMA_VERSION,
  POLICY_SCHEMA_VERSION,
  simulateAction,
  type ActionContext,
  type PolicyBundle,
  type PolicyDecision,
} from "@turnkeeper/sdk";

export const SUPPORT_ESCALATION_ACTION = "support.escalation";

export type SupportEscalationSignals = {
  agent_authorized: boolean;
  approval_required: boolean;
  escalation_preflight_complete: boolean;
  escalation_tier: string;
};

export type ScenarioId = "routine-recorded" | "approval-required" | "unauthorized-agent";

export type ScenarioFixture = {
  expectedDecision: PolicyDecision;
  expectedMatchedRuleCode: string | null;
  expectedReasonCode: string;
  id: ScenarioId;
  name: string;
  signals: SupportEscalationSignals;
};

export const supportEscalationBundle: PolicyBundle = {
  actionName: SUPPORT_ESCALATION_ACTION,
  allowedRoles: ["support_agent"],
  approvalRequired: false,
  parameterRestrictions: [{ kind: "required", parameter: "case_ref" }],
  policies: [
    {
      decision: "block",
      description: "Blocks escalation when agent_authorized is false.",
      name: "Agent not authorized",
      operator: "equals",
      priority: 1000,
      reasonCode: "agent_not_authorized",
      ruleCode: "support.escalation.agent_not_authorized",
      signalKey: "agent_authorized",
      signalValue: "false",
      status: "active",
      valueType: "boolean",
      workflow: SUPPORT_ESCALATION_ACTION,
    },
    {
      decision: "review",
      description: "Requires review when approval_required is true.",
      name: "Escalation approval required",
      operator: "equals",
      priority: 800,
      reasonCode: "escalation_approval_required",
      ruleCode: "support.escalation.escalation_approval_required",
      signalKey: "approval_required",
      signalValue: "true",
      status: "active",
      valueType: "boolean",
      workflow: SUPPORT_ESCALATION_ACTION,
    },
    {
      decision: "audit",
      description: "Records escalation preflight when complete.",
      name: "Escalation preflight observed",
      operator: "equals",
      priority: 1,
      reasonCode: "escalation_preflight_observed",
      ruleCode: "support.escalation.escalation_preflight_observed",
      signalKey: "escalation_preflight_complete",
      signalValue: "true",
      status: "active",
      valueType: "boolean",
      workflow: SUPPORT_ESCALATION_ACTION,
    },
    {
      decision: "block",
      description: "Local fail-closed fallback.",
      name: "No policy match",
      operator: "always",
      priority: 0,
      reasonCode: "no_policy_match",
      ruleCode: "support.escalation.no_policy_match",
      signalKey: "",
      signalValue: "",
      status: "active",
      valueType: "string",
      workflow: SUPPORT_ESCALATION_ACTION,
    },
  ],
  riskLevel: "medium",
  schemaVersion: POLICY_SCHEMA_VERSION,
};

export const SCENARIOS: readonly ScenarioFixture[] = Object.freeze([
  {
    expectedDecision: "audit",
    expectedMatchedRuleCode: "support.escalation.escalation_preflight_observed",
    expectedReasonCode: "escalation_preflight_observed",
    id: "routine-recorded",
    name: "Routine recorded escalation",
    signals: {
      agent_authorized: true,
      approval_required: false,
      escalation_preflight_complete: true,
      escalation_tier: "tier_1",
    },
  },
  {
    expectedDecision: "review",
    expectedMatchedRuleCode: "support.escalation.escalation_approval_required",
    expectedReasonCode: "escalation_approval_required",
    id: "approval-required",
    name: "Approval-required escalation",
    signals: {
      agent_authorized: true,
      approval_required: true,
      escalation_preflight_complete: true,
      escalation_tier: "tier_2",
    },
  },
  {
    expectedDecision: "block",
    expectedMatchedRuleCode: "support.escalation.agent_not_authorized",
    expectedReasonCode: "agent_not_authorized",
    id: "unauthorized-agent",
    name: "Unauthorized agent",
    signals: {
      agent_authorized: false,
      approval_required: false,
      escalation_preflight_complete: true,
      escalation_tier: "tier_1",
    },
  },
]);

export function buildActionContext(
  signals: SupportEscalationSignals,
  actorRoles: string[],
): ActionContext {
  return {
    actionName: SUPPORT_ESCALATION_ACTION,
    actorId: "actor_esc_demo",
    actorRoles,
    conversationId: "conversation_esc_demo",
    environment: "test",
    parameters: { case_ref: "case_44P1" },
    projectId: "project_esc_demo",
    proposalVersion: 1,
    schemaVersion: ACTION_CONTEXT_SCHEMA_VERSION,
    signals,
    tenantId: "tenant_esc_demo",
    turnId: "turn_esc_demo",
    userId: "subject_esc_demo",
  };
}

export function evaluateSupportEscalation(
  signals: SupportEscalationSignals,
  actorRoles: string[] = ["support_agent"],
  bindingSecret = process.env.TURNKEEPER_BINDING_SECRET,
) {
  if (!bindingSecret) throw new Error("TURNKEEPER_BINDING_SECRET is required.");
  return simulateAction(supportEscalationBundle, buildActionContext(signals, actorRoles), {
    bindingSecret,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const results = SCENARIOS.map((scenario) => ({
    id: scenario.id,
    ...evaluateSupportEscalation(scenario.signals),
  }));
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
}
