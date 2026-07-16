import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createMcpServer } from "../src/server.js";

test("bin fails with one sanitized message when the workspace root is missing", () => {
  const environment = { ...process.env };
  delete environment.TURNKEEPER_WORKSPACE_ROOT;
  const bin = fileURLToPath(new URL("../dist/bin.js", import.meta.url));
  const result = spawnSync(process.execPath, [bin], {
    encoding: "utf8",
    env: environment,
  });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "Turnkeeper MCP server failed to start.\n");
});

test("MCP exposes only deterministic development tools and sanitizes path failures", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "turnkeeper-mcp-server-"));
  const project = path.join(workspace, "agent");
  await mkdir(project);
  await writeFile(path.join(project, "agent.ts"), "export const agent = true;\n", "utf8");

  const server = await createMcpServer({ workspaceRoot: workspace });
  const client = new Client({ name: "turnkeeper-mcp-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const listed = await client.listTools();
    assert.deepEqual(
      listed.tools.map((tool) => tool.name).sort(),
      [
        "generate_policy",
        "generate_policy_tests",
        "get_migration_help",
        "get_sdk_examples",
        "get_turnkeeper_quickstart",
        "inspect_integration",
        "scaffold_turnkeeper_agent",
        "simulate_action",
        "validate_policy",
      ],
    );
    assert.doesNotMatch(JSON.stringify(listed.tools), /apiKey|bindingSecret/u);

    const rejected = await client.callTool({
      name: "inspect_integration",
      arguments: { projectPath: "../outside" },
    });
    assert.equal(rejected.isError, true);
    assert.ok(Array.isArray(rejected.content));
    const firstContent = rejected.content[0] as { text?: unknown; type?: unknown } | undefined;
    const text =
      firstContent?.type === "text" && typeof firstContent.text === "string"
        ? firstContent.text
        : "";
    assert.match(text, /project_path_outside_workspace/u);
    assert.doesNotMatch(text, new RegExp(workspace.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  } finally {
    await Promise.allSettled([
      client.close(),
      server.close(),
      clientTransport.close(),
      serverTransport.close(),
    ]);
    await rm(workspace, { force: true, recursive: true });
  }
});
