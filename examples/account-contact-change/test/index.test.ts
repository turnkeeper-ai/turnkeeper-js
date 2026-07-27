import assert from "node:assert/strict";
import test from "node:test";

import { SCENARIOS, evaluateAccountContactChange } from "../src/index.ts";

const BINDING_SECRET = "synthetic-test-only-binding-secret-000001";

test("account.contact_information.change scenarios match expected decisions", () => {
  assert.equal(SCENARIOS.length, 5);
  for (const scenario of SCENARIOS) {
    const result = evaluateAccountContactChange(scenario.signals, ["support_agent"], BINDING_SECRET);
    assert.equal(result.decision, scenario.expectedDecision, scenario.id);
    assert.equal(result.reasonCode, scenario.expectedReasonCode, scenario.id);
    assert.equal(result.matchedPolicyRuleCode, scenario.expectedMatchedRuleCode, scenario.id);
    assert.equal(typeof result.actionBinding, "string");
    assert.ok(result.actionBinding.length >= 32);
  }
});
