import assert from "node:assert/strict";
import test from "node:test";

import {
  TurnkeeperApiError,
  TurnkeeperClient,
  TurnkeeperTransportError,
  classifyRetry,
  type TurnkeeperFetch,
} from "../src/index.js";
import { API_KEY, NOW, replayBatch } from "./helpers.js";

test("classifies 429 and 5xx as retryable but not auth rejection", async () => {
  for (const [status, expected] of [[429, true], [503, true], [401, false]] as const) {
    const fetch: TurnkeeperFetch = async () => new Response(JSON.stringify({
      request_id: "req_error123",
      error: { code: status === 429 ? "rate_limited" : status === 401 ? "invalid_api_key" : "ingestion_unavailable" },
    }), { status, headers: { "Content-Type": "application/json", "Retry-After": "2" } });
    const client = new TurnkeeperClient({ apiKey: API_KEY, baseUrl: "https://example.invalid", fetch });
    await assert.rejects(
      () => client.replay.ingestBatch(replayBatch(), { now: NOW }),
      (error: unknown) => {
        assert.ok(error instanceof TurnkeeperApiError);
        assert.equal(classifyRetry(error).retry, expected);
        if (status === 429) assert.equal(classifyRetry(error).retryAfterMs, 2000);
        return true;
      },
    );
  }
});

test("network failure is retryable and executes only once", async () => {
  let calls = 0;
  const client = new TurnkeeperClient({
    apiKey: API_KEY,
    baseUrl: "https://example.invalid",
    fetch: async () => {
      calls += 1;
      throw new Error("synthetic network detail");
    },
  });
  await assert.rejects(
    () => client.replay.ingestBatch(replayBatch(), { now: NOW }),
    (error: unknown) => {
      assert.ok(error instanceof TurnkeeperTransportError);
      assert.equal(classifyRetry(error).retry, true);
      assert.equal(JSON.stringify(error).includes("synthetic network detail"), false);
      return true;
    },
  );
  assert.equal(calls, 1);
});

test("caller abort is not retryable", async () => {
  const controller = new AbortController();
  controller.abort();
  const client = new TurnkeeperClient({
    apiKey: API_KEY,
    baseUrl: "https://example.invalid",
    fetch: async (_input, init) => {
      if (init?.signal?.aborted) throw new DOMException("aborted", "AbortError");
      return new Response();
    },
  });
  await assert.rejects(
    () => client.replay.ingestBatch(replayBatch(), { now: NOW, signal: controller.signal }),
    (error: unknown) => {
      assert.ok(error instanceof TurnkeeperTransportError);
      assert.equal(error.transportCode, "request_aborted");
      assert.equal(classifyRetry(error).retry, false);
      return true;
    },
  );
});

test("safe API error serialization excludes credentials and request payloads", async () => {
  const batch = replayBatch();
  const client = new TurnkeeperClient({
    apiKey: API_KEY,
    baseUrl: "https://example.invalid",
    fetch: async () => new Response(JSON.stringify({
      request_id: "req_safe123",
      error: { code: "invalid_api_key", unsafe: API_KEY },
    }), { status: 401, headers: { "Content-Type": "application/json" } }),
  });
  await assert.rejects(
    () => client.replay.ingestBatch(batch, { now: NOW }),
    (error: unknown) => {
      assert.ok(error instanceof TurnkeeperApiError);
      const serialized = JSON.stringify(error);
      assert.equal(serialized.includes(API_KEY), false);
      assert.equal(serialized.includes(batch.events[0]?.source_event_id ?? "never"), false);
      return true;
    },
  );
});
