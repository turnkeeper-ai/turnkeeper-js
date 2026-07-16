import assert from "node:assert/strict";
import test from "node:test";

import { evaluateRefund } from "../src/index.ts";

const BINDING_SECRET = "synthetic-test-only-binding-secret-000001";

test("routes threshold refunds to review and smaller refunds to block", () => {
  assert.equal(
    evaluateRefund(
      { amount: 150, orderRef: "order_demo_001" },
      ["support_agent"],
      BINDING_SECRET,
    ).decision,
    "review",
  );
  assert.equal(
    evaluateRefund(
      { amount: 50, orderRef: "order_demo_001" },
      ["support_agent"],
      BINDING_SECRET,
    ).decision,
    "block",
  );
});

test("blocks unauthorized and out-of-range refund proposals", () => {
  assert.equal(
    evaluateRefund(
      { amount: 50, orderRef: "order_demo_001" },
      ["viewer"],
      BINDING_SECRET,
    ).decision,
    "block",
  );
  assert.equal(
    evaluateRefund(
      { amount: 6000, orderRef: "order_demo_001" },
      ["support_agent"],
      BINDING_SECRET,
    ).decision,
    "block",
  );
});

test("derives a stable binding for an exact retry", () => {
  const proposal = { amount: 150, orderRef: "order_demo_001" };
  assert.equal(
    evaluateRefund(proposal, ["support_agent"], BINDING_SECRET).actionBinding,
    evaluateRefund(proposal, ["support_agent"], BINDING_SECRET).actionBinding,
  );
});
