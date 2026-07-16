import type { RiskLevel } from "@turnkeeper/sdk";

export type SupportedLanguage = "python" | "typescript";
export type SupportedFramework = "fastapi" | "nextjs" | "node";
export type AgentType =
  "anthropic-compatible" | "openai-compatible" | "provider-neutral";

export interface QuickstartContent {
  status: "http_pattern_only" | "supported";
  steps: readonly string[];
  warning?: string;
}

export function getQuickstart(
  language: SupportedLanguage,
  framework: SupportedFramework,
): QuickstartContent {
  if (language === "python") {
    return {
      status: "http_pattern_only",
      steps: [
        "Keep exact action parameters in caller-owned durable storage.",
        "Derive a keyed opaque action binding and send only bounded scalar signals to POST /api/v1/checks.",
        "Stop on block, persist pending state on review, and execute only after an explicit approved decision.",
        "Deliver metadata-only Replay lifecycle events from a durable background worker.",
      ],
      warning:
        "Turnkeeper does not currently ship a Python SDK; use the documented HTTP adapter pattern.",
    };
  }

  return {
    status: "supported",
    steps: [
      `Install @turnkeeper/sdk and @turnkeeper/cli for the ${framework} integration.`,
      "Define one bounded policy bundle per externally visible action.",
      "Persist the exact proposal before requesting a Turnkeeper decision.",
      "Branch explicitly on allow, audit, review, and block before invoking the real tool.",
      "Deliver metadata-only Replay events from a durable background worker.",
    ],
  };
}

const SDK_EXAMPLES = {
  approvals: {
    decisionHandling: {
      allow:
        "execute the exact persisted proposal and record its downstream outcome",
      audit:
        "execute the exact persisted proposal and retain additional evidence",
      block: "do not execute; return a safe refusal",
      review:
        "persist pending state and wait for an authenticated human decision",
    },
  },
  audit: {
    rule: "Keep exact parameters in caller-owned storage; send only keyed opaque references and bounded scalar signals.",
  },
  policies: {
    operators: ["always", "exists", "equals", "in", "gte", "lte"],
    outcomes: ["allow", "audit", "review", "block"],
  },
  simulation: {
    rule: "Local simulation is development-time evaluation and never authorizes or executes a production action.",
  },
} as const;

export type SdkExampleTopic = keyof typeof SDK_EXAMPLES;

export function getSdkExamples(topic: SdkExampleTopic) {
  return SDK_EXAMPLES[topic];
}

export function getMigrationHelp(
  language: SupportedLanguage,
  riskLevel: RiskLevel,
) {
  return {
    phases: [
      "Inventory every external side effect and current bypass path.",
      "Wrap each side effect in a typed proposal with exact parameters and stable identity.",
      "Add caller-owned authorization and parameter guards before the Turnkeeper check.",
      "Persist review-pending state and make exact retries idempotent.",
      "Add metadata-only Replay delivery outside the customer-response path.",
      "Run allow, audit, review, block, malformed, retry, and bypass tests.",
    ],
    riskLevel,
    runtimeStatus: "gated" as const,
    sdkStatus:
      language === "typescript"
        ? ("typescript_supported" as const)
        : ("http_pattern_only" as const),
  };
}
