import { canonicalSHA256 } from "../replay/validation.js";
import { createTransport, type TurnkeeperFetch } from "../transport.js";
import { TurnkeeperProtocolError } from "../errors.js";
import {
  PolicyBundleSchema,
  createActionBinding,
  deriveIdempotencyKey,
  simulateAction,
  validatePolicy,
  type ActionContext,
  type ControlPolicy,
  type PolicyBundle,
  type PolicyDecision,
} from "./policy.js";

const REQUEST_ID_PATTERN = /^req_[A-Za-z0-9_-]{1,96}$/u;
const CHECK_ID_PATTERN = /^chk_[A-Za-z0-9_-]{1,96}$/u;
const RECORD_ID_PATTERN = /^grc_[A-Za-z0-9_-]{1,96}$/u;
const REVIEW_ID_PATTERN = /^rev_[A-Za-z0-9_-]{1,96}$/u;
const CODE_PATTERN = /^[a-z0-9][a-z0-9_.:/-]{0,119}$/u;
const HEX_64_PATTERN = /^[a-f0-9]{64}$/u;

export interface ControlClientOptions {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly fetch?: TurnkeeperFetch;
  readonly timeoutMs?: number;
}

export interface ControlCheckOptions {
  readonly bindingSecret: string | Uint8Array;
  readonly signal?: AbortSignal;
}

export interface ControlEvidence {
  readonly recordHash: string;
  readonly recordId: string;
  readonly requestHash: string;
}

export interface ControlReview {
  readonly id: string;
  readonly status: string;
  readonly version: number;
}

export interface ControlCheckResult {
  readonly actionBinding: string;
  readonly checkId: string | null;
  readonly decision: PolicyDecision;
  readonly evidence: ControlEvidence | null;
  readonly idempotencyKey: string;
  readonly matched: boolean;
  readonly reasonCode: string;
  readonly requestId: string | null;
  readonly review: ControlReview | null;
  readonly source: "local_guard" | "turnkeeper";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function safeString(value: unknown, pattern: RegExp): string | null {
  return typeof value === "string" && pattern.test(value) ? value : null;
}

interface HostedPolicySummary {
  readonly condition: {
    readonly key: string | null;
    readonly operator: string;
    readonly type: string;
    readonly value: string | null;
  };
  readonly id: string;
  readonly name: string;
  readonly ruleCode: string;
  readonly version: number;
}

function parsePolicySummary(value: unknown): HostedPolicySummary | null {
  if (!isPlainObject(value)) return null;
  if (
    !exactKeys(
      value,
      new Set(["id", "name", "condition", "rule_code", "version"]),
    )
  ) {
    return null;
  }
  if (
    !safeString(value.id, /^pol_[A-Za-z0-9_-]{1,96}$/u) ||
    typeof value.name !== "string" ||
    value.name.length > 120 ||
    !safeString(value.rule_code, CODE_PATTERN) ||
    !Number.isSafeInteger(value.version)
  ) {
    return null;
  }
  const condition = value.condition;
  if (
    !isPlainObject(condition) ||
    !exactKeys(condition, new Set(["key", "operator", "type", "value"])) ||
    (condition.key !== null && typeof condition.key !== "string") ||
    typeof condition.operator !== "string" ||
    typeof condition.type !== "string" ||
    (condition.value !== null && typeof condition.value !== "string")
  ) {
    return null;
  }
  return {
    condition: {
      key: condition.key,
      operator: condition.operator,
      type: condition.type,
      value: condition.value,
    },
    id: String(value.id),
    name: value.name,
    ruleCode: String(value.rule_code),
    version: Number(value.version),
  };
}

function parseResponse(
  value: unknown,
  expectedDecision: PolicyDecision,
  expectedPolicy: ControlPolicy,
  expectedReasonCode: string,
  expectedRequestHash: string,
): Omit<ControlCheckResult, "actionBinding" | "idempotencyKey" | "source"> {
  if (
    !isPlainObject(value) ||
    !exactKeys(
      value,
      new Set([
        "request_id",
        "check_id",
        "decision",
        "evidence",
        "matched",
        "policy",
        "reason_code",
        "review",
      ]),
    )
  ) {
    throw new TurnkeeperProtocolError("invalid_control_response");
  }
  const requestId = safeString(value.request_id, REQUEST_ID_PATTERN);
  const checkId = safeString(value.check_id, CHECK_ID_PATTERN);
  const reasonCode = safeString(value.reason_code, CODE_PATTERN);
  if (!requestId || !checkId || !reasonCode || value.matched !== true) {
    throw new TurnkeeperProtocolError("unmatched_or_invalid_control_response");
  }
  if (
    value.decision !== "allow" &&
    value.decision !== "audit" &&
    value.decision !== "review" &&
    value.decision !== "block"
  ) {
    throw new TurnkeeperProtocolError("invalid_control_decision", { requestId });
  }
  if (value.decision !== expectedDecision) {
    throw new TurnkeeperProtocolError("policy_configuration_mismatch", { requestId });
  }
  const hostedPolicy = parsePolicySummary(value.policy);
  if (!hostedPolicy) {
    throw new TurnkeeperProtocolError("invalid_control_policy", { requestId });
  }
  const expectedCondition = {
    key: expectedPolicy.signalKey || null,
    operator: expectedPolicy.operator,
    type: expectedPolicy.valueType,
    value: expectedPolicy.signalValue || null,
  };
  if (
    hostedPolicy.ruleCode !== expectedPolicy.ruleCode ||
    hostedPolicy.name !== expectedPolicy.name ||
    reasonCode !== expectedReasonCode ||
    hostedPolicy.condition.key !== expectedCondition.key ||
    hostedPolicy.condition.operator !== expectedCondition.operator ||
    hostedPolicy.condition.type !== expectedCondition.type ||
    hostedPolicy.condition.value !== expectedCondition.value
  ) {
    throw new TurnkeeperProtocolError("policy_configuration_mismatch", { requestId });
  }

  const evidenceValue = value.evidence;
  if (
    !isPlainObject(evidenceValue) ||
    !exactKeys(evidenceValue, new Set(["record_hash", "record_id", "request_hash"]))
  ) {
    throw new TurnkeeperProtocolError("invalid_control_evidence", { requestId });
  }
  const recordHash = safeString(evidenceValue.record_hash, HEX_64_PATTERN);
  const recordId = safeString(evidenceValue.record_id, RECORD_ID_PATTERN);
  const requestHash = safeString(evidenceValue.request_hash, HEX_64_PATTERN);
  if (!recordHash || !recordId || !requestHash || requestHash !== expectedRequestHash) {
    throw new TurnkeeperProtocolError("control_request_hash_mismatch", { requestId });
  }

  let review: ControlReview | null = null;
  if (value.decision === "review") {
    if (
      !isPlainObject(value.review) ||
      !exactKeys(value.review, new Set(["id", "status", "version"]))
    ) {
      throw new TurnkeeperProtocolError("missing_control_review", { requestId });
    }
    const id = safeString(value.review.id, REVIEW_ID_PATTERN);
    const status = safeString(value.review.status, CODE_PATTERN);
    if (!id || !status || !Number.isSafeInteger(value.review.version) || Number(value.review.version) < 1) {
      throw new TurnkeeperProtocolError("invalid_control_review", { requestId });
    }
    review = { id, status, version: Number(value.review.version) };
  } else if (value.review !== null) {
    throw new TurnkeeperProtocolError("unexpected_control_review", { requestId });
  }

  return {
    checkId,
    decision: value.decision,
    evidence: { recordHash, recordId, requestHash },
    matched: true,
    reasonCode,
    requestId,
    review,
  };
}

export class ControlClient {
  readonly #transport: ReturnType<typeof createTransport>;

  constructor(options: ControlClientOptions) {
    this.#transport = createTransport(options);
  }

  async check(
    bundleValue: PolicyBundle | unknown,
    action: ActionContext,
    options: ControlCheckOptions,
  ): Promise<ControlCheckResult> {
    const validation = validatePolicy(bundleValue);
    if (!validation.valid) {
      throw new TurnkeeperProtocolError("invalid_local_policy_bundle");
    }
    const bundle = PolicyBundleSchema.parse(bundleValue);
    const local = simulateAction(bundle, action, { bindingSecret: options.bindingSecret });
    const idempotencyKey = deriveIdempotencyKey(local.actionBinding);

    if (local.decision === "block") {
      return {
        actionBinding: local.actionBinding,
        checkId: null,
        decision: "block",
        evidence: null,
        idempotencyKey,
        matched: local.matchedPolicy !== null,
        reasonCode: local.reasonCode,
        requestId: null,
        review: null,
        source: "local_guard",
      };
    }

    const body = {
      references: { action_id: local.actionBinding },
      signals: action.signals,
      workflow: action.actionName,
    };
    const requestHash = canonicalSHA256(body);
    if (!local.matchedPolicy) {
      throw new TurnkeeperProtocolError("policy_fallback_not_reachable");
    }
    const response = await this.#transport.requestJson("/api/v1/checks", {
      body: JSON.stringify(body),
      idempotencyKey,
      method: "POST",
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
    return {
      actionBinding: createActionBinding(action, options.bindingSecret),
      idempotencyKey,
      source: "turnkeeper",
      ...parseResponse(
        response,
        local.decision,
        local.matchedPolicy,
        local.reasonCode,
        requestHash,
      ),
    };
  }
}
