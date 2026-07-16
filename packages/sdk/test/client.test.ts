import assert from "node:assert/strict";
import test from "node:test";

import {
  TurnkeeperClient,
  TurnkeeperProtocolError,
  type TurnkeeperFetch,
} from "../src/index.js";
import { acceptedResponse, API_KEY, NOW, opaque, replayBatch, replayEvent } from "./helpers.js";

test("ingestBatch sends one strict authenticated request and parses ordered results", async () => {
  const batch = replayBatch();
  const calls: Array<{ input: string; init?: RequestInit }> = [];
  const fetch: TurnkeeperFetch = async (input, init) => {
    calls.push({ input: String(input), ...(init === undefined ? {} : { init }) });
    return new Response(JSON.stringify(acceptedResponse(batch)), {
      status: 200,
      headers: { "Content-Type": "application/json", "X-Request-ID": "req_synthetic123" },
    });
  };
  const client = new TurnkeeperClient({ apiKey: API_KEY, baseUrl: "https://example.invalid", fetch });
  const result = await client.replay.ingestBatch(batch, { now: NOW });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.input, "https://example.invalid/api/v1/events/batch");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal(calls[0]?.init?.redirect, "manual");
  assert.equal(new Headers(calls[0]?.init?.headers).get("authorization"), `Bearer ${API_KEY}`);
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), batch);
  assert.equal(result.results[0]?.status, "accepted");
});

test("ingestBatch preserves partial rejection as a typed result", async () => {
  const batch = replayBatch();
  const fetch: TurnkeeperFetch = async () => new Response(JSON.stringify({
    request_id: "req_partial123",
    results: [{
      index: 0,
      source_event_id: batch.events[0]?.source_event_id,
      status: "rejected",
      code: "schema_invalid",
      errors: [{ path: "$.events[0].data", code: "unknown_key" }],
    }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });
  const client = new TurnkeeperClient({ apiKey: API_KEY, baseUrl: "https://example.invalid", fetch });
  const result = await client.replay.ingestBatch(batch, { now: NOW });
  assert.equal(result.results[0]?.status, "rejected");
  assert.deepEqual(result.results[0]?.errors, [{ path: "$.events[0].data", code: "unknown_key" }]);
});

test("listEvents encodes bounded filters and validates the response", async () => {
  const event = replayEvent({
    type: "output.sent",
    parent_source_event_id: null,
    trace_id: null,
  });
  let requested = "";
  const fetch: TurnkeeperFetch = async (input) => {
    requested = String(input);
    return new Response(JSON.stringify({
      request_id: "req_read123",
      events: [{ ...event, public_id: "evt_synthetic123" }],
      pagination: {
        has_next_page: false,
        has_previous_page: false,
        page: 2,
        page_size: 25,
        total_events: 1,
        total_pages: 1,
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const client = new TurnkeeperClient({ apiKey: API_KEY, baseUrl: "https://example.invalid", fetch });
  const result = await client.replay.listEvents({
    conversationExternalId: opaque("a"),
    from: "2026-07-12T00:00:00Z",
    limit: 25,
    page: 2,
    type: "output.sent",
  });
  const url = new URL(requested);
  assert.equal(url.pathname, "/api/v1/events");
  assert.equal(url.searchParams.get("conversation_external_id"), "a".repeat(64));
  assert.equal(url.searchParams.get("type"), "output.sent");
  assert.equal(result.events[0]?.public_id, "evt_synthetic123");
});

test("protocol mismatches never return partially trusted data", async () => {
  const batch = replayBatch();
  const client = new TurnkeeperClient({
    apiKey: API_KEY,
    baseUrl: "https://example.invalid",
    fetch: async () => new Response(JSON.stringify({
      request_id: "req_bad123",
      results: [{ ...acceptedResponse(batch).results[0], source_event_id: opaque("f") }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }),
  });
  await assert.rejects(() => client.replay.ingestBatch(batch, { now: NOW }), TurnkeeperProtocolError);
});
