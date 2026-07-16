import { lstat, readdir, realpath } from "node:fs/promises";
import path from "node:path";

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".venv",
  "coverage",
  "dist",
  "node_modules",
  "vendor",
]);
const INSPECTED_EXTENSIONS = new Set([".js", ".json", ".jsx", ".mjs", ".py", ".ts", ".tsx"]);
const MAX_PROJECT_PATH_BYTES = 1_024;
const MAX_DIRECTORIES = 200;
const MAX_ENTRIES = 4_096;
const MAX_FILES = 200;
const MAX_DEPTH = 12;
const MAX_FILE_BYTES = 64 * 1024;
const MAX_TOTAL_FILE_BYTES = 1024 * 1024;

export type WorkspaceBoundaryCode =
  | "inspection_limit_exceeded"
  | "project_path_invalid"
  | "project_path_not_found"
  | "project_path_outside_workspace"
  | "workspace_root_invalid";

export class WorkspaceBoundaryError extends Error {
  readonly code: WorkspaceBoundaryCode;

  constructor(code: WorkspaceBoundaryCode) {
    super(code);
    this.name = "WorkspaceBoundaryError";
    this.code = code;
  }
}

function insideWorkspace(workspaceRoot: string, candidate: string): boolean {
  const relative = path.relative(workspaceRoot, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function boundedTreePreflight(projectRoot: string): Promise<void> {
  const pending: Array<{ depth: number; directory: string }> = [
    { depth: 0, directory: projectRoot },
  ];
  let directories = 0;
  let entries = 0;
  let files = 0;
  let totalFileBytes = 0;

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) break;
    directories += 1;
    if (directories > MAX_DIRECTORIES || current.depth > MAX_DEPTH) {
      throw new WorkspaceBoundaryError("inspection_limit_exceeded");
    }

    let children;
    try {
      children = await readdir(current.directory, { withFileTypes: true });
    } catch {
      throw new WorkspaceBoundaryError("project_path_not_found");
    }
    children.sort((left, right) => left.name.localeCompare(right.name));

    for (const child of children) {
      entries += 1;
      if (entries > MAX_ENTRIES) {
        throw new WorkspaceBoundaryError("inspection_limit_exceeded");
      }
      if (
        child.name.startsWith(".env") ||
        (child.name.startsWith(".") && child.name !== ".eslintrc") ||
        IGNORED_DIRECTORIES.has(child.name)
      ) {
        continue;
      }
      if (child.isSymbolicLink()) continue;

      const absolute = path.join(current.directory, child.name);
      if (child.isDirectory()) {
        pending.push({ depth: current.depth + 1, directory: absolute });
        continue;
      }
      if (
        !child.isFile() ||
        !(INSPECTED_EXTENSIONS.has(path.extname(child.name)) || child.name === "package.json")
      ) {
        continue;
      }

      let stat;
      try {
        stat = await lstat(absolute);
      } catch {
        throw new WorkspaceBoundaryError("project_path_not_found");
      }
      if (!stat.isFile() || stat.size > MAX_FILE_BYTES) continue;
      files += 1;
      totalFileBytes += stat.size;
      if (files > MAX_FILES || totalFileBytes > MAX_TOTAL_FILE_BYTES) {
        throw new WorkspaceBoundaryError("inspection_limit_exceeded");
      }
    }
  }
}

export async function resolveWorkspaceRoot(value: string): Promise<string> {
  if (
    !value ||
    value.includes("\0") ||
    Buffer.byteLength(value, "utf8") > MAX_PROJECT_PATH_BYTES
  ) {
    throw new WorkspaceBoundaryError("workspace_root_invalid");
  }
  let resolved: string;
  try {
    resolved = await realpath(path.resolve(value));
    const stat = await lstat(resolved);
    if (!stat.isDirectory()) throw new WorkspaceBoundaryError("workspace_root_invalid");
  } catch (error) {
    if (error instanceof WorkspaceBoundaryError) throw error;
    throw new WorkspaceBoundaryError("workspace_root_invalid");
  }
  return resolved;
}

export async function resolveInspectionPath(
  workspaceRoot: string,
  projectPath: string,
): Promise<string> {
  if (
    !projectPath ||
    projectPath.includes("\0") ||
    path.isAbsolute(projectPath) ||
    Buffer.byteLength(projectPath, "utf8") > MAX_PROJECT_PATH_BYTES
  ) {
    throw new WorkspaceBoundaryError("project_path_invalid");
  }

  const requested = path.resolve(workspaceRoot, projectPath);
  if (!insideWorkspace(workspaceRoot, requested)) {
    throw new WorkspaceBoundaryError("project_path_outside_workspace");
  }

  let resolved: string;
  try {
    resolved = await realpath(requested);
    const stat = await lstat(resolved);
    if (!stat.isDirectory()) throw new WorkspaceBoundaryError("project_path_invalid");
  } catch (error) {
    if (error instanceof WorkspaceBoundaryError) throw error;
    throw new WorkspaceBoundaryError("project_path_not_found");
  }
  if (!insideWorkspace(workspaceRoot, resolved)) {
    throw new WorkspaceBoundaryError("project_path_outside_workspace");
  }

  await boundedTreePreflight(resolved);
  return resolved;
}
