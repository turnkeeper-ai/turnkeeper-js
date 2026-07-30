import { pathToFileURL } from "node:url";

import {
  ACTION_CONTEXT_SCHEMA_VERSION,
  CALENDAR_APPOINTMENT_CREATE,
  POLICY_SCHEMA_VERSION,
  createActionBinding,
  createAppointmentAction,
  simulateAction,
  type AppointmentCreateSignals,
  type AppointmentProposal,
  type PolicyBundle,
  type PolicyDecision,
} from "@turnkeeper/sdk";

export type { AppointmentCreateSignals, AppointmentProposal } from "@turnkeeper/sdk";

export const LEAD_TIME_THRESHOLD_MINUTES = 60;
export const DURATION_THRESHOLD_MINUTES = 120;

export type AppointmentExecutionState =
  | "blocked"
  | "executed"
  | "execution_preflight"
  | "locally_rejected"
  | "proposed"
  | "provider_rejected"
  | "provider_unknown"
  | "reconcile"
  | "review_approved"
  | "review_blocked"
  | "review_pending"
  | "review_revised"
  | "shadow_observed"
  | "stale_or_unauthorized"
  | "stopped";

export type StoredAppointmentProposal = AppointmentProposal & {
  actionBinding?: string;
  resourceVersion: string;
  state: AppointmentExecutionState;
};

export type FakeProviderOutcome = "executed" | "provider_rejected" | "provider_unknown";

/**
 * Local PolicyBundle correlated to hosted calendar.appointment.create templates.
 * Preflight uses priority 1 so the always→block fallback does not win when complete.
 */
export const appointmentCreateBundle: PolicyBundle = {
  actionName: CALENDAR_APPOINTMENT_CREATE,
  allowedRoles: ["scheduler"],
  approvalRequired: false,
  parameterRestrictions: [
    { kind: "required", parameter: "proposal_id" },
    { kind: "required", parameter: "calendar_ref" },
    { kind: "required", parameter: "resource_ref" },
    { kind: "required", parameter: "starts_at" },
    { kind: "required", parameter: "ends_at" },
  ],
  riskLevel: "medium",
  policies: [
    {
      decision: "block",
      description: "Blocks when actor_authorized is false.",
      name: "Actor authorization required",
      operator: "equals",
      priority: 1000,
      reasonCode: "actor_not_authorized",
      ruleCode: "calendar.appointment.create.actor_required",
      signalKey: "actor_authorized",
      signalValue: "false",
      status: "active",
      valueType: "boolean",
      workflow: CALENDAR_APPOINTMENT_CREATE,
    },
    {
      decision: "block",
      description: "Blocks when slot_available is false.",
      name: "Appointment slot unavailable",
      operator: "equals",
      priority: 900,
      reasonCode: "appointment_slot_unavailable",
      ruleCode: "calendar.appointment.create.slot_unavailable",
      signalKey: "slot_available",
      signalValue: "false",
      status: "active",
      valueType: "boolean",
      workflow: CALENDAR_APPOINTMENT_CREATE,
    },
    {
      decision: "review",
      description: "Requires review when conflict_present is true.",
      name: "Appointment conflict review",
      operator: "equals",
      priority: 800,
      reasonCode: "appointment_conflict_review",
      ruleCode: "calendar.appointment.create.conflict_review",
      signalKey: "conflict_present",
      signalValue: "true",
      status: "active",
      valueType: "boolean",
      workflow: CALENDAR_APPOINTMENT_CREATE,
    },
    {
      decision: "review",
      description: "Requires review when outside_business_hours is true.",
      name: "Outside business hours review",
      operator: "equals",
      priority: 700,
      reasonCode: "outside_business_hours_review",
      ruleCode: "calendar.appointment.create.outside_hours",
      signalKey: "outside_business_hours",
      signalValue: "true",
      status: "active",
      valueType: "boolean",
      workflow: CALENDAR_APPOINTMENT_CREATE,
    },
    {
      decision: "review",
      description: "Requires review when lead_time_minutes is at or below threshold.",
      name: "Short-notice appointment review",
      operator: "lte",
      priority: 650,
      reasonCode: "short_notice_review",
      ruleCode: "calendar.appointment.create.short_notice",
      signalKey: "lead_time_minutes",
      signalValue: String(LEAD_TIME_THRESHOLD_MINUTES),
      status: "active",
      valueType: "number",
      workflow: CALENDAR_APPOINTMENT_CREATE,
    },
    {
      decision: "review",
      description: "Requires review when duration_minutes reaches threshold.",
      name: "Long-duration appointment review",
      operator: "gte",
      priority: 600,
      reasonCode: "appointment_duration_review",
      ruleCode: "calendar.appointment.create.long_duration",
      signalKey: "duration_minutes",
      signalValue: String(DURATION_THRESHOLD_MINUTES),
      status: "active",
      valueType: "number",
      workflow: CALENDAR_APPOINTMENT_CREATE,
    },
    {
      decision: "audit",
      description: "Records preflight when appointment_preflight_complete is true.",
      name: "Appointment create preflight complete",
      operator: "equals",
      priority: 1,
      reasonCode: "appointment_preflight_observed",
      ruleCode: "calendar.appointment.create.preflight_complete",
      signalKey: "appointment_preflight_complete",
      signalValue: "true",
      status: "active",
      valueType: "boolean",
      workflow: CALENDAR_APPOINTMENT_CREATE,
    },
    {
      decision: "block",
      description: "Local fail-closed fallback.",
      name: "No policy match",
      operator: "always",
      priority: 0,
      reasonCode: "no_policy_match",
      ruleCode: "calendar.appointment.create.no_policy_match",
      signalKey: "",
      signalValue: "",
      status: "active",
      valueType: "string",
      workflow: CALENDAR_APPOINTMENT_CREATE,
    },
  ],
  schemaVersion: POLICY_SCHEMA_VERSION,
};

const store = new Map<string, StoredAppointmentProposal>();

export function persistProposal(proposal: AppointmentProposal, resourceVersion: string) {
  const stored: StoredAppointmentProposal = {
    ...proposal,
    resourceVersion,
    state: "proposed",
  };
  store.set(proposal.proposalId, structuredClone(stored));
  return structuredClone(stored);
}

export function loadProposal(proposalId: string) {
  const stored = store.get(proposalId);
  if (!stored) throw new Error("proposal_not_found");
  return structuredClone(stored);
}

export function updateProposalState(proposalId: string, state: AppointmentExecutionState) {
  const stored = loadProposal(proposalId);
  stored.state = state;
  store.set(proposalId, stored);
  return structuredClone(stored);
}

export type FakeCalendarProvider = {
  createAppointment: (proposal: AppointmentProposal) => FakeProviderOutcome;
};

export function createInMemoryCalendarProvider(
  outcome: FakeProviderOutcome = "executed",
): FakeCalendarProvider {
  const seen = new Set<string>();
  return {
    createAppointment(proposal) {
      const key = `${proposal.proposalId}:${proposal.proposalVersion}`;
      if (seen.has(key)) return "executed";
      if (outcome === "provider_unknown") {
        seen.add(key);
        return "provider_unknown";
      }
      if (outcome === "provider_rejected") return "provider_rejected";
      seen.add(key);
      return "executed";
    },
  };
}

export function evaluateAppointmentCreate(input: {
  actorAuthorized: boolean;
  bindingSecret: string;
  proposal: AppointmentProposal;
  resourceVersion: string;
  signals: AppointmentCreateSignals;
}) {
  if (!input.actorAuthorized) {
    const stored = persistProposal(input.proposal, input.resourceVersion);
    return {
      decision: "block" as PolicyDecision,
      reasonCode: "local_actor_not_authorized",
      state: updateProposalState(stored.proposalId, "locally_rejected").state,
    };
  }

  const stored = persistProposal(input.proposal, input.resourceVersion);
  const action = createAppointmentAction({
    actorId: input.proposal.actorRef,
    actorRoles: ["scheduler"],
    conversationId: `conversation_${input.proposal.proposalId}`,
    environment: "test",
    projectId: "project_appointment_demo",
    proposal: input.proposal,
    signals: input.signals,
    tenantId: "tenant_appointment_demo",
    turnId: `turn_${input.proposal.proposalId}`,
    userId: input.proposal.resourceRef,
  });
  const binding = createActionBinding(action, input.bindingSecret);
  stored.actionBinding = binding;
  store.set(stored.proposalId, stored);

  const result = simulateAction(appointmentCreateBundle, action, {
    bindingSecret: input.bindingSecret,
  });

  let state: AppointmentExecutionState = "shadow_observed";
  if (result.decision === "block") state = "blocked";
  if (result.decision === "review") state = "review_pending";
  if (result.decision === "audit" || result.decision === "allow") state = "shadow_observed";
  updateProposalState(stored.proposalId, state);

  return {
    actionBinding: binding,
    decision: result.decision,
    reasonCode: result.reasonCode,
    schemaVersion: ACTION_CONTEXT_SCHEMA_VERSION,
    state,
  };
}

export function resolveReview(
  proposalId: string,
  outcome: "approved" | "blocked" | "revised",
) {
  if (outcome === "approved") return updateProposalState(proposalId, "review_approved");
  if (outcome === "blocked") return updateProposalState(proposalId, "review_blocked");
  return updateProposalState(proposalId, "review_revised");
}

export function executeExactProposal(input: {
  actorStillAuthorized: boolean;
  bindingSecret: string;
  currentResourceVersion: string;
  proposalId: string;
  provider: FakeCalendarProvider;
  signals: AppointmentCreateSignals;
}) {
  const stored = loadProposal(input.proposalId);
  if (stored.state === "review_pending") {
    return { state: stored.state, outcome: null };
  }
  if (stored.state === "review_revised") {
    return { state: stored.state, outcome: null };
  }
  if (stored.state !== "review_approved" && stored.state !== "shadow_observed") {
    return { state: "stopped" as const, outcome: null };
  }
  if (!input.actorStillAuthorized) {
    return {
      state: updateProposalState(stored.proposalId, "stale_or_unauthorized").state,
      outcome: null,
    };
  }
  if (stored.resourceVersion !== input.currentResourceVersion) {
    return {
      state: updateProposalState(stored.proposalId, "stale_or_unauthorized").state,
      outcome: null,
    };
  }

  const reboundProposal: AppointmentProposal = {
    actorRef: stored.actorRef,
    calendarRef: stored.calendarRef,
    endsAt: stored.endsAt,
    operation: stored.operation,
    proposalId: stored.proposalId,
    proposalVersion: stored.proposalVersion,
    resourceRef: stored.resourceRef,
    startsAt: stored.startsAt,
    timezone: stored.timezone,
  };
  if (stored.appointmentRef !== undefined) {
    reboundProposal.appointmentRef = stored.appointmentRef;
  }
  if (stored.expectedResourceVersion !== undefined) {
    reboundProposal.expectedResourceVersion = stored.expectedResourceVersion;
  }
  if (stored.slotRef !== undefined) {
    reboundProposal.slotRef = stored.slotRef;
  }

  const rebound = createAppointmentAction({
    actorId: stored.actorRef,
    actorRoles: ["scheduler"],
    conversationId: `conversation_${stored.proposalId}`,
    environment: "test",
    projectId: "project_appointment_demo",
    proposal: reboundProposal,
    signals: input.signals,
    tenantId: "tenant_appointment_demo",
    turnId: `turn_${stored.proposalId}`,
    userId: stored.resourceRef,
  });
  const binding = createActionBinding(rebound, input.bindingSecret);
  if (!stored.actionBinding || binding !== stored.actionBinding) {
    return {
      state: updateProposalState(stored.proposalId, "stale_or_unauthorized").state,
      outcome: null,
    };
  }

  updateProposalState(stored.proposalId, "execution_preflight");
  const providerOutcome = input.provider.createAppointment(stored);
  if (providerOutcome === "provider_unknown") {
    return {
      state: updateProposalState(stored.proposalId, "reconcile").state,
      outcome: providerOutcome,
    };
  }
  if (providerOutcome === "provider_rejected") {
    return {
      state: updateProposalState(stored.proposalId, "provider_rejected").state,
      outcome: providerOutcome,
    };
  }
  return {
    state: updateProposalState(stored.proposalId, "executed").state,
    outcome: providerOutcome,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const bindingSecret = process.env.TURNKEEPER_BINDING_SECRET;
  if (!bindingSecret) throw new Error("TURNKEEPER_BINDING_SECRET is required.");
  const proposal: AppointmentProposal = {
    actorRef: "actor_scheduler_demo",
    calendarRef: "calendar_demo",
    endsAt: "2026-08-01T16:00:00.000Z",
    operation: "create",
    proposalId: "proposal_demo_1",
    proposalVersion: 1,
    resourceRef: "resource_demo",
    slotRef: "slot_demo_1500",
    startsAt: "2026-08-01T15:00:00.000Z",
    timezone: "America/Los_Angeles",
  };
  const result = evaluateAppointmentCreate({
    actorAuthorized: true,
    bindingSecret,
    proposal,
    resourceVersion: "rv_1",
    signals: {
      actor_authorized: true,
      appointment_preflight_complete: true,
      conflict_present: false,
      duration_minutes: 60,
      lead_time_minutes: 120,
      outside_business_hours: false,
      slot_available: true,
    },
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
