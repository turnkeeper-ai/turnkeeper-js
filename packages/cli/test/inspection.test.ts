import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
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

test("inspection refuses a symlink root", async (context) => {
  if (process.platform === "win32") {
    context.skip(
      "symlink creation requires platform-specific privileges on Windows",
    );
    return;
  }

  const root = await mkdtemp(path.join(tmpdir(), "turnkeeper-cli-symlink-"));
  const target = path.join(root, "target");
  const link = path.join(root, "link");
  try {
    const { mkdir, symlink } = await import("node:fs/promises");
    await mkdir(target);
    await symlink(target, link);
    await assert.rejects(inspectIntegration(link), /non-symlink directory/u);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
