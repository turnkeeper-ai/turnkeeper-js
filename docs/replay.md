# Replay API

The SDK wraps two implemented metadata-only endpoints:

- `POST /api/v1/events/batch`
- `GET /api/v1/events`

The current dated API version is `2026-07-27`. Provider metadata accepts `anthropic` for hosted
Anthropic lifecycle facts and `self_hosted` when the customer operates the inference runtime.
The TypeScript types use the wire contract's snake-case names so the object inspected in application code matches the JSON transmitted to Turnkeeper.

## Write limits

- 1 to 500 events per batch
- 16 KiB maximum canonical JSON size per event
- 1 MiB maximum encoded request body
- event timestamps no more than five minutes in the future
- default local validation window of 30 days, configurable to match the project retention window
- integer indexes from 0 through 2,147,483,647

Each result is `accepted`, `duplicate`, or `rejected`. An exact retry returns `duplicate`; a conflicting event identity or ordering slot is rejected. Partial rejection remains an ordered result and does not turn the whole HTTP response into an exception.

The current preview event vocabulary is intentionally narrow. Do not infer support for arbitrary providers, channels, or application types from this scaffold.

## Reads

`listEvents` supports page and limit plus event type, conversation ID, turn ID, and ISO timestamp filters. Organization and project are derived by the server from the API key and are never accepted as query fields.
