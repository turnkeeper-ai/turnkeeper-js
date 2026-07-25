import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  resolveInspectionPath,
  resolveWorkspaceRoot,
  WorkspaceBoundaryError,
} from "../src/workspace.js";

test("inspection paths remain beneath the configured real workspace root", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "turnkeeper-mcp-workspace-"));
  const workspace = path.join(temporary, "workspace");
  const project = path.join(workspace, "agent");
  const outside = path.join(temporary, "outside");
  try {
    await mkdir(project, { recursive: true });
    await mkdir(outside, { recursive: true });
    await writeFile(path.join(project, "agent.ts"), "export const safe = true;\n", "utf8");
    await symlink(
      outside,
      path.join(workspace, "outside-link"),
      process.platform === "win32" ? "junction" : "dir",
    );

    const root = await resolveWorkspaceRoot(workspace);
    assert.equal(await resolveInspectionPath(root, "agent"), path.join(root, "agent"));
    await assert.rejects(
      resolveInspectionPath(root, "../outside"),
      (error: unknown) =>
        error instanceof WorkspaceBoundaryError &&
        error.code === "project_path_outside_workspace",
    );
    await assert.rejects(
      resolveInspectionPath(root, "outside-link"),
      (error: unknown) =>
        error instanceof WorkspaceBoundaryError &&
        error.code === "project_path_outside_workspace",
    );
    await assert.rejects(resolveInspectionPath(root, outside), /project_path_invalid/u);
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
});

test("inspection preflight rejects trees beyond the directory bound", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "turnkeeper-mcp-bounds-"));
  try {
    let current = temporary;
    for (let index = 0; index < 14; index += 1) {
      current = path.join(current, `level-${index}`);
      await mkdir(current);
    }
    const root = await resolveWorkspaceRoot(temporary);
    await assert.rejects(
      resolveInspectionPath(root, "."),
      (error: unknown) =>
        error instanceof WorkspaceBoundaryError &&
        error.code === "inspection_limit_exceeded",
    );
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
});
