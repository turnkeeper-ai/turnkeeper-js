import {
  PolicyBundleSchema,
  ACTION_CONTEXT_SCHEMA_VERSION,
  generatePolicyTests,
  simulateAction,
  validatePolicy,
  type PolicyDecision,
} from "@turnkeeper/sdk";

const TEST_BINDING_SECRET = "turnkeeper-cli-policy-test-secret-0001";

export interface PolicyTestFailure {
  actualDecision?: PolicyDecision;
  bundleIndex: number;
  caseName: string;
  code: "invalid_bundle" | "invalid_policy" | "unexpected_decision";
  expectedDecision?: PolicyDecision;
}

export interface PolicyTestRunResult {
  executed: number;
  failed: number;
  failures: PolicyTestFailure[];
  passed: boolean;
}

export function runPolicyTests(
  bundleValues: readonly unknown[],
): PolicyTestRunResult {
  const failures: PolicyTestFailure[] = [];
  let executed = 0;

  for (const [bundleIndex, bundleValue] of bundleValues.entries()) {
    const parsed = PolicyBundleSchema.safeParse(bundleValue);
    if (!parsed.success) {
      failures.push({
        bundleIndex,
        caseName: "bundle schema",
        code: "invalid_bundle",
      });
      continue;
    }

    const validation = validatePolicy(parsed.data);
    if (!validation.valid) {
      failures.push({
        bundleIndex,
        caseName: "policy validation",
        code: "invalid_policy",
      });
      continue;
    }

    for (const policyCase of generatePolicyTests(parsed.data).cases) {
      executed += 1;
      const result = simulateAction(
        parsed.data,
        {
          ...policyCase.action,
          schemaVersion: ACTION_CONTEXT_SCHEMA_VERSION,
        },
        { bindingSecret: TEST_BINDING_SECRET },
      );
      if (result.decision !== policyCase.expectedDecision) {
        failures.push({
          actualDecision: result.decision,
          bundleIndex,
          caseName: policyCase.name,
          code: "unexpected_decision",
          expectedDecision: policyCase.expectedDecision,
        });
      }
    }
  }

  return {
    executed,
    failed: failures.length,
    failures,
    passed: failures.length === 0 && executed > 0,
  };
}
