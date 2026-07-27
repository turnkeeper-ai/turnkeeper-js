import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const version = "0.1.0-alpha.6";
const packageDirectories = ["packages/sdk", "packages/cli", "packages/mcp"];
const exampleDirectories = [
  "examples/customer-support-agent",
  "examples/booking-agent",
  "examples/account-management-agent",
  "examples/financial-services-refund",
  "examples/support-escalation",
  "examples/account-contact-change",
];
const installationGuides = [
  ["README.md", "@turnkeeper/sdk"],
  ["packages/sdk/README.md", "@turnkeeper/sdk"],
  ["packages/cli/README.md", "@turnkeeper/cli"],
  ["packages/mcp/README.md", "@turnkeeper/mcp"],
  ["docs/mcp.md", "@turnkeeper/mcp"],
  ["examples/customer-support-agent/README.md", "@turnkeeper/cli"],
  ["examples/booking-agent/README.md", "@turnkeeper/cli"],
  ["examples/account-management-agent/README.md", "@turnkeeper/cli"],
  ["examples/financial-services-refund/README.md", "@turnkeeper/cli"],
  ["examples/support-escalation/README.md", "@turnkeeper/cli"],
  ["examples/account-contact-change/README.md", "@turnkeeper/cli"],
  ["docs/versioning.md", "@turnkeeper/sdk"],
];
const versionReferences = [
  ["docs/agent-builder-skill.md", `\`${version}\``],
  ["docs/releasing.md", `version="${version}"`],
  ["packages/sdk/src/transport.ts", `turnkeeper-sdk/${version}`],
  ["packages/cli/src/cli.ts", `@turnkeeper/sdk@${version}`],
  ["packages/cli/src/scaffold.ts", `"${version}"`],
  ["packages/mcp/src/server.ts", `"${version}"`],
  ["skills/turnkeeper-agent-builder/SKILL.md", `\`${version}\``],
  [
    "skills/turnkeeper-agent-builder/references/public-packages.md",
    `@turnkeeper/cli@${version}`,
  ],
];
const requiredPaths = [
  "LICENSE",
  "docs/control.md",
  "docs/mcp.md",
  "docs/agent-builder-skill.md",
  "docs/releasing.md",
  "docs/repository-boundary.md",
  "spec/control-check-request-2026-07-16.schema.json",
  "spec/control-check-response-2026-07-16.schema.json",
  "spec/replay-2026-07-09.schema.json",
  "skills/turnkeeper-agent-builder/SKILL.md",
  "skills/turnkeeper-agent-builder/agents/openai.yaml",
  "skills/turnkeeper-agent-builder/references/public-packages.md",
  "skills/turnkeeper-agent-builder/references/runtime-architecture.md",
  "skills/turnkeeper-agent-builder/references/framework-patterns.md",
  "skills/turnkeeper-agent-builder/references/security-checklist.md",
  "examples/customer-support-agent/package.json",
  "examples/booking-agent/package.json",
  "examples/account-management-agent/package.json",
  "examples/financial-services-refund/package.json",
  "examples/support-escalation/package.json",
  "examples/account-contact-change/package.json",
  ".github/ISSUE_TEMPLATE/bug.yml",
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

for (const [file, packageName] of installationGuides) {
  const guide = await text(file);
  if (!guide.includes(`${packageName}@${version}`)) {
    throw new Error(`${file} must pin ${packageName}@${version}.`);
  }
}

for (const [file, expected] of versionReferences) {
  if (!(await text(file)).includes(expected)) {
    throw new Error(`${file} must include release-aligned value ${expected}.`);
  }
}

if (!(await text(".github/ISSUE_TEMPLATE/bug.yml")).includes(version)) {
  throw new Error(`Bug reports must prompt for the current alpha ${version}.`);
}

const skill = (await text("skills/turnkeeper-agent-builder/SKILL.md")).replace(
  /\r\n?/gu,
  "\n",
);
if (!skill.startsWith("---\n"))
  throw new Error("Skill frontmatter is missing.");
const frontmatterEnd = skill.indexOf("\n---\n", 4);
if (frontmatterEnd < 0) throw new Error("Skill frontmatter is not closed.");
const frontmatter = skill.slice(4, frontmatterEnd);
if (!/^name: turnkeeper-agent-builder$/mu.test(frontmatter)) {
  throw new Error("Skill name must be turnkeeper-agent-builder.");
}
const description = /^description: (.+)$/mu.exec(frontmatter)?.[1];
if (!description || description.length < 40 || description.length > 1_024) {
  throw new Error(
    "Skill description is missing or outside the supported length.",
  );
}

const rootManifest = JSON.parse(await text("package.json"));
if (rootManifest.version !== version) {
  throw new Error(`Root manifest must use synchronized version ${version}.`);
}

for (const directory of packageDirectories) {
  const manifest = JSON.parse(await text(`${directory}/package.json`));
  if (manifest.version !== version) {
    throw new Error(
      `${manifest.name} must use synchronized version ${version}.`,
    );
  }
  if (manifest.license !== "Apache-2.0" || manifest.private === true) {
    throw new Error(`${manifest.name} must be a public Apache-2.0 package.`);
  }
  await text(`${directory}/LICENSE`);
}

for (const directory of exampleDirectories) {
  const manifest = JSON.parse(await text(`${directory}/package.json`));
  if (
    manifest.version !== version ||
    manifest.dependencies?.["@turnkeeper/sdk"] !== version
  ) {
    throw new Error(
      `${manifest.name} must use synchronized example and SDK version ${version}.`,
    );
  }
}

const lock = JSON.parse(await text("package-lock.json"));
if (lock.version !== version || lock.packages?.[""]?.version !== version) {
  throw new Error(`Package lock root must use synchronized version ${version}.`);
}
for (const directory of [...packageDirectories, ...exampleDirectories]) {
  if (lock.packages?.[directory]?.version !== version) {
    throw new Error(`${directory} package lock entry must use ${version}.`);
  }
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

const controlRequestSchema = JSON.parse(
  await text("spec/control-check-request-2026-07-16.schema.json"),
);
const controlResponseSchema = JSON.parse(
  await text("spec/control-check-response-2026-07-16.schema.json"),
);
const controlSource = await text("packages/sdk/src/governance/control.ts");
const controlVersion = /\/(\d{4}-\d{2}-\d{2})\.json$/u.exec(
  String(controlRequestSchema.$id),
)?.[1];
if (
  !controlVersion ||
  !String(controlResponseSchema.$id).endsWith(`/${controlVersion}.json`) ||
  !controlSource.includes(`CONTROL_API_VERSION = "${controlVersion}"`)
) {
  throw new Error("Control schemas and SDK version drifted.");
}

async function sourceFiles(directory) {
  const result = [];
  for (const entry of await readdir(path.join(root, directory), {
    withFileTypes: true,
  })) {
    if ([".git", "dist", "node_modules"].includes(entry.name)) continue;
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await sourceFiles(relative)));
    else if (/\.(?:json|md|mjs|ts|yaml)$/u.test(entry.name))
      result.push(relative);
  }
  return result;
}

for (const file of await sourceFiles(".")) {
  const portableFile = file.replaceAll("\\", "/");
  if (
    portableFile === "package-lock.json" ||
    portableFile === "scripts/validate-skill.mjs"
  )
    continue;
  const content = await text(file);
  const prohibited = prohibitedText.find((value) => content.includes(value));
  if (prohibited)
    throw new Error(
      `Prohibited private-repository reference in ${portableFile}: ${prohibited}`,
    );
  if (/\btk_(?:live|test)_[A-Za-z0-9_-]{32,96}\b/u.test(content)) {
    throw new Error(`Credential-like value found in ${portableFile}.`);
  }
}

console.log(
  "Skill, package versions, Replay/Control contracts, and repository boundary verified.",
);
