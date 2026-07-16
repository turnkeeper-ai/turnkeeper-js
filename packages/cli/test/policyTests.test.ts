import assert from "node:assert/strict";
import test from "node:test";

import { generatePolicy } from "@turnkeeper/sdk";

import { runPolicyTests } from "../src/index.js";

test("policy tests execute generated cases rather than only printing them", () => {
  const bundle = generatePolicy({
    actionName: "confirm_booking",
    allowedRoles: ["scheduler"],
    approvalRequired: true,
    parameterRestrictions: [{ kind: "required", parameter: "appointment_id" }],
    requiredConditions: [],
    riskLevel: "high",
  });

  const result = runPolicyTests([bundle]);
  assert.equal(result.passed, true);
  assert.equal(result.failed, 0);
  assert.ok(result.executed >= 2);
});

test("invalid bundles fail without pretending that zero cases passed", () => {
  const result = runPolicyTests([{ actionName: "unsafe" }]);
  assert.equal(result.passed, false);
  assert.equal(result.executed, 0);
  assert.equal(result.failures[0]?.code, "invalid_bundle");
});
