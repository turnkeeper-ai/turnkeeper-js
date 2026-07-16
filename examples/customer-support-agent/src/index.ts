import { pathToFileURL } from "node:url";

import {
  ACTION_CONTEXT_SCHEMA_VERSION,
  generatePolicy,
  simulateAction,
} from "@turnkeeper/sdk";

export interface RefundProposal {
  amount: number;
  orderRef: string;
}

export const refundPolicy = generatePolicy({
  actionName: "issue_refund",
  allowedRoles: ["support_agent"],
  approvalRequired: true,
  parameterRestrictions: [
    { kind: "required", parameter: "order_ref" },
    { kind: "max_number", maximum: 5000, parameter: "amount" },
  ],
  requiredConditions: [
    {
      operator: "gte",
      signalKey: "amount",
      value: 100,
      valueType: "number",
    },
  ],
  riskLevel: "high",
});

export function evaluateRefund(
  proposal: RefundProposal,
  actorRoles: string[] = ["support_agent"],
  bindingSecret = process.env.TURNKEEPER_BINDING_SECRET,
) {
  if (!bindingSecret) throw new Error("TURNKEEPER_BINDING_SECRET is required.");
  const result = simulateAction(
    refundPolicy,
    {
      actionName: "issue_refund",
      actorId: "actor_support_demo",
      actorRoles,
      conversationId: "conversation_support_demo",
      environment: "test",
      parameters: {
        amount: proposal.amount,
        order_ref: proposal.orderRef,
      },
      projectId: "project_support_demo",
      proposalVersion: 1,
      schemaVersion: ACTION_CONTEXT_SCHEMA_VERSION,
      signals: { amount: proposal.amount },
      tenantId: "tenant_support_demo",
      turnId: "turn_support_demo",
      userId: "subject_support_demo",
    },
    { bindingSecret },
  );

  return {
    actionBinding: result.actionBinding,
    decision: result.decision,
    outcome:
      result.decision === "review"
        ? "pending_review"
        : result.decision === "block"
          ? "blocked"
          : "ready",
    reasonCode: result.reasonCode,
  } as const;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = evaluateRefund({ amount: 150, orderRef: "order_demo_001" });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
