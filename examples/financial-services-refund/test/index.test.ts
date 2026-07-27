import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  SCENARIOS,
  evaluateScenario,
  evaluateSupportRefund,
  supportRefundBundle,
} from "../src/index.ts";

const BINDING_SECRET = "synthetic-test-only-binding-secret-000001";
const PII_PATTERN =
  /\b(?:ssn|social security|passport|driver(?:'s)? license|\+?\d[\d\s().-]{8,}\d|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/iu;
const SECRET_PATTERN = /\b(?:sk_live_|sk_test_|pk_live_|AKIA)[A-Za-z0-9_-]+\b/u;

test("covers six support.refund scenarios with expected decisions and reason codes", () => {
  assert.equal(SCENARIOS.length, 6);
  for (const scenario of SCENARIOS) {
    const result = evaluateSupportRefund(
      scenario.proposal,
      scenario.signals,
      ["support_agent"],
      BINDING_SECRET,
    );
    assert.equal(result.decision, scenario.expectedDecision, scenario.id);
    assert.equal(result.reasonCode, scenario.expectedReasonCode, scenario.id);
    assert.equal(result.matchedPolicyRuleCode, scenario.expectedMatchedRuleCode, scenario.id);
    assert.notEqual(result.decision, "request_info");
  }
});

test("policy priority prefers identity over amount and window over amount", () => {
  const identityWins = evaluateSupportRefund(
    { amountCents: 50_000, customerRef: "cus_29F8", transactionRef: "txn_84K2M" },
    {
      amount_cents: 50_000,
      customer_verified: false,
      prior_refunds_30d: 4,
      refund_preflight_complete: true,
      within_refund_window: false,
    },
    ["support_agent"],
    BINDING_SECRET,
  );
  assert.equal(identityWins.decision, "block");
  assert.equal(identityWins.reasonCode, "customer_not_verified");

  const windowWins = evaluateSupportRefund(
    { amountCents: 50_000, customerRef: "cus_29F8", transactionRef: "txn_84K2M" },
    {
      amount_cents: 50_000,
      customer_verified: true,
      prior_refunds_30d: 4,
      refund_preflight_complete: true,
      within_refund_window: false,
    },
    ["support_agent"],
    BINDING_SECRET,
  );
  assert.equal(windowWins.decision, "review");
  assert.equal(windowWins.reasonCode, "refund_window_exception");
});

test("incomplete preflight fails closed via local always fallback", () => {
  const result = evaluateScenario("incomplete-preflight", ["support_agent"], BINDING_SECRET);
  assert.equal(result.decision, "block");
  assert.equal(result.reasonCode, "no_policy_match");
  assert.equal(result.matchedPolicyRuleCode, "support.refund.no_policy_match");
  assert.equal(result.applicationState, "permanently_stopped");
});

test("blocks unauthorized roles and missing required parameters", () => {
  const unauthorized = evaluateSupportRefund(
    { amountCents: 7500, customerRef: "cus_29F8", transactionRef: "txn_84K2M" },
    {
      amount_cents: 7500,
      customer_verified: true,
      prior_refunds_30d: 1,
      refund_preflight_complete: true,
      within_refund_window: true,
    },
    ["viewer"],
    BINDING_SECRET,
  );
  assert.equal(unauthorized.decision, "block");
  assert.equal(unauthorized.reasonCode, "actor_role_not_allowed");
  assert.equal(unauthorized.source, "execution_guard");

  const missingParam = evaluateSupportRefund(
    { amountCents: 7500, customerRef: "cus_29F8", transactionRef: "" },
    {
      amount_cents: 7500,
      customer_verified: true,
      prior_refunds_30d: 1,
      refund_preflight_complete: true,
      within_refund_window: true,
    },
    ["support_agent"],
    BINDING_SECRET,
  );
  assert.equal(missingParam.decision, "block");
  assert.equal(missingParam.reasonCode, "parameter_required.transaction_ref");
  assert.equal(missingParam.source, "execution_guard");

  const overMax = evaluateSupportRefund(
    {
      amountCents: 1_000_000_000_001,
      customerRef: "cus_29F8",
      transactionRef: "txn_84K2M",
    },
    {
      amount_cents: 7500,
      customer_verified: true,
      prior_refunds_30d: 1,
      refund_preflight_complete: true,
      within_refund_window: true,
    },
    ["support_agent"],
    BINDING_SECRET,
  );
  assert.equal(overMax.decision, "block");
  assert.equal(overMax.reasonCode, "parameter_maximum_exceeded.amount_cents");
  assert.equal(overMax.source, "execution_guard");

  assert.throws(
    () =>
      evaluateSupportRefund(
        { amountCents: 7500, customerRef: "cus_29F8", transactionRef: "txn_84K2M" },
        {
          amount_cents: 7500,
          customer_verified: true,
          prior_refunds_30d: 1,
          refund_preflight_complete: true,
          within_refund_window: true,
        },
        ["support_agent"],
        undefined,
      ),
    /TURNKEEPER_BINDING_SECRET is required/u,
  );
});

test("derives a stable binding for an exact retry and changes when the proposal changes", () => {
  const proposal = { amountCents: 50_000, customerRef: "cus_29F8", transactionRef: "txn_84K2M" };
  const signals = {
    amount_cents: 50_000,
    customer_verified: true,
    prior_refunds_30d: 1,
    refund_preflight_complete: true,
    within_refund_window: true,
  };
  const first = evaluateSupportRefund(proposal, signals, ["support_agent"], BINDING_SECRET);
  const second = evaluateSupportRefund(proposal, signals, ["support_agent"], BINDING_SECRET);
  assert.equal(first.actionBinding, second.actionBinding);

  const changed = evaluateSupportRefund(
    { ...proposal, amountCents: 50_001 },
    { ...signals, amount_cents: 50_001 },
    ["support_agent"],
    BINDING_SECRET,
  );
  assert.notEqual(first.actionBinding, changed.actionBinding);
});

test("bundle includes fail-closed always policy and correlated support.refund rule codes", () => {
  assert.equal(supportRefundBundle.actionName, "support.refund");
  assert.ok(supportRefundBundle.policies.some((policy) => policy.operator === "always"));
  assert.ok(
    supportRefundBundle.policies.some(
      (policy) => policy.ruleCode === "support.refund.preflight_complete" && policy.priority > 0,
    ),
  );
});

test("example sources avoid PII, payment providers, and hosted API calls", async () => {
  const [source, readme] = await Promise.all([
    readFile(new URL("../src/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
  ]);
  for (const blob of [source, readme, JSON.stringify(SCENARIOS)]) {
    assert.doesNotMatch(blob, PII_PATTERN);
    assert.doesNotMatch(blob, SECRET_PATTERN);
    assert.doesNotMatch(blob, /stripe|adyen|braintree|paypal/iu);
  }
  assert.doesNotMatch(source, /new ControlClient|fetch\(/iu);
  assert.match(readme, /does \*\*not\*\* calculate refund eligibility/iu);
  assert.match(readme, /does \*\*not\*\* execute or resume refunds/iu);
  assert.match(readme, /turnkeeper\.ai\/demo\/financial-services/u);
});
