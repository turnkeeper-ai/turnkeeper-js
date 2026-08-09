import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  EXCHANGE_CONTRACT_VERSION,
  validateExchangeRevocationV1,
  validateExchangeSignalV1,
} from "../src/index.js";

type SyntheticFixture = {
  contract_status: {
    exchange_envelopes: string;
    multi_company_case_room: string;
  };
  illustrative_local_outcomes: Array<{ shared_conclusion: boolean }>;
  revocations: unknown[];
  signals: unknown[];
};

test("the public protocol fixture validates exchange objects without sharing conclusions", async () => {
  const fixture = JSON.parse(
    await readFile(
      new URL(
        "../../../docs/examples/safety-exchange-v0.1.synthetic.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as SyntheticFixture;

  assert.equal(
    fixture.contract_status.exchange_envelopes,
    "implemented_synthetic",
  );
  assert.equal(fixture.contract_status.multi_company_case_room, "roadmap");
  assert.ok(fixture.signals.length >= 2);

  for (const signal of fixture.signals) {
    const result = validateExchangeSignalV1(signal);
    assert.equal(
      result.ok,
      true,
      result.ok ? undefined : `${result.code}: ${result.detail ?? ""}`,
    );
    if (result.ok)
      assert.equal(result.value.schema_version, EXCHANGE_CONTRACT_VERSION);
  }

  for (const revocation of fixture.revocations) {
    const result = validateExchangeRevocationV1(revocation);
    assert.equal(
      result.ok,
      true,
      result.ok ? undefined : `${result.code}: ${result.detail ?? ""}`,
    );
  }

  assert.ok(fixture.illustrative_local_outcomes.length >= 3);
  assert.ok(
    fixture.illustrative_local_outcomes.every(
      (outcome) => !outcome.shared_conclusion,
    ),
  );
});
