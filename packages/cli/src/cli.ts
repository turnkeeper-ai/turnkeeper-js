import { lstat, readFile } from "node:fs/promises";
import path from "node:path";

import { validatePolicy } from "@turnkeeper/sdk";

import { inspectIntegration } from "./inspection.js";
import { runPolicyTests } from "./policyTests.js";
import { scaffoldAgent, writeScaffoldTransaction } from "./scaffold.js";

const MAX_POLICY_FILE_BYTES = 1024 * 1024;
const HELP = `turnkeeper <command>

Commands:
  init [directory]          Create a bounded Turnkeeper agent project
  add-agent [directory]     Add the bounded agent files to a project
  validate <policy-file>    Validate one policy bundle or a bundle array
  test-policies <file>      Execute deterministic policy cases
  inspect [directory]       Run a bounded heuristic integration inspection

Options:
  --force                   Replace scaffold-owned regular files
  -h, --help                Show this help
`;

export interface CliIo {
  stderr(message: string): void;
  stdout(message: string): void;
}

const processIo: CliIo = {
  stderr: (message) => process.stderr.write(message),
  stdout: (message) => process.stdout.write(message),
};

function defaultScaffold(projectName: string) {
  return scaffoldAgent({
    actions: [
      {
        actionName: "example_action",
        allowedRoles: ["operator"],
        approvalRequired: true,
        parameterRestrictions: [{ kind: "required", parameter: "resource_id" }],
        requiredConditions: [],
        riskLevel: "high",
      },
    ],
    agentType: "provider-neutral",
    framework: "node",
    language: "typescript",
    projectName,
  });
}

function additiveScaffold(projectName: string) {
  const scaffold = defaultScaffold(projectName);
  return {
    ...scaffold,
    files: scaffold.files.flatMap((file) => {
      if (file.path === "package.json") return [];
      if (file.path === "tsconfig.json") return [];
      if (file.path === "README.md") {
        return [
          {
            ...file,
            content:
              "Install the SDK in the host project first: `npm install @turnkeeper/sdk@0.1.0-alpha.2`.\n\n" +
              file.content,
            path: "turnkeeper/README.md",
          },
        ];
      }
      return [file];
    }),
  };
}

async function refuseExistingInitManifest(root: string): Promise<void> {
  try {
    await lstat(path.join(root, "package.json"));
    throw new Error("refusing_to_overwrite:package.json");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
}

async function readPolicyFile(file: string): Promise<unknown> {
  const absolute = path.resolve(file);
  const stat = await lstat(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new TypeError("policy file must be a non-symlink regular file.");
  }
  if (stat.size > MAX_POLICY_FILE_BYTES) {
    throw new TypeError("policy file exceeds 1 MiB.");
  }
  return JSON.parse(await readFile(absolute, "utf8")) as unknown;
}

function policyBundles(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

function projectName(root: string): string {
  const value = path
    .basename(root)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  if (value.length >= 2) return value.slice(0, 64);
  return "turnkeeper-agent";
}

function parseArguments(argv: readonly string[]): {
  command: string | undefined;
  force: boolean;
  operands: string[];
} {
  const force = argv.includes("--force");
  const values = argv.filter((value) => value !== "--force");
  const [command, ...operands] = values;
  return { command, force, operands };
}

export async function runCli(
  argv: readonly string[],
  io: CliIo = processIo,
): Promise<number> {
  const { command, force, operands } = parseArguments(argv);
  if (!command || command === "--help" || command === "-h") {
    io.stdout(HELP);
    return 0;
  }

  if (command === "init" || command === "add-agent") {
    if (operands.length > 1)
      throw new TypeError(`${command} accepts at most one directory.`);
    const root = path.resolve(operands[0] ?? ".");
    if (command === "init") await refuseExistingInitManifest(root);
    const scaffold =
      command === "init"
        ? defaultScaffold(projectName(root))
        : additiveScaffold(projectName(root));
    const result = await writeScaffoldTransaction(root, scaffold, { force });
    io.stdout(
      `${JSON.stringify(
        {
          files_written: result.filesWritten.length,
          replaced_files: result.replacedFiles.length,
          root: result.root,
          status: "created",
        },
        null,
        2,
      )}\n`,
    );
    return 0;
  }

  if (force)
    throw new TypeError("--force is supported only by init and add-agent.");
  if (command === "validate" || command === "test-policies") {
    const policyFile = operands[0];
    if (operands.length !== 1 || policyFile === undefined)
      throw new TypeError(`${command} requires one policy file.`);
    const bundles = policyBundles(await readPolicyFile(policyFile));
    if (command === "validate") {
      const results = bundles.map((bundle) => validatePolicy(bundle));
      io.stdout(`${JSON.stringify(results, null, 2)}\n`);
      return results.every((result) => result.valid) ? 0 : 1;
    }

    const result = runPolicyTests(bundles);
    io.stdout(`${JSON.stringify(result, null, 2)}\n`);
    return result.passed ? 0 : 1;
  }

  if (command === "inspect") {
    if (operands.length > 1)
      throw new TypeError("inspect accepts at most one directory.");
    const result = await inspectIntegration(operands[0] ?? ".");
    io.stdout(`${JSON.stringify(result, null, 2)}\n`);
    return result.findings.some((finding) => finding.severity === "error")
      ? 1
      : 0;
  }

  throw new TypeError(`unknown command: ${command}`);
}
