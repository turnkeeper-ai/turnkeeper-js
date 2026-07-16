import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createDevelopmentToolHandlers } from "../src/tools.js";
import { resolveWorkspaceRoot } from "../src/workspace.js";

test("development handlers expose the bounded tool surface without action execution", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "turnkeeper-mcp-tools-"));
  try {
    const project = path.join(workspace, "agent");
    await mkdir(project);
    await writeFile(
      path.join(project, "agent.ts"),
      'import { TurnkeeperClient } from "@turnkeeper/sdk";\nvoid TurnkeeperClient;\n',
      "utf8",
    );

    const handlers = createDevelopmentToolHandlers(await resolveWorkspaceRoot(workspace));
    assert.deepEqual(Object.keys(handlers).sort(), [
      "generate_policy",
      "generate_policy_tests",
      "get_migration_help",
      "get_sdk_examples",
      "get_turnkeeper_quickstart",
      "inspect_integration",
      "scaffold_turnkeeper_agent",
      "simulate_action",
      "validate_policy",
    ]);
    const inspection = await handlers.inspect_integration({ projectPath: "agent" });
    assert.equal(typeof inspection, "object");
    assert.equal(
      handlers.get_turnkeeper_quickstart({
        framework: "node",
        language: "typescript",
      }).status,
      "supported",
    );
  } finally {
    await rm(workspace, { force: true, recursive: true });
  }
});
