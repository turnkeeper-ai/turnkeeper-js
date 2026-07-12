# Turnkeeper TypeScript SDK

This repository is a public pre-release, unpublished scaffold for a server-side Turnkeeper Replay client. The npm package is intentionally marked `private` and `UNLICENSED` while the public contract and release policy are reviewed.

Current scope is limited to the preview, provider-specific Replay API contract `2026-07-09`:

- batch metadata event ingestion through `POST /api/v1/events/batch`
- project-scoped metadata event reads through `GET /api/v1/events`

Turnkeeper policy execution, model routing, prompts, memory, evaluations, handoffs, conversation orchestration, streaming, webhooks, and CLI commands are not part of this SDK.

## Requirements

- Node.js 22 or newer
- a server-side, project-bound Turnkeeper API key
- a durable producer outbox for write retries

Do not import this package into browser code. A bearer key grants access to a project and must stay in a server-side secret manager.

## Local development

```bash
npm ci
npm run check
```

## Client

```ts
import {
  REPLAY_API_VERSION,
  TurnkeeperClient,
  parseOpaqueReplayId,
  type ReplayBatch,
} from "@turnkeeper/sdk";

const client = new TurnkeeperClient({
  apiKey: process.env.TURNKEEPER_API_KEY!,
  baseUrl: process.env.TURNKEEPER_BASE_URL!,
});

const batch: ReplayBatch = {
  events: [
    {
      api_version: REPLAY_API_VERSION,
      source_event_id: parseOpaqueReplayId("1".repeat(64)),
      type: "turn.started",
      occurred_at: new Date().toISOString(),
      conversation_external_id: parseOpaqueReplayId("a".repeat(64)),
      turn_external_id: parseOpaqueReplayId("b".repeat(64)),
      event_index: 0,
      data: { channel: "webhook" },
      privacy: { mode: "metadata_only", key_version: 1 },
    },
  ],
};

// Call this from a background worker after claiming a durable outbox row.
const write = await client.replay.ingestBatch(batch);

const page = await client.replay.listEvents({
  conversationExternalId: batch.events[0].conversation_external_id,
  limit: 50,
});
```

The client never retries automatically. Use `classifyRetry` to decide whether a durable outbox row should be retried, quarantined, or marked sent.

## Safety boundaries

Replay is metadata-only. Never send message text, prompts, completions, summaries, transcripts, names, emails, phone numbers, addresses, raw customer identifiers, provider payloads, extracted values, tool arguments/results, credentials, headers, or arbitrary metadata.

Use full-length, environment-specific HMAC-SHA-256 pseudonyms for predictable source identifiers. This SDK validates opaque identifiers but deliberately does not define how application identities are composed.

See [Replay usage](docs/replay.md), [privacy](docs/privacy.md), [retry behavior](docs/retries.md), and [versioning](docs/versioning.md).
