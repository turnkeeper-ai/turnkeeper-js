# Customer-support agent

This synthetic example models a refund proposal without executing a refund:

- refunds from `100` through `5000` require human review;
- refunds outside that bounded range and unauthorized actors are blocked locally.

```sh
TURNKEEPER_BINDING_SECRET=synthetic-demo-only-binding-secret-000001 npm run demo
npm test
```

The demo uses `simulateAction` from `@turnkeeper/sdk`. Simulation is deterministic development
behavior, not production authorization. The command above uses a public synthetic value; use a
32-byte-or-longer secret from server-side secret storage in a real integration.

For a live integration:

1. persist the exact refund proposal in caller-owned durable storage;
2. derive and retain one stable action binding and idempotency key;
3. call `ControlClient` before the payment provider;
4. stop on `block` and persist pending state on `review`;
5. execute only the exact approved proposal;
6. enqueue metadata-only Replay evidence after recording the downstream result.

Never send order contents, customer messages, payment details, names, emails, or exact refund
parameters to Replay. The example identifiers are synthetic.

Development tooling after the alpha packages are published:

```sh
npx @turnkeeper/cli@0.1.0-alpha.5 inspect .
TURNKEEPER_WORKSPACE_ROOT="$PWD" npx @turnkeeper/mcp@0.1.0-alpha.5
```
