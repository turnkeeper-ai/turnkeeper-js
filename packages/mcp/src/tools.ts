import {
  getMigrationHelp,
  getQuickstart,
  getSdkExamples,
  inspectIntegration,
  scaffoldAgent,
} from "@turnkeeper/cli";
import {
  generatePolicy,
  generatePolicyTests,
  simulateAction,
  validatePolicy,
  type GeneratePolicyInput,
} from "@turnkeeper/sdk";

import { resolveInspectionPath } from "./workspace.js";

const DEVELOPMENT_ONLY_BINDING_SECRET =
  "turnkeeper-mcp-development-only-binding-secret-never-use-in-production";

export interface DevelopmentToolHandlers {
  generate_policy(input: GeneratePolicyInput): ReturnType<typeof generatePolicy>;
  generate_policy_tests(input: { bundle: unknown }): ReturnType<typeof generatePolicyTests>;
  get_migration_help(input: {
    language: "python" | "typescript";
    riskLevel: "critical" | "high" | "low" | "medium";
  }): ReturnType<typeof getMigrationHelp>;
  get_sdk_examples(input: {
    topic: "approvals" | "audit" | "policies" | "simulation";
  }): ReturnType<typeof getSdkExamples>;
  get_turnkeeper_quickstart(input: {
    framework: "fastapi" | "nextjs" | "node";
    language: "python" | "typescript";
  }): ReturnType<typeof getQuickstart>;
  inspect_integration(input: {
    projectPath: string;
  }): Promise<Awaited<ReturnType<typeof inspectIntegration>>>;
  scaffold_turnkeeper_agent(
    input: Parameters<typeof scaffoldAgent>[0],
  ): ReturnType<typeof scaffoldAgent>;
  simulate_action(input: {
    action: unknown;
    bundle: unknown;
  }): ReturnType<typeof simulateAction>;
  validate_policy(input: { bundle: unknown }): ReturnType<typeof validatePolicy>;
}

export function createDevelopmentToolHandlers(workspaceRoot: string): DevelopmentToolHandlers {
  return {
    generate_policy: (input) => generatePolicy(input),
    generate_policy_tests: ({ bundle }) => generatePolicyTests(bundle),
    get_migration_help: ({ language, riskLevel }) => getMigrationHelp(language, riskLevel),
    get_sdk_examples: ({ topic }) => getSdkExamples(topic),
    get_turnkeeper_quickstart: ({ framework, language }) => getQuickstart(language, framework),
    inspect_integration: async ({ projectPath }) => {
      const resolved = await resolveInspectionPath(workspaceRoot, projectPath);
      return inspectIntegration(resolved);
    },
    scaffold_turnkeeper_agent: (input) => scaffoldAgent(input),
    simulate_action: ({ action, bundle }) =>
      simulateAction(bundle, action, { bindingSecret: DEVELOPMENT_ONLY_BINDING_SECRET }),
    validate_policy: ({ bundle }) => validatePolicy(bundle),
  };
}
