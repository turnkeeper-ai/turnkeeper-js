import { createHmac } from "node:crypto";

import { z } from "zod";

const CODE_PATTERN = /^[a-z0-9][a-z0-9_.:/-]{0,119}$/u;
const SIGNAL_KEY_PATTERN = /^[a-z][a-z0-9_.-]{0,63}$/u;
const ROLE_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/u;
const HEX_64_PATTERN = /^[a-f0-9]{64}$/u;
const UNSAFE_KEY_PATTERN =
  /(?:^|[._-])(?:address|api_?key|auth|birth|completion|content|credential|email|message|name|password|phone|prompt|secret|ssn|text|token|transcript|uri|url)(?:$|[._-])/iu;

const MAX_PARAMETER_BYTES = 32 * 1024;
const MAX_PARAMETER_DEPTH = 12;
const MAX_PARAMETER_ENTRIES = 256;
const MAX_ARRAY_LENGTH = 128;
const MAX_PARAMETER_STRING_LENGTH = 2_048;
const BINDING_CONTEXT = "turnkeeper.action-binding.v1\0";

export const POLICY_SCHEMA_VERSION = "2026-07-16" as const;
export const ACTION_CONTEXT_SCHEMA_VERSION = "2026-07-16" as const;

export const RiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);
export const PolicyDecisionSchema = z.enum(["allow", "audit", "review", "block"]);
export const PolicyOperatorSchema = z.enum(["always", "exists", "equals", "in", "gte", "lte"]);
export const PolicyValueTypeSchema = z.enum(["string", "number", "boolean"]);
export const TurnkeeperEnvironmentSchema = z.enum(["production", "staging", "test"]);
export const SignalValueSchema = z.union([
  z
    .string()
    .max(120)
    .regex(CODE_PATTERN)
    .refine((value) => !looksUnsafeMetadataString(value), "unsafe_signal_value"),
  z.number().finite().min(-1_000_000_000_000).max(1_000_000_000_000),
  z.boolean(),
]);

export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;
export type PolicyOperator = z.infer<typeof PolicyOperatorSchema>;
export type PolicyValueType = z.infer<typeof PolicyValueTypeSchema>;
export type SignalValue = z.infer<typeof SignalValueSchema>;
export type TurnkeeperEnvironment = z.infer<typeof TurnkeeperEnvironmentSchema>;

export const PolicyConditionSchema = z
  .object({
    operator: PolicyOperatorSchema,
    signalKey: z.string().max(64).regex(SIGNAL_KEY_PATTERN).optional(),
    value: z.union([z.string().max(240), z.number().finite(), z.boolean()]).optional(),
    valueType: PolicyValueTypeSchema.default("string"),
  })
  .strict()
  .superRefine((condition, context) => {
    if (condition.operator !== "always" && !condition.signalKey) {
      context.addIssue({ code: "custom", message: "signal_key_required", path: ["signalKey"] });
    }
    if (condition.signalKey && UNSAFE_KEY_PATTERN.test(condition.signalKey)) {
      context.addIssue({ code: "custom", message: "unsafe_signal_key", path: ["signalKey"] });
    }
    if (condition.operator === "in" && condition.valueType !== "string") {
      context.addIssue({ code: "custom", message: "in_requires_string", path: ["valueType"] });
    }
    if (
      (condition.operator === "gte" || condition.operator === "lte") &&
      condition.valueType !== "number"
    ) {
      context.addIssue({
        code: "custom",
        message: "comparison_requires_number",
        path: ["valueType"],
      });
    }
    if (!["always", "exists"].includes(condition.operator) && condition.value === undefined) {
      context.addIssue({ code: "custom", message: "condition_value_required", path: ["value"] });
    }
  });

export const ParameterRestrictionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("required"),
      parameter: z.string().max(64).regex(SIGNAL_KEY_PATTERN),
    })
    .strict(),
  z
    .object({
      kind: z.literal("max_number"),
      maximum: z.number().finite(),
      parameter: z.string().max(64).regex(SIGNAL_KEY_PATTERN),
    })
    .strict(),
  z
    .object({
      kind: z.literal("allowed_values"),
      parameter: z.string().max(64).regex(SIGNAL_KEY_PATTERN),
      values: z
        .array(z.union([z.string().max(120), z.number().finite(), z.boolean()]))
        .min(1)
        .max(20),
    })
    .strict(),
]);

export const GeneratePolicyInputSchema = z
  .object({
    actionName: z.string().max(120).regex(CODE_PATTERN),
    allowedRoles: z.array(z.string().max(64).regex(ROLE_PATTERN)).min(1).max(20),
    approvalRequired: z.boolean(),
    parameterRestrictions: z.array(ParameterRestrictionSchema).max(20).default([]),
    requiredConditions: z.array(PolicyConditionSchema).max(1).default([]),
    riskLevel: RiskLevelSchema,
  })
  .strict();

export type PolicyCondition = z.infer<typeof PolicyConditionSchema>;
export type ParameterRestriction = z.infer<typeof ParameterRestrictionSchema>;
export type GeneratePolicyInput = z.input<typeof GeneratePolicyInputSchema>;

export const ControlPolicySchema = z
  .object({
    decision: PolicyDecisionSchema,
    description: z.string().max(500),
    name: z.string().min(1).max(120),
    operator: PolicyOperatorSchema,
    priority: z.number().int().min(0).max(10_000),
    reasonCode: z.string().max(120).regex(CODE_PATTERN),
    ruleCode: z.string().max(120).regex(CODE_PATTERN),
    signalKey: z.string().max(64).regex(SIGNAL_KEY_PATTERN).or(z.literal("")),
    signalValue: z.string().max(240),
    status: z.enum(["active", "draft"]),
    valueType: PolicyValueTypeSchema,
    workflow: z.string().max(120).regex(CODE_PATTERN),
  })
  .strict()
  .superRefine((policy, context) => {
    if (policy.operator === "always" && (policy.signalKey || policy.signalValue)) {
      context.addIssue({ code: "custom", message: "always_must_not_have_value", path: [] });
    }
    if (policy.operator === "exists" && policy.signalValue) {
      context.addIssue({ code: "custom", message: "exists_must_not_have_value", path: [] });
    }
    if (policy.operator !== "always" && !policy.signalKey) {
      context.addIssue({ code: "custom", message: "signal_key_required", path: ["signalKey"] });
    }
    if (policy.signalKey && UNSAFE_KEY_PATTERN.test(policy.signalKey)) {
      context.addIssue({ code: "custom", message: "unsafe_signal_key", path: ["signalKey"] });
    }
    if (policy.operator === "in") {
      const values = policy.signalValue.split(",").filter(Boolean);
      if (
        policy.valueType !== "string" ||
        values.length < 1 ||
        values.length > 20 ||
        values.some((value) => !CODE_PATTERN.test(value) || looksUnsafeMetadataString(value))
      ) {
        context.addIssue({ code: "custom", message: "invalid_in_values", path: ["signalValue"] });
      }
    }
    if (policy.operator === "gte" || policy.operator === "lte") {
      if (
        policy.valueType !== "number" ||
        policy.signalValue.trim() === "" ||
        !Number.isFinite(Number(policy.signalValue))
      ) {
        context.addIssue({
          code: "custom",
          message: "invalid_number_value",
          path: ["signalValue"],
        });
      }
    }
    if (
      policy.valueType === "boolean" &&
      !["always", "exists"].includes(policy.operator) &&
      policy.signalValue !== "true" &&
      policy.signalValue !== "false"
    ) {
      context.addIssue({
        code: "custom",
        message: "invalid_boolean_value",
        path: ["signalValue"],
      });
    }
    if (
      policy.valueType === "string" &&
      !["always", "exists", "in"].includes(policy.operator) &&
      (!CODE_PATTERN.test(policy.signalValue) || looksUnsafeMetadataString(policy.signalValue))
    ) {
      context.addIssue({
        code: "custom",
        message: "invalid_string_value",
        path: ["signalValue"],
      });
    }
  });

export type ControlPolicy = z.infer<typeof ControlPolicySchema>;

export const PolicyBundleSchema = z
  .object({
    actionName: z.string().max(120).regex(CODE_PATTERN),
    allowedRoles: z.array(z.string().max(64).regex(ROLE_PATTERN)).min(1).max(20),
    approvalRequired: z.boolean(),
    parameterRestrictions: z.array(ParameterRestrictionSchema).max(20),
    policies: z.array(ControlPolicySchema).min(1).max(32),
    riskLevel: RiskLevelSchema,
    schemaVersion: z.literal(POLICY_SCHEMA_VERSION),
  })
  .strict();

export type PolicyBundle = z.infer<typeof PolicyBundleSchema>;

export const ActionContextSchema = z
  .object({
    actionName: z.string().max(120).regex(CODE_PATTERN),
    actorId: z.string().min(1).max(160),
    actorRoles: z.array(z.string().max(64).regex(ROLE_PATTERN)).max(20),
    conversationId: z.string().min(1).max(160),
    environment: TurnkeeperEnvironmentSchema,
    parameters: z.record(z.string(), z.unknown()),
    projectId: z.string().min(1).max(160),
    proposalVersion: z.number().int().min(1).max(2_147_483_647),
    schemaVersion: z.literal(ACTION_CONTEXT_SCHEMA_VERSION),
    signals: z
      .record(z.string().regex(SIGNAL_KEY_PATTERN), SignalValueSchema)
      .refine(
        (signals) => Object.keys(signals).every((key) => !UNSAFE_KEY_PATTERN.test(key)),
        "unsafe_signal_key",
      ),
    tenantId: z.string().min(1).max(160),
    turnId: z.string().min(1).max(160),
    userId: z.string().min(1).max(160),
  })
  .strict();

export type ActionContext = z.infer<typeof ActionContextSchema>;

export interface PolicyFinding {
  readonly code: string;
  readonly path: string;
  readonly severity: "error" | "warning";
}

export interface PolicyValidationResult {
  readonly findings: readonly PolicyFinding[];
  readonly valid: boolean;
}

export interface SimulationOptions {
  readonly bindingSecret: string | Uint8Array;
}

export interface SimulationResult {
  readonly actionBinding: string;
  readonly decision: PolicyDecision;
  readonly matchedPolicy: ControlPolicy | null;
  readonly reasonCode: string;
  readonly source: "execution_guard" | "policy";
}

export interface GeneratedPolicyCase {
  readonly action: ActionContext;
  readonly expectedDecision: PolicyDecision;
  readonly name: string;
}

export interface GeneratedPolicyTests {
  readonly cases: readonly GeneratedPolicyCase[];
  readonly source: string;
}

export class GovernanceInputError extends Error {
  readonly code: string;

  constructor(code: string) {
    super("Turnkeeper governance input failed validation.");
    this.name = "GovernanceInputError";
    this.code = code;
  }

  toJSON(): Record<string, unknown> {
    return { code: this.code, message: this.message, name: this.name };
  }
}

function looksUnsafeMetadataString(value: string): boolean {
  const text = value.normalize("NFKC");
  if (/^[a-z][a-z0-9+.-]{1,31}:/iu.test(text)) return true;
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu.test(text)) return true;
  if (/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/u.test(text)) return true;
  if (/(?:https?:\/\/|www\.)/iu.test(text)) return true;
  if (/[a-z0-9-]+\.(?:com|net|org|io|ai|dev|app)(?:[/?#:]|$)/iu.test(text)) return true;
  const addressText = text.replace(/[._/:_-]+/gu, " ");
  if (
    /\b\d{1,6}\s+(?:[a-z0-9]+\s+){0,4}(?:street|st|road|rd|avenue|ave|boulevard|blvd|lane|ln|drive|dr|court|ct|highway|hwy|way)\b/iu.test(
      addressText,
    )
  ) {
    return true;
  }
  if (/^(?:sk|pk|rk|tk)_(?:live|test)_[A-Za-z0-9_-]{8,}$/iu.test(text)) return true;
  if (/^sk-(?:ant-api\d+|proj)-[A-Za-z0-9_-]{16,}$/iu.test(text)) return true;
  if (/^(?:ghp_|github_pat_|xox[baprs]-)[A-Za-z0-9_-]{8,}$/iu.test(text)) return true;
  if (/^AKIA[A-Z0-9]{16}$/u.test(text)) return true;
  if (/^AIza[A-Za-z0-9_-]{20,}$/u.test(text)) return true;
  if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(text)) return true;
  return /(?:password|passwd|secret|api[-_]?key|access[-_]?token|auth[-_]?token)[:=_-][A-Za-z0-9._/-]{8,}/iu.test(
    text,
  );
}

function policyValue(condition: PolicyCondition): {
  readonly signalKey: string;
  readonly signalValue: string;
  readonly valueType: PolicyValueType;
} {
  if (condition.operator === "always" || condition.operator === "exists") {
    return {
      signalKey: condition.signalKey ?? "",
      signalValue: "",
      valueType: condition.valueType,
    };
  }
  if (condition.operator === "in") {
    const values = String(condition.value)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (
      !values.length ||
      values.length > 20 ||
      values.some((value) => !CODE_PATTERN.test(value) || looksUnsafeMetadataString(value))
    ) {
      throw new GovernanceInputError("invalid_in_values");
    }
    return { signalKey: condition.signalKey ?? "", signalValue: values.join(","), valueType: "string" };
  }
  if (condition.valueType === "number" && typeof condition.value !== "number") {
    throw new GovernanceInputError("number_condition_requires_number");
  }
  if (condition.valueType === "boolean" && typeof condition.value !== "boolean") {
    throw new GovernanceInputError("boolean_condition_requires_boolean");
  }
  const value = String(condition.value);
  if (
    condition.valueType === "string" &&
    (!CODE_PATTERN.test(value) || looksUnsafeMetadataString(value))
  ) {
    throw new GovernanceInputError("invalid_string_condition");
  }
  return {
    signalKey: condition.signalKey ?? "",
    signalValue: value,
    valueType: condition.valueType,
  };
}

function primaryDecision(input: z.output<typeof GeneratePolicyInputSchema>): PolicyDecision {
  if (input.approvalRequired) return "review";
  if (input.riskLevel === "critical" || input.riskLevel === "high") {
    throw new GovernanceInputError("high_risk_requires_approval");
  }
  return input.riskLevel === "medium" ? "audit" : "allow";
}

function fallbackDecision(input: z.output<typeof GeneratePolicyInputSchema>): PolicyDecision {
  if (input.approvalRequired || input.riskLevel !== "low") return "block";
  return "allow";
}

function createPolicy(
  input: z.output<typeof GeneratePolicyInputSchema>,
  condition: PolicyCondition,
  decision: PolicyDecision,
  priority: number,
  suffix: string,
): ControlPolicy {
  const value = policyValue(condition);
  return {
    decision,
    description: `${input.actionName} ${suffix.replaceAll("_", " ")}`,
    name: `${input.actionName} ${suffix}`,
    operator: condition.operator,
    priority,
    reasonCode: `${input.actionName}.${suffix}`,
    ruleCode: `${input.actionName}.${suffix}`,
    signalKey: value.signalKey,
    signalValue: value.signalValue,
    status: "active",
    valueType: value.valueType,
    workflow: input.actionName,
  };
}

export function generatePolicy(input: GeneratePolicyInput): PolicyBundle {
  const parsed = GeneratePolicyInputSchema.safeParse(input);
  if (!parsed.success) throw new GovernanceInputError("invalid_policy_generation_input");
  const value = parsed.data;
  const decision = primaryDecision(value);
  const condition: PolicyCondition = value.requiredConditions[0] ?? {
    operator: "always",
    valueType: "string",
  };
  const policies = [createPolicy(value, condition, decision, 500, `${decision}_required`)];
  if (condition.operator !== "always") {
    const fallback = fallbackDecision(value);
    policies.push(
      createPolicy(
        value,
        { operator: "always", valueType: "string" },
        fallback,
        0,
        `fallback_${fallback}`,
      ),
    );
  }
  return {
    actionName: value.actionName,
    allowedRoles: [...new Set(value.allowedRoles)].sort(),
    approvalRequired: value.approvalRequired,
    parameterRestrictions: value.parameterRestrictions,
    policies,
    riskLevel: value.riskLevel,
    schemaVersion: POLICY_SCHEMA_VERSION,
  };
}

function zodFindings(error: z.ZodError): PolicyFinding[] {
  return error.issues.map((issue) => ({
    code: issue.message,
    path: issue.path.join("."),
    severity: "error",
  }));
}

function restrictionFindings(restrictions: readonly ParameterRestriction[]): PolicyFinding[] {
  const findings: PolicyFinding[] = [];
  const byParameter = new Map<string, ParameterRestriction[]>();
  for (const restriction of restrictions) {
    const entries = byParameter.get(restriction.parameter) ?? [];
    entries.push(restriction);
    byParameter.set(restriction.parameter, entries);
  }
  for (const [parameter, entries] of byParameter) {
    const sameKind = new Set(entries.map((entry) => entry.kind));
    if (sameKind.size !== entries.length) {
      findings.push({
        code: "duplicate_parameter_restriction",
        path: `parameterRestrictions.${parameter}`,
        severity: "error",
      });
    }
    const maximum = entries.find((entry) => entry.kind === "max_number");
    const allowed = entries.find((entry) => entry.kind === "allowed_values");
    if (
      maximum?.kind === "max_number" &&
      allowed?.kind === "allowed_values" &&
      allowed.values.some((value) => typeof value !== "number" || value > maximum.maximum)
    ) {
      findings.push({
        code: "contradictory_parameter_restrictions",
        path: `parameterRestrictions.${parameter}`,
        severity: "error",
      });
    }
  }
  return findings;
}

export function validatePolicy(value: unknown): PolicyValidationResult {
  const parsed = PolicyBundleSchema.safeParse(value);
  if (!parsed.success) return { findings: zodFindings(parsed.error), valid: false };
  const bundle = parsed.data;
  const findings: PolicyFinding[] = [...restrictionFindings(bundle.parameterRestrictions)];
  const active = bundle.policies.filter((policy) => policy.status === "active");

  if (!active.length) {
    findings.push({ code: "no_active_policies", path: "policies", severity: "error" });
  }
  if (!active.some((policy) => policy.operator === "always")) {
    findings.push({ code: "missing_explicit_fallback", path: "policies", severity: "error" });
  }
  if (active.some((policy) => policy.workflow !== bundle.actionName)) {
    findings.push({ code: "workflow_mismatch", path: "policies", severity: "error" });
  }
  const ruleCodes = new Set<string>();
  for (const [index, policy] of active.entries()) {
    if (ruleCodes.has(policy.ruleCode)) {
      findings.push({
        code: "duplicate_rule_code",
        path: `policies.${index}.ruleCode`,
        severity: "error",
      });
    }
    ruleCodes.add(policy.ruleCode);
  }

  const allowedDecisions =
    bundle.approvalRequired || bundle.riskLevel === "high" || bundle.riskLevel === "critical"
      ? new Set<PolicyDecision>(["review", "block"])
      : bundle.riskLevel === "medium"
        ? new Set<PolicyDecision>(["audit", "review", "block"])
        : new Set<PolicyDecision>(["allow", "audit", "review", "block"]);
  if (active.some((policy) => !allowedDecisions.has(policy.decision))) {
    findings.push({
      code: "unsafe_reachable_decision",
      path: "policies",
      severity: "error",
    });
  }

  for (let index = 0; index < active.length; index += 1) {
    for (let peerIndex = index + 1; peerIndex < active.length; peerIndex += 1) {
      const left = active[index];
      const right = active[peerIndex];
      if (
        left &&
        right &&
        left.priority === right.priority &&
        left.operator === right.operator &&
        left.signalKey === right.signalKey &&
        left.signalValue === right.signalValue &&
        left.decision !== right.decision
      ) {
        findings.push({
          code: "ambiguous_equal_priority_conflict",
          path: `policies.${index}`,
          severity: "error",
        });
      }
    }
  }
  return { findings, valid: findings.every((finding) => finding.severity !== "error") };
}

function hasExactArrayIndexes(value: unknown[]): boolean {
  const keys = Object.keys(value);
  if (keys.length !== value.length || value.length > MAX_ARRAY_LENGTH) return false;
  return keys.every((key, index) => key === String(index));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

interface CanonicalState {
  entries: number;
  readonly seen: Set<object>;
}

function canonicalize(value: unknown, state: CanonicalState, depth = 0): string {
  if (depth > MAX_PARAMETER_DEPTH) throw new GovernanceInputError("action_parameters_too_deep");
  if (value === null) return "null";
  if (typeof value === "string") {
    if (value.length > MAX_PARAMETER_STRING_LENGTH) {
      throw new GovernanceInputError("action_parameter_string_too_large");
    }
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new GovernanceInputError("non_finite_action_parameter");
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (typeof value !== "object") throw new GovernanceInputError("unsupported_action_parameter");
  if (state.seen.has(value)) throw new GovernanceInputError("cyclic_action_parameters");
  state.seen.add(value);
  try {
    if (Array.isArray(value)) {
      if (!hasExactArrayIndexes(value)) {
        throw new GovernanceInputError("invalid_action_parameter_array");
      }
      state.entries += value.length;
      if (state.entries > MAX_PARAMETER_ENTRIES) {
        throw new GovernanceInputError("too_many_action_parameters");
      }
      return `[${value.map((item) => canonicalize(item, state, depth + 1)).join(",")}]`;
    }
    if (!isPlainObject(value) || Object.getOwnPropertySymbols(value).length) {
      throw new GovernanceInputError("non_json_action_parameter");
    }
    const keys = Object.keys(value).sort();
    state.entries += keys.length;
    if (state.entries > MAX_PARAMETER_ENTRIES) {
      throw new GovernanceInputError("too_many_action_parameters");
    }
    return `{${keys
      .map((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !("value" in descriptor)) {
          throw new GovernanceInputError("accessor_action_parameter");
        }
        return `${JSON.stringify(key)}:${canonicalize(descriptor.value, state, depth + 1)}`;
      })
      .join(",")}}`;
  } finally {
    state.seen.delete(value);
  }
}

function canonicalAction(action: ActionContext): string {
  const canonical = canonicalize(action, { entries: 0, seen: new Set() });
  if (Buffer.byteLength(canonical, "utf8") > MAX_PARAMETER_BYTES) {
    throw new GovernanceInputError("action_parameters_too_large");
  }
  return canonical;
}

function bindingKey(secret: string | Uint8Array): Uint8Array {
  const key =
    typeof secret === "string" ? new TextEncoder().encode(secret) : Uint8Array.from(secret);
  if (key.byteLength < 32 || key.byteLength > 4_096) {
    throw new GovernanceInputError("invalid_binding_secret");
  }
  return key;
}

export function createActionBinding(
  actionValue: ActionContext,
  bindingSecret: string | Uint8Array,
): string {
  const parsed = ActionContextSchema.safeParse(actionValue);
  if (!parsed.success) throw new GovernanceInputError("invalid_action_context");
  return createHmac("sha256", bindingKey(bindingSecret))
    .update(BINDING_CONTEXT, "utf8")
    .update(canonicalAction(parsed.data), "utf8")
    .digest("hex");
}

export function deriveIdempotencyKey(actionBinding: string): string {
  if (!HEX_64_PATTERN.test(actionBinding)) {
    throw new GovernanceInputError("invalid_action_binding");
  }
  return `tk-check-${actionBinding}`;
}

function restrictionFailure(
  restrictions: readonly ParameterRestriction[],
  parameters: Record<string, unknown>,
): string | null {
  for (const restriction of restrictions) {
    const value = parameters[restriction.parameter];
    if (
      restriction.kind === "required" &&
      (value === undefined || value === null || value === "")
    ) {
      return `parameter_required.${restriction.parameter}`;
    }
    if (
      restriction.kind === "max_number" &&
      (typeof value !== "number" || !Number.isFinite(value) || value > restriction.maximum)
    ) {
      return `parameter_maximum_exceeded.${restriction.parameter}`;
    }
    if (
      restriction.kind === "allowed_values" &&
      !restriction.values.some((allowed) => Object.is(allowed, value))
    ) {
      return `parameter_not_allowed.${restriction.parameter}`;
    }
  }
  return null;
}

function parsePolicyValue(policy: ControlPolicy): SignalValue | readonly string[] | null {
  if (policy.operator === "always" || policy.operator === "exists") return null;
  if (policy.operator === "in") return policy.signalValue.split(",").filter(Boolean);
  if (policy.valueType === "number") return Number(policy.signalValue);
  if (policy.valueType === "boolean") return policy.signalValue === "true";
  return policy.signalValue;
}

function matches(policy: ControlPolicy, signals: Record<string, SignalValue>): boolean {
  if (policy.operator === "always") return true;
  const hasSignal = Object.prototype.hasOwnProperty.call(signals, policy.signalKey);
  if (policy.operator === "exists") return hasSignal;
  if (!hasSignal) return false;
  const actual = signals[policy.signalKey];
  const expected = parsePolicyValue(policy);
  if (policy.operator === "equals") return Object.is(actual, expected);
  if (policy.operator === "in") {
    return typeof actual === "string" && Array.isArray(expected) && expected.includes(actual);
  }
  if (policy.operator === "gte") {
    return typeof actual === "number" && typeof expected === "number" && actual >= expected;
  }
  if (policy.operator === "lte") {
    return typeof actual === "number" && typeof expected === "number" && actual <= expected;
  }
  return false;
}

const DECISION_SEVERITY: Readonly<Record<PolicyDecision, number>> = {
  allow: 0,
  audit: 1,
  review: 2,
  block: 3,
};

export function simulateAction(
  bundleValue: unknown,
  actionValue: unknown,
  options: SimulationOptions,
): SimulationResult {
  const validation = validatePolicy(bundleValue);
  if (!validation.valid) throw new GovernanceInputError("invalid_policy_bundle");
  const bundle = PolicyBundleSchema.parse(bundleValue);
  const parsedAction = ActionContextSchema.safeParse(actionValue);
  if (!parsedAction.success) throw new GovernanceInputError("invalid_action_context");
  const action = parsedAction.data;
  const actionBinding = createActionBinding(action, options.bindingSecret);

  if (action.actionName !== bundle.actionName) {
    return {
      actionBinding,
      decision: "block",
      matchedPolicy: null,
      reasonCode: "action_name_mismatch",
      source: "execution_guard",
    };
  }
  if (!action.actorRoles.some((role) => bundle.allowedRoles.includes(role))) {
    return {
      actionBinding,
      decision: "block",
      matchedPolicy: null,
      reasonCode: "actor_role_not_allowed",
      source: "execution_guard",
    };
  }
  const restriction = restrictionFailure(bundle.parameterRestrictions, action.parameters);
  if (restriction) {
    return {
      actionBinding,
      decision: "block",
      matchedPolicy: null,
      reasonCode: restriction,
      source: "execution_guard",
    };
  }

  const policies = bundle.policies
    .filter((policy) => policy.status === "active" && policy.workflow === bundle.actionName)
    .sort((left, right) => {
      const priority = right.priority - left.priority;
      if (priority) return priority;
      const severity = DECISION_SEVERITY[right.decision] - DECISION_SEVERITY[left.decision];
      if (severity) return severity;
      return left.ruleCode.localeCompare(right.ruleCode);
    });
  const matched = policies.find((policy) => matches(policy, action.signals));
  if (!matched) throw new GovernanceInputError("policy_fallback_not_reachable");
  return {
    actionBinding,
    decision: matched.decision,
    matchedPolicy: matched,
    reasonCode: matched.reasonCode,
    source: "policy",
  };
}

function sampleParameters(restrictions: readonly ParameterRestriction[]): Record<string, unknown> {
  const parameters: Record<string, unknown> = {};
  for (const restriction of restrictions) {
    if (restriction.kind === "required" && parameters[restriction.parameter] === undefined) {
      parameters[restriction.parameter] = "synthetic";
    } else if (restriction.kind === "max_number") {
      parameters[restriction.parameter] = Math.min(restriction.maximum, 1);
    } else if (restriction.kind === "allowed_values") {
      parameters[restriction.parameter] = restriction.values[0];
    }
  }
  return parameters;
}

function signalsFor(policy: ControlPolicy): Record<string, SignalValue> {
  if (policy.operator === "always") return {};
  if (policy.operator === "exists") return { [policy.signalKey]: true };
  const parsed = parsePolicyValue(policy);
  if (policy.operator === "in") {
    return { [policy.signalKey]: (parsed as readonly string[])[0] ?? "synthetic" };
  }
  return { [policy.signalKey]: parsed as SignalValue };
}

function sampleAction(
  bundle: PolicyBundle,
  overrides: Partial<ActionContext> = {},
): ActionContext {
  return {
    actionName: bundle.actionName,
    actorId: "synthetic_actor",
    actorRoles: [bundle.allowedRoles[0] ?? "operator"],
    conversationId: "synthetic_conversation",
    environment: "test",
    parameters: sampleParameters(bundle.parameterRestrictions),
    projectId: "synthetic_project",
    proposalVersion: 1,
    schemaVersion: ACTION_CONTEXT_SCHEMA_VERSION,
    signals: {},
    tenantId: "synthetic_tenant",
    turnId: "synthetic_turn",
    userId: "synthetic_user",
    ...overrides,
  };
}

export function generatePolicyTests(bundleValue: unknown): GeneratedPolicyTests {
  const validation = validatePolicy(bundleValue);
  if (!validation.valid) throw new GovernanceInputError("invalid_policy_bundle");
  const bundle = PolicyBundleSchema.parse(bundleValue);
  const cases: GeneratedPolicyCase[] = [];
  for (const policy of bundle.policies.filter((candidate) => candidate.status === "active")) {
    cases.push({
      action: sampleAction(bundle, { signals: signalsFor(policy) }),
      expectedDecision: policy.decision,
      name: policy.ruleCode,
    });
  }
  cases.push({
    action: sampleAction(bundle, { actorRoles: ["unauthorized"] }),
    expectedDecision: "block",
    name: "unauthorized_actor",
  });

  const source = `import assert from "node:assert/strict";
import test from "node:test";
import { simulateAction } from "@turnkeeper/sdk";

const bundle = ${JSON.stringify(bundle, null, 2)} as const;
const cases = ${JSON.stringify(cases, null, 2)} as const;
const bindingSecret = "synthetic-test-binding-secret-32-bytes-minimum";

for (const policyCase of cases) {
  test(policyCase.name, () => {
    assert.equal(
      simulateAction(bundle, policyCase.action, { bindingSecret }).decision,
      policyCase.expectedDecision,
    );
  });
}
`;
  return { cases, source };
}
