# Appointment create example

Synthetic customer-side loop for `calendar.appointment.create`.

This example:

- persists an exact proposal before any Control check
- builds a dated `ActionContext` with `@turnkeeper/sdk` appointment helpers
- simulates policy decisions locally
- holds review outcomes without executing
- revalidates the exact action binding before a fake calendar provider call
- routes unknown provider outcomes to reconciliation instead of blind retry

It does not call a live calendar API or Turnkeeper hosted Control.

```bash
export TURNKEEPER_BINDING_SECRET='synthetic-binding-secret-that-is-at-least-32-bytes'
npm run demo --workspace @turnkeeper/example-appointment-create
npm test --workspace @turnkeeper/example-appointment-create
```
