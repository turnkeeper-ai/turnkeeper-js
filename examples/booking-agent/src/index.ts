import { pathToFileURL } from "node:url";

import {
  ACTION_CONTEXT_SCHEMA_VERSION,
  generatePolicy,
  simulateAction,
} from "@turnkeeper/sdk";

export interface BookingProposal {
  slotRef: string;
  subjectRef: string;
}

export const bookingPolicy = generatePolicy({
  actionName: "confirm_booking",
  allowedRoles: ["scheduler"],
  approvalRequired: true,
  parameterRestrictions: [
    { kind: "required", parameter: "slot_ref" },
    { kind: "required", parameter: "subject_ref" },
  ],
  requiredConditions: [],
  riskLevel: "high",
});

export function searchAvailability(dateCode: string): string[] {
  return [`${dateCode}_0900`, `${dateCode}_1300`];
}

export function evaluateBooking(
  proposal: BookingProposal,
  actorRoles: string[] = ["scheduler"],
  bindingSecret = process.env.TURNKEEPER_BINDING_SECRET,
) {
  if (!bindingSecret) throw new Error("TURNKEEPER_BINDING_SECRET is required.");
  return simulateAction(
    bookingPolicy,
    {
      actionName: "confirm_booking",
      actorId: "actor_scheduler_demo",
      actorRoles,
      conversationId: "conversation_booking_demo",
      environment: "test",
      parameters: {
        slot_ref: proposal.slotRef,
        subject_ref: proposal.subjectRef,
      },
      projectId: "project_booking_demo",
      proposalVersion: 1,
      schemaVersion: ACTION_CONTEXT_SCHEMA_VERSION,
      signals: {},
      tenantId: "tenant_booking_demo",
      turnId: "turn_booking_demo",
      userId: "subject_booking_demo",
    },
    { bindingSecret },
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = evaluateBooking({
    slotRef: "slot_demo_0900",
    subjectRef: "subject_demo_001",
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
