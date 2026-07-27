# Support escalation example

Local `simulateAction` walkthrough for the bounded `support.escalation` Control contract.

```bash
npm install
TURNKEEPER_BINDING_SECRET=synthetic-test-only-binding-secret-000001 npm test
TURNKEEPER_BINDING_SECRET=synthetic-test-only-binding-secret-000001 npm run demo
npm run typecheck
```

Install `@turnkeeper/cli@0.1.0-alpha.7` for policy validation helpers. This example does not call
production Control APIs by default.
