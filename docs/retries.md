# Durable retries

The SDK sends one request per method call and never retries automatically.

Persist the event batch to an application-owned durable outbox before sending it. Export from a background worker, not from a webhook or customer-response path.

Use `classifyRetry`:

| Outcome | Action |
|---|---|
| accepted or duplicate | mark the outbox item sent |
| item rejected | quarantine or correct the item; do not retry unchanged |
| 400, 401, 403, 413, 415, 422 | do not retry unchanged |
| 429 | retry after the returned delay |
| 5xx | retry with bounded exponential jitter |
| timeout or network failure | retry with bounded exponential jitter |
| caller abort | do not retry automatically |
| malformed server response | stop and investigate contract drift |

Reuse the exact same `source_event_id`, turn identifiers, ordering indexes, and payload on every retry.
