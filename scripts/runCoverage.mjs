import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import process from "node:process";

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run coverage through npm so npm_execpath is available.");

const c8Cli = fileURLToPath(new URL("../node_modules/c8/bin/c8.js", import.meta.url));
const coverageTemp = mkdtempSync(join(tmpdir(), "turnkeeper-coverage-"));

try {
  const result = spawnSync(
    process.execPath,
    [c8Cli, "--temp-directory", coverageTemp, process.execPath, npmCli, "test"],
    { stdio: "inherit" },
  );

  if (result.error) throw result.error;
  if (result.signal) throw new Error(`Coverage process terminated by ${result.signal}.`);
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(coverageTemp, { force: true, recursive: true });
}
