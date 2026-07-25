# Account-management agent

This synthetic example models three account actions:

- profile updates are low-risk and may be allowed for `account_agent`;
- account cancellation requires human review for `account_admin`;
- payment-reference changes require human review for `billing_admin`.

```sh
TURNKEEPER_BINDING_SECRET=synthetic-demo-only-binding-secret-000001 npm run demo
npm test
```

The example never changes an account or payment method. Exact profile, account, and payment data
remain in caller-owned storage; only synthetic opaque references appear in the simulation.
The command above uses a public synthetic binding value; use a 32-byte-or-longer secret from
server-side secret storage in production.

For live use, request a decision with `ControlClient` before the downstream system, bind approval
to the immutable proposal, and fail closed on unavailable or malformed responses. Deliver
metadata-only Replay evidence from durable background work.

Development tooling after the alpha packages are published:

```sh
npx @turnkeeper/cli@0.1.0-alpha.6 inspect .
TURNKEEPER_WORKSPACE_ROOT="$PWD" npx @turnkeeper/mcp@0.1.0-alpha.6
```
