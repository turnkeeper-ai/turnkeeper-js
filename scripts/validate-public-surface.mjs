import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractVersion = "2026-08-08";

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

async function exists(relativePath) {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function required(relativePath) {
  if (!(await exists(relativePath))) throw new Error(`Required public artifact is missing: ${relativePath}`);
}

for (const relativePath of [
  "packages/sdk/package.json",
  "packages/sdk/src/ward/exchange.ts",
  "packages/adapter-sentinel/package.json",
  "docs/safety-exchange-protocol-v0.1.md",
  "docs/safety-exchange-conformance-v0.1.md",
  "docs/examples/safety-exchange-v0.1.conformance.json",
  "spec/safety-exchange-2026-08-08.schema.json",
]) {
  await required(relativePath);
}

for (const relativePath of [
  "packages/cli/package.json",
  "packages/mcp/package.json",
  "skills/turnkeeper-agent-builder/SKILL.md",
  "docs/control.md",
  "docs/mcp.md",
  "docs/replay.md",
  "spec/control-check-request-2026-07-16.schema.json",
  "spec/control-check-response-2026-07-16.schema.json",
  "spec/control-review-response-2026-07-16.schema.json",
  "spec/replay-2026-07-09.schema.json",
  "spec/replay-2026-07-27.schema.json",
]) {
  if (await exists(relativePath)) throw new Error(`Retired legacy artifact remains: ${relativePath}`);
}

const rootPackage = JSON.parse(await read("package.json"));
const sdkPackage = JSON.parse(await read("packages/sdk/package.json"));
const adapterPackage = JSON.parse(await read("packages/adapter-sentinel/package.json"));
if (rootPackage.version !== sdkPackage.version || sdkPackage.version !== adapterPackage.version) {
  throw new Error("Retained package versions must match the repository source version.");
}
if (Object.keys(sdkPackage.dependencies ?? {}).length !== 0) {
  throw new Error("The public Ward SDK must remain zero-dependency.");
}
if (Object.keys(adapterPackage.dependencies ?? {}).length !== 0) {
  throw new Error("The detector adapter must remain zero-dependency.");
}

const index = await read("packages/sdk/src/index.ts");
if (index.trim() !== 'export * from "./ward/index.js";') {
  throw new Error("The public SDK index must export only the Ward contract surface.");
}
const exchangeSource = await read("packages/sdk/src/ward/exchange.ts");
if (!exchangeSource.includes(`EXCHANGE_CONTRACT_VERSION = "${contractVersion}"`)) {
  throw new Error("The SDK exchange contract version drifted.");
}
const schema = JSON.parse(await read("spec/safety-exchange-2026-08-08.schema.json"));
if (schema.$id !== `https://turnkeeper.ai/schemas/safety-exchange/${contractVersion}.json`) {
  throw new Error("The public safety-exchange schema version drifted.");
}

process.stdout.write("Public Ward contract surface verified.\n");
