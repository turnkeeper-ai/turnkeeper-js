import { TurnkeeperProtocolError, TurnkeeperValidationError } from "../errors.js";
import {
  REPLAY_API_VERSION,
  REPLAY_EVENT_TYPES,
  type OpaqueReplayId,
  type ReplayBatch,
  type ReplayEnvelopeValidationResult,
  type ReplayEvent,
  type ReplayEventType,
  type ReplayReadEvent,
  type ReplayReadQuery,
  type ReplayReadResponse,
  type ReplayValidationIssue,
  type ReplayWriteResponse,
  type ReplayWriteResult,
} from "./types.js";

export const MAX_REPLAY_REQUEST_BYTES = 1024 * 1024;
export const MAX_REPLAY_EVENT_BYTES = 16 * 1024;
export const MAX_REPLAY_BATCH_EVENTS = 500;

const MAX_FUTURE_MS = 5 * 60 * 1000;
const DEFAULT_RETENTION_DAYS = 30;
const MAX_INTEGER = 2_147_483_647;
const MAX_LATENCY_MS = 86_400_000;
const MAX_MESSAGE_LENGTH = 1_048_576;
const MAX_CODE_LENGTH = 120;
const MAX_EXTRACTED_FIELDS = 32;

const HEX_64_RE = /^[a-f0-9]{64}$/;
const CODE_RE = /^[A-Za-z0-9_.:/-]{1,120}$/;
const SAFE_ERROR_CODE_RE = /^[a-z0-9_]{1,80}$/;
const REQUEST_ID_RE = /^req_[A-Za-z0-9_-]{1,96}$/;
const PUBLIC_EVENT_ID_RE = /^evt_[A-Za-z0-9_-]{1,120}$/;
const ISO_WITH_ZONE_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|([+-])(\d{2}):(\d{2}))$/;

const EVENT_TYPE_SET = new Set<string>(REPLAY_EVENT_TYPES);
const BOT_TYPES = new Set(["seller", "buyer"]);
const CHANNELS = new Set(["sms", "webhook", "simulator"]);
const PROVIDERS = new Set(["anthropic"]);
const DELIVERY_STATES = new Set(["queued", "held", "sent", "failed", "none"]);

const EVENT_KEYS = new Set([
  "api_version",
  "source_event_id",
  "type",
  "occurred_at",
  "conversation_external_id",
  "turn_external_id",
  "turn_index",
  "event_index",
  "parent_source_event_id",
  "trace_id",
  "data",
  "privacy",
]);
const REQUIRED_EVENT_KEYS = [
  "api_version",
  "source_event_id",
  "type",
  "occurred_at",
  "conversation_external_id",
  "turn_external_id",
  "event_index",
  "data",
  "privacy",
] as const;
const DATA_KEYS = new Set([
  "bot_type",
  "channel",
  "stage_before",
  "stage_after",
  "decision_code",
  "outcome_code",
  "reason_code",
  "reply_source",
  "extracted_field_names",
  "provider",
  "model",
  "input_tokens",
  "output_tokens",
  "cache_read_tokens",
  "cache_write_tokens",
  "latency_ms",
  "fallback",
  "message_length",
  "message_fingerprint",
  "delivery_state",
  "attempt",
]);
const CODE_DATA_FIELDS = [
  "stage_before",
  "stage_after",
  "decision_code",
  "outcome_code",
  "reason_code",
  "reply_source",
  "model",
] as const;
const COUNT_DATA_FIELDS = [
  "input_tokens",
  "output_tokens",
  "cache_read_tokens",
  "cache_write_tokens",
  "attempt",
] as const;

type PlainObject = Record<string, unknown>;

const hasOwn = (value: PlainObject, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

function isPlainObject(value: unknown): value is PlainObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function issue(path: string, code: string): ReplayValidationIssue {
  return { path, code };
}

function checkShape(
  value: unknown,
  path: string,
  allowed: ReadonlySet<string>,
  errors: ReplayValidationIssue[],
  required: readonly string[] = [],
): value is PlainObject {
  if (!isPlainObject(value)) {
    errors.push(issue(path, "invalid_object"));
    return false;
  }

  if (Object.keys(value).some((key) => !allowed.has(key))) {
    errors.push(issue(path, "unknown_key"));
  }
  for (const key of required) {
    if (!hasOwn(value, key)) errors.push(issue(`${path}.${key}`, "missing_field"));
  }
  return true;
}

function canonicalize(value: unknown, seen: Set<object>): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("non_json_number");
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (typeof value !== "object") throw new TypeError("non_json_value");
  if (seen.has(value)) throw new TypeError("cyclic_value");

  seen.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.keys(value).length !== value.length) throw new TypeError("sparse_or_extended_array");
      return `[${value.map((item) => canonicalize(item, seen)).join(",")}]`;
    }
    if (!isPlainObject(value) || Object.getOwnPropertySymbols(value).length > 0) {
      throw new TypeError("non_json_object");
    }
    return `{${Object.keys(value)
      .sort()
      .map((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !("value" in descriptor)) throw new TypeError("accessor_property");
        return `${JSON.stringify(key)}:${canonicalize(descriptor.value, seen)}`;
      })
      .join(",")}}`;
  } finally {
    seen.delete(value);
  }
}

export function stableCanonicalJson(value: unknown): string {
  return canonicalize(value, new Set());
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function looksUnsafe(value: string): boolean {
  const text = value.normalize("NFKC");
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) return true;
  if (/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/.test(text)) return true;
  if (/(?:https?:\/\/|www\.)/i.test(text)) return true;
  if (/[a-z0-9-]+\.(?:com|net|org|io|ai|dev|app)(?:[/?#:]|$)/i.test(text)) return true;
  const addressText = text.replace(/[._/:_-]+/g, " ");
  if (/\b\d{1,6}\s+(?:[a-z0-9]+\s+){0,4}(?:street|st|road|rd|avenue|ave|boulevard|blvd|lane|ln|drive|dr|court|ct|highway|hwy|way)\b/i.test(addressText)) {
    return true;
  }
  if (/^(?:sk|pk|rk|tk)_(?:live|test)_[A-Za-z0-9_-]{8,}$/i.test(text)) return true;
  if (/^(?:ghp_|github_pat_|xox[baprs]-)[A-Za-z0-9_-]{8,}$/i.test(text)) return true;
  if (/^AKIA[A-Z0-9]{16}$/.test(text)) return true;
  if (/^AIza[A-Za-z0-9_-]{20,}$/.test(text)) return true;
  if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(text)) return true;
  return /(?:password|passwd|secret|api[-_]?key|access[-_]?token|auth[-_]?token)[:=_-][A-Za-z0-9._/-]{8,}/i.test(text);
}

function validateCode(value: unknown, path: string, errors: ReplayValidationIssue[]): void {
  if (typeof value !== "string") {
    errors.push(issue(path, "invalid_type"));
  } else if (looksUnsafe(value)) {
    errors.push(issue(path, "unsafe_string"));
  } else if (value.length > MAX_CODE_LENGTH || !CODE_RE.test(value)) {
    errors.push(issue(path, "invalid_code"));
  }
}

function validateNullableCode(value: unknown, path: string, errors: ReplayValidationIssue[]): void {
  if (value !== null) validateCode(value, path, errors);
}

function validateHex(value: unknown, path: string, errors: ReplayValidationIssue[]): void {
  if (typeof value !== "string") errors.push(issue(path, "invalid_type"));
  else if (!HEX_64_RE.test(value)) errors.push(issue(path, "invalid_hex_id"));
}

function validateNullableHex(value: unknown, path: string, errors: ReplayValidationIssue[]): void {
  if (value !== null) validateHex(value, path, errors);
}

function validateInteger(
  value: unknown,
  path: string,
  errors: ReplayValidationIssue[],
  minimum = 0,
  maximum = MAX_INTEGER,
): void {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    errors.push(issue(path, "invalid_integer"));
  } else if (value < minimum || value > maximum) {
    errors.push(issue(path, "integer_out_of_range"));
  }
}

function validateNullableInteger(
  value: unknown,
  path: string,
  errors: ReplayValidationIssue[],
  minimum = 0,
  maximum = MAX_INTEGER,
): void {
  if (value !== null) validateInteger(value, path, errors, minimum, maximum);
}

function daysInMonth(year: number, month: number): number {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}

function parseStrictTimestamp(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = ISO_WITH_ZONE_RE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[8] === "Z" ? 0 : Number(match[10]);
  const offsetMinute = match[8] === "Z" ? 0 : Number(match[11]);
  if (
    month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month) ||
    hour > 23 || minute > 59 || second > 59 || offsetHour > 14 || offsetMinute > 59 ||
    (offsetHour === 14 && offsetMinute !== 0)
  ) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validateTimestamp(value: unknown, path: string, errors: ReplayValidationIssue[]): number | null {
  if (typeof value !== "string") {
    errors.push(issue(path, "invalid_type"));
    return null;
  }
  const parsed = parseStrictTimestamp(value);
  if (parsed === null) errors.push(issue(path, "invalid_timestamp"));
  return parsed;
}

function validateEnum(
  value: unknown,
  path: string,
  errors: ReplayValidationIssue[],
  allowed: ReadonlySet<string>,
): void {
  if (value === null) return;
  if (typeof value !== "string") errors.push(issue(path, "invalid_type"));
  else if (!allowed.has(value)) errors.push(issue(path, "invalid_enum"));
}

function validateData(value: unknown, path: string, errors: ReplayValidationIssue[]): void {
  if (!checkShape(value, path, DATA_KEYS, errors)) return;
  if (hasOwn(value, "bot_type")) validateEnum(value.bot_type, `${path}.bot_type`, errors, BOT_TYPES);
  if (hasOwn(value, "channel")) validateEnum(value.channel, `${path}.channel`, errors, CHANNELS);
  if (hasOwn(value, "provider")) validateEnum(value.provider, `${path}.provider`, errors, PROVIDERS);
  if (hasOwn(value, "delivery_state")) validateEnum(value.delivery_state, `${path}.delivery_state`, errors, DELIVERY_STATES);
  for (const field of CODE_DATA_FIELDS) {
    if (hasOwn(value, field)) validateNullableCode(value[field], `${path}.${field}`, errors);
  }
  for (const field of COUNT_DATA_FIELDS) {
    if (hasOwn(value, field)) validateNullableInteger(value[field], `${path}.${field}`, errors);
  }
  if (hasOwn(value, "latency_ms")) validateNullableInteger(value.latency_ms, `${path}.latency_ms`, errors, 0, MAX_LATENCY_MS);
  if (hasOwn(value, "message_length")) validateNullableInteger(value.message_length, `${path}.message_length`, errors, 0, MAX_MESSAGE_LENGTH);
  if (hasOwn(value, "fallback") && value.fallback !== null && typeof value.fallback !== "boolean") {
    errors.push(issue(`${path}.fallback`, "invalid_type"));
  }
  if (hasOwn(value, "message_fingerprint")) validateNullableHex(value.message_fingerprint, `${path}.message_fingerprint`, errors);
  if (hasOwn(value, "extracted_field_names") && value.extracted_field_names !== null) {
    if (!Array.isArray(value.extracted_field_names)) {
      errors.push(issue(`${path}.extracted_field_names`, "invalid_type"));
    } else if (value.extracted_field_names.length > MAX_EXTRACTED_FIELDS) {
      errors.push(issue(`${path}.extracted_field_names`, "array_too_large"));
    } else {
      value.extracted_field_names.forEach((field, index) => validateCode(field, `${path}.extracted_field_names[${index}]`, errors));
    }
  }
}

function validatePrivacy(value: unknown, path: string, errors: ReplayValidationIssue[]): void {
  if (!checkShape(value, path, new Set(["mode", "key_version"]), errors, ["mode", "key_version"])) return;
  if (hasOwn(value, "mode")) {
    if (typeof value.mode !== "string") errors.push(issue(`${path}.mode`, "invalid_type"));
    else if (value.mode !== "metadata_only") errors.push(issue(`${path}.mode`, "invalid_enum"));
  }
  if (hasOwn(value, "key_version")) validateInteger(value.key_version, `${path}.key_version`, errors, 1);
}

function validateEvent(
  value: unknown,
  index: number,
  nowMs: number,
  retentionMs: number,
): { readonly ok: true; readonly index: number } | { readonly ok: false; readonly index: number; readonly errors: readonly ReplayValidationIssue[] } {
  const path = `$.events[${index}]`;
  const errors: ReplayValidationIssue[] = [];
  try {
    if (utf8Bytes(stableCanonicalJson(value)) > MAX_REPLAY_EVENT_BYTES) errors.push(issue(path, "event_too_large"));
  } catch {
    errors.push(issue(path, "invalid_json_value"));
  }
  if (!checkShape(value, path, EVENT_KEYS, errors, REQUIRED_EVENT_KEYS)) return { ok: false, index, errors };

  if (hasOwn(value, "api_version")) {
    if (typeof value.api_version !== "string") errors.push(issue(`${path}.api_version`, "invalid_type"));
    else if (value.api_version !== REPLAY_API_VERSION) errors.push(issue(`${path}.api_version`, "unsupported_version"));
  }
  if (hasOwn(value, "source_event_id")) validateHex(value.source_event_id, `${path}.source_event_id`, errors);
  if (hasOwn(value, "type")) {
    if (typeof value.type !== "string") errors.push(issue(`${path}.type`, "invalid_type"));
    else if (!EVENT_TYPE_SET.has(value.type)) errors.push(issue(`${path}.type`, "invalid_enum"));
  }
  if (hasOwn(value, "occurred_at")) {
    const occurredAt = validateTimestamp(value.occurred_at, `${path}.occurred_at`, errors);
    if (occurredAt !== null && occurredAt > nowMs + MAX_FUTURE_MS) errors.push(issue(`${path}.occurred_at`, "timestamp_too_far_future"));
    else if (occurredAt !== null && occurredAt < nowMs - retentionMs) errors.push(issue(`${path}.occurred_at`, "timestamp_outside_retention"));
  }
  if (hasOwn(value, "conversation_external_id")) validateHex(value.conversation_external_id, `${path}.conversation_external_id`, errors);
  if (hasOwn(value, "turn_external_id")) validateHex(value.turn_external_id, `${path}.turn_external_id`, errors);
  if (hasOwn(value, "turn_index")) validateNullableInteger(value.turn_index, `${path}.turn_index`, errors);
  if (hasOwn(value, "event_index")) validateInteger(value.event_index, `${path}.event_index`, errors);
  if (hasOwn(value, "parent_source_event_id")) validateNullableHex(value.parent_source_event_id, `${path}.parent_source_event_id`, errors);
  if (hasOwn(value, "trace_id")) validateNullableHex(value.trace_id, `${path}.trace_id`, errors);
  if (hasOwn(value, "data")) validateData(value.data, `${path}.data`, errors);
  if (hasOwn(value, "privacy")) validatePrivacy(value.privacy, `${path}.privacy`, errors);
  return errors.length === 0 ? { ok: true, index } : { ok: false, index, errors };
}

export function validateReplayBatch(
  value: unknown,
  options: { readonly now?: Date; readonly retentionDays?: number } = {},
): ReplayEnvelopeValidationResult {
  const now = options.now ?? new Date();
  const retentionDays = options.retentionDays ?? DEFAULT_RETENTION_DAYS;
  const envelopeErrors: ReplayValidationIssue[] = [];
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) envelopeErrors.push(issue("$", "invalid_now_option"));
  if (typeof retentionDays !== "number" || !Number.isFinite(retentionDays) || retentionDays <= 0) {
    envelopeErrors.push(issue("$", "invalid_retention_option"));
  }
  if (!checkShape(value, "$", new Set(["events"]), envelopeErrors, ["events"])) {
    return { ok: false, envelopeErrors };
  }
  if (hasOwn(value, "events")) {
    if (!Array.isArray(value.events)) envelopeErrors.push(issue("$.events", "invalid_type"));
    else if (value.events.length < 1) envelopeErrors.push(issue("$.events", "batch_too_small"));
    else if (value.events.length > MAX_REPLAY_BATCH_EVENTS) envelopeErrors.push(issue("$.events", "batch_too_large"));
  }
  if (envelopeErrors.length > 0) return { ok: false, envelopeErrors };
  const events = value.events as unknown[];
  return {
    ok: true,
    events: events.map((event, index) => validateEvent(event, index, now.getTime(), retentionDays * 86_400_000)),
  };
}

export function assertValidReplayBatch(
  value: unknown,
  options: { readonly now?: Date; readonly retentionDays?: number } = {},
): asserts value is ReplayBatch {
  const result = validateReplayBatch(value, options);
  const issues = result.ok
    ? result.events.flatMap((event) => event.ok ? [] : event.errors)
    : result.envelopeErrors;
  if (issues.length > 0) throw new TurnkeeperValidationError(issues);
}

export function isOpaqueReplayId(value: unknown): value is OpaqueReplayId {
  return typeof value === "string" && HEX_64_RE.test(value);
}

export function parseOpaqueReplayId(value: unknown): OpaqueReplayId {
  if (!isOpaqueReplayId(value)) throw new TurnkeeperValidationError([issue("$", "invalid_hex_id")]);
  return value;
}

export function validateReplayReadQuery(query: ReplayReadQuery): readonly ReplayValidationIssue[] {
  const errors: ReplayValidationIssue[] = [];
  if (query.page !== undefined) validateInteger(query.page, "$.page", errors, 1, 1_000_000);
  if (query.limit !== undefined) validateInteger(query.limit, "$.limit", errors, 1, 100);
  if (query.type !== undefined && !EVENT_TYPE_SET.has(query.type)) errors.push(issue("$.type", "invalid_event_type"));
  if (query.conversationExternalId !== undefined) validateHex(query.conversationExternalId, "$.conversationExternalId", errors);
  if (query.turnExternalId !== undefined) validateHex(query.turnExternalId, "$.turnExternalId", errors);
  const from = query.from === undefined ? null : validateTimestamp(query.from, "$.from", errors);
  const to = query.to === undefined ? null : validateTimestamp(query.to, "$.to", errors);
  if (from !== null && to !== null && from > to) errors.push(issue("$.range", "invalid_range"));
  return errors;
}

function safeRequestId(value: unknown): string | null {
  return typeof value === "string" && REQUEST_ID_RE.test(value) ? value : null;
}

function safeIssue(value: unknown): ReplayValidationIssue | null {
  if (!isPlainObject(value) || typeof value.path !== "string" || typeof value.code !== "string") return null;
  if (value.path.length > 160 || !SAFE_ERROR_CODE_RE.test(value.code)) return null;
  return { path: value.path, code: value.code };
}

export function parseReplayWriteResponse(value: unknown, expectedEvents: readonly ReplayEvent[]): ReplayWriteResponse {
  if (!isPlainObject(value) || !Array.isArray(value.results)) throw new TurnkeeperProtocolError("invalid_write_response");
  const requestId = safeRequestId(value.request_id);
  if (!requestId || value.results.length !== expectedEvents.length) throw new TurnkeeperProtocolError("invalid_write_response");
  const results: ReplayWriteResult[] = value.results.map((candidate, index) => {
    if (!isPlainObject(candidate)) throw new TurnkeeperProtocolError("invalid_write_result", { requestId });
    const expected = expectedEvents[index];
    if (
      !expected || candidate.index !== index || candidate.source_event_id !== expected.source_event_id ||
      (candidate.status !== "accepted" && candidate.status !== "duplicate" && candidate.status !== "rejected") ||
      typeof candidate.code !== "string" || !SAFE_ERROR_CODE_RE.test(candidate.code)
    ) throw new TurnkeeperProtocolError("invalid_write_result", { requestId });
    const errors = candidate.errors === undefined
      ? undefined
      : Array.isArray(candidate.errors) && candidate.errors.length <= 12
        ? candidate.errors.map(safeIssue)
        : null;
    if (errors !== undefined && (errors === null || errors.some((entry) => entry === null))) {
      throw new TurnkeeperProtocolError("invalid_write_result", { requestId });
    }
    return {
      index,
      source_event_id: expected.source_event_id,
      status: candidate.status,
      code: candidate.code,
      ...(errors === undefined ? {} : { errors: errors as ReplayValidationIssue[] }),
    };
  });
  return { request_id: requestId, results };
}

function parseReadEvent(value: unknown, index: number, requestId: string): ReplayReadEvent {
  if (!isPlainObject(value)) throw new TurnkeeperProtocolError("invalid_read_event", { requestId });
  const path = `$.events[${index}]`;
  const errors: ReplayValidationIssue[] = [];
  checkShape(value, path, new Set([...EVENT_KEYS, "public_id"]), errors, [...REQUIRED_EVENT_KEYS, "turn_index", "parent_source_event_id", "trace_id", "public_id"]);
  if (value.api_version !== REPLAY_API_VERSION) errors.push(issue(`${path}.api_version`, "unsupported_version"));
  validateHex(value.source_event_id, `${path}.source_event_id`, errors);
  if (typeof value.type !== "string" || !EVENT_TYPE_SET.has(value.type)) errors.push(issue(`${path}.type`, "invalid_enum"));
  validateTimestamp(value.occurred_at, `${path}.occurred_at`, errors);
  validateHex(value.conversation_external_id, `${path}.conversation_external_id`, errors);
  validateHex(value.turn_external_id, `${path}.turn_external_id`, errors);
  validateNullableInteger(value.turn_index, `${path}.turn_index`, errors);
  validateInteger(value.event_index, `${path}.event_index`, errors);
  validateNullableHex(value.parent_source_event_id, `${path}.parent_source_event_id`, errors);
  validateNullableHex(value.trace_id, `${path}.trace_id`, errors);
  validateData(value.data, `${path}.data`, errors);
  validatePrivacy(value.privacy, `${path}.privacy`, errors);
  if (typeof value.public_id !== "string" || !PUBLIC_EVENT_ID_RE.test(value.public_id)) errors.push(issue(`${path}.public_id`, "invalid_public_id"));
  if (errors.length > 0) throw new TurnkeeperProtocolError("invalid_read_event", { requestId });
  return value as unknown as ReplayReadEvent;
}

export function parseReplayReadResponse(value: unknown): ReplayReadResponse {
  if (!isPlainObject(value) || !Array.isArray(value.events) || !isPlainObject(value.pagination)) {
    throw new TurnkeeperProtocolError("invalid_read_response");
  }
  const requestId = safeRequestId(value.request_id);
  if (!requestId) throw new TurnkeeperProtocolError("invalid_read_response");
  const pagination = value.pagination;
  const paginationValid =
    typeof pagination.has_next_page === "boolean" &&
    typeof pagination.has_previous_page === "boolean" &&
    Number.isInteger(pagination.page) && Number(pagination.page) >= 1 &&
    Number.isInteger(pagination.page_size) && Number(pagination.page_size) >= 1 && Number(pagination.page_size) <= 100 &&
    Number.isInteger(pagination.total_events) && Number(pagination.total_events) >= 0 &&
    Number.isInteger(pagination.total_pages) && Number(pagination.total_pages) >= 1;
  if (!paginationValid) throw new TurnkeeperProtocolError("invalid_read_pagination", { requestId });
  return {
    request_id: requestId,
    events: value.events.map((event, index) => parseReadEvent(event, index, requestId)),
    pagination: {
      has_next_page: pagination.has_next_page as boolean,
      has_previous_page: pagination.has_previous_page as boolean,
      page: pagination.page as number,
      page_size: pagination.page_size as number,
      total_events: pagination.total_events as number,
      total_pages: pagination.total_pages as number,
    },
  };
}

export function isReplayEventType(value: unknown): value is ReplayEventType {
  return typeof value === "string" && EVENT_TYPE_SET.has(value);
}
