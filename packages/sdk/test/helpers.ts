import {
  REPLAY_API_VERSION,
  parseOpaqueReplayId,
  type ReplayBatch,
  type ReplayEvent,
  type ReplayWriteResponse,
  type TurnkeeperFetch,
} from "../src/index.js";

export const NOW = new Date("2026-07-12T12:00:00.000Z");
export const API_KEY = `tk_test_${"x".repeat(32)}`;

export function opaque(character: string) {
  return parseOpaqueReplayId(character.repeat(64));
}

export function replayEvent(overrides: Partial<ReplayEvent> = {}): ReplayEvent {
  return {
    api_version: REPLAY_API_VERSION,
    source_event_id: opaque("1"),
    type: "turn.started",
    occurred_at: "2026-07-12T11:59:59.000Z",
    conversation_external_id: opaque("a"),
    turn_external_id: opaque("b"),
    turn_index: null,
    event_index: 0,
    parent_source_event_id: null,
    trace_id: opaque("c"),
    data: {
      bot_type: "seller",
      channel: "simulator",
      decision_code: "workflow.start",
      provider: "anthropic",
      model: "model.preview",
      fallback: false,
      message_length: 42,
    },
    privacy: { mode: "metadata_only", key_version: 1 },
    ...overrides,
  };
}

export function replayBatch(overrides: Partial<ReplayEvent> = {}): ReplayBatch {
  return { events: [replayEvent(overrides)] };
}

export function acceptedResponse(batch: ReplayBatch): ReplayWriteResponse {
  return {
    request_id: "req_synthetic123",
    results: batch.events.map((event, index) => ({
      index,
      source_event_id: event.source_event_id,
      status: "accepted",
      code: "stored",
    })),
  };
}

export function jsonFetch(value: unknown, options: { readonly status?: number; readonly headers?: HeadersInit } = {}): TurnkeeperFetch {
  return async () => new Response(JSON.stringify(value), {
    status: options.status ?? 200,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
}
