import { Client } from "@modelcontextprotocol/client";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/client/stdio";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const EXPECTED_TOOLS = [
  "generate_policy",
  "generate_policy_tests",
  "get_migration_help",
  "get_sdk_examples",
  "get_turnkeeper_quickstart",
  "inspect_integration",
  "scaffold_turnkeeper_agent",
  "simulate_action",
  "validate_policy",
].sort();

const binPath = fileURLToPath(new URL("../dist/bin.js", import.meta.url));
const SMOKE_TIMEOUT_MS = 15_000;

async function withSyntheticWorkspace<T>(
  callback: (workspaceRoot: string) => Promise<T>,
): Promise<T> {
  const workspace = await mkdtemp(path.join(tmpdir(), "turnkeeper-mcp-stdio-"));
  try {
    await mkdir(path.join(workspace, "agent"));
    await writeFile(
      path.join(workspace, "agent", "README.md"),
      "# synthetic\n",
      "utf8",
    );
    return await callback(workspace);
  } finally {
    await rm(workspace, { force: true, recursive: true });
  }
}

function createStdioClient(workspaceRoot: string, entryArgs: string[]) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: entryArgs,
    cwd: workspaceRoot,
    env: {
      ...getDefaultEnvironment(),
      TURNKEEPER_WORKSPACE_ROOT: workspaceRoot,
    },
    stderr: "pipe",
  });
  const client = new Client(
    { name: "turnkeeper-mcp-stdio-smoke", version: "1.0.0" },
    {
      supportedProtocolVersions: ["2025-11-25"],
      versionNegotiation: { mode: "legacy" },
    },
  );
  return { client, transport };
}

async function connectWithTimeout(
  client: Client,
  transport: StdioClientTransport,
  timeoutMs = SMOKE_TIMEOUT_MS,
): Promise<void> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      client.connect(transport),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`MCP stdio connect timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

test("built MCP stdio entrypoint initializes and lists the bounded tool set", async () => {
  await withSyntheticWorkspace(async (workspaceRoot) => {
    const { client, transport } = createStdioClient(workspaceRoot, [binPath]);
    const stderrChunks: Buffer[] = [];
    transport.stderr?.on("data", (chunk: Buffer) => {
      stderrChunks.push(Buffer.from(chunk));
    });

    try {
      await connectWithTimeout(client, transport);
      const listed = await client.listTools();
      assert.deepEqual(
        listed.tools.map((tool) => tool.name).sort(),
        EXPECTED_TOOLS,
      );

      const quickstart = await client.callTool({
        name: "get_turnkeeper_quickstart",
        arguments: { framework: "node", language: "typescript" },
      });
      assert.notEqual(quickstart.isError, true);
      const encoded = JSON.stringify(quickstart);
      assert.match(encoded, /turnkeeper|sdk|control|replay/iu);
      assert.doesNotMatch(encoded, /api[_-]?key|sk_live|password/iu);

      const stderr = Buffer.concat(stderrChunks).toString("utf8");
      assert.match(stderr, /Turnkeeper MCP server running on stdio\./u);
      assert.doesNotMatch(stderr, /api[_-]?key|token|password/iu);
    } finally {
      await Promise.allSettled([client.close(), transport.close()]);
    }
  });
});

test("unexpected stdout noise fails MCP stdio framing before tool discovery", async () => {
  await withSyntheticWorkspace(async (workspaceRoot) => {
    const noisyEntry = path.join(workspaceRoot, "noisy-entry.mjs");
    // Stay alive while emitting non-protocol stdout so initialize cannot complete.
    await writeFile(
      noisyEntry,
      [
        "process.stderr.write('noisy fixture started\\n');",
        "process.stdout.write('not-a-jsonrpc-frame\\n');",
        "setInterval(() => {}, 60_000);",
        "",
      ].join("\n"),
      "utf8",
    );

    const { client, transport } = createStdioClient(workspaceRoot, [noisyEntry]);
    let failed = false;
    try {
      await connectWithTimeout(client, transport, 3_000);
      await client.listTools();
    } catch {
      failed = true;
    } finally {
      await Promise.allSettled([client.close(), transport.close()]);
    }
    assert.equal(failed, true, "stdout noise must break stdio framing");
  });
});

test("stdio child is terminated when the client closes", async () => {
  await withSyntheticWorkspace(async (workspaceRoot) => {
    const { client, transport } = createStdioClient(workspaceRoot, [binPath]);
    await connectWithTimeout(client, transport);
    const pid = transport.pid;
    assert.ok(typeof pid === "number" && pid > 0);
    await Promise.allSettled([client.close(), transport.close()]);

    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(processAlive(pid), false, "MCP child process must exit after client close");
  });
});

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
