/**
 * Domain validation for support.refund proposals and trusted signals.
 * Policy configuration (thresholds) must not appear in trusted signals.
 */

import type { SupportRefundProposal, SupportRefundSignals } from "./index.ts";

const OPAQUE_REF_PATTERN = /^[a-z]{2,8}_[A-Za-z0-9]{4,64}$/u;
const SIGNAL_KEYS = Object.freeze([
  "amount_cents",
  "customer_verified",
  "prior_refunds_30d",
  "refund_preflight_complete",
  "within_refund_window",
] as const);

export type SupportRefundValidationError = {
  code: string;
  path: string;
};

export function validateOpaqueReference(
  value: string,
  path: string,
): SupportRefundValidationError | null {
  if (!OPAQUE_REF_PATTERN.test(value)) {
    return { code: "invalid_opaque_reference", path };
  }
  return null;
}

export function validatePositiveIntegerCents(
  value: unknown,
  path: string,
): SupportRefundValidationError | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    return { code: "invalid_positive_integer_cents", path };
  }
  return null;
}

export function validateSupportRefundSignals(
  value: unknown,
): { ok: true; value: SupportRefundSignals } | { ok: false; errors: SupportRefundValidationError[] } {
  const errors: SupportRefundValidationError[] = [];
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: [{ code: "invalid_signals_object", path: "signals" }] };
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const expected = [...SIGNAL_KEYS].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    errors.push({ code: "exact_signal_shape_required", path: "signals" });
  }
  for (const banned of ["amount_threshold_cents", "velocity_threshold", "amountThresholdCents"]) {
    if (banned in record) {
      errors.push({ code: "policy_configuration_in_trusted_signals", path: `signals.${banned}` });
    }
  }
  const amountError = validatePositiveIntegerCents(record.amount_cents, "signals.amount_cents");
  if (amountError) errors.push(amountError);
  if (typeof record.customer_verified !== "boolean") {
    errors.push({ code: "invalid_boolean", path: "signals.customer_verified" });
  }
  if (
    typeof record.prior_refunds_30d !== "number" ||
    !Number.isInteger(record.prior_refunds_30d) ||
    record.prior_refunds_30d < 0
  ) {
    errors.push({ code: "invalid_non_negative_integer", path: "signals.prior_refunds_30d" });
  }
  if (typeof record.refund_preflight_complete !== "boolean") {
    errors.push({ code: "invalid_boolean", path: "signals.refund_preflight_complete" });
  }
  if (typeof record.within_refund_window !== "boolean") {
    errors.push({ code: "invalid_boolean", path: "signals.within_refund_window" });
  }
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      amount_cents: record.amount_cents as number,
      customer_verified: record.customer_verified as boolean,
      prior_refunds_30d: record.prior_refunds_30d as number,
      refund_preflight_complete: record.refund_preflight_complete as boolean,
      within_refund_window: record.within_refund_window as boolean,
    },
  };
}

export function validateSupportRefundProposal(
  value: unknown,
): { ok: true; value: SupportRefundProposal } | { ok: false; errors: SupportRefundValidationError[] } {
  const errors: SupportRefundValidationError[] = [];
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: [{ code: "invalid_proposal_object", path: "proposal" }] };
  }
  const record = value as Record<string, unknown>;
  const amountError = validatePositiveIntegerCents(record.amountCents, "proposal.amountCents");
  if (amountError) errors.push(amountError);
  if (typeof record.customerRef !== "string") {
    errors.push({ code: "invalid_string", path: "proposal.customerRef" });
  } else {
    const refError = validateOpaqueReference(record.customerRef, "proposal.customerRef");
    if (refError) errors.push(refError);
  }
  if (typeof record.transactionRef !== "string") {
    errors.push({ code: "invalid_string", path: "proposal.transactionRef" });
  } else {
    const refError = validateOpaqueReference(record.transactionRef, "proposal.transactionRef");
    if (refError) errors.push(refError);
  }
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      amountCents: record.amountCents as number,
      customerRef: record.customerRef as string,
      transactionRef: record.transactionRef as string,
    },
  };
}

export function assertProposalSignalConsistency(
  proposal: SupportRefundProposal,
  signals: SupportRefundSignals,
): void {
  if (proposal.amountCents !== signals.amount_cents) {
    throw new Error("proposal_signal_amount_mismatch");
  }
}
