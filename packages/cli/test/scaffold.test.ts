import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  readGeneratedPackageVersion,
  scaffoldAgent,
  writeScaffoldTransaction,
} from "../src/index.js";
import { runPolicyTests } from "../src/policyTests.js";

function multiActionScaffold() {
  return scaffoldAgent({
    actions: [
      {
        actionName: "issue_refund",
        allowedRoles: ["support_agent"],
        approvalRequired: true,
        parameterRestrictions: [
          { kind: "required", parameter: "order_id" },
          { kind: "max_number", maximum: 5000, parameter: "amount" },
        ],
        requiredConditions: [
          {
            operator: "gte",
            signalKey: "amount",
            value: 100,
            valueType: "number",
          },
        ],
        riskLevel: "high",
      },
      {
        actionName: "cancel_account",
        allowedRoles: ["account_admin"],
        approvalRequired: true,
        parameterRestrictions: [{ kind: "required", parameter: "account_id" }],
        requiredConditions: [],
        riskLevel: "critical",
      },
    ],
    agentType: "provider-neutral",
    framework: "node",
    language: "typescript",
    projectName: "governed-agent",
  });
}

test("multi-action scaffolds use the exact SDK alpha and executable combined cases", () => {
  const scaffold = multiActionScaffold();
  assert.equal(scaffold.status, "generated");

  const manifest = JSON.parse(
    scaffold.files.find((file) => file.path === "package.json")?.content ??
      "{}",
  ) as {
    dependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  };
  assert.equal(manifest.dependencies?.["@turnkeeper/sdk"], "0.1.0-alpha.6");
  assert.equal(manifest.scripts?.typecheck, "tsc --noEmit");
  assert.equal(manifest.scripts?.check, "npm run typecheck && npm test");
  assert.ok(scaffold.files.some((file) => file.path === "tsconfig.json"));

  const policies = JSON.parse(
    scaffold.files.find((file) => file.path === "turnkeeper/policies.json")
      ?.content ?? "[]",
  ) as unknown[];
  const result = runPolicyTests(policies);
  assert.equal(result.passed, true);
  assert.ok(result.executed >= 4);

  const generatedTests =
    scaffold.files.find((file) => file.path === "turnkeeper/policies.test.ts")
      ?.content ?? "";
  assert.equal(
    generatedTests.match(/import \{ simulateAction \}/gu)?.length,
    1,
  );
  assert.match(generatedTests, /issue_refund/u);
  assert.match(generatedTests, /cancel_account/u);

  const agent =
    scaffold.files.find((file) => file.path === "turnkeeper/agent.ts")
      ?.content ?? "";
  const runtime =
    scaffold.files.find((file) => file.path === "turnkeeper/runtime.ts")
      ?.content ?? "";
  assert.match(agent, /proposeAction\(value: unknown\)/u);
  assert.doesNotMatch(agent, /ActionContext/u);
  assert.match(runtime, /buildActionContext/u);
  assert.match(runtime, /TrustedActionContext/u);
});

test("generated multi-action TypeScript tests execute against the workspace SDK", async () => {
  const packageRoot = fileURLToPath(new URL("..", import.meta.url));
  const destination = await mkdtemp(
    path.join(packageRoot, ".generated-agent-"),
  );
  try {
    await writeScaffoldTransaction(destination, multiActionScaffold());
    const typecheck = spawnSync(
      process.execPath,
      [
        fileURLToPath(
          new URL("../../../node_modules/typescript/bin/tsc", import.meta.url),
        ),
        "-p",
        "tsconfig.json",
      ],
      {
        cwd: destination,
        encoding: "utf8",
      },
    );
    assert.equal(typecheck.status, 0, typecheck.stderr || typecheck.stdout);

    const execution = spawnSync(
      process.execPath,
      ["--import", "tsx", "--test", "turnkeeper/policies.test.ts"],
      {
        cwd: destination,
        encoding: "utf8",
      },
    );
    assert.equal(execution.status, 0, execution.stderr || execution.stdout);
  } finally {
    await rm(destination, { force: true, recursive: true });
  }
});

test("write preflight prevents partial output and force performs a complete replacement", async () => {
  const temporaryRoot = await mkdtemp(
    path.join(tmpdir(), "turnkeeper-cli-scaffold-"),
  );
  const destination = path.join(temporaryRoot, "agent");
  const existingAgent = path.join(destination, "turnkeeper", "agent.ts");
  try {
    await mkdir(path.dirname(existingAgent), { recursive: true });
    await writeFile(existingAgent, "existing content\n", "utf8");

    await assert.rejects(
      writeScaffoldTransaction(destination, multiActionScaffold()),
      /refusing_to_overwrite:turnkeeper\/agent\.ts/u,
    );
    await assert.rejects(access(path.join(destination, "package.json")));
    assert.equal(await readFile(existingAgent, "utf8"), "existing content\n");

    const result = await writeScaffoldTransaction(
      destination,
      multiActionScaffold(),
      {
        force: true,
      },
    );
    assert.equal(result.filesWritten.length, 7);
    assert.deepEqual(result.replacedFiles, ["turnkeeper/agent.ts"]);
    assert.match(await readFile(existingAgent, "utf8"), /availableActions/u);
    assert.equal(
      await readGeneratedPackageVersion(destination),
      "0.1.0-alpha.6",
    );
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
});

test("a missing destination is published by one directory rename", async () => {
  const temporaryRoot = await mkdtemp(
    path.join(tmpdir(), "turnkeeper-cli-new-root-"),
  );
  const destination = path.join(temporaryRoot, "new-agent");
  try {
    const result = await writeScaffoldTransaction(
      destination,
      multiActionScaffold(),
    );
    assert.equal(result.replacedFiles.length, 0);
    assert.equal(
      await readGeneratedPackageVersion(destination),
      "0.1.0-alpha.6",
    );
    assert.match(
      await readFile(
        path.join(destination, "turnkeeper", "runtime.ts"),
        "utf8",
      ),
      /deriveIdempotencyKey/u,
    );
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
});
