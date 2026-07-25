import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { INSPECTION_LIMITS, inspectIntegration } from "../src/index.js";

test("inspection is bounded, skips secret-like files, and reports heuristic bypasses", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "turnkeeper-cli-inspect-"));
  try {
    await writeFile(
      path.join(root, "agent.ts"),
      'import "@turnkeeper/sdk";\nasync function run() { issueRefund(); }\n',
      "utf8",
    );
    await writeFile(path.join(root, "api-key.ts"), "cancelAccount();", "utf8");
    for (let index = 0; index < INSPECTION_LIMITS.maxFiles + 8; index += 1) {
      await writeFile(
        path.join(root, `file-${String(index).padStart(3, "0")}.ts`),
        "export {};\n",
      );
    }

    const result = await inspectIntegration(root);
    assert.equal(result.confidence, "heuristic");
    assert.equal(result.turnkeeperDetected, true);
    assert.equal(result.truncated, true);
    assert.ok(result.filesInspected <= INSPECTION_LIMITS.maxFiles);
    assert.ok(
      result.findings.some(
        (finding) =>
          finding.code === "possible_side_effect_without_control_check" &&
          finding.file === "agent.ts",
      ),
    );
    assert.equal(
      result.findings.some((finding) => finding.file === "api-key.ts"),
      false,
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("inspection refuses a linked directory root", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "turnkeeper-cli-symlink-"));
  const target = path.join(root, "target");
  const link = path.join(root, "link");
  try {
    await mkdir(target);
    await symlink(
      target,
      link,
      process.platform === "win32" ? "junction" : "dir",
    );
    await assert.rejects(inspectIntegration(link), /non-symlink directory/u);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
