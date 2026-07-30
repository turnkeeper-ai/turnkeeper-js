import {
  ACTION_CONTEXT_SCHEMA_VERSION,
  GovernanceInputError,
  type ActionContext,
  type TurnkeeperEnvironment,
} from "../policy.js";
import {
  assertExactKeys,
  assertExactSignalSet,
  durationMinutes,
  requireBooleanSignal,
  requireIanaTimezone,
  requireIsoInstant,
  requireNumberSignal,
  requireOpaqueRef,
  requirePositiveSafeInteger,
  type GovernedProposalBase,
} from "./shared.js";

export const CALENDAR_APPOINTMENT_CREATE = "calendar.appointment.create" as const;
export const CALENDAR_APPOINTMENT_RESCHEDULE = "calendar.appointment.reschedule" as const;
export const CALENDAR_APPOINTMENT_CANCEL = "calendar.appointment.cancel" as const;

export type AppointmentOperation = "cancel" | "create" | "reschedule";

export type AppointmentProposal = GovernedProposalBase & {
  appointmentRef?: string;
  calendarRef: string;
  endsAt: string;
  operation: AppointmentOperation;
  slotRef?: string;
  startsAt: string;
  timezone: string;
};

export type AppointmentCreateSignals = {
  actor_authorized: boolean;
  appointment_preflight_complete: boolean;
  conflict_present: boolean;
  duration_minutes: number;
  lead_time_minutes: number;
  outside_business_hours: boolean;
  slot_available: boolean;
};

export type AppointmentRescheduleSignals = {
  actor_authorized: boolean;
  appointment_locked: boolean;
  appointment_preflight_complete: boolean;
  change_notice_minutes: number;
  conflict_present: boolean;
  prior_reschedules_30d: number;
  slot_available: boolean;
};

export type AppointmentCancelSignals = {
  actor_authorized: boolean;
  appointment_locked: boolean;
  appointment_preflight_complete: boolean;
  cancellation_window_exception: boolean;
  fee_or_credit_effect: boolean;
};

export type AppointmentActionInput<TSignals> = {
  actorId: string;
  actorRoles: readonly string[];
  conversationId: string;
  environment: TurnkeeperEnvironment;
  projectId: string;
  proposal: AppointmentProposal;
  signals: TSignals;
  tenantId: string;
  turnId: string;
  userId: string;
};

const CREATE_PROPOSAL_KEYS = new Set([
  "actorRef",
  "calendarRef",
  "endsAt",
  "expectedResourceVersion",
  "operation",
  "proposalId",
  "proposalVersion",
  "resourceRef",
  "slotRef",
  "startsAt",
  "timezone",
]);

const RESCHEDULE_OR_CANCEL_PROPOSAL_KEYS = new Set([
  ...CREATE_PROPOSAL_KEYS,
  "appointmentRef",
]);

const CREATE_SIGNAL_KEYS = new Set([
  "actor_authorized",
  "appointment_preflight_complete",
  "conflict_present",
  "duration_minutes",
  "lead_time_minutes",
  "outside_business_hours",
  "slot_available",
]);

const RESCHEDULE_SIGNAL_KEYS = new Set([
  "actor_authorized",
  "appointment_locked",
  "appointment_preflight_complete",
  "change_notice_minutes",
  "conflict_present",
  "prior_reschedules_30d",
  "slot_available",
]);

const CANCEL_SIGNAL_KEYS = new Set([
  "actor_authorized",
  "appointment_locked",
  "appointment_preflight_complete",
  "cancellation_window_exception",
  "fee_or_credit_effect",
]);

const ACTION_INPUT_KEYS = new Set([
  "actorId",
  "actorRoles",
  "conversationId",
  "environment",
  "projectId",
  "proposal",
  "signals",
  "tenantId",
  "turnId",
  "userId",
]);

function validateProposal(
  proposalValue: unknown,
  operation: AppointmentOperation,
): AppointmentProposal {
  if (proposalValue === null || typeof proposalValue !== "object" || Array.isArray(proposalValue)) {
    throw new GovernanceInputError("invalid_appointment_proposal");
  }
  const proposal = proposalValue as Record<string, unknown>;
  const allowed =
    operation === "create" ? CREATE_PROPOSAL_KEYS : RESCHEDULE_OR_CANCEL_PROPOSAL_KEYS;
  assertExactKeys(proposal, allowed, "unknown_appointment_proposal_field");

  if (proposal.operation !== operation) {
    throw new GovernanceInputError("invalid_appointment_operation");
  }

  const startsAt = requireIsoInstant(proposal.startsAt, "invalid_appointment_starts_at");
  const endsAt = requireIsoInstant(proposal.endsAt, "invalid_appointment_ends_at");
  const minutes = durationMinutes(startsAt, endsAt);
  if (minutes < 5 || minutes > 1_440) {
    throw new GovernanceInputError("invalid_appointment_duration");
  }

  const base: AppointmentProposal = {
    actorRef: requireOpaqueRef(proposal.actorRef, "invalid_appointment_actor_ref"),
    calendarRef: requireOpaqueRef(proposal.calendarRef, "invalid_appointment_calendar_ref"),
    endsAt,
    operation,
    proposalId: requireOpaqueRef(proposal.proposalId, "invalid_appointment_proposal_id"),
    proposalVersion: requirePositiveSafeInteger(
      proposal.proposalVersion,
      1,
      2_147_483_647,
      "invalid_appointment_proposal_version",
    ),
    resourceRef: requireOpaqueRef(proposal.resourceRef, "invalid_appointment_resource_ref"),
    startsAt,
    timezone: requireIanaTimezone(proposal.timezone, "invalid_appointment_timezone"),
  };

  if (proposal.expectedResourceVersion !== undefined) {
    base.expectedResourceVersion = requireOpaqueRef(
      proposal.expectedResourceVersion,
      "invalid_appointment_resource_version",
    );
  }
  if (proposal.slotRef !== undefined) {
    base.slotRef = requireOpaqueRef(proposal.slotRef, "invalid_appointment_slot_ref");
  }
  if (operation === "create") {
    if (proposal.appointmentRef !== undefined) {
      throw new GovernanceInputError("appointment_ref_not_allowed_for_create");
    }
    return base;
  }

  return {
    ...base,
    appointmentRef: requireOpaqueRef(
      proposal.appointmentRef,
      "invalid_appointment_appointment_ref",
    ),
  };
}

function validateCreateSignals(value: unknown): AppointmentCreateSignals {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new GovernanceInputError("invalid_appointment_signals");
  }
  const signals = value as Record<string, unknown>;
  assertExactSignalSet(signals, CREATE_SIGNAL_KEYS, "invalid_appointment_signal_set");
  return {
    actor_authorized: requireBooleanSignal(signals.actor_authorized, "invalid_actor_authorized"),
    appointment_preflight_complete: requireBooleanSignal(
      signals.appointment_preflight_complete,
      "invalid_appointment_preflight_complete",
    ),
    conflict_present: requireBooleanSignal(signals.conflict_present, "invalid_conflict_present"),
    duration_minutes: requireNumberSignal(
      signals.duration_minutes,
      5,
      1_440,
      "invalid_duration_minutes",
    ),
    lead_time_minutes: requireNumberSignal(
      signals.lead_time_minutes,
      0,
      1_000_000,
      "invalid_lead_time_minutes",
    ),
    outside_business_hours: requireBooleanSignal(
      signals.outside_business_hours,
      "invalid_outside_business_hours",
    ),
    slot_available: requireBooleanSignal(signals.slot_available, "invalid_slot_available"),
  };
}

function validateRescheduleSignals(value: unknown): AppointmentRescheduleSignals {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new GovernanceInputError("invalid_appointment_signals");
  }
  const signals = value as Record<string, unknown>;
  assertExactSignalSet(signals, RESCHEDULE_SIGNAL_KEYS, "invalid_appointment_signal_set");
  return {
    actor_authorized: requireBooleanSignal(signals.actor_authorized, "invalid_actor_authorized"),
    appointment_locked: requireBooleanSignal(
      signals.appointment_locked,
      "invalid_appointment_locked",
    ),
    appointment_preflight_complete: requireBooleanSignal(
      signals.appointment_preflight_complete,
      "invalid_appointment_preflight_complete",
    ),
    change_notice_minutes: requireNumberSignal(
      signals.change_notice_minutes,
      0,
      1_000_000,
      "invalid_change_notice_minutes",
    ),
    conflict_present: requireBooleanSignal(signals.conflict_present, "invalid_conflict_present"),
    prior_reschedules_30d: requireNumberSignal(
      signals.prior_reschedules_30d,
      0,
      1_000_000,
      "invalid_prior_reschedules_30d",
    ),
    slot_available: requireBooleanSignal(signals.slot_available, "invalid_slot_available"),
  };
}

function validateCancelSignals(value: unknown): AppointmentCancelSignals {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new GovernanceInputError("invalid_appointment_signals");
  }
  const signals = value as Record<string, unknown>;
  assertExactSignalSet(signals, CANCEL_SIGNAL_KEYS, "invalid_appointment_signal_set");
  return {
    actor_authorized: requireBooleanSignal(signals.actor_authorized, "invalid_actor_authorized"),
    appointment_locked: requireBooleanSignal(
      signals.appointment_locked,
      "invalid_appointment_locked",
    ),
    appointment_preflight_complete: requireBooleanSignal(
      signals.appointment_preflight_complete,
      "invalid_appointment_preflight_complete",
    ),
    cancellation_window_exception: requireBooleanSignal(
      signals.cancellation_window_exception,
      "invalid_cancellation_window_exception",
    ),
    fee_or_credit_effect: requireBooleanSignal(
      signals.fee_or_credit_effect,
      "invalid_fee_or_credit_effect",
    ),
  };
}

function proposalParameters(proposal: AppointmentProposal): Record<string, unknown> {
  const parameters: Record<string, unknown> = {
    actor_ref: proposal.actorRef,
    calendar_ref: proposal.calendarRef,
    ends_at: proposal.endsAt,
    operation: proposal.operation,
    proposal_id: proposal.proposalId,
    resource_ref: proposal.resourceRef,
    starts_at: proposal.startsAt,
    timezone: proposal.timezone,
  };
  if (proposal.appointmentRef !== undefined) {
    parameters.appointment_ref = proposal.appointmentRef;
  }
  if (proposal.expectedResourceVersion !== undefined) {
    parameters.expected_resource_version = proposal.expectedResourceVersion;
  }
  if (proposal.slotRef !== undefined) {
    parameters.slot_ref = proposal.slotRef;
  }
  return parameters;
}

function buildAction(
  input: AppointmentActionInput<Record<string, unknown>>,
  actionName: string,
  proposal: AppointmentProposal,
  signals: Record<string, boolean | number>,
): ActionContext {
  assertExactKeys(
    input as unknown as Record<string, unknown>,
    ACTION_INPUT_KEYS,
    "unknown_appointment_action_field",
  );
  if (
    input.environment !== "production" &&
    input.environment !== "staging" &&
    input.environment !== "test"
  ) {
    throw new GovernanceInputError("invalid_appointment_environment");
  }
  if (!Array.isArray(input.actorRoles) || input.actorRoles.length < 1 || input.actorRoles.length > 20) {
    throw new GovernanceInputError("invalid_appointment_actor_roles");
  }
  return {
    actionName,
    actorId: requireOpaqueRef(input.actorId, "invalid_appointment_actor_id"),
    actorRoles: [...input.actorRoles],
    conversationId: requireOpaqueRef(input.conversationId, "invalid_appointment_conversation_id"),
    environment: input.environment,
    parameters: proposalParameters(proposal),
    projectId: requireOpaqueRef(input.projectId, "invalid_appointment_project_id"),
    proposalVersion: proposal.proposalVersion,
    schemaVersion: ACTION_CONTEXT_SCHEMA_VERSION,
    signals,
    tenantId: requireOpaqueRef(input.tenantId, "invalid_appointment_tenant_id"),
    turnId: requireOpaqueRef(input.turnId, "invalid_appointment_turn_id"),
    userId: requireOpaqueRef(input.userId, "invalid_appointment_user_id"),
  };
}

export function createAppointmentAction(
  input: AppointmentActionInput<AppointmentCreateSignals>,
): ActionContext {
  const proposal = validateProposal(input.proposal, "create");
  const signals = validateCreateSignals(input.signals);
  const durationFromProposal = durationMinutes(proposal.startsAt, proposal.endsAt);
  if (signals.duration_minutes !== durationFromProposal) {
    throw new GovernanceInputError("appointment_duration_signal_mismatch");
  }
  return buildAction(input, CALENDAR_APPOINTMENT_CREATE, proposal, signals);
}

export function createAppointmentRescheduleAction(
  input: AppointmentActionInput<AppointmentRescheduleSignals>,
): ActionContext {
  const proposal = validateProposal(input.proposal, "reschedule");
  const signals = validateRescheduleSignals(input.signals);
  return buildAction(input, CALENDAR_APPOINTMENT_RESCHEDULE, proposal, signals);
}

export function createAppointmentCancelAction(
  input: AppointmentActionInput<AppointmentCancelSignals>,
): ActionContext {
  const proposal = validateProposal(input.proposal, "cancel");
  const signals = validateCancelSignals(input.signals);
  return buildAction(input, CALENDAR_APPOINTMENT_CANCEL, proposal, signals);
}
