import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { Ajv2020 } from "ajv/dist/2020.js";

import { CONTROL_API_VERSION, SignalValueSchema } from "../src/index.js";

function schema(name: string) {
  return JSON.parse(
    readFileSync(new URL(`../../../spec/${name}`, import.meta.url), "utf8"),
  ) as object;
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.addSchema(schema("replay-2026-07-09.schema.json"));
const validateRequest = ajv.compile(
  schema("control-check-request-2026-07-16.schema.json"),
);
const validateResponse = ajv.compile(
  schema("control-check-response-2026-07-16.schema.json"),
);

const validRequest = {
  references: { action_id: "a".repeat(64) },
  signals: { amount: 1200, approval_required: true, risk: "high" },
  workflow: "issue_refund",
};

const validResponse = {
  check_id: "chk_synthetic",
  decision: "review",
  evidence: {
    record_hash: "b".repeat(64),
    record_id: "grc_synthetic",
    request_hash: "c".repeat(64),
  },
  matched: true,
  policy: {
    condition: {
      key: "amount",
      operator: "gte",
      type: "number",
      value: "500",
    },
    id: "pol_synthetic",
    name: "Review larger refunds",
    rule_code: "issue_refund.review",
    version: 1,
  },
  reason_code: "issue_refund.review_required",
  request_id: "req_synthetic",
  review: {
    id: "rev_synthetic",
    status: "open",
    version: 1,
  },
};

const validUnmatchedBlock = {
  ...validResponse,
  decision: "block",
  matched: false,
  policy: null,
  reason_code: "no_policy_match",
  review: null,
};

test("exports the dated Control contract and validates bounded request/response fixtures", () => {
  assert.equal(CONTROL_API_VERSION, "2026-07-16");
  assert.equal(
    validateRequest(validRequest),
    true,
    JSON.stringify(validateRequest.errors),
  );
  assert.equal(
    validateResponse(validResponse),
    true,
    JSON.stringify(validateResponse.errors),
  );
  assert.equal(
    validateResponse(validUnmatchedBlock),
    true,
    JSON.stringify(validateResponse.errors),
  );
  assert.equal(
    validateResponse({
      error: { code: "rate_limited" },
      request_id: "req_synthetic",
    }),
    true,
    JSON.stringify(validateResponse.errors),
  );
});

test("Control schemas reject unsafe metadata, unknown fields, and review mismatches", () => {
  assert.equal(validateRequest({ ...validRequest, references: {} }), false);
  assert.equal(
    validateRequest({
      ...validRequest,
      references: { action_id: "not-a-hash" },
    }),
    false,
  );
  assert.equal(
    validateRequest({
      ...validRequest,
      references: { action_id: "a".repeat(64) },
    }),
    true,
  );
  assert.equal(
    validateRequest({
      ...validRequest,
      signals: { customer_email: "high" },
    }),
    false,
  );
  assert.equal(
    validateRequest({
      ...validRequest,
      signals: { risk: "https://example.com/private" },
    }),
    false,
  );
  assert.equal(
    validateRequest({ ...validRequest, prompt: "raw content" }),
    false,
  );
  assert.equal(
    validateResponse({ ...validResponse, decision: "allow" }),
    false,
  );
  assert.equal(
    validateResponse({ ...validUnmatchedBlock, decision: "allow" }),
    false,
  );
  assert.equal(
    validateResponse({ ...validUnmatchedBlock, policy: validResponse.policy }),
    false,
  );
  assert.equal(validateResponse({ ...validResponse, unexpected: true }), false);
});

test("Control signal strings preserve SDK and wire-schema parity", () => {
  for (const value of [
    "high",
    "risk.high",
    "UPPER",
    "s3://private-bucket/object",
    `sk-ant-api03-${"A".repeat(80)}`,
    `sk-proj-${"A".repeat(80)}`,
    "password=synthetic-secret",
    "https://example.com/private",
  ]) {
    const candidate = { ...validRequest, signals: { risk: value } };
    assert.equal(
      validateRequest(candidate),
      SignalValueSchema.safeParse(value).success,
      value,
    );
  }

  for (const value of [
    "UPPER",
    "s3://private-bucket/object",
    `sk-ant-api03-${"A".repeat(80)}`,
    `sk-proj-${"A".repeat(80)}`,
    "password=synthetic-secret",
    "https://example.com/private",
  ]) {
    assert.equal(validateRequest({ ...validRequest, signals: { risk: value } }), false);
  }
});

test("Control response versions remain inside the public integer contract", () => {
  for (const version of [0, 2_147_483_648]) {
    assert.equal(
      validateResponse({
        ...validResponse,
        policy: { ...validResponse.policy, version },
      }),
      false,
    );
    assert.equal(
      validateResponse({
        ...validResponse,
        review: { ...validResponse.review, version },
      }),
      false,
    );
  }
});
