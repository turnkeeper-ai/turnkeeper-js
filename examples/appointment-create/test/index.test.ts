import assert from "node:assert/strict";
import test from "node:test";

import {
  createInMemoryCalendarProvider,
  evaluateAppointmentCreate,
  executeExactProposal,
  loadProposal,
  resolveReview,
  type AppointmentProposal,
} from "../src/index.ts";

const BINDING_SECRET = "synthetic-binding-secret-that-is-at-least-32-bytes";

function proposal(overrides: Partial<AppointmentProposal> = {}): AppointmentProposal {
  return {
    actorRef: "actor_scheduler_1",
    calendarRef: "calendar_primary",
    endsAt: "2026-08-01T16:00:00.000Z",
    operation: "create",
    proposalId: `proposal_${Math.random().toString(16).slice(2)}`,
    proposalVersion: 1,
    resourceRef: "resource_room_a",
    slotRef: "slot_1500",
    startsAt: "2026-08-01T15:00:00.000Z",
    timezone: "America/Los_Angeles",
    ...overrides,
  };
}

const healthySignals = {
  actor_authorized: true,
  appointment_preflight_complete: true,
  conflict_present: false,
  duration_minutes: 60,
  lead_time_minutes: 120,
  outside_business_hours: false,
  slot_available: true,
};

test("local rejection never reaches policy evaluation state transitions beyond locally_rejected", () => {
  const result = evaluateAppointmentCreate({
    actorAuthorized: false,
    bindingSecret: BINDING_SECRET,
    proposal: proposal(),
    resourceVersion: "rv_1",
    signals: healthySignals,
  });
  assert.equal(result.state, "locally_rejected");
  assert.equal(result.decision, "block");
});

test("block never executes the fake provider", () => {
  const storedProposal = proposal();
  const result = evaluateAppointmentCreate({
    actorAuthorized: true,
    bindingSecret: BINDING_SECRET,
    proposal: storedProposal,
    resourceVersion: "rv_1",
    signals: { ...healthySignals, actor_authorized: false },
  });
  assert.equal(result.state, "blocked");
  const execution = executeExactProposal({
    actorStillAuthorized: true,
    bindingSecret: BINDING_SECRET,
    currentResourceVersion: "rv_1",
    proposalId: storedProposal.proposalId,
    provider: createInMemoryCalendarProvider("executed"),
    signals: healthySignals,
  });
  assert.equal(execution.state, "stopped");
  assert.equal(execution.outcome, null);
});

test("review remains held while open and executes only after approval of the exact binding", () => {
  const storedProposal = proposal();
  const result = evaluateAppointmentCreate({
    actorAuthorized: true,
    bindingSecret: BINDING_SECRET,
    proposal: storedProposal,
    resourceVersion: "rv_1",
    signals: { ...healthySignals, conflict_present: true },
  });
  assert.equal(result.state, "review_pending");
  assert.equal(
    executeExactProposal({
      actorStillAuthorized: true,
      bindingSecret: BINDING_SECRET,
      currentResourceVersion: "rv_1",
      proposalId: storedProposal.proposalId,
      provider: createInMemoryCalendarProvider("executed"),
      signals: { ...healthySignals, conflict_present: true },
    }).state,
    "review_pending",
  );

  resolveReview(storedProposal.proposalId, "approved");
  const executed = executeExactProposal({
    actorStillAuthorized: true,
    bindingSecret: BINDING_SECRET,
    currentResourceVersion: "rv_1",
    proposalId: storedProposal.proposalId,
    provider: createInMemoryCalendarProvider("executed"),
    signals: { ...healthySignals, conflict_present: true },
  });
  assert.equal(executed.state, "executed");
  assert.equal(executed.outcome, "executed");
});

test("revised review stops execution of the superseded proposal", () => {
  const storedProposal = proposal();
  evaluateAppointmentCreate({
    actorAuthorized: true,
    bindingSecret: BINDING_SECRET,
    proposal: storedProposal,
    resourceVersion: "rv_1",
    signals: { ...healthySignals, outside_business_hours: true },
  });
  resolveReview(storedProposal.proposalId, "revised");
  assert.equal(loadProposal(storedProposal.proposalId).state, "review_revised");
  assert.equal(
    executeExactProposal({
      actorStillAuthorized: true,
      bindingSecret: BINDING_SECRET,
      currentResourceVersion: "rv_1",
      proposalId: storedProposal.proposalId,
      provider: createInMemoryCalendarProvider("executed"),
      signals: { ...healthySignals, outside_business_hours: true },
    }).state,
    "review_revised",
  );
});

test("changed resource version and lost permission stop execution", () => {
  const storedProposal = proposal();
  evaluateAppointmentCreate({
    actorAuthorized: true,
    bindingSecret: BINDING_SECRET,
    proposal: storedProposal,
    resourceVersion: "rv_1",
    signals: healthySignals,
  });
  assert.equal(
    executeExactProposal({
      actorStillAuthorized: true,
      bindingSecret: BINDING_SECRET,
      currentResourceVersion: "rv_2",
      proposalId: storedProposal.proposalId,
      provider: createInMemoryCalendarProvider("executed"),
      signals: healthySignals,
    }).state,
    "stale_or_unauthorized",
  );

  const next = proposal();
  evaluateAppointmentCreate({
    actorAuthorized: true,
    bindingSecret: BINDING_SECRET,
    proposal: next,
    resourceVersion: "rv_1",
    signals: healthySignals,
  });
  assert.equal(
    executeExactProposal({
      actorStillAuthorized: false,
      bindingSecret: BINDING_SECRET,
      currentResourceVersion: "rv_1",
      proposalId: next.proposalId,
      provider: createInMemoryCalendarProvider("executed"),
      signals: healthySignals,
    }).state,
    "stale_or_unauthorized",
  );
});

test("provider idempotency prevents duplicate execution and unknown outcomes enter reconcile", () => {
  const storedProposal = proposal();
  evaluateAppointmentCreate({
    actorAuthorized: true,
    bindingSecret: BINDING_SECRET,
    proposal: storedProposal,
    resourceVersion: "rv_1",
    signals: healthySignals,
  });
  const provider = createInMemoryCalendarProvider("executed");
  assert.equal(
    executeExactProposal({
      actorStillAuthorized: true,
      bindingSecret: BINDING_SECRET,
      currentResourceVersion: "rv_1",
      proposalId: storedProposal.proposalId,
      provider,
      signals: healthySignals,
    }).outcome,
    "executed",
  );

  const unknownProposal = proposal();
  evaluateAppointmentCreate({
    actorAuthorized: true,
    bindingSecret: BINDING_SECRET,
    proposal: unknownProposal,
    resourceVersion: "rv_1",
    signals: healthySignals,
  });
  assert.equal(
    executeExactProposal({
      actorStillAuthorized: true,
      bindingSecret: BINDING_SECRET,
      currentResourceVersion: "rv_1",
      proposalId: unknownProposal.proposalId,
      provider: createInMemoryCalendarProvider("provider_unknown"),
      signals: healthySignals,
    }).state,
    "reconcile",
  );
});
