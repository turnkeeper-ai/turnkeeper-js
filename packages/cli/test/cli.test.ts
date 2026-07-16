import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { generatePolicy } from "@turnkeeper/sdk";

import { runCli, type CliIo } from "../src/cli.js";

test("packaged binary executes help through its bin entrypoint", () => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("../dist/bin.js", import.meta.url)), "--help"],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /test-policies/u);
});

function capturedIo(): { io: CliIo; stderr: string[]; stdout: string[] } {
  const stderr: string[] = [];
  const stdout: string[] = [];
  return {
    io: {
      stderr: (message) => stderr.push(message),
      stdout: (message) => stdout.push(message),
    },
    stderr,
    stdout,
  };
}

test("test-policies executes cases and returns a failing exit code for invalid input", async () => {
  const root = await mkdtemp(
    path.join(tmpdir(), "turnkeeper-cli-policy-command-"),
  );
  try {
    const validFile = path.join(root, "valid.json");
    const invalidFile = path.join(root, "invalid.json");
    await writeFile(
      validFile,
      JSON.stringify(
        generatePolicy({
          actionName: "issue_refund",
          allowedRoles: ["support_agent"],
          approvalRequired: true,
          parameterRestrictions: [],
          requiredConditions: [],
          riskLevel: "high",
        }),
      ),
    );
    await writeFile(invalidFile, JSON.stringify({ actionName: "invalid" }));

    const validOutput = capturedIo();
    assert.equal(await runCli(["test-policies", validFile], validOutput.io), 0);
    const validResult = JSON.parse(validOutput.stdout.join("")) as {
      executed: number;
      passed: boolean;
    };
    assert.equal(validResult.passed, true);
    assert.ok(validResult.executed > 0);

    const invalidOutput = capturedIo();
    assert.equal(
      await runCli(["test-policies", invalidFile], invalidOutput.io),
      1,
    );
    assert.equal(
      (JSON.parse(invalidOutput.stdout.join("")) as { passed: boolean }).passed,
      false,
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("init creates a standalone project and reports structured output", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "turnkeeper-cli-init-"));
  const destination = path.join(root, "sample-agent");
  try {
    const output = capturedIo();
    assert.equal(await runCli(["init", destination], output.io), 0);
    const result = JSON.parse(output.stdout.join("")) as {
      files_written: number;
      status: string;
    };
    assert.equal(result.files_written, 7);
    assert.equal(result.status, "created");
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("add-agent preserves an existing project manifest and root README", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "turnkeeper-cli-add-agent-"));
  try {
    const manifest = '{"name":"existing-project","private":true}\n';
    const tsconfig = '{"compilerOptions":{"strict":true}}\n';
    await writeFile(path.join(root, "package.json"), manifest);
    await writeFile(path.join(root, "README.md"), "# Existing project\n");
    await writeFile(path.join(root, "tsconfig.json"), tsconfig);

    const output = capturedIo();
    assert.equal(await runCli(["add-agent", root], output.io), 0);
    assert.equal(
      await readFile(path.join(root, "package.json"), "utf8"),
      manifest,
    );
    assert.equal(
      await readFile(path.join(root, "README.md"), "utf8"),
      "# Existing project\n",
    );
    assert.equal(
      await readFile(path.join(root, "tsconfig.json"), "utf8"),
      tsconfig,
    );
    assert.match(
      await readFile(path.join(root, "turnkeeper", "README.md"), "utf8"),
      /@turnkeeper\/sdk/u,
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("init --force never overwrites an existing project manifest", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "turnkeeper-cli-force-init-"));
  const manifest = '{"name":"do-not-replace","private":true}\n';
  try {
    await writeFile(path.join(root, "package.json"), manifest);
    await assert.rejects(
      runCli(["init", root, "--force"], capturedIo().io),
      /refusing_to_overwrite:package\.json/u,
    );
    assert.equal(
      await readFile(path.join(root, "package.json"), "utf8"),
      manifest,
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
