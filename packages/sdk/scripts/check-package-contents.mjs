import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
if (packageJson.private === true) throw new Error("The public SDK package must not be private.");
if (packageJson.license !== "Apache-2.0") throw new Error("The SDK must use Apache-2.0.");
if (JSON.stringify(packageJson.dependencies ?? {}) !== JSON.stringify({ zod: "4.4.3" })) {
  throw new Error("The SDK runtime dependency allowlist changed.");
}
if (!(packageJson.files ?? []).includes("LICENSE")) throw new Error("LICENSE must be packaged.");

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run this check through npm so npm_execpath is available.");
const packed = spawnSync(process.execPath, [npmCli, "pack", "--dry-run", "--json"], {
  cwd: new URL("..", import.meta.url),
  encoding: "utf8",
});
if (packed.status !== 0) throw new Error("npm pack --dry-run failed.");

let report;
try {
  report = JSON.parse(packed.stdout);
} catch {
  throw new Error("npm pack returned an unreadable report.");
}
const files = report[0]?.files?.map((entry) => String(entry.path).replace(/^package\//, "")) ?? [];
const required = [
  "package.json",
  "README.md",
  "SECURITY.md",
  "LICENSE",
  "dist/index.js",
  "dist/index.d.ts",
];
for (const path of required) {
  if (!files.includes(path)) throw new Error(`Required package file is missing: ${path}`);
}
const allowed = (path) =>
  path === "package.json" ||
  path === "README.md" ||
  path === "SECURITY.md" ||
  path === "LICENSE" ||
  path.startsWith("dist/");
const unexpected = files.filter((path) => !allowed(path));
if (unexpected.length > 0) throw new Error(`Unexpected package files: ${unexpected.join(", ")}`);

console.log(`Package contents verified (${files.length} files).`);
