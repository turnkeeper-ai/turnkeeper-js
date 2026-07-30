import { GovernanceInputError } from "../policy.js";

const OPAQUE_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u;
const TAXONOMY_CODE_PATTERN = /^[a-z0-9][a-z0-9_.:/-]{0,119}$/u;
const HEX_DIGEST_PATTERN = /^[a-f0-9]{64}$/u;
const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/u;
const IANA_TIMEZONE_PATTERN = /^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+)$/u;
const ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/u;

export type GovernedProposalBase = {
  actorRef: string;
  expectedResourceVersion?: string;
  operation: string;
  proposalId: string;
  proposalVersion: number;
  resourceRef: string;
};

export function assertExactKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  code: string,
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new GovernanceInputError(code);
    }
  }
}

export function requireOpaqueRef(value: unknown, code: string): string {
  if (typeof value !== "string" || !OPAQUE_REF_PATTERN.test(value)) {
    throw new GovernanceInputError(code);
  }
  return value;
}

export function requireTaxonomyCode(value: unknown, code: string): string {
  if (typeof value !== "string" || !TAXONOMY_CODE_PATTERN.test(value)) {
    throw new GovernanceInputError(code);
  }
  return value;
}

export function requireHexDigest(value: unknown, code: string): string {
  if (typeof value !== "string" || !HEX_DIGEST_PATTERN.test(value)) {
    throw new GovernanceInputError(code);
  }
  return value;
}

export function requireCurrencyCode(value: unknown, code: string): string {
  if (typeof value !== "string" || !CURRENCY_CODE_PATTERN.test(value)) {
    throw new GovernanceInputError(code);
  }
  return value;
}

export function requireNonNegativeSafeInteger(
  value: unknown,
  maximum: number,
  code: string,
): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > maximum) {
    throw new GovernanceInputError(code);
  }
  return Number(value);
}

export function requirePositiveSafeInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  code: string,
): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new GovernanceInputError(code);
  }
  return Number(value);
}

export function requireIsoInstant(value: unknown, code: string): string {
  if (typeof value !== "string" || !ISO_INSTANT_PATTERN.test(value)) {
    throw new GovernanceInputError(code);
  }
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) {
    throw new GovernanceInputError(code);
  }
  return value;
}

export function requireIanaTimezone(value: unknown, code: string): string {
  if (typeof value !== "string" || !IANA_TIMEZONE_PATTERN.test(value) || value.length > 64) {
    throw new GovernanceInputError(code);
  }
  return value;
}

export function assertExactSignalSet(
  signals: Record<string, unknown>,
  required: ReadonlySet<string>,
  code: string,
): void {
  const keys = Object.keys(signals);
  if (keys.length !== required.size || keys.some((key) => !required.has(key))) {
    throw new GovernanceInputError(code);
  }
}

export function requireBooleanSignal(value: unknown, code: string): boolean {
  if (typeof value !== "boolean") {
    throw new GovernanceInputError(code);
  }
  return value;
}

export function requireNumberSignal(
  value: unknown,
  minimum: number,
  maximum: number,
  code: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new GovernanceInputError(code);
  }
  return value;
}

export function durationMinutes(startsAt: string, endsAt: string): number {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  const minutes = (end - start) / 60_000;
  if (!Number.isFinite(minutes) || end <= start) {
    throw new GovernanceInputError("invalid_appointment_interval");
  }
  return minutes;
}
