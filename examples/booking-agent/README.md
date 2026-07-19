# Booking agent

This synthetic example keeps availability lookup read-only and requires human review before a
booking proposal can be confirmed.

```sh
TURNKEEPER_BINDING_SECRET=synthetic-demo-only-binding-secret-000001 npm run demo
npm test
```

No calendar, scheduling provider, email service, or customer system is contacted. The local SDK
simulation proves that:

- availability lookup remains read-only;
- an authorized confirmation proposal returns `review`;
- unauthorized or incomplete proposals return `block`.

The command above uses a public synthetic binding value. Store a 32-byte-or-longer production
binding secret in server-side secret storage.

For a live integration, persist the exact slot and subject references, request a hosted decision
with `ControlClient`, and resume idempotently only after approval for the same action binding.
Record the provider result locally and enqueue metadata-only Replay evidence afterward.

Development tooling after the alpha packages are published:

```sh
npx @turnkeeper/cli@0.1.0-alpha.4 inspect .
TURNKEEPER_WORKSPACE_ROOT="$PWD" npx @turnkeeper/mcp@0.1.0-alpha.4
```
