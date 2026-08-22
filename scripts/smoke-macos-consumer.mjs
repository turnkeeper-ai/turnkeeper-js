/**
 * Bounded macOS / path-with-spaces clean-consumer smoke.
 *
 * Narrower than the Ubuntu/Windows `npm run check` matrix on purpose: this job
 * only proves packed SDK and detector-adapter artifacts install and expose current entrypoints
 * in a temporary consumer, including a workspace path that contains spaces.
 * It does not re-run the full workspace typecheck/test matrix.
 */
import { spawnSync } from "node:child_process";
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

const root = await mkdtemp(path.join(tmpdir(), "turnkeeper-macos-smoke-"));
const spacedRoot = path.join(root, "clean consumer");
const packs = path.join(spacedRoot, "packs");
const consumer = path.join(spacedRoot, "consumer");

try {
  await mkdir(packs, { recursive: true });
  await mkdir(consumer, { recursive: true });

  const tarballs = [];
  for (const workspace of [
    "@turnkeeper/sdk",
    "@turnkeeper/adapter-sentinel",
  ]) {
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
      'import("@turnkeeper/sdk").then((module) => { if (module.EXCHANGE_CONTRACT_VERSION !== "2026-08-08" || typeof module.validateDetectorCandidateV1 !== "function") process.exit(1); });',
    ],
    consumer,
  );
  if (sdk.stderr) throw new Error("SDK import smoke emitted stderr.");

  console.log(
    "macOS/path-with-spaces clean-consumer smoke verified for packed SDK and adapter entrypoints.",
  );
} finally {
  await rm(root, { force: true, recursive: true });
}
