import assert from "node:assert/strict";
import test from "node:test";

import {
  CRM_RECORD_FIELDS_UPDATE,
  createActionBinding,
  createCrmAssignmentChangeAction,
  createCrmFieldsUpdateAction,
  createCrmLeadStageChangeAction,
  GovernanceInputError,
  type CrmWriteProposal,
} from "../src/index.js";

const BINDING_SECRET = "synthetic-binding-secret-that-is-at-least-32-bytes";
const PATCH_DIGEST = "a".repeat(64);

function createProposal(overrides: Partial<CrmWriteProposal> = {}): CrmWriteProposal {
  return {
    actorRef: "actor_crm_1",
    fieldSetCode: "lead_status_fields",
    operation: "fields_update",
    patchDigest: PATCH_DIGEST,
    proposalId: "proposal_crm_1",
    proposalVersion: 1,
    recordRef: "record_lead_42",
    recordType: "lead",
    resourceRef: "resource_lead_pipeline",
    ...overrides,
  };
}

function createSignals(overrides: Record<string, unknown> = {}) {
  return {
    actor_authorized: true,
    bulk_record_count: 1,
    crm_write_preflight_complete: true,
    record_type: "lead",
    restricted_field_present: false,
    step_up_complete: true,
    transition_allowed: true,
    write_class: "ordinary",
    ...overrides,
  };
}

function createInput(overrides: Record<string, unknown> = {}) {
  return {
    actorId: "actor_crm_1",
    actorRoles: ["crm_agent"],
    conversationId: "conversation_crm_1",
    environment: "test" as const,
    projectId: "project_crm_1",
    proposal: createProposal(),
    signals: createSignals(),
    tenantId: "tenant_crm_1",
    turnId: "turn_crm_1",
    userId: "subject_crm_1",
    ...overrides,
  };
}

test("crm fields update builder returns a dated ActionContext with exact signals", () => {
  const action = createCrmFieldsUpdateAction(createInput());
  assert.equal(action.actionName, CRM_RECORD_FIELDS_UPDATE);
  assert.equal(action.proposalVersion, 1);
  assert.equal(action.parameters.patch_digest, PATCH_DIGEST);
  assert.equal(action.parameters.field_set_code, "lead_status_fields");
  assert.deepEqual(action.signals, createSignals());
  assert.equal(createActionBinding(action, BINDING_SECRET).length, 64);
});

test("crm builders reject unknown fields, invalid digests, and missing signals", () => {
  assert.throws(
    () =>
      createCrmFieldsUpdateAction(
        createInput({
          proposal: { ...createProposal(), customerEmail: "private@example.com" },
        }),
      ),
    (error: unknown) =>
      error instanceof GovernanceInputError && error.code === "unknown_crm_proposal_field",
  );
  assert.throws(
    () =>
      createCrmFieldsUpdateAction(
        createInput({
          proposal: { ...createProposal(), patchDigest: "not-a-valid-digest" },
        }),
      ),
    (error: unknown) =>
      error instanceof GovernanceInputError && error.code === "invalid_crm_patch_digest",
  );
  assert.throws(
    () =>
      createCrmFieldsUpdateAction(
        createInput({
          signals: {
            actor_authorized: true,
            crm_write_preflight_complete: true,
          },
        }),
      ),
    (error: unknown) =>
      error instanceof GovernanceInputError && error.code === "invalid_crm_signal_set",
  );
});

test("crm builders reject bulk writes and record type mismatches", () => {
  assert.throws(
    () =>
      createCrmFieldsUpdateAction(
        createInput({
          signals: createSignals({ bulk_record_count: 2 }),
        }),
      ),
    (error: unknown) =>
      error instanceof GovernanceInputError && error.code === "invalid_bulk_record_count",
  );
  assert.throws(
    () =>
      createCrmFieldsUpdateAction(
        createInput({
          signals: createSignals({ record_type: "account" }),
        }),
      ),
    (error: unknown) =>
      error instanceof GovernanceInputError && error.code === "crm_record_type_signal_mismatch",
  );
});

test("crm builders reject invalid write classes and PII-shaped signal values", () => {
  assert.throws(
    () =>
      createCrmFieldsUpdateAction(
        createInput({
          signals: createSignals({ write_class: "person@example.com" }),
        }),
      ),
    (error: unknown) =>
      error instanceof GovernanceInputError && error.code === "invalid_write_class",
  );
});

test("crm binding changes when executable proposal fields change", () => {
  const first = createActionBinding(createCrmFieldsUpdateAction(createInput()), BINDING_SECRET);
  const changed = createActionBinding(
    createCrmFieldsUpdateAction(
      createInput({
        proposal: {
          ...createProposal(),
          fieldSetCode: "lead_owner_fields",
          proposalVersion: 2,
        },
      }),
    ),
    BINDING_SECRET,
  );
  assert.notEqual(first, changed);
});

test("lead stage and assignment builders require matching operations and exact signal sets", () => {
  const stageChange = createCrmLeadStageChangeAction({
    ...createInput(),
    proposal: {
      ...createProposal(),
      operation: "stage_change",
      proposalVersion: 2,
    },
  });
  assert.equal(stageChange.actionName, "crm.lead.stage.change");
  assert.equal(stageChange.parameters.operation, "stage_change");

  const assignmentChange = createCrmAssignmentChangeAction({
    ...createInput(),
    proposal: {
      ...createProposal(),
      fieldSetCode: "lead_assignment_fields",
      operation: "assignment_change",
      proposalVersion: 3,
    },
    signals: createSignals({ write_class: "ownership" }),
  });
  assert.equal(assignmentChange.actionName, "crm.record.assignment.change");
  assert.equal(assignmentChange.signals.write_class, "ownership");

  assert.throws(
    () =>
      createCrmLeadStageChangeAction(createInput()),
    (error: unknown) =>
      error instanceof GovernanceInputError && error.code === "invalid_crm_operation",
  );
});
