import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const version = "0.1.0-alpha.1";
const packageDirectories = ["packages/sdk", "packages/cli", "packages/mcp"];
const requiredPaths = [
  "LICENSE",
  "docs/mcp.md",
  "docs/agent-builder-skill.md",
  "docs/repository-boundary.md",
  "skills/turnkeeper-agent-builder/SKILL.md",
  "skills/turnkeeper-agent-builder/agents/openai.yaml",
  "skills/turnkeeper-agent-builder/references/public-packages.md",
  "skills/turnkeeper-agent-builder/references/runtime-architecture.md",
  "skills/turnkeeper-agent-builder/references/framework-patterns.md",
  "skills/turnkeeper-agent-builder/references/security-checklist.md",
  "examples/customer-support-agent/package.json",
  "examples/booking-agent/package.json",
  "examples/account-management-agent/package.json",
];
const prohibitedText = [
  "@turnkeeper/agent-toolkit",
  "@turnkeeper/replay-sdk",
  "alex@alexok.dev",
  "/Users/",
  "packages/replay-sdk",
];

async function text(file) {
  return readFile(path.join(root, file), "utf8");
}

for (const file of requiredPaths) await text(file);

const skill = await text("skills/turnkeeper-agent-builder/SKILL.md");
if (!skill.startsWith("---\n")) throw new Error("Skill frontmatter is missing.");
const frontmatterEnd = skill.indexOf("\n---\n", 4);
if (frontmatterEnd < 0) throw new Error("Skill frontmatter is not closed.");
const frontmatter = skill.slice(4, frontmatterEnd);
if (!/^name: turnkeeper-agent-builder$/mu.test(frontmatter)) {
  throw new Error("Skill name must be turnkeeper-agent-builder.");
}
const description = /^description: (.+)$/mu.exec(frontmatter)?.[1];
if (!description || description.length < 40 || description.length > 1_024) {
  throw new Error("Skill description is missing or outside the supported length.");
}

for (const directory of packageDirectories) {
  const manifest = JSON.parse(await text(`${directory}/package.json`));
  if (manifest.version !== version) {
    throw new Error(`${manifest.name} must use synchronized version ${version}.`);
  }
  if (manifest.license !== "Apache-2.0" || manifest.private === true) {
    throw new Error(`${manifest.name} must be a public Apache-2.0 package.`);
  }
  await text(`${directory}/LICENSE`);
}

const cli = JSON.parse(await text("packages/cli/package.json"));
const mcp = JSON.parse(await text("packages/mcp/package.json"));
if (cli.dependencies?.["@turnkeeper/sdk"] !== version) {
  throw new Error("@turnkeeper/cli must pin the matching SDK version.");
}
if (
  mcp.dependencies?.["@turnkeeper/sdk"] !== version ||
  mcp.dependencies?.["@turnkeeper/cli"] !== version
) {
  throw new Error("@turnkeeper/mcp must pin matching SDK and CLI versions.");
}

const schema = JSON.parse(await text("spec/replay-2026-07-09.schema.json"));
const replayTypes = await text("packages/sdk/src/replay/types.ts");
const schemaVersion = schema?.$defs?.event?.properties?.api_version?.const;
if (
  typeof schemaVersion !== "string" ||
  !replayTypes.includes(`REPLAY_API_VERSION = "${schemaVersion}"`)
) {
  throw new Error("Replay schema and SDK version drifted.");
}

async function sourceFiles(directory) {
  const result = [];
  for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
    if ([".git", "dist", "node_modules"].includes(entry.name)) continue;
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await sourceFiles(relative)));
    else if (/\.(?:json|md|mjs|ts|yaml)$/u.test(entry.name)) result.push(relative);
  }
  return result;
}

for (const file of await sourceFiles(".")) {
  if (file === "package-lock.json" || file === "scripts/validate-skill.mjs") continue;
  const content = await text(file);
  const prohibited = prohibitedText.find((value) => content.includes(value));
  if (prohibited) throw new Error(`Prohibited private-repository reference in ${file}: ${prohibited}`);
  if (/\btk_(?:live|test)_[A-Za-z0-9_-]{32,96}\b/u.test(content)) {
    throw new Error(`Credential-like value found in ${file}.`);
  }
}

console.log("Skill, package versions, Replay contract, and repository boundary verified.");
