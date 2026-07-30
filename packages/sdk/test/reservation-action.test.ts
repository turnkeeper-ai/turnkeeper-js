import assert from "node:assert/strict";
import test from "node:test";

import {
  BOOKING_RESERVATION_CREATE,
  createActionBinding,
  createReservationAction,
  createReservationCancelAction,
  createReservationModifyAction,
  GovernanceInputError,
  type ReservationProposal,
} from "../src/index.js";

const BINDING_SECRET = "synthetic-binding-secret-that-is-at-least-32-bytes";

function createProposal(overrides: Partial<ReservationProposal> = {}): ReservationProposal {
  return {
    actorRef: "actor_host_1",
    endsAt: "2026-08-01T22:00:00.000Z",
    inventoryRef: "inventory_table_12",
    operation: "create",
    partySize: 4,
    proposalId: "proposal_res_1",
    proposalVersion: 1,
    resourceRef: "resource_dining_room",
    startsAt: "2026-08-01T20:00:00.000Z",
    venueRef: "venue_main",
    ...overrides,
  };
}

function createInput(overrides: Record<string, unknown> = {}) {
  return {
    actorId: "actor_host_1",
    actorRoles: ["host"],
    conversationId: "conversation_res_1",
    environment: "test" as const,
    projectId: "project_res_1",
    proposal: createProposal(),
    signals: {
      actor_authorized: true,
      capacity_limit_exceeded: false,
      deposit_required: false,
      inventory_available: true,
      outside_service_hours: false,
      party_size: 4,
      reservation_preflight_complete: true,
    },
    tenantId: "tenant_res_1",
    turnId: "turn_res_1",
    userId: "subject_res_1",
    ...overrides,
  };
}

test("reservation create builder returns a dated ActionContext with exact signals", () => {
  const action = createReservationAction(createInput());
  assert.equal(action.actionName, BOOKING_RESERVATION_CREATE);
  assert.equal(action.proposalVersion, 1);
  assert.equal(action.parameters.operation, "create");
  assert.equal(action.parameters.party_size, 4);
  assert.deepEqual(action.signals, createInput().signals);
  assert.equal(createActionBinding(action, BINDING_SECRET).length, 64);
});

test("reservation create builder rejects unknown fields, bad intervals, and signal mismatches", () => {
  assert.throws(
    () =>
      createReservationAction(
        createInput({
          proposal: { ...createProposal(), guestName: "private" },
        }),
      ),
    (error: unknown) =>
      error instanceof GovernanceInputError && error.code === "unknown_reservation_proposal_field",
  );
  assert.throws(
    () =>
      createReservationAction(
        createInput({
          proposal: {
            ...createProposal(),
            endsAt: "2026-08-01T20:00:00.000Z",
          },
        }),
      ),
    (error: unknown) =>
      error instanceof GovernanceInputError && error.code === "invalid_reservation_interval",
  );
  assert.throws(
    () =>
      createReservationAction(
        createInput({
          signals: {
            ...createInput().signals,
            party_size: 2,
          },
        }),
      ),
    (error: unknown) =>
      error instanceof GovernanceInputError && error.code === "reservation_party_size_signal_mismatch",
  );
  assert.throws(
    () =>
      createReservationAction(
        createInput({
          signals: {
            actor_authorized: true,
            reservation_preflight_complete: true,
          },
        }),
      ),
    (error: unknown) =>
      error instanceof GovernanceInputError && error.code === "invalid_reservation_signal_set",
  );
});

test("reservation create builder rejects PII-shaped proposal refs", () => {
  assert.throws(
    () =>
      createReservationAction(
        createInput({
          proposal: {
            ...createProposal(),
            actorRef: "guest@example.com",
          },
        }),
      ),
    (error: unknown) =>
      error instanceof GovernanceInputError && error.code === "invalid_reservation_actor_ref",
  );
});

test("reservation create binding changes when executable proposal fields change", () => {
  const first = createActionBinding(createReservationAction(createInput()), BINDING_SECRET);
  const changed = createActionBinding(
    createReservationAction(
      createInput({
        proposal: {
          ...createProposal(),
          partySize: 6,
          proposalVersion: 2,
        },
        signals: {
          ...createInput().signals,
          party_size: 6,
        },
      }),
    ),
    BINDING_SECRET,
  );
  assert.notEqual(first, changed);
});

test("modify and cancel builders require reservation refs and exact signal sets", () => {
  const modify = createReservationModifyAction({
    ...createInput(),
    proposal: {
      ...createProposal(),
      operation: "modify",
      proposalVersion: 2,
      reservationRef: "reservation_1",
    },
    signals: {
      actor_authorized: true,
      capacity_limit_exceeded: false,
      change_notice_minutes: 120,
      inventory_available: true,
      price_or_deposit_changes: false,
      reservation_locked: false,
      reservation_preflight_complete: true,
    },
  });
  assert.equal(modify.actionName, "booking.reservation.modify");
  assert.equal(modify.parameters.reservation_ref, "reservation_1");

  const cancel = createReservationCancelAction({
    ...createInput(),
    proposal: {
      ...createProposal(),
      operation: "cancel",
      proposalVersion: 3,
      reservationRef: "reservation_1",
    },
    signals: {
      actor_authorized: true,
      cancellation_window_exception: false,
      fee_or_credit_effect: false,
      reservation_locked: false,
      reservation_preflight_complete: true,
    },
  });
  assert.equal(cancel.actionName, "booking.reservation.cancel");

  assert.throws(
    () =>
      createReservationModifyAction({
        ...createInput(),
        proposal: { ...createProposal(), operation: "modify" },
        signals: {
          actor_authorized: true,
          capacity_limit_exceeded: false,
          change_notice_minutes: 120,
          inventory_available: true,
          price_or_deposit_changes: false,
          reservation_locked: false,
          reservation_preflight_complete: true,
        },
      }),
    (error: unknown) =>
      error instanceof GovernanceInputError && error.code === "invalid_reservation_reservation_ref",
  );
});
