import assert from "node:assert/strict";
import test from "node:test";

import { SCENARIOS, evaluateSupportEscalation } from "../src/index.ts";

const BINDING_SECRET = "synthetic-test-only-binding-secret-000001";

test("support.escalation scenarios match expected decisions", () => {
  assert.equal(SCENARIOS.length, 3);
  for (const scenario of SCENARIOS) {
    const result = evaluateSupportEscalation(scenario.signals, ["support_agent"], BINDING_SECRET);
    assert.equal(result.decision, scenario.expectedDecision, scenario.id);
    assert.equal(result.reasonCode, scenario.expectedReasonCode, scenario.id);
    assert.equal(result.matchedPolicy?.ruleCode ?? null, scenario.expectedMatchedRuleCode, scenario.id);
  }
});
