import {
  ACTION_CONTEXT_SCHEMA_VERSION,
  GeneratePolicyInputSchema,
  generatePolicy,
  generatePolicyTests,
  type GeneratePolicyInput,
  type PolicyBundle,
} from "@turnkeeper/sdk";
import {
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  rmdir,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import type {
  AgentType,
  SupportedFramework,
  SupportedLanguage,
} from "./content.js";

const SDK_VERSION = "0.1.0-alpha.3";
const MAX_SCAFFOLD_FILES = 64;
const MAX_SCAFFOLD_BYTES = 512 * 1024;

export interface ScaffoldInput {
  actions: GeneratePolicyInput[];
  agentType: AgentType;
  framework: SupportedFramework;
  language: SupportedLanguage;
  projectName: string;
}

export interface ScaffoldFile {
  content: string;
  path: string;
}

export interface ScaffoldResult {
  files: ScaffoldFile[];
  status: "generated" | "unsupported";
  warnings: string[];
}

export interface ScaffoldWriteOptions {
  force?: boolean;
}

export interface ScaffoldWriteResult {
  filesWritten: string[];
  replacedFiles: string[];
  root: string;
}

async function exists(file: string): Promise<boolean> {
  try {
    await lstat(file);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function packageJson(projectName: string): string {
  return `${JSON.stringify(
    {
      name: projectName,
      private: true,
      scripts: {
        check: "npm run typecheck && npm test",
        test: "node --import tsx --test turnkeeper/*.test.ts",
        typecheck: "tsc --noEmit",
      },
      type: "module",
      dependencies: {
        "@turnkeeper/sdk": SDK_VERSION,
      },
      devDependencies: {
        "@types/node": "^22.19.9",
        tsx: "^4.23.0",
        typescript: "^5.7.3",
      },
    },
    null,
    2,
  )}\n`;
}

function tsconfig(): string {
  return `${JSON.stringify(
    {
      compilerOptions: {
        exactOptionalPropertyTypes: true,
        forceConsistentCasingInFileNames: true,
        lib: ["ES2023", "DOM"],
        module: "NodeNext",
        moduleResolution: "NodeNext",
        noEmit: true,
        noFallthroughCasesInSwitch: true,
        noImplicitReturns: true,
        noUncheckedIndexedAccess: true,
        strict: true,
        target: "ES2022",
        types: ["node"],
      },
      include: ["turnkeeper/**/*.ts"],
    },
    null,
    2,
  )}\n`;
}

function runtimeSource(): string {
  return `import {
  ACTION_CONTEXT_SCHEMA_VERSION,
  ControlClient,
  createActionBinding,
  deriveIdempotencyKey,
  type ActionContext,
  type PolicyBundle,
} from "@turnkeeper/sdk";

import type { AgentProposal } from "./agent.js";

export type TrustedActionContext = Omit<
  ActionContext,
  "actionName" | "parameters" | "schemaVersion"
>;

export function buildActionContext(
  proposal: AgentProposal,
  trusted: TrustedActionContext,
): ActionContext {
  return {
    ...trusted,
    actionName: proposal.actionName,
    parameters: { ...proposal.parameters },
    schemaVersion: ACTION_CONTEXT_SCHEMA_VERSION,
  };
}

export interface PendingActionStore {
  save(proposal: {
    actionBinding: string;
    action: ActionContext;
    idempotencyKey: string;
    state: "proposed" | "pending_review" | "blocked" | "ready" | "executed" | "failed";
  }): Promise<void>;
}

export async function evaluateBeforeExecution(options: {
  action: ActionContext;
  bindingSecret: string | Uint8Array;
  bundle: PolicyBundle;
  control: ControlClient;
  signal?: AbortSignal;
  store: PendingActionStore;
}) {
  const actionBinding = createActionBinding(options.action, options.bindingSecret);
  const idempotencyKey = deriveIdempotencyKey(actionBinding);
  await options.store.save({
    actionBinding,
    action: options.action,
    idempotencyKey,
    state: "proposed",
  });
  const decision = await options.control.check(
    options.bundle,
    options.action,
    {
      bindingSecret: options.bindingSecret,
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );

  if (decision.decision === "block") {
    await options.store.save({
      actionBinding,
      action: options.action,
      idempotencyKey,
      state: "blocked",
    });
    return decision;
  }
  if (decision.decision === "review") {
    await options.store.save({
      actionBinding,
      action: options.action,
      idempotencyKey,
      state: "pending_review",
    });
    return decision;
  }

  await options.store.save({
    actionBinding,
    action: options.action,
    idempotencyKey,
    state: "ready",
  });
  return decision;
}
`;
}

function agentSource(agentType: AgentType, actionNames: string[]): string {
  return `export const agentType = ${JSON.stringify(agentType)} as const;
export const availableActions = ${JSON.stringify(actionNames)} as const;
export type AvailableAction = (typeof availableActions)[number];

export interface AgentProposal {
  readonly actionName: AvailableAction;
  readonly parameters: Readonly<Record<string, unknown>>;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function proposeAction(value: unknown): AgentProposal {
  if (
    !isPlainRecord(value) ||
    Object.keys(value).some((key) => key !== "actionName" && key !== "parameters") ||
    typeof value.actionName !== "string" ||
    !availableActions.includes(value.actionName as AvailableAction) ||
    !isPlainRecord(value.parameters)
  ) {
    throw new Error("unknown_action");
  }
  return {
    actionName: value.actionName as AvailableAction,
    parameters: structuredClone(value.parameters),
  };
}

// Model/provider output contains only the action proposal. Trusted identity,
// roles, environment, signals, and versioning are added by server code.
`;
}

function combinedPolicyTests(bundles: PolicyBundle[]): string {
  const suites = bundles.map((bundle) => ({
    actionName: bundle.actionName,
    bundle,
    cases: generatePolicyTests(bundle).cases.map((policyCase) => ({
      ...policyCase,
      action: {
        ...policyCase.action,
        schemaVersion: ACTION_CONTEXT_SCHEMA_VERSION,
      },
    })),
  }));

  return `import assert from "node:assert/strict";
import test from "node:test";

import { simulateAction } from "@turnkeeper/sdk";

const suites = ${JSON.stringify(suites, null, 2)};
const bindingSecret = "turnkeeper-generated-policy-test-secret-0001";

test("generated Turnkeeper policy cases", () => {
  for (const suite of suites) {
    for (const policyCase of suite.cases) {
      const result = simulateAction(suite.bundle, policyCase.action, { bindingSecret });
      assert.equal(result.decision, policyCase.expectedDecision, \`\${suite.actionName}: \${policyCase.name}\`);
    }
  }
});
`;
}

function generatedReadme(input: ScaffoldInput): string {
  return `# ${input.projectName}

This scaffold uses the Turnkeeper SDK's bounded Control API client.

1. Install dependencies with \`npm install\`.
2. Configure the generated policy rows in an enabled Turnkeeper project.
3. Set server-only \`TURNKEEPER_API_KEY\`, \`TURNKEEPER_BASE_URL\`, and an independent action-binding secret.
4. Parse model output with \`proposeAction\`; it accepts only an action name and parameters.
5. Call \`buildActionContext\` with actor roles, tenant, project, environment, conversation, turn, signals, and proposal version from authenticated server state.
6. Persist the exact action context in your own durable store.
7. Call \`evaluateBeforeExecution\` before every external side effect.
8. Never execute on \`review\` or \`block\`; resume only after an authenticated approval.
9. Deliver metadata-only Replay events from a durable background worker.

The scaffold does not execute refunds, bookings, cancellations, payment changes, or other actions.
`;
}

export function scaffoldAgent(input: ScaffoldInput): ScaffoldResult {
  if (
    input.language !== "typescript" ||
    !["nextjs", "node"].includes(input.framework)
  ) {
    return {
      files: [],
      status: "unsupported",
      warnings: [
        "Python/FastAPI is currently a documented HTTP adapter pattern because no Python SDK ships.",
      ],
    };
  }
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/u.test(input.projectName)) {
    throw new TypeError("projectName must be a lowercase package name.");
  }
  if (
    !Array.isArray(input.actions) ||
    input.actions.length < 1 ||
    input.actions.length > 20
  ) {
    throw new TypeError("actions must contain between 1 and 20 entries.");
  }

  const actions = input.actions.map((action) =>
    GeneratePolicyInputSchema.parse(action),
  );
  const actionNames = actions.map((action) => action.actionName);
  if (new Set(actionNames).size !== actionNames.length) {
    throw new TypeError("action names must be unique.");
  }
  const bundles = actions.map((action) => generatePolicy(action));

  return {
    files: [
      { content: packageJson(input.projectName), path: "package.json" },
      { content: tsconfig(), path: "tsconfig.json" },
      {
        content: `${JSON.stringify(bundles, null, 2)}\n`,
        path: "turnkeeper/policies.json",
      },
      { content: runtimeSource(), path: "turnkeeper/runtime.ts" },
      {
        content: agentSource(input.agentType, actionNames),
        path: "turnkeeper/agent.ts",
      },
      {
        content: combinedPolicyTests(bundles),
        path: "turnkeeper/policies.test.ts",
      },
      { content: generatedReadme(input), path: "README.md" },
    ],
    status: "generated",
    warnings: [
      "Apply generated policies through the authenticated Turnkeeper project boundary before live checks.",
      "Generated code requires caller-owned durable storage and explicit review resumption.",
    ],
  };
}

function safeRelativePath(value: string): string {
  if (!value || path.isAbsolute(value) || value.includes("\0")) {
    throw new TypeError("scaffold paths must be safe relative paths.");
  }
  const normalized = value.replaceAll("\\", "/");
  const segments = normalized.split("/");
  if (
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new TypeError(
      "scaffold paths must not contain empty or traversal segments.",
    );
  }
  return segments.join(path.sep);
}

function validateScaffold(
  scaffold: ScaffoldResult,
): Array<ScaffoldFile & { relativePath: string }> {
  if (scaffold.status !== "generated") {
    throw new Error(scaffold.warnings[0] ?? "unsupported_scaffold");
  }
  if (scaffold.files.length < 1 || scaffold.files.length > MAX_SCAFFOLD_FILES) {
    throw new TypeError("scaffold file count is outside the supported range.");
  }

  const seen = new Set<string>();
  let totalBytes = 0;
  return scaffold.files.map((file) => {
    const relativePath = safeRelativePath(file.path);
    if (seen.has(relativePath))
      throw new TypeError(`duplicate scaffold path: ${file.path}`);
    seen.add(relativePath);
    totalBytes += Buffer.byteLength(file.content, "utf8");
    if (totalBytes > MAX_SCAFFOLD_BYTES) {
      throw new TypeError("scaffold content exceeds the supported size.");
    }
    return { ...file, relativePath };
  });
}

async function assertSafeRoot(root: string): Promise<boolean> {
  try {
    const stat = await lstat(root);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new TypeError(
        "scaffold destination must be a non-symlink directory.",
      );
    }
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function assertSafeParentChain(
  root: string,
  relativePath: string,
): Promise<void> {
  const segments = relativePath.split(path.sep).slice(0, -1);
  let current = root;
  for (const segment of segments) {
    current = path.join(current, segment);
    try {
      const stat = await lstat(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) {
        throw new TypeError(
          `unsafe scaffold parent: ${path.relative(root, current)}`,
        );
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
  }
}

async function writeStage(
  stageRoot: string,
  files: Array<ScaffoldFile & { relativePath: string }>,
): Promise<void> {
  for (const file of files) {
    const destination = path.join(stageRoot, file.relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, file.content, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o644,
    });
  }
}

async function cleanEmptyParents(
  root: string,
  relativePath: string,
): Promise<void> {
  let current = path.dirname(path.join(root, relativePath));
  while (current !== root && current.startsWith(`${root}${path.sep}`)) {
    try {
      await rmdir(current);
    } catch {
      return;
    }
    current = path.dirname(current);
  }
}

export async function writeScaffoldTransaction(
  destinationRoot: string,
  scaffold: ScaffoldResult,
  options: ScaffoldWriteOptions = {},
): Promise<ScaffoldWriteResult> {
  const root = path.resolve(destinationRoot);
  const files = validateScaffold(scaffold);
  const rootExists = await assertSafeRoot(root);
  const parent = path.dirname(root);
  await mkdir(parent, { recursive: true });

  if (rootExists) {
    for (const file of files) {
      await assertSafeParentChain(root, file.relativePath);
      const destination = path.join(root, file.relativePath);
      if (await exists(destination)) {
        const stat = await lstat(destination);
        if (stat.isSymbolicLink() || !stat.isFile()) {
          throw new TypeError(
            `refusing to replace non-file path: ${file.path}`,
          );
        }
        if (!options.force)
          throw new Error(`refusing_to_overwrite:${file.path}`);
      }
    }
  }

  const transactionRoot = await mkdtemp(path.join(parent, ".turnkeeper-txn-"));
  const stageRoot = path.join(transactionRoot, "stage");
  const backupRoot = path.join(transactionRoot, "backup");
  await mkdir(stageRoot);

  try {
    await writeStage(stageRoot, files);
    if (!rootExists) {
      await rename(stageRoot, root);
      return {
        filesWritten: files.map((file) => file.path),
        replacedFiles: [],
        root,
      };
    }

    const committed = new Set<string>();
    const backedUp = new Set<string>();
    const replacedFiles: string[] = [];
    try {
      for (const file of files) {
        const destination = path.join(root, file.relativePath);
        const staged = path.join(stageRoot, file.relativePath);
        await mkdir(path.dirname(destination), { recursive: true });

        if (await exists(destination)) {
          const backup = path.join(backupRoot, file.relativePath);
          await mkdir(path.dirname(backup), { recursive: true });
          await rename(destination, backup);
          backedUp.add(file.relativePath);
          replacedFiles.push(file.path);
          await rename(staged, destination);
        } else {
          await link(staged, destination);
        }
        committed.add(file.relativePath);
      }
    } catch (error) {
      for (const file of [...files].reverse()) {
        const destination = path.join(root, file.relativePath);
        const backup = path.join(backupRoot, file.relativePath);
        if (committed.has(file.relativePath)) {
          await rm(destination, { force: true });
        }
        if (backedUp.has(file.relativePath) && (await exists(backup))) {
          await mkdir(path.dirname(destination), { recursive: true });
          await rename(backup, destination);
        }
        await cleanEmptyParents(root, file.relativePath);
      }
      throw error;
    }

    return {
      filesWritten: files.map((file) => file.path),
      replacedFiles,
      root,
    };
  } finally {
    await rm(transactionRoot, { force: true, recursive: true });
  }
}

export async function readGeneratedPackageVersion(
  root: string,
): Promise<string | null> {
  try {
    const manifest = JSON.parse(
      await readFile(path.join(root, "package.json"), "utf8"),
    ) as {
      dependencies?: Record<string, string>;
    };
    return manifest.dependencies?.["@turnkeeper/sdk"] ?? null;
  } catch {
    return null;
  }
}
