import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

import {
  ACTION_CONTEXT_SCHEMA_VERSION,
  POLICY_SCHEMA_VERSION,
  REPLAY_API_VERSION,
  simulateAction,
  validateReplayBatch,
  type ActionContext,
  type OpaqueReplayId,
  type PolicyBundle,
  type PolicyDecision,
  type ReplayBatch,
  type ReplayEvent,
} from "@turnkeeper/sdk";

export const MODEL_OUTPUT_SAFETY_ACTION = "model.output.safety";

export const MODEL_FAMILY = "gpt_oss";
export const MODEL_VARIANT = "20b";
export const MODEL_REVISION = "support_v1";
export const MODEL_CODE = `${MODEL_FAMILY}.${MODEL_VARIANT}.${MODEL_REVISION}`;

export type ClassificationState = "available" | "unavailable";

export type SafeguardResult = {
  violation: boolean;
  category: string | null;
  requires_review: boolean;
  classification_state?: ClassificationState;
};

export type SafeguardSignals = {
  classification_state: ClassificationState;
  model_family: string;
  model_revision: string;
  model_variant: string;
  safeguard_category: string;
  safeguard_requires_review: boolean;
  safeguard_violation: boolean;
};

export type ScenarioId = "safe-audit" | "violation-review" | "unavailable-block";

export type ScenarioFixture = {
  expectedDecision: PolicyDecision;
  expectedMatchedRuleCode: string | null;
  expectedReasonCode: string;
  id: ScenarioId;
  name: string;
  safeguard: SafeguardResult;
};

function opaqueFromSeed(seed: string): OpaqueReplayId {
  return createHash("sha256").update(seed).digest("hex") as OpaqueReplayId;
}

export function normalizeSafeguardResult(result: SafeguardResult): SafeguardResult {
  return {
    violation: result.violation,
    category: result.category,
    requires_review: result.requires_review,
    ...(result.classification_state === undefined
      ? {}
      : { classification_state: result.classification_state }),
  };
}

export function buildSafeguardSignals(result: SafeguardResult): SafeguardSignals {
  const normalized = normalizeSafeguardResult(result);
  const classificationState = normalized.classification_state ?? "available";
  return {
    classification_state: classificationState,
    model_family: MODEL_FAMILY,
    model_revision: MODEL_REVISION,
    model_variant: MODEL_VARIANT,
    safeguard_category: normalized.category ?? "none",
    safeguard_requires_review: normalized.requires_review,
    safeguard_violation: normalized.violation,
  };
}

export const safeguardSafetyBundle: PolicyBundle = {
  actionName: MODEL_OUTPUT_SAFETY_ACTION,
  allowedRoles: ["model_runtime"],
  approvalRequired: false,
  parameterRestrictions: [],
  policies: [
    {
      decision: "block",
      description: "Blocks when classification is unavailable.",
      name: "Classification unavailable",
      operator: "equals",
      priority: 1000,
      reasonCode: "classification_unavailable",
      ruleCode: "model.output.safety.classification_unavailable",
      signalKey: "classification_state",
      signalValue: "unavailable",
      status: "active",
      valueType: "string",
      workflow: MODEL_OUTPUT_SAFETY_ACTION,
    },
    {
      decision: "review",
      description: "Requires review when safeguard reports a violation.",
      name: "Safeguard violation",
      operator: "equals",
      priority: 800,
      reasonCode: "safeguard_violation",
      ruleCode: "model.output.safety.safeguard_violation",
      signalKey: "safeguard_violation",
      signalValue: "true",
      status: "active",
      valueType: "boolean",
      workflow: MODEL_OUTPUT_SAFETY_ACTION,
    },
    {
      decision: "audit",
      description: "Records safe output when classification is available.",
      name: "Classification available",
      operator: "equals",
      priority: 1,
      reasonCode: "classification_available",
      ruleCode: "model.output.safety.classification_available",
      signalKey: "classification_state",
      signalValue: "available",
      status: "active",
      valueType: "string",
      workflow: MODEL_OUTPUT_SAFETY_ACTION,
    },
    {
      decision: "block",
      description: "Local fail-closed fallback.",
      name: "No policy match",
      operator: "always",
      priority: 0,
      reasonCode: "no_policy_match",
      ruleCode: "model.output.safety.no_policy_match",
      signalKey: "",
      signalValue: "",
      status: "active",
      valueType: "string",
      workflow: MODEL_OUTPUT_SAFETY_ACTION,
    },
  ],
  riskLevel: "medium",
  schemaVersion: POLICY_SCHEMA_VERSION,
};

export const SCENARIOS: readonly ScenarioFixture[] = Object.freeze([
  {
    expectedDecision: "audit",
    expectedMatchedRuleCode: "model.output.safety.classification_available",
    expectedReasonCode: "classification_available",
    id: "safe-audit",
    name: "Available classification with no violation",
    safeguard: {
      violation: false,
      category: null,
      requires_review: false,
      classification_state: "available",
    },
  },
  {
    expectedDecision: "review",
    expectedMatchedRuleCode: "model.output.safety.safeguard_violation",
    expectedReasonCode: "safeguard_violation",
    id: "violation-review",
    name: "Safeguard violation",
    safeguard: {
      violation: true,
      category: "financial_advice",
      requires_review: true,
      classification_state: "available",
    },
  },
  {
    expectedDecision: "block",
    expectedMatchedRuleCode: "model.output.safety.classification_unavailable",
    expectedReasonCode: "classification_unavailable",
    id: "unavailable-block",
    name: "Classification unavailable",
    safeguard: {
      violation: false,
      category: null,
      requires_review: false,
      classification_state: "unavailable",
    },
  },
]);

export function buildActionContext(
  signals: SafeguardSignals,
  actorRoles: string[],
): ActionContext {
  return {
    actionName: MODEL_OUTPUT_SAFETY_ACTION,
    actorId: "actor_safeguard_demo",
    actorRoles,
    conversationId: "conversation_safeguard_demo",
    environment: "test",
    parameters: {},
    projectId: "project_safeguard_demo",
    proposalVersion: 1,
    schemaVersion: ACTION_CONTEXT_SCHEMA_VERSION,
    signals,
    tenantId: "tenant_safeguard_demo",
    turnId: "turn_safeguard_demo",
    userId: "subject_safeguard_demo",
  };
}

export function evaluateSafeguardSafety(
  safeguard: SafeguardResult,
  actorRoles: string[] = ["model_runtime"],
  bindingSecret = process.env.TURNKEEPER_BINDING_SECRET,
) {
  if (!bindingSecret) throw new Error("TURNKEEPER_BINDING_SECRET is required.");
  return simulateAction(
    safeguardSafetyBundle,
    buildActionContext(buildSafeguardSignals(safeguard), actorRoles),
    { bindingSecret },
  );
}

function replayPrivacy() {
  return { mode: "metadata_only" as const, key_version: 1 };
}

export function buildSafeguardReplayBatch(input: {
  decisionCode: string;
  outcomeCode: string;
  now?: Date;
}): ReplayBatch {
  const conversationExternalId = opaqueFromSeed("conversation_safeguard_demo");
  const turnExternalId = opaqueFromSeed("turn_safeguard_demo");
  const traceId = opaqueFromSeed("trace_safeguard_demo");
  const startedSourceEventId = opaqueFromSeed("event_safeguard_started");
  const modelSourceEventId = opaqueFromSeed("event_safeguard_model_completed");
  const completedSourceEventId = opaqueFromSeed("event_safeguard_completed");

  const events: ReplayEvent[] = [
    {
      api_version: REPLAY_API_VERSION,
      source_event_id: startedSourceEventId,
      type: "turn.started",
      occurred_at: "2026-07-12T11:59:59.000Z",
      conversation_external_id: conversationExternalId,
      turn_external_id: turnExternalId,
      turn_index: 0,
      event_index: 0,
      parent_source_event_id: null,
      trace_id: traceId,
      data: {
        bot_type: "seller",
        channel: "simulator",
        decision_code: "workflow.start",
      },
      privacy: replayPrivacy(),
    },
    {
      api_version: REPLAY_API_VERSION,
      source_event_id: modelSourceEventId,
      type: "model.completed",
      occurred_at: "2026-07-12T12:00:00.000Z",
      conversation_external_id: conversationExternalId,
      turn_external_id: turnExternalId,
      turn_index: 0,
      event_index: 1,
      parent_source_event_id: startedSourceEventId,
      trace_id: traceId,
      data: {
        provider: "self_hosted",
        model: MODEL_CODE,
        input_tokens: 120,
        output_tokens: 48,
        latency_ms: 250,
        fallback: false,
      },
      privacy: replayPrivacy(),
    },
    {
      api_version: REPLAY_API_VERSION,
      source_event_id: completedSourceEventId,
      type: "turn.decision_recorded",
      occurred_at: "2026-07-12T12:00:01.000Z",
      conversation_external_id: conversationExternalId,
      turn_external_id: turnExternalId,
      turn_index: 0,
      event_index: 2,
      parent_source_event_id: modelSourceEventId,
      trace_id: traceId,
      data: {
        decision_code: input.decisionCode,
        outcome_code: input.outcomeCode,
        reason_code: input.outcomeCode,
      },
      privacy: replayPrivacy(),
    },
  ];

  const batch: ReplayBatch = { events };
  const validation = validateReplayBatch(batch, {
    now: input.now ?? new Date("2026-07-12T12:05:00.000Z"),
    retentionDays: 30,
  });
  if (!validation.ok || !validation.events.every((event) => event.ok)) {
    throw new Error("invalid_replay_batch");
  }
  return batch;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const results = SCENARIOS.map((scenario) => ({
    id: scenario.id,
    ...evaluateSafeguardSafety(scenario.safeguard),
  }));
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
}
