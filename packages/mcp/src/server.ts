import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import {
  ActionContextSchema,
  GeneratePolicyInputSchema,
  PolicyBundleSchema,
  RiskLevelSchema,
} from "@turnkeeper/sdk";
import { z } from "zod";

import {
  PayloadBoundaryError,
  assertBoundedInput,
  serializeBoundedOutput,
} from "./bounds.js";
import {
  createDevelopmentToolHandlers,
  type DevelopmentToolHandlers,
} from "./tools.js";
import {
  resolveWorkspaceRoot,
  WorkspaceBoundaryError,
  type WorkspaceBoundaryCode,
} from "./workspace.js";

const VERSION = "0.1.0-alpha.6";

const AgentTypeSchema = z.enum([
  "anthropic-compatible",
  "openai-compatible",
  "provider-neutral",
]);
const FrameworkSchema = z.enum(["fastapi", "nextjs", "node"]);
const LanguageSchema = z.enum(["python", "typescript"]);
const TopicSchema = z.enum(["approvals", "audit", "policies", "simulation"]);
const ProjectPathSchema = z
  .string()
  .min(1)
  .max(1024)
  .refine(
    (value) => !value.includes("\0") && !value.startsWith("/"),
    "invalid_project_path",
  );
const JsonObjectSchema = z.record(z.string(), z.json());

const QuickstartInputSchema = z
  .object({ framework: FrameworkSchema, language: LanguageSchema })
  .strict();
const SdkExamplesInputSchema = z.object({ topic: TopicSchema }).strict();
const ScaffoldInputSchema = z
  .object({
    actions: z.array(GeneratePolicyInputSchema).min(1).max(20),
    agentType: AgentTypeSchema,
    framework: FrameworkSchema,
    language: LanguageSchema,
    projectName: z
      .string()
      .min(2)
      .max(64)
      .regex(/^[a-z0-9][a-z0-9-]{1,63}$/u),
  })
  .strict();
const GeneratePolicySchema = GeneratePolicyInputSchema;
const ValidatePolicyWireSchema = z.object({ bundle: z.unknown() }).strict();
const ValidatePolicySchema = z.object({ bundle: JsonObjectSchema }).strict();
const SimulateActionWireSchema = z
  .object({ action: z.unknown(), bundle: z.unknown() })
  .strict();
const SimulateActionSchema = z
  .object({ action: ActionContextSchema, bundle: PolicyBundleSchema })
  .strict();
const GeneratePolicyTestsWireSchema = z
  .object({ bundle: z.unknown() })
  .strict();
const GeneratePolicyTestsSchema = z
  .object({ bundle: PolicyBundleSchema })
  .strict();
const InspectIntegrationSchema = z
  .object({ projectPath: ProjectPathSchema })
  .strict();
const MigrationHelpSchema = z
  .object({ language: LanguageSchema, riskLevel: RiskLevelSchema })
  .strict();

type ToolResponse = {
  content: Array<{ text: string; type: "text" }>;
  isError?: true;
  structuredContent: Record<string, unknown>;
};

function success(output: unknown): ToolResponse {
  const structuredContent = { result: output };
  return {
    content: [
      { text: serializeBoundedOutput(structuredContent), type: "text" },
    ],
    structuredContent,
  };
}

function failure(code: string): ToolResponse {
  const structuredContent = { error: { code }, ok: false };
  return {
    content: [
      { text: serializeBoundedOutput(structuredContent), type: "text" },
    ],
    isError: true,
    structuredContent,
  };
}

function safeErrorCode(error: unknown): string {
  if (
    error instanceof PayloadBoundaryError ||
    error instanceof WorkspaceBoundaryError
  ) {
    return error.code;
  }
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string" &&
    /^[a-z][a-z0-9_]{0,79}$/u.test(error.code)
  ) {
    return error.code;
  }
  return "tool_execution_failed";
}

function boundedHandler<Input>(
  schema: z.ZodType<Input>,
  handler: (input: Input) => unknown | Promise<unknown>,
): (input: unknown) => Promise<ToolResponse> {
  return async (input) => {
    try {
      assertBoundedInput(input);
      const parsed = schema.safeParse(input);
      if (!parsed.success) return failure("invalid_tool_input");
      return success(await handler(parsed.data));
    } catch (error) {
      return failure(safeErrorCode(error));
    }
  };
}

function registerTools(
  server: McpServer,
  handlers: DevelopmentToolHandlers,
): void {
  server.registerTool(
    "get_turnkeeper_quickstart",
    {
      description:
        "Return deterministic integration guidance. This tool never authorizes or executes an action.",
      inputSchema: QuickstartInputSchema,
    },
    boundedHandler(QuickstartInputSchema, handlers.get_turnkeeper_quickstart),
  );
  server.registerTool(
    "get_sdk_examples",
    {
      description:
        "Return bounded SDK examples that contain no credentials, customer content, or execution.",
      inputSchema: SdkExamplesInputSchema,
    },
    boundedHandler(SdkExamplesInputSchema, handlers.get_sdk_examples),
  );
  server.registerTool(
    "scaffold_turnkeeper_agent",
    {
      description:
        "Return a deterministic starter file plan. The MCP server does not write files or execute actions.",
      inputSchema: ScaffoldInputSchema,
    },
    boundedHandler(ScaffoldInputSchema, handlers.scaffold_turnkeeper_agent),
  );
  server.registerTool(
    "generate_policy",
    {
      description:
        "Generate a bounded policy bundle for development. Generated output is not production authorization.",
      inputSchema: GeneratePolicySchema,
    },
    boundedHandler(GeneratePolicySchema, handlers.generate_policy),
  );
  server.registerTool(
    "validate_policy",
    {
      description:
        "Validate one bounded policy bundle without calling Turnkeeper.",
      inputSchema: ValidatePolicyWireSchema,
    },
    boundedHandler(ValidatePolicySchema, handlers.validate_policy),
  );
  server.registerTool(
    "simulate_action",
    {
      description:
        "Simulate a bounded policy decision locally. Simulation never authorizes a production action.",
      inputSchema: SimulateActionWireSchema,
    },
    boundedHandler(SimulateActionSchema, handlers.simulate_action),
  );
  server.registerTool(
    "generate_policy_tests",
    {
      description:
        "Generate deterministic policy test cases without executing customer or provider actions.",
      inputSchema: GeneratePolicyTestsWireSchema,
    },
    boundedHandler(GeneratePolicyTestsSchema, handlers.generate_policy_tests),
  );
  server.registerTool(
    "inspect_integration",
    {
      description:
        "Heuristically inspect source beneath the configured workspace root. Findings are not a security proof.",
      inputSchema: InspectIntegrationSchema,
    },
    boundedHandler(InspectIntegrationSchema, handlers.inspect_integration),
  );
  server.registerTool(
    "get_migration_help",
    {
      description:
        "Return deterministic migration guidance without modifying files or contacting production.",
      inputSchema: MigrationHelpSchema,
    },
    boundedHandler(MigrationHelpSchema, handlers.get_migration_help),
  );
}

export interface McpServerOptions {
  workspaceRoot: string;
}

export async function createMcpServer(
  options: McpServerOptions,
): Promise<McpServer> {
  const workspaceRoot = await resolveWorkspaceRoot(options.workspaceRoot);
  const server = new McpServer({ name: "turnkeeper", version: VERSION });
  registerTools(server, createDevelopmentToolHandlers(workspaceRoot));
  return server;
}

export async function startMcpServer(options: McpServerOptions): Promise<void> {
  const server = await createMcpServer(options);
  await server.connect(new StdioServerTransport());
  process.stderr.write("Turnkeeper MCP server running on stdio.\n");
}

export function configuredWorkspaceRoot(environment = process.env): string {
  const value = environment.TURNKEEPER_WORKSPACE_ROOT;
  if (!value) throw new WorkspaceBoundaryError("workspace_root_invalid");
  return value;
}

export type { WorkspaceBoundaryCode };
