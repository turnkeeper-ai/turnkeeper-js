/**
 * Bounded macOS / path-with-spaces clean-consumer smoke.
 *
 * Narrower than the Ubuntu/Windows `npm run check` matrix on purpose: this job
 * only proves packed SDK/CLI/MCP artifacts install and expose current entrypoints
 * in a temporary consumer, including a workspace path that contains spaces.
 * It does not re-run the full workspace typecheck/test matrix.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run package smoke checks through npm.");

const CHILD_TIMEOUT_MS = 30_000;

function npm(args, cwd = process.cwd()) {
  const result = spawnSync(process.execPath, [npmCli, ...args], {
    cwd,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`npm ${args[0] ?? "command"} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function runNode(args, cwd, environment = process.env) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
    env: environment,
    timeout: CHILD_TIMEOUT_MS,
  });
  if (result.status !== 0) {
    throw new Error(
      `consumer command failed (${args[0]}): ${result.stderr || result.stdout || result.error}`,
    );
  }
  return result;
}

async function mcpStdioListsQuickstart(bin, workspaceRoot) {
  const child = spawn(process.execPath, [bin], {
    cwd: workspaceRoot,
    env: { ...process.env, TURNKEEPER_WORKSPACE_ROOT: workspaceRoot },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const initialize = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "turnkeeper-macos-smoke", version: "1.0.0" },
    },
  };
  const listTools = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  };

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("MCP stdio smoke timed out"));
    }, CHILD_TIMEOUT_MS);

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    const waitForReady = setInterval(() => {
      if (stderr.includes("Turnkeeper MCP server running on stdio.")) {
        clearInterval(waitForReady);
        child.stdin.write(`${JSON.stringify(initialize)}\n`);
      }
    }, 25);

    child.stdout.on("data", () => {
      if (stdout.includes('"id":1') && !stdout.includes('"id":2')) {
        child.stdin.write(`${JSON.stringify(listTools)}\n`);
      }
      if (stdout.includes("get_turnkeeper_quickstart") && stdout.includes('"id":2')) {
        clearInterval(waitForReady);
        clearTimeout(timer);
        child.kill("SIGTERM");
        resolve(undefined);
      }
    });

    child.on("exit", (code, signal) => {
      clearInterval(waitForReady);
      clearTimeout(timer);
      if (!stdout.includes("get_turnkeeper_quickstart")) {
        reject(
          new Error(
            `MCP stdio smoke exited before tool discovery (code=${code}, signal=${signal}). stderr=${stderr.slice(0, 500)}`,
          ),
        );
      }
    });
  });

  if (!stderr.includes("Turnkeeper MCP server running on stdio.")) {
    throw new Error("MCP stdio banner missing from stderr.");
  }
  if (/api[_-]?key|sk_live|password/iu.test(`${stdout}\n${stderr}`)) {
    throw new Error("MCP smoke emitted credential-shaped output.");
  }
}

const root = await mkdtemp(path.join(tmpdir(), "turnkeeper-macos-smoke-"));
const spacedRoot = path.join(root, "clean consumer");
const packs = path.join(spacedRoot, "packs");
const consumer = path.join(spacedRoot, "consumer");

try {
  await mkdir(packs, { recursive: true });
  await mkdir(consumer, { recursive: true });

  const tarballs = [];
  for (const workspace of ["@turnkeeper/sdk", "@turnkeeper/cli", "@turnkeeper/mcp"]) {
    const report = JSON.parse(
      npm(
        ["pack", "--workspace", workspace, "--ignore-scripts", "--json", "--pack-destination", packs],
        process.cwd(),
      ),
    );
    const filename = report[0]?.filename;
    if (typeof filename !== "string") throw new Error(`npm pack did not return ${workspace}.`);
    tarballs.push(path.join(packs, filename));
  }

  await writeFile(
    path.join(consumer, "package.json"),
    `${JSON.stringify({ name: "turnkeeper-macos-clean-consumer", private: true, type: "module" }, null, 2)}\n`,
    "utf8",
  );
  npm(["install", "--ignore-scripts", ...tarballs], consumer);

  const sdk = runNode(
    [
      "--input-type=module",
      "-e",
      'import("@turnkeeper/sdk").then((module) => { if (module.REPLAY_API_VERSION !== "2026-07-27" || typeof module.ControlClient !== "function") process.exit(1); });',
    ],
    consumer,
  );
  if (sdk.stderr) throw new Error("SDK import smoke emitted stderr.");

  const cliBin = path.join(consumer, "node_modules", "@turnkeeper", "cli", "dist", "bin.js");
  const cli = runNode([cliBin, "--help"], consumer);
  if (!cli.stdout.includes("test-policies")) throw new Error("CLI help smoke failed.");

  const mcpBin = path.join(consumer, "node_modules", "@turnkeeper", "mcp", "dist", "bin.js");
  await mcpStdioListsQuickstart(mcpBin, consumer);

  console.log(
    "macOS/path-with-spaces clean-consumer smoke verified for packed SDK, CLI, and MCP entrypoints.",
  );
} finally {
  await rm(root, { force: true, recursive: true });
}
