# Durable outbox worker pattern

This example is intentionally architectural rather than database-specific.

1. In the same authoritative transaction as the application event, insert an immutable metadata-only Replay batch into a durable outbox.
2. A background worker claims bounded rows with a lease.
3. Call `client.replay.ingestBatch` with the persisted batch.
4. Mark `accepted` and `duplicate` items sent.
5. Quarantine permanent item rejections.
6. Retry only transient transport, 429, and 5xx failures with bounded jitter.
7. Recover expired leases after worker crashes.

Do not replace the durable outbox with an in-memory array, detached promise, or direct call from a customer-response handler.
