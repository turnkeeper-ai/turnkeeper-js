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
  requireHexDigest,
  requireNumberSignal,
  requireOpaqueRef,
  requirePositiveSafeInteger,
  requireTaxonomyCode,
  type GovernedProposalBase,
} from "./shared.js";

export const CRM_RECORD_FIELDS_UPDATE = "crm.record.fields.update" as const;
export const CRM_LEAD_STAGE_CHANGE = "crm.lead.stage.change" as const;
export const CRM_RECORD_ASSIGNMENT_CHANGE = "crm.record.assignment.change" as const;

export type CrmOperation = "assignment_change" | "fields_update" | "stage_change";

export type CrmRecordType =
  | "account"
  | "case"
  | "contact"
  | "deal"
  | "lead"
  | "opportunity";

export type CrmWriteClass =
  | "financial"
  | "identity"
  | "legal"
  | "ordinary"
  | "ownership"
  | "sensitive";

export type CrmWriteProposal = GovernedProposalBase & {
  expectedRecordVersion?: string;
  fieldSetCode: string;
  operation: CrmOperation;
  patchDigest: string;
  recordRef: string;
  recordType: CrmRecordType;
};

export type CrmWriteSignals = {
  actor_authorized: boolean;
  bulk_record_count: number;
  crm_write_preflight_complete: boolean;
  record_type: string;
  restricted_field_present: boolean;
  step_up_complete: boolean;
  transition_allowed: boolean;
  write_class: string;
};

export type CrmActionInput = {
  actorId: string;
  actorRoles: readonly string[];
  conversationId: string;
  environment: TurnkeeperEnvironment;
  projectId: string;
  proposal: CrmWriteProposal;
  signals: CrmWriteSignals;
  tenantId: string;
  turnId: string;
  userId: string;
};

const CRM_RECORD_TYPES = new Set<CrmRecordType>([
  "account",
  "case",
  "contact",
  "deal",
  "lead",
  "opportunity",
]);

const CRM_WRITE_CLASSES = new Set<CrmWriteClass>([
  "financial",
  "identity",
  "legal",
  "ordinary",
  "ownership",
  "sensitive",
]);

const CRM_PROPOSAL_KEYS = new Set([
  "actorRef",
  "expectedRecordVersion",
  "expectedResourceVersion",
  "fieldSetCode",
  "operation",
  "patchDigest",
  "proposalId",
  "proposalVersion",
  "recordRef",
  "recordType",
  "resourceRef",
]);

const CRM_SIGNAL_KEYS = new Set([
  "actor_authorized",
  "bulk_record_count",
  "crm_write_preflight_complete",
  "record_type",
  "restricted_field_present",
  "step_up_complete",
  "transition_allowed",
  "write_class",
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

function requireCrmRecordType(value: unknown, code: string): CrmRecordType {
  if (typeof value !== "string" || !CRM_RECORD_TYPES.has(value as CrmRecordType)) {
    throw new GovernanceInputError(code);
  }
  return value as CrmRecordType;
}

function requireCrmWriteClass(value: unknown, code: string): CrmWriteClass {
  const writeClass = requireTaxonomyCode(value, code);
  if (!CRM_WRITE_CLASSES.has(writeClass as CrmWriteClass)) {
    throw new GovernanceInputError(code);
  }
  return writeClass as CrmWriteClass;
}

function validateProposal(proposalValue: unknown, operation: CrmOperation): CrmWriteProposal {
  if (proposalValue === null || typeof proposalValue !== "object" || Array.isArray(proposalValue)) {
    throw new GovernanceInputError("invalid_crm_proposal");
  }
  const proposal = proposalValue as Record<string, unknown>;
  assertExactKeys(proposal, CRM_PROPOSAL_KEYS, "unknown_crm_proposal_field");

  if (proposal.operation !== operation) {
    throw new GovernanceInputError("invalid_crm_operation");
  }

  const base: CrmWriteProposal = {
    actorRef: requireOpaqueRef(proposal.actorRef, "invalid_crm_actor_ref"),
    fieldSetCode: requireTaxonomyCode(proposal.fieldSetCode, "invalid_crm_field_set_code"),
    operation,
    patchDigest: requireHexDigest(proposal.patchDigest, "invalid_crm_patch_digest"),
    proposalId: requireOpaqueRef(proposal.proposalId, "invalid_crm_proposal_id"),
    proposalVersion: requirePositiveSafeInteger(
      proposal.proposalVersion,
      1,
      2_147_483_647,
      "invalid_crm_proposal_version",
    ),
    recordRef: requireOpaqueRef(proposal.recordRef, "invalid_crm_record_ref"),
    recordType: requireCrmRecordType(proposal.recordType, "invalid_crm_record_type"),
    resourceRef: requireOpaqueRef(proposal.resourceRef, "invalid_crm_resource_ref"),
  };

  if (proposal.expectedResourceVersion !== undefined) {
    base.expectedResourceVersion = requireOpaqueRef(
      proposal.expectedResourceVersion,
      "invalid_crm_resource_version",
    );
  }
  if (proposal.expectedRecordVersion !== undefined) {
    base.expectedRecordVersion = requireOpaqueRef(
      proposal.expectedRecordVersion,
      "invalid_crm_record_version",
    );
  }

  return base;
}

function validateSignals(value: unknown, proposal: CrmWriteProposal): CrmWriteSignals {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new GovernanceInputError("invalid_crm_signals");
  }
  const signals = value as Record<string, unknown>;
  assertExactSignalSet(signals, CRM_SIGNAL_KEYS, "invalid_crm_signal_set");

  const bulkRecordCount = requireNumberSignal(
    signals.bulk_record_count,
    1,
    1,
    "invalid_bulk_record_count",
  );
  const recordType = requireCrmRecordType(signals.record_type, "invalid_crm_record_type_signal");
  if (recordType !== proposal.recordType) {
    throw new GovernanceInputError("crm_record_type_signal_mismatch");
  }

  return {
    actor_authorized: requireBooleanSignal(signals.actor_authorized, "invalid_actor_authorized"),
    bulk_record_count: bulkRecordCount,
    crm_write_preflight_complete: requireBooleanSignal(
      signals.crm_write_preflight_complete,
      "invalid_crm_write_preflight_complete",
    ),
    record_type: recordType,
    restricted_field_present: requireBooleanSignal(
      signals.restricted_field_present,
      "invalid_restricted_field_present",
    ),
    step_up_complete: requireBooleanSignal(signals.step_up_complete, "invalid_step_up_complete"),
    transition_allowed: requireBooleanSignal(
      signals.transition_allowed,
      "invalid_transition_allowed",
    ),
    write_class: requireCrmWriteClass(signals.write_class, "invalid_write_class"),
  };
}

function proposalParameters(proposal: CrmWriteProposal): Record<string, unknown> {
  const parameters: Record<string, unknown> = {
    actor_ref: proposal.actorRef,
    field_set_code: proposal.fieldSetCode,
    operation: proposal.operation,
    patch_digest: proposal.patchDigest,
    proposal_id: proposal.proposalId,
    record_ref: proposal.recordRef,
    record_type: proposal.recordType,
    resource_ref: proposal.resourceRef,
  };
  if (proposal.expectedRecordVersion !== undefined) {
    parameters.expected_record_version = proposal.expectedRecordVersion;
  }
  if (proposal.expectedResourceVersion !== undefined) {
    parameters.expected_resource_version = proposal.expectedResourceVersion;
  }
  return parameters;
}

function buildAction(
  input: CrmActionInput,
  actionName: string,
  proposal: CrmWriteProposal,
  signals: CrmWriteSignals,
): ActionContext {
  assertExactKeys(
    input as unknown as Record<string, unknown>,
    ACTION_INPUT_KEYS,
    "unknown_crm_action_field",
  );
  if (
    input.environment !== "production" &&
    input.environment !== "staging" &&
    input.environment !== "test"
  ) {
    throw new GovernanceInputError("invalid_crm_environment");
  }
  if (!Array.isArray(input.actorRoles) || input.actorRoles.length < 1 || input.actorRoles.length > 20) {
    throw new GovernanceInputError("invalid_crm_actor_roles");
  }
  return {
    actionName,
    actorId: requireOpaqueRef(input.actorId, "invalid_crm_actor_id"),
    actorRoles: [...input.actorRoles],
    conversationId: requireOpaqueRef(input.conversationId, "invalid_crm_conversation_id"),
    environment: input.environment,
    parameters: proposalParameters(proposal),
    projectId: requireOpaqueRef(input.projectId, "invalid_crm_project_id"),
    proposalVersion: proposal.proposalVersion,
    schemaVersion: ACTION_CONTEXT_SCHEMA_VERSION,
    signals,
    tenantId: requireOpaqueRef(input.tenantId, "invalid_crm_tenant_id"),
    turnId: requireOpaqueRef(input.turnId, "invalid_crm_turn_id"),
    userId: requireOpaqueRef(input.userId, "invalid_crm_user_id"),
  };
}

export function createCrmFieldsUpdateAction(input: CrmActionInput): ActionContext {
  const proposal = validateProposal(input.proposal, "fields_update");
  const signals = validateSignals(input.signals, proposal);
  return buildAction(input, CRM_RECORD_FIELDS_UPDATE, proposal, signals);
}

export function createCrmLeadStageChangeAction(input: CrmActionInput): ActionContext {
  const proposal = validateProposal(input.proposal, "stage_change");
  const signals = validateSignals(input.signals, proposal);
  return buildAction(input, CRM_LEAD_STAGE_CHANGE, proposal, signals);
}

export function createCrmAssignmentChangeAction(input: CrmActionInput): ActionContext {
  const proposal = validateProposal(input.proposal, "assignment_change");
  const signals = validateSignals(input.signals, proposal);
  return buildAction(input, CRM_RECORD_ASSIGNMENT_CHANGE, proposal, signals);
}
