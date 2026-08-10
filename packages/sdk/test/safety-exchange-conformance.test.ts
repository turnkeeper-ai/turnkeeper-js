import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { Ajv2020 } from "ajv/dist/2020.js";

import {
  validateDetectorCandidateV1,
  validateExchangeDeliveryRecordV1,
  validateExchangeRevocationV1,
  validateExchangeSignalV1,
  validateMatchLookupRequestV1,
  validatePublishProposalV1,
  type ExchangeValidationResult,
} from "../src/index.js";

type ObjectName =
  | "detector_candidate"
  | "exchange_delivery_record"
  | "exchange_revocation"
  | "exchange_signal"
  | "match_lookup_request"
  | "publish_proposal";

type Fixture = {
  claim: string;
  fixture_version: string;
  objects: Record<ObjectName, unknown>;
};

type NegativeCase = {
  copy_from?: ObjectName;
  expected_code: string;
  name: string;
  object: ObjectName;
  path: string;
  schema_reject?: boolean;
  value?: unknown;
};

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

const schema = readJson(
  "../../../spec/safety-exchange-2026-08-08.schema.json",
) as object;
const fixture = readJson(
  "../../../docs/examples/safety-exchange-v0.1.conformance.json",
) as Fixture;
const negativeFixture = readJson(
  "../../../docs/examples/safety-exchange-v0.1.negative.json",
) as { cases: NegativeCase[] };
const validateSchema = new Ajv2020({ allErrors: true, strict: true }).compile(
  schema,
);

const validators: Record<
  ObjectName,
  (value: unknown) => ExchangeValidationResult<unknown>
> = {
  detector_candidate: validateDetectorCandidateV1,
  publish_proposal: validatePublishProposalV1,
  exchange_signal: validateExchangeSignalV1,
  exchange_revocation: validateExchangeRevocationV1,
  match_lookup_request: validateMatchLookupRequestV1,
  exchange_delivery_record: validateExchangeDeliveryRecordV1,
};

function mutated(testCase: NegativeCase): unknown {
  const value = structuredClone(fixture.objects[testCase.object]) as Record<
    string,
    unknown
  >;
  const parts = testCase.path.split(".");
  let cursor = value;
  for (const part of parts.slice(0, -1)) {
    const next = cursor[part];
    assert.ok(next && typeof next === "object" && !Array.isArray(next));
    cursor = next as Record<string, unknown>;
  }
  cursor[parts.at(-1)!] = testCase.copy_from
    ? structuredClone(fixture.objects[testCase.copy_from])
    : testCase.value;
  return value;
}

test("the published schema suite and SDK accept every synthetic v0.1 object", () => {
  assert.equal(fixture.claim, "schema_conformant_synthetic");
  assert.equal(fixture.fixture_version, "2026-08-08");

  for (const [name, value] of Object.entries(fixture.objects) as Array<
    [ObjectName, unknown]
  >) {
    assert.equal(
      validateSchema(value),
      true,
      `${name}: ${JSON.stringify(validateSchema.errors)}`,
    );
    const result = validators[name](value);
    assert.equal(
      result.ok,
      true,
      result.ok ? undefined : `${name}: ${result.code}: ${result.detail ?? ""}`,
    );
  }
});

test("negative conformance mutations fail with stable SDK codes", () => {
  for (const testCase of negativeFixture.cases) {
    const value = mutated(testCase);
    const result = validators[testCase.object](value);
    assert.equal(result.ok, false, `${testCase.name}: SDK accepted mutation`);
    if (!result.ok) assert.equal(result.code, testCase.expected_code, testCase.name);
    if (testCase.schema_reject !== false) {
      assert.equal(
        validateSchema(value),
        false,
        `${testCase.name}: schema accepted mutation`,
      );
    }
  }
});
