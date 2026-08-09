import type { IdentifierType } from "./exchange.js";

export const PRIVATE_MATCH_PROTOCOL = "turnkeeper-private-match-v1" as const;
export const PRIVATE_MATCH_CIPHERSUITE = "ristretto255-SHA512" as const;

export type PrivateMatchEvaluationRequestV1 = {
  protocol: typeof PRIVATE_MATCH_PROTOCOL;
  ciphersuite: typeof PRIVATE_MATCH_CIPHERSUITE;
  exchange_id: string;
  environment: string;
  key_id: string;
  epoch: string;
  identifier_type: IdentifierType;
  purpose: "local_investigation" | "specialist_review" | "audit_retention";
  blinded_element: string;
};

export type PrivateMatchEvaluationResponseV1 = Omit<
  PrivateMatchEvaluationRequestV1,
  "blinded_element"
> & {
  evaluated_element: string;
  proof: string;
  public_key: string;
  provider_container_digest: string;
};

export type PrivateMatchKeyManifestV1 = {
  schema_version: "1";
  protocol: typeof PRIVATE_MATCH_PROTOCOL;
  ciphersuite: typeof PRIVATE_MATCH_CIPHERSUITE;
  environment: string;
  exchange_id: string;
  issued_at: string;
  expires_at: string;
  keys: Array<{
    key_id: string;
    epoch: string;
    public_key: string;
    not_before: string;
    not_after: string;
  }>;
  release_key_id: string;
  signature: string;
};

export type PrivateMatchReleaseManifestV1 = {
  schema_version: "1";
  protocol: typeof PRIVATE_MATCH_PROTOCOL;
  source_commit: string;
  dependency_lock_sha256: string;
  container_digest: string;
  audit_report_sha256: string;
  audit_retest_completed: true;
  approved_at: string;
  approved_by: string[];
  release_key_id: string;
  signature: string;
};

export type PrivateMatchValidationResult<T> =
  { ok: true; value: T } | { ok: false; code: string; detail?: string };

const REQUEST_KEYS = new Set([
  "protocol",
  "ciphersuite",
  "exchange_id",
  "environment",
  "key_id",
  "epoch",
  "identifier_type",
  "purpose",
  "blinded_element",
]);
const TOKEN = /^[A-Za-z0-9._:-]{1,128}$/u;
const EPOCH = /^\d{4}-(0[1-9]|1[0-2])$/u;
const BASE64URL_32 = /^[A-Za-z0-9_-]{43}$/u;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactBase64Url32(value: unknown): value is string {
  if (typeof value !== "string" || !BASE64URL_32.test(value)) return false;
  const decoded = Buffer.from(value, "base64url");
  return decoded.length === 32 && decoded.toString("base64url") === value;
}

export function validatePrivateMatchEvaluationRequestV1(
  value: unknown,
): PrivateMatchValidationResult<PrivateMatchEvaluationRequestV1> {
  if (!record(value)) return { ok: false, code: "invalid_voprf_request" };
  const unexpected = Object.keys(value).find((key) => !REQUEST_KEYS.has(key));
  if (unexpected)
    return { ok: false, code: "unexpected_voprf_field", detail: unexpected };
  if (
    value.protocol !== PRIVATE_MATCH_PROTOCOL ||
    value.ciphersuite !== PRIVATE_MATCH_CIPHERSUITE
  )
    return { ok: false, code: "unsupported_voprf_protocol" };
  for (const field of ["exchange_id", "environment", "key_id"] as const)
    if (typeof value[field] !== "string" || !TOKEN.test(value[field]))
      return { ok: false, code: "invalid_voprf_request", detail: field };
  if (typeof value.epoch !== "string" || !EPOCH.test(value.epoch))
    return { ok: false, code: "invalid_voprf_request", detail: "epoch" };
  if (
    value.identifier_type !== "verified_email" &&
    value.identifier_type !== "verified_phone"
  )
    return {
      ok: false,
      code: "invalid_voprf_request",
      detail: "identifier_type",
    };
  if (
    value.purpose !== "local_investigation" &&
    value.purpose !== "specialist_review" &&
    value.purpose !== "audit_retention"
  )
    return { ok: false, code: "invalid_voprf_request", detail: "purpose" };
  if (!exactBase64Url32(value.blinded_element))
    return { ok: false, code: "invalid_blinded_element" };
  return { ok: true, value: value as PrivateMatchEvaluationRequestV1 };
}
