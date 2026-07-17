import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run package smoke checks through npm.");

function npm(args, cwd = process.cwd()) {
  const result = spawnSync(process.execPath, [npmCli, ...args], {
    cwd,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`npm ${args[0] ?? "command"} failed.`);
  }
  return result.stdout;
}

function node(args, cwd, environment = process.env) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
    env: environment,
  });
  if (result.status !== 0)
    throw new Error(`Package smoke command failed: ${args[0] ?? "node"}`);
  return result;
}

const root = await mkdtemp(path.join(tmpdir(), "turnkeeper-pack-smoke-"));
const packs = path.join(root, "packs");
const consumer = path.join(root, "consumer");
const sdkConsumer = path.join(root, "sdk-consumer");

try {
  await mkdir(packs);
  await mkdir(consumer);
  await mkdir(sdkConsumer);
  const tarballs = new Map();
  for (const workspace of [
    "@turnkeeper/sdk",
    "@turnkeeper/cli",
    "@turnkeeper/mcp",
  ]) {
    const report = JSON.parse(
      npm([
        "pack",
        "--workspace",
        workspace,
        "--ignore-scripts",
        "--json",
        "--pack-destination",
        packs,
      ]),
    );
    const filename = report[0]?.filename;
    if (typeof filename !== "string")
      throw new Error(`npm pack did not return ${workspace}.`);
    tarballs.set(workspace, path.join(packs, filename));
  }

  await writeFile(
    path.join(sdkConsumer, "package.json"),
    `${JSON.stringify({ name: "turnkeeper-sdk-standalone-smoke", private: true, type: "module" }, null, 2)}\n`,
    "utf8",
  );
  npm(
    ["install", "--ignore-scripts", tarballs.get("@turnkeeper/sdk")],
    sdkConsumer,
  );
  node(
    [
      "--input-type=module",
      "-e",
      'import("@turnkeeper/sdk").then((module) => { if (module.REPLAY_API_VERSION !== "2026-07-09" || typeof module.ControlClient !== "function") process.exit(1); });',
    ],
    sdkConsumer,
  );

  await writeFile(
    path.join(consumer, "package.json"),
    `${JSON.stringify({ name: "turnkeeper-package-smoke", private: true, type: "module" }, null, 2)}\n`,
    "utf8",
  );
  npm(["install", "--ignore-scripts", ...tarballs.values()], consumer);

  const sdk = node(
    [
      "--input-type=module",
      "-e",
      'import("@turnkeeper/sdk").then((module) => { if (module.REPLAY_API_VERSION !== "2026-07-09" || typeof module.ControlClient !== "function") process.exit(1); });',
    ],
    consumer,
  );
  if (sdk.stderr) throw new Error("SDK import smoke emitted stderr.");

  const cli = node(
    [
      path.join(
        consumer,
        "node_modules",
        "@turnkeeper",
        "cli",
        "dist",
        "bin.js",
      ),
      "--help",
    ],
    consumer,
  );
  if (!cli.stdout.includes("test-policies"))
    throw new Error("CLI help smoke failed.");

  const mcp = node(
    [
      path.join(
        consumer,
        "node_modules",
        "@turnkeeper",
        "mcp",
        "dist",
        "bin.js",
      ),
    ],
    consumer,
    { ...process.env, TURNKEEPER_WORKSPACE_ROOT: consumer },
  );
  if (!mcp.stderr.includes("Turnkeeper MCP server running on stdio.")) {
    throw new Error("MCP stdio smoke failed.");
  }

  console.log(
    "Standalone SDK plus combined prerelease SDK, CLI, and MCP package smoke verified. Release CI verifies CLI and MCP independently after their registry dependencies are available.",
  );
} finally {
  await rm(root, { force: true, recursive: true });
}
