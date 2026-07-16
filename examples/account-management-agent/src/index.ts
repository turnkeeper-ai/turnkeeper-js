import { pathToFileURL } from "node:url";

import {
  ACTION_CONTEXT_SCHEMA_VERSION,
  generatePolicy,
  simulateAction,
} from "@turnkeeper/sdk";

export const profilePolicy = generatePolicy({
  actionName: "update_profile",
  allowedRoles: ["account_agent"],
  approvalRequired: false,
  parameterRestrictions: [{ kind: "required", parameter: "profile_patch_ref" }],
  requiredConditions: [],
  riskLevel: "low",
});

export const cancellationPolicy = generatePolicy({
  actionName: "cancel_account",
  allowedRoles: ["account_admin"],
  approvalRequired: true,
  parameterRestrictions: [{ kind: "required", parameter: "account_ref" }],
  requiredConditions: [],
  riskLevel: "critical",
});

export const paymentPolicy = generatePolicy({
  actionName: "change_payment",
  allowedRoles: ["billing_admin"],
  approvalRequired: true,
  parameterRestrictions: [{ kind: "required", parameter: "payment_method_ref" }],
  requiredConditions: [],
  riskLevel: "critical",
});

function evaluate(
  bundle: ReturnType<typeof generatePolicy>,
  parameters: Record<string, unknown>,
  actorRoles: string[],
  bindingSecret = process.env.TURNKEEPER_BINDING_SECRET,
) {
  if (!bindingSecret) throw new Error("TURNKEEPER_BINDING_SECRET is required.");
  return simulateAction(
    bundle,
    {
      actionName: bundle.actionName,
      actorId: "actor_account_demo",
      actorRoles,
      conversationId: "conversation_account_demo",
      environment: "test",
      parameters,
      projectId: "project_account_demo",
      proposalVersion: 1,
      schemaVersion: ACTION_CONTEXT_SCHEMA_VERSION,
      signals: {},
      tenantId: "tenant_account_demo",
      turnId: "turn_account_demo",
      userId: "subject_account_demo",
    },
    { bindingSecret },
  );
}

export const accountActions = {
  cancelAccount: (
    accountRef: string,
    actorRoles: string[] = ["account_admin"],
    bindingSecret = process.env.TURNKEEPER_BINDING_SECRET,
  ) => evaluate(cancellationPolicy, { account_ref: accountRef }, actorRoles, bindingSecret),
  changePayment: (
    paymentMethodRef: string,
    actorRoles: string[] = ["billing_admin"],
    bindingSecret = process.env.TURNKEEPER_BINDING_SECRET,
  ) =>
    evaluate(
      paymentPolicy,
      { payment_method_ref: paymentMethodRef },
      actorRoles,
      bindingSecret,
    ),
  updateProfile: (
    profilePatchRef: string,
    actorRoles: string[] = ["account_agent"],
    bindingSecret = process.env.TURNKEEPER_BINDING_SECRET,
  ) =>
    evaluate(
      profilePolicy,
      { profile_patch_ref: profilePatchRef },
      actorRoles,
      bindingSecret,
    ),
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = {
    cancellation: accountActions.cancelAccount("account_demo_001"),
    payment: accountActions.changePayment("payment_ref_demo_001"),
    profile: accountActions.updateProfile("profile_patch_demo_001"),
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
