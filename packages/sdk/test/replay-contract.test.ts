import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  REPLAY_API_VERSION,
  REPLAY_EVENT_TYPES,
  TurnkeeperValidationError,
  assertValidReplayBatch,
  parseOpaqueReplayId,
  stableCanonicalJson,
  validateReplayBatch,
} from "../src/index.js";
import { NOW, replayBatch, replayEvent } from "./helpers.js";

test("exports the exact preview Replay contract", () => {
  assert.equal(REPLAY_API_VERSION, "2026-07-09");
  assert.deepEqual(REPLAY_EVENT_TYPES, [
    "input.received",
    "turn.started",
    "turn.decision_recorded",
    "model.completed",
    "output.finalized",
    "output.queued",
    "output.held",
    "output.sent",
    "output.failed",
    "turn.completed",
    "turn.failed",
  ]);
});

test("validates a synthetic metadata-only lifecycle", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/synthetic-replay.json", import.meta.url), "utf8")) as unknown;
  const result = validateReplayBatch(fixture, { now: NOW, retentionDays: 30 });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.events.every((event) => event.ok), true);
  assert.doesNotThrow(() => assertValidReplayBatch(fixture, { now: NOW, retentionDays: 30 }));
});

test("rejects unknown, content-bearing, coercible, and oversized fields", () => {
  const cases: unknown[] = [
    { ...replayBatch(), unexpected: "value" },
    { events: [{ ...replayEvent(), event_index: "0" }] },
    { events: [{ ...replayEvent(), data: { message: "customer content" } }] },
    { events: [{ ...replayEvent(), data: { reason_code: "person@example.com" } }] },
    { events: [{ ...replayEvent(), data: { extracted_field_names: Array(33).fill("field") } }] },
    { events: [{ ...replayEvent(), oversized: "x".repeat(17 * 1024) }] },
  ];
  for (const candidate of cases) {
    const result = validateReplayBatch(candidate, { now: NOW, retentionDays: 30 });
    assert.equal(result.ok && result.events.every((event) => event.ok), false);
  }
});

test("validation errors do not echo unsafe values", () => {
  const canary = "person@example.com";
  assert.throws(
    () => assertValidReplayBatch({ events: [{ ...replayEvent(), data: { reason_code: canary } }] }, { now: NOW }),
    (error: unknown) => {
      assert.ok(error instanceof TurnkeeperValidationError);
      assert.equal(JSON.stringify(error).includes(canary), false);
      return true;
    },
  );
});

test("rejects PII, URLs, and credential-shaped values in every free code field", () => {
  const fields = [
    "stage_before",
    "stage_after",
    "decision_code",
    "outcome_code",
    "reason_code",
    "reply_source",
    "model",
  ] as const;
  const canaries = [
    "555-123-4567",
    "lead@example.com",
    "123-Main-Street",
    "https://example.com/private",
    "sk_live_1234567890abcdef",
    `sk-ant-api03-${"A".repeat(80)}`,
    `sk-proj-${"A".repeat(80)}`,
  ];

  for (const field of fields) {
    for (const canary of canaries) {
      const event = replayEvent({ data: { ...replayEvent().data, [field]: canary } });
      const result = validateReplayBatch({ events: [event] }, { now: NOW, retentionDays: 30 });
      assert.equal(result.ok && result.events[0]?.ok, false, `${field} accepted an unsafe canary`);
      assert.equal(JSON.stringify(result).includes(canary), false);
    }
  }

  for (const canary of canaries) {
    const event = replayEvent({
      data: { ...replayEvent().data, extracted_field_names: [canary] },
    });
    const result = validateReplayBatch({ events: [event] }, { now: NOW, retentionDays: 30 });
    assert.equal(result.ok && result.events[0]?.ok, false);
    assert.equal(JSON.stringify(result).includes(canary), false);
  }
});

test("enforces timestamp and identifier boundaries", () => {
  const invalidTimes = [
    "2026-07-12T12:05:00.001Z",
    "2026-02-30T12:00:00Z",
    "2026-07-12T11:59:00",
  ];
  for (const occurred_at of invalidTimes) {
    const result = validateReplayBatch(replayBatch({ occurred_at }), { now: NOW, retentionDays: 30 });
    assert.equal(result.ok && result.events[0]?.ok, false);
  }
  assert.throws(() => parseOpaqueReplayId("A".repeat(64)), TurnkeeperValidationError);
});

test("stable canonical JSON sorts keys and rejects non-JSON values", () => {
  assert.equal(stableCanonicalJson({ z: 1, a: { y: true, x: null } }), '{"a":{"x":null,"y":true},"z":1}');
  assert.throws(() => stableCanonicalJson({ value: undefined }), TypeError);
  const cyclic: { self?: unknown } = {};
  cyclic.self = cyclic;
  assert.throws(() => stableCanonicalJson(cyclic), TypeError);
});
