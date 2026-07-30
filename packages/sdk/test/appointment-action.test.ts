import assert from "node:assert/strict";
import test from "node:test";

import {
  CALENDAR_APPOINTMENT_CREATE,
  createActionBinding,
  createAppointmentAction,
  createAppointmentCancelAction,
  createAppointmentRescheduleAction,
  GovernanceInputError,
  type AppointmentProposal,
} from "../src/index.js";

const BINDING_SECRET = "synthetic-binding-secret-that-is-at-least-32-bytes";

function createProposal(overrides: Partial<AppointmentProposal> = {}): AppointmentProposal {
  return {
    actorRef: "actor_scheduler_1",
    calendarRef: "calendar_primary",
    endsAt: "2026-08-01T16:00:00.000Z",
    operation: "create",
    proposalId: "proposal_appt_1",
    proposalVersion: 1,
    resourceRef: "resource_room_a",
    slotRef: "slot_2026_08_01_1500",
    startsAt: "2026-08-01T15:00:00.000Z",
    timezone: "America/Los_Angeles",
    ...overrides,
  };
}

function createInput(overrides: Record<string, unknown> = {}) {
  return {
    actorId: "actor_scheduler_1",
    actorRoles: ["scheduler"],
    conversationId: "conversation_appt_1",
    environment: "test" as const,
    projectId: "project_appt_1",
    proposal: createProposal(),
    signals: {
      actor_authorized: true,
      appointment_preflight_complete: true,
      conflict_present: false,
      duration_minutes: 60,
      lead_time_minutes: 120,
      outside_business_hours: false,
      slot_available: true,
    },
    tenantId: "tenant_appt_1",
    turnId: "turn_appt_1",
    userId: "subject_appt_1",
    ...overrides,
  };
}

test("appointment create builder returns a dated ActionContext with exact signals", () => {
  const action = createAppointmentAction(createInput());
  assert.equal(action.actionName, CALENDAR_APPOINTMENT_CREATE);
  assert.equal(action.proposalVersion, 1);
  assert.equal(action.parameters.operation, "create");
  assert.equal(action.parameters.slot_ref, "slot_2026_08_01_1500");
  assert.deepEqual(action.signals, createInput().signals);
  assert.equal(createActionBinding(action, BINDING_SECRET).length, 64);
});

test("appointment create builder rejects unknown fields, bad intervals, and signal mismatches", () => {
  assert.throws(
    () =>
      createAppointmentAction(
        createInput({
          proposal: { ...createProposal(), notes: "private" },
        }),
      ),
    (error: unknown) =>
      error instanceof GovernanceInputError && error.code === "unknown_appointment_proposal_field",
  );
  assert.throws(
    () =>
      createAppointmentAction(
        createInput({
          proposal: {
            ...createProposal(),
            endsAt: "2026-08-01T15:00:00.000Z",
          },
        }),
      ),
    (error: unknown) =>
      error instanceof GovernanceInputError && error.code === "invalid_appointment_interval",
  );
  assert.throws(
    () =>
      createAppointmentAction(
        createInput({
          signals: {
            ...createInput().signals,
            duration_minutes: 30,
          },
        }),
      ),
    (error: unknown) =>
      error instanceof GovernanceInputError && error.code === "appointment_duration_signal_mismatch",
  );
  assert.throws(
    () =>
      createAppointmentAction(
        createInput({
          signals: {
            actor_authorized: true,
            appointment_preflight_complete: true,
          },
        }),
      ),
    (error: unknown) =>
      error instanceof GovernanceInputError && error.code === "invalid_appointment_signal_set",
  );
});

test("appointment create binding changes when executable proposal fields change", () => {
  const first = createActionBinding(createAppointmentAction(createInput()), BINDING_SECRET);
  const changed = createActionBinding(
    createAppointmentAction(
      createInput({
        proposal: {
          ...createProposal(),
          proposalVersion: 2,
          startsAt: "2026-08-01T16:00:00.000Z",
          endsAt: "2026-08-01T17:00:00.000Z",
        },
        signals: {
          ...createInput().signals,
          duration_minutes: 60,
        },
      }),
    ),
    BINDING_SECRET,
  );
  assert.notEqual(first, changed);
});

test("reschedule and cancel builders require appointment refs and exact signal sets", () => {
  const reschedule = createAppointmentRescheduleAction({
    ...createInput(),
    proposal: {
      ...createProposal(),
      appointmentRef: "appointment_1",
      operation: "reschedule",
      proposalVersion: 2,
    },
    signals: {
      actor_authorized: true,
      appointment_locked: false,
      appointment_preflight_complete: true,
      change_notice_minutes: 90,
      conflict_present: false,
      prior_reschedules_30d: 0,
      slot_available: true,
    },
  });
  assert.equal(reschedule.actionName, "calendar.appointment.reschedule");
  assert.equal(reschedule.parameters.appointment_ref, "appointment_1");

  const cancel = createAppointmentCancelAction({
    ...createInput(),
    proposal: {
      ...createProposal(),
      appointmentRef: "appointment_1",
      operation: "cancel",
      proposalVersion: 3,
    },
    signals: {
      actor_authorized: true,
      appointment_locked: false,
      appointment_preflight_complete: true,
      cancellation_window_exception: false,
      fee_or_credit_effect: false,
    },
  });
  assert.equal(cancel.actionName, "calendar.appointment.cancel");

  assert.throws(
    () =>
      createAppointmentRescheduleAction({
        ...createInput(),
        proposal: { ...createProposal(), operation: "reschedule" },
        signals: {
          actor_authorized: true,
          appointment_locked: false,
          appointment_preflight_complete: true,
          change_notice_minutes: 90,
          conflict_present: false,
          prior_reschedules_30d: 0,
          slot_available: true,
        },
      }),
    (error: unknown) =>
      error instanceof GovernanceInputError && error.code === "invalid_appointment_appointment_ref",
  );
});
