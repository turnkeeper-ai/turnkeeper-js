import assert from "node:assert/strict";
import test from "node:test";

import {
  TurnkeeperValidationError,
  assertValidReplayBatch,
  validateReplayBatch,
} from "@turnkeeper/sdk";

import {
  MODEL_CODE,
  SCENARIOS,
  buildSafeguardReplayBatch,
  buildSafeguardSignals,
  evaluateSafeguardSafety,
  normalizeSafeguardResult,
} from "../src/index.ts";

const BINDING_SECRET = "synthetic-test-only-binding-secret-000001";
const CANARY = "person@example.com";

test("model.output.safety scenarios match expected decisions", () => {
  assert.equal(SCENARIOS.length, 3);
  for (const scenario of SCENARIOS) {
    const result = evaluateSafeguardSafety(scenario.safeguard, ["model_runtime"], BINDING_SECRET);
    assert.equal(result.decision, scenario.expectedDecision, scenario.id);
    assert.equal(result.reasonCode, scenario.expectedReasonCode, scenario.id);
    assert.equal(result.matchedPolicy?.ruleCode ?? null, scenario.expectedMatchedRuleCode, scenario.id);
  }
});

test("unavailable classification blocks before violation review", () => {
  const result = evaluateSafeguardSafety(
    {
      violation: true,
      category: "financial_advice",
      requires_review: true,
      classification_state: "unavailable",
    },
    ["model_runtime"],
    BINDING_SECRET,
  );
  assert.equal(result.decision, "block");
  assert.equal(result.reasonCode, "classification_unavailable");
});

test("buildSafeguardReplayBatch validates metadata-only self_hosted lifecycle", () => {
  const batch = buildSafeguardReplayBatch({
    decisionCode: "classification_available",
    outcomeCode: "audit_recorded",
  });
  assert.equal(batch.events.length, 3);
  const modelEvent = batch.events[1];
  assert.equal(modelEvent?.type, "model.completed");
  assert.equal(modelEvent?.data.provider, "self_hosted");
  assert.equal(modelEvent?.data.model, MODEL_CODE);
  assert.doesNotThrow(() =>
    assertValidReplayBatch(batch, {
      now: new Date("2026-07-12T12:05:00.000Z"),
      retentionDays: 30,
    }),
  );
});

test("replay payloads and validation errors omit content canaries", () => {
  const batch = buildSafeguardReplayBatch({
    decisionCode: "classification_available",
    outcomeCode: "audit_recorded",
  });
  assert.equal(JSON.stringify(batch).includes(CANARY), false);

  const invalid = validateReplayBatch(
    {
      events: [
        {
          ...batch.events[0],
          data: { ...batch.events[0]!.data, reason_code: CANARY },
        },
      ],
    },
    { now: new Date("2026-07-12T12:05:00.000Z"), retentionDays: 30 },
  );
  assert.equal(invalid.ok && invalid.events[0]?.ok, false);
  assert.equal(JSON.stringify(invalid).includes(CANARY), false);

  assert.throws(
    () =>
      assertValidReplayBatch(
        {
          events: [
            {
              ...batch.events[0],
              data: { message: CANARY },
            },
          ],
        },
        { now: new Date("2026-07-12T12:05:00.000Z") },
      ),
    (error: unknown) => {
      assert.ok(error instanceof TurnkeeperValidationError);
      assert.equal(JSON.stringify(error).includes(CANARY), false);
      return true;
    },
  );
});

test("normalizeSafeguardResult preserves bounded scalar fields only", () => {
  const signals = buildSafeguardSignals(
    normalizeSafeguardResult({
      violation: false,
      category: "none",
      requires_review: false,
      classification_state: "available",
    }),
  );
  assert.equal(signals.safeguard_violation, false);
  assert.equal(signals.classification_state, "available");
  assert.equal(signals.model_family, "gpt_oss");
  assert.equal(signals.model_variant, "20b");
  assert.equal(signals.model_revision, "support_v1");
  assert.equal(JSON.stringify(signals).includes(CANARY), false);
});
