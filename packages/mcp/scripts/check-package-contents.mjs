import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
if (
  manifest.name !== "@turnkeeper/mcp" ||
  manifest.version !== "0.1.0-alpha.3"
) {
  throw new Error("MCP package identity is not release-aligned.");
}
if (manifest.license !== "Apache-2.0" || manifest.private === true) {
  throw new Error("MCP package must remain public and Apache-2.0 licensed.");
}
if (
  manifest.dependencies?.["@turnkeeper/sdk"] !== "0.1.0-alpha.3" ||
  manifest.dependencies?.["@turnkeeper/cli"] !== "0.1.0-alpha.3"
) {
  throw new Error(
    "MCP package must use exact release-aligned Turnkeeper dependencies.",
  );
}
for (const lifecycle of ["install", "postinstall", "preinstall"]) {
  if (manifest.scripts?.[lifecycle]) {
    throw new Error(
      `MCP package must not declare a ${lifecycle} lifecycle script.`,
    );
  }
}

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run package verification through npm.");
const packed = spawnSync(
  process.execPath,
  [npmCli, "pack", "--dry-run", "--ignore-scripts", "--json"],
  {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  },
);
if (packed.status !== 0) throw new Error("npm pack --dry-run failed.");

let report;
try {
  report = JSON.parse(packed.stdout);
} catch {
  throw new Error("npm pack returned an unreadable report.");
}
const files =
  report[0]?.files?.map((entry) =>
    String(entry.path).replace(/^package\//u, ""),
  ) ?? [];
const required = [
  "LICENSE",
  "README.md",
  "SECURITY.md",
  "dist/bin.js",
  "dist/index.d.ts",
  "dist/index.js",
  "package.json",
];
for (const file of required) {
  if (!files.includes(file))
    throw new Error(`Required package file is missing: ${file}`);
}
const unexpected = files.filter(
  (file) =>
    !["LICENSE", "README.md", "SECURITY.md", "package.json"].includes(file) &&
    !file.startsWith("dist/"),
);
if (unexpected.length > 0) {
  throw new Error(`Unexpected package files: ${unexpected.join(", ")}`);
}

console.log(`MCP package contents verified (${files.length} files).`);
