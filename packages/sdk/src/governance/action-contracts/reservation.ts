import {
  ACTION_CONTEXT_SCHEMA_VERSION,
  GovernanceInputError,
  type ActionContext,
  type TurnkeeperEnvironment,
} from "../policy.js";
import {
  assertExactKeys,
  assertExactSignalSet,
  requireBooleanSignal,
  requireCurrencyCode,
  requireIsoInstant,
  requireNonNegativeSafeInteger,
  requireNumberSignal,
  requireOpaqueRef,
  requirePositiveSafeInteger,
  type GovernedProposalBase,
} from "./shared.js";

export const BOOKING_RESERVATION_CREATE = "booking.reservation.create" as const;
export const BOOKING_RESERVATION_MODIFY = "booking.reservation.modify" as const;
export const BOOKING_RESERVATION_CANCEL = "booking.reservation.cancel" as const;

export type ReservationOperation = "cancel" | "create" | "modify";

const MAX_PARTY_SIZE = 10_000;
const MAX_DEPOSIT_MINOR = 1_000_000_000_000;

export type ReservationProposal = GovernedProposalBase & {
  currencyCode?: string;
  depositAmountMinor?: number;
  endsAt?: string;
  inventoryRef: string;
  operation: ReservationOperation;
  partySize: number;
  reservationRef?: string;
  startsAt: string;
  venueRef: string;
};

export type ReservationCreateSignals = {
  actor_authorized: boolean;
  capacity_limit_exceeded: boolean;
  deposit_required: boolean;
  inventory_available: boolean;
  outside_service_hours: boolean;
  party_size: number;
  reservation_preflight_complete: boolean;
};

export type ReservationModifySignals = {
  actor_authorized: boolean;
  capacity_limit_exceeded: boolean;
  change_notice_minutes: number;
  inventory_available: boolean;
  price_or_deposit_changes: boolean;
  reservation_locked: boolean;
  reservation_preflight_complete: boolean;
};

export type ReservationCancelSignals = {
  actor_authorized: boolean;
  cancellation_window_exception: boolean;
  fee_or_credit_effect: boolean;
  reservation_locked: boolean;
  reservation_preflight_complete: boolean;
};

export type ReservationActionInput<TSignals> = {
  actorId: string;
  actorRoles: readonly string[];
  conversationId: string;
  environment: TurnkeeperEnvironment;
  projectId: string;
  proposal: ReservationProposal;
  signals: TSignals;
  tenantId: string;
  turnId: string;
  userId: string;
};

const CREATE_PROPOSAL_KEYS = new Set([
  "actorRef",
  "currencyCode",
  "depositAmountMinor",
  "endsAt",
  "expectedResourceVersion",
  "inventoryRef",
  "operation",
  "partySize",
  "proposalId",
  "proposalVersion",
  "resourceRef",
  "startsAt",
  "venueRef",
]);

const MODIFY_OR_CANCEL_PROPOSAL_KEYS = new Set([...CREATE_PROPOSAL_KEYS, "reservationRef"]);

const CREATE_SIGNAL_KEYS = new Set([
  "actor_authorized",
  "capacity_limit_exceeded",
  "deposit_required",
  "inventory_available",
  "outside_service_hours",
  "party_size",
  "reservation_preflight_complete",
]);

const MODIFY_SIGNAL_KEYS = new Set([
  "actor_authorized",
  "capacity_limit_exceeded",
  "change_notice_minutes",
  "inventory_available",
  "price_or_deposit_changes",
  "reservation_locked",
  "reservation_preflight_complete",
]);

const CANCEL_SIGNAL_KEYS = new Set([
  "actor_authorized",
  "cancellation_window_exception",
  "fee_or_credit_effect",
  "reservation_locked",
  "reservation_preflight_complete",
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

function validateOptionalInterval(startsAt: string, endsAt: string): void {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new GovernanceInputError("invalid_reservation_interval");
  }
}

function validateProposal(
  proposalValue: unknown,
  operation: ReservationOperation,
): ReservationProposal {
  if (proposalValue === null || typeof proposalValue !== "object" || Array.isArray(proposalValue)) {
    throw new GovernanceInputError("invalid_reservation_proposal");
  }
  const proposal = proposalValue as Record<string, unknown>;
  const allowed =
    operation === "create" ? CREATE_PROPOSAL_KEYS : MODIFY_OR_CANCEL_PROPOSAL_KEYS;
  assertExactKeys(proposal, allowed, "unknown_reservation_proposal_field");

  if (proposal.operation !== operation) {
    throw new GovernanceInputError("invalid_reservation_operation");
  }

  const startsAt = requireIsoInstant(proposal.startsAt, "invalid_reservation_starts_at");
  const base: ReservationProposal = {
    actorRef: requireOpaqueRef(proposal.actorRef, "invalid_reservation_actor_ref"),
    inventoryRef: requireOpaqueRef(proposal.inventoryRef, "invalid_reservation_inventory_ref"),
    operation,
    partySize: requirePositiveSafeInteger(
      proposal.partySize,
      1,
      MAX_PARTY_SIZE,
      "invalid_reservation_party_size",
    ),
    proposalId: requireOpaqueRef(proposal.proposalId, "invalid_reservation_proposal_id"),
    proposalVersion: requirePositiveSafeInteger(
      proposal.proposalVersion,
      1,
      2_147_483_647,
      "invalid_reservation_proposal_version",
    ),
    resourceRef: requireOpaqueRef(proposal.resourceRef, "invalid_reservation_resource_ref"),
    startsAt,
    venueRef: requireOpaqueRef(proposal.venueRef, "invalid_reservation_venue_ref"),
  };

  if (proposal.expectedResourceVersion !== undefined) {
    base.expectedResourceVersion = requireOpaqueRef(
      proposal.expectedResourceVersion,
      "invalid_reservation_resource_version",
    );
  }
  if (proposal.endsAt !== undefined) {
    const endsAt = requireIsoInstant(proposal.endsAt, "invalid_reservation_ends_at");
    validateOptionalInterval(startsAt, endsAt);
    base.endsAt = endsAt;
  }
  if (proposal.currencyCode !== undefined) {
    base.currencyCode = requireCurrencyCode(
      proposal.currencyCode,
      "invalid_reservation_currency_code",
    );
  }
  if (proposal.depositAmountMinor !== undefined) {
    base.depositAmountMinor = requireNonNegativeSafeInteger(
      proposal.depositAmountMinor,
      MAX_DEPOSIT_MINOR,
      "invalid_reservation_deposit_amount_minor",
    );
  }

  if (operation === "create") {
    if (proposal.reservationRef !== undefined) {
      throw new GovernanceInputError("reservation_ref_not_allowed_for_create");
    }
    return base;
  }

  return {
    ...base,
    reservationRef: requireOpaqueRef(
      proposal.reservationRef,
      "invalid_reservation_reservation_ref",
    ),
  };
}

function validateCreateSignals(value: unknown): ReservationCreateSignals {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new GovernanceInputError("invalid_reservation_signals");
  }
  const signals = value as Record<string, unknown>;
  assertExactSignalSet(signals, CREATE_SIGNAL_KEYS, "invalid_reservation_signal_set");
  return {
    actor_authorized: requireBooleanSignal(signals.actor_authorized, "invalid_actor_authorized"),
    capacity_limit_exceeded: requireBooleanSignal(
      signals.capacity_limit_exceeded,
      "invalid_capacity_limit_exceeded",
    ),
    deposit_required: requireBooleanSignal(signals.deposit_required, "invalid_deposit_required"),
    inventory_available: requireBooleanSignal(
      signals.inventory_available,
      "invalid_inventory_available",
    ),
    outside_service_hours: requireBooleanSignal(
      signals.outside_service_hours,
      "invalid_outside_service_hours",
    ),
    party_size: requireNumberSignal(signals.party_size, 1, MAX_PARTY_SIZE, "invalid_party_size"),
    reservation_preflight_complete: requireBooleanSignal(
      signals.reservation_preflight_complete,
      "invalid_reservation_preflight_complete",
    ),
  };
}

function validateModifySignals(value: unknown): ReservationModifySignals {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new GovernanceInputError("invalid_reservation_signals");
  }
  const signals = value as Record<string, unknown>;
  assertExactSignalSet(signals, MODIFY_SIGNAL_KEYS, "invalid_reservation_signal_set");
  return {
    actor_authorized: requireBooleanSignal(signals.actor_authorized, "invalid_actor_authorized"),
    capacity_limit_exceeded: requireBooleanSignal(
      signals.capacity_limit_exceeded,
      "invalid_capacity_limit_exceeded",
    ),
    change_notice_minutes: requireNumberSignal(
      signals.change_notice_minutes,
      0,
      1_000_000,
      "invalid_change_notice_minutes",
    ),
    inventory_available: requireBooleanSignal(
      signals.inventory_available,
      "invalid_inventory_available",
    ),
    price_or_deposit_changes: requireBooleanSignal(
      signals.price_or_deposit_changes,
      "invalid_price_or_deposit_changes",
    ),
    reservation_locked: requireBooleanSignal(
      signals.reservation_locked,
      "invalid_reservation_locked",
    ),
    reservation_preflight_complete: requireBooleanSignal(
      signals.reservation_preflight_complete,
      "invalid_reservation_preflight_complete",
    ),
  };
}

function validateCancelSignals(value: unknown): ReservationCancelSignals {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new GovernanceInputError("invalid_reservation_signals");
  }
  const signals = value as Record<string, unknown>;
  assertExactSignalSet(signals, CANCEL_SIGNAL_KEYS, "invalid_reservation_signal_set");
  return {
    actor_authorized: requireBooleanSignal(signals.actor_authorized, "invalid_actor_authorized"),
    cancellation_window_exception: requireBooleanSignal(
      signals.cancellation_window_exception,
      "invalid_cancellation_window_exception",
    ),
    fee_or_credit_effect: requireBooleanSignal(
      signals.fee_or_credit_effect,
      "invalid_fee_or_credit_effect",
    ),
    reservation_locked: requireBooleanSignal(
      signals.reservation_locked,
      "invalid_reservation_locked",
    ),
    reservation_preflight_complete: requireBooleanSignal(
      signals.reservation_preflight_complete,
      "invalid_reservation_preflight_complete",
    ),
  };
}

function proposalParameters(proposal: ReservationProposal): Record<string, unknown> {
  const parameters: Record<string, unknown> = {
    actor_ref: proposal.actorRef,
    inventory_ref: proposal.inventoryRef,
    operation: proposal.operation,
    party_size: proposal.partySize,
    proposal_id: proposal.proposalId,
    resource_ref: proposal.resourceRef,
    starts_at: proposal.startsAt,
    venue_ref: proposal.venueRef,
  };
  if (proposal.currencyCode !== undefined) {
    parameters.currency_code = proposal.currencyCode;
  }
  if (proposal.depositAmountMinor !== undefined) {
    parameters.deposit_amount_minor = proposal.depositAmountMinor;
  }
  if (proposal.endsAt !== undefined) {
    parameters.ends_at = proposal.endsAt;
  }
  if (proposal.expectedResourceVersion !== undefined) {
    parameters.expected_resource_version = proposal.expectedResourceVersion;
  }
  if (proposal.reservationRef !== undefined) {
    parameters.reservation_ref = proposal.reservationRef;
  }
  return parameters;
}

function buildAction(
  input: ReservationActionInput<Record<string, unknown>>,
  actionName: string,
  proposal: ReservationProposal,
  signals: Record<string, boolean | number>,
): ActionContext {
  assertExactKeys(
    input as unknown as Record<string, unknown>,
    ACTION_INPUT_KEYS,
    "unknown_reservation_action_field",
  );
  if (
    input.environment !== "production" &&
    input.environment !== "staging" &&
    input.environment !== "test"
  ) {
    throw new GovernanceInputError("invalid_reservation_environment");
  }
  if (!Array.isArray(input.actorRoles) || input.actorRoles.length < 1 || input.actorRoles.length > 20) {
    throw new GovernanceInputError("invalid_reservation_actor_roles");
  }
  return {
    actionName,
    actorId: requireOpaqueRef(input.actorId, "invalid_reservation_actor_id"),
    actorRoles: [...input.actorRoles],
    conversationId: requireOpaqueRef(input.conversationId, "invalid_reservation_conversation_id"),
    environment: input.environment,
    parameters: proposalParameters(proposal),
    projectId: requireOpaqueRef(input.projectId, "invalid_reservation_project_id"),
    proposalVersion: proposal.proposalVersion,
    schemaVersion: ACTION_CONTEXT_SCHEMA_VERSION,
    signals,
    tenantId: requireOpaqueRef(input.tenantId, "invalid_reservation_tenant_id"),
    turnId: requireOpaqueRef(input.turnId, "invalid_reservation_turn_id"),
    userId: requireOpaqueRef(input.userId, "invalid_reservation_user_id"),
  };
}

export function createReservationAction(
  input: ReservationActionInput<ReservationCreateSignals>,
): ActionContext {
  const proposal = validateProposal(input.proposal, "create");
  const signals = validateCreateSignals(input.signals);
  if (signals.party_size !== proposal.partySize) {
    throw new GovernanceInputError("reservation_party_size_signal_mismatch");
  }
  return buildAction(input, BOOKING_RESERVATION_CREATE, proposal, signals);
}

export function createReservationModifyAction(
  input: ReservationActionInput<ReservationModifySignals>,
): ActionContext {
  const proposal = validateProposal(input.proposal, "modify");
  const signals = validateModifySignals(input.signals);
  return buildAction(input, BOOKING_RESERVATION_MODIFY, proposal, signals);
}

export function createReservationCancelAction(
  input: ReservationActionInput<ReservationCancelSignals>,
): ActionContext {
  const proposal = validateProposal(input.proposal, "cancel");
  const signals = validateCancelSignals(input.signals);
  return buildAction(input, BOOKING_RESERVATION_CANCEL, proposal, signals);
}
