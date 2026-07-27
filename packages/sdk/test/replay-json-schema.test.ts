import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { Ajv2020 } from "ajv/dist/2020.js";

import { validateReplayBatch } from "../src/index.js";
import { NOW, replayEvent } from "./helpers.js";

const schema = JSON.parse(
  readFileSync(
    new URL("../../../spec/replay-2026-07-27.schema.json", import.meta.url),
    "utf8",
  ),
) as object;
const validateSchema = new Ajv2020({ allErrors: true, strict: true })
  .addSchema(
    JSON.parse(
      readFileSync(
        new URL("../../../spec/replay-2026-07-09.schema.json", import.meta.url),
        "utf8",
      ),
    ) as object,
  )
  .compile(schema);

function sdkAccepts(candidate: unknown): boolean {
  const result = validateReplayBatch(candidate, {
    now: NOW,
    retentionDays: 30,
  });
  return result.ok && result.events.every((event) => event.ok);
}

test("published Replay JSON Schema accepts the SDK's valid synthetic contract", () => {
  const candidate = { events: [replayEvent()] };

  assert.equal(
    validateSchema(candidate),
    true,
    JSON.stringify(validateSchema.errors),
  );
  assert.equal(sdkAccepts(candidate), true);
});

test("published Replay JSON Schema accepts self_hosted provider metadata", () => {
  const candidate = {
    events: [
      replayEvent({
        type: "model.completed",
        data: {
          ...replayEvent().data,
          provider: "self_hosted",
          model: "gpt_oss.20b.support_v1",
          input_tokens: 120,
          output_tokens: 48,
          latency_ms: 250,
        },
      }),
    ],
  };

  assert.equal(
    validateSchema(candidate),
    true,
    JSON.stringify(validateSchema.errors),
  );
  assert.equal(sdkAccepts(candidate), true);
});

test("published Replay JSON Schema rejects the SDK's unsafe code canaries", () => {
  const canaries = [
    "555-123-4567",
    "123-Main-Street",
    "https://example.com/private",
    "example.com",
    "sk_live_1234567890abcdef",
    `sk-ant-api03-${"A".repeat(80)}`,
    `sk-proj-${"A".repeat(80)}`,
    "password=synthetic-secret",
  ];

  for (const canary of canaries) {
    const candidate = {
      events: [
        replayEvent({
          data: {
            ...replayEvent().data,
            reason_code: canary,
          },
        }),
      ],
    };

    assert.equal(sdkAccepts(candidate), false, `SDK accepted ${canary}`);
    assert.equal(
      validateSchema(candidate),
      false,
      `JSON Schema accepted ${canary}`,
    );
  }
});
