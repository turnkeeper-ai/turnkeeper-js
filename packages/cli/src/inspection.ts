import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".venv",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "target",
  "vendor",
]);
const SAFE_EXTENSIONS = new Set([
  ".js",
  ".json",
  ".jsx",
  ".mjs",
  ".py",
  ".ts",
  ".tsx",
]);
const SECRET_FILE_PATTERN =
  /(?:^|[._-])(?:credential|credentials|key|private|secret|secrets|token|tokens)(?:$|[._-])/iu;

export const INSPECTION_LIMITS = Object.freeze({
  maxBytesPerFile: 64 * 1024,
  maxDepth: 12,
  maxDirectories: 200,
  maxFiles: 200,
  maxFindings: 100,
  maxTotalBytes: 1024 * 1024,
});

export interface IntegrationFinding {
  code: string;
  file?: string;
  severity: "error" | "warning";
}

export interface IntegrationInspection {
  bytesInspected: number;
  confidence: "heuristic";
  filesInspected: number;
  filesSkipped: number;
  findings: IntegrationFinding[];
  truncated: boolean;
  turnkeeperDetected: boolean;
}

interface CandidateFile {
  absolutePath: string;
  relativePath: string;
  size: number;
}

function ignoredName(name: string): boolean {
  if (name.startsWith(".env")) return true;
  if (name.startsWith(".") && name !== ".eslintrc") return true;
  return SECRET_FILE_PATTERN.test(name);
}

async function candidateFiles(root: string): Promise<{
  files: CandidateFile[];
  skipped: number;
  truncated: boolean;
}> {
  const files: CandidateFile[] = [];
  let directories = 0;
  let skipped = 0;
  let truncated = false;

  async function visit(directory: string, depth: number): Promise<void> {
    if (
      depth > INSPECTION_LIMITS.maxDepth ||
      directories >= INSPECTION_LIMITS.maxDirectories
    ) {
      truncated = true;
      return;
    }
    directories += 1;

    const entries = (await readdir(directory, { withFileTypes: true })).sort(
      (left, right) => left.name.localeCompare(right.name),
    );
    for (const entry of entries) {
      if (files.length >= INSPECTION_LIMITS.maxFiles) {
        truncated = true;
        return;
      }
      if (ignoredName(entry.name) || IGNORED_DIRECTORIES.has(entry.name)) {
        skipped += 1;
        continue;
      }

      const absolutePath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        skipped += 1;
        continue;
      }
      if (entry.isDirectory()) {
        await visit(absolutePath, depth + 1);
        if (files.length >= INSPECTION_LIMITS.maxFiles) return;
        continue;
      }
      if (
        !entry.isFile() ||
        (!SAFE_EXTENSIONS.has(path.extname(entry.name)) &&
          entry.name !== "package.json")
      ) {
        skipped += 1;
        continue;
      }

      const stat = await lstat(absolutePath);
      if (stat.size > INSPECTION_LIMITS.maxBytesPerFile) {
        skipped += 1;
        truncated = true;
        continue;
      }
      files.push({
        absolutePath,
        relativePath: path.relative(root, absolutePath),
        size: stat.size,
      });
    }
  }

  await visit(root, 0);
  return { files, skipped, truncated };
}

function addFinding(
  findings: IntegrationFinding[],
  finding: IntegrationFinding,
): void {
  if (findings.length < INSPECTION_LIMITS.maxFindings) findings.push(finding);
}

export async function inspectIntegration(
  projectPath: string,
): Promise<IntegrationInspection> {
  if (!projectPath || projectPath.length > 1024) {
    throw new TypeError(
      "projectPath must contain between 1 and 1024 characters.",
    );
  }
  const root = path.resolve(projectPath);
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new TypeError("projectPath must be a non-symlink directory.");
  }

  const candidates = await candidateFiles(root);
  const findings: IntegrationFinding[] = [];
  const sources: Array<{ file: string; source: string }> = [];
  let bytesInspected = 0;
  let truncated = candidates.truncated;
  let filesSkipped = candidates.skipped;

  for (const candidate of candidates.files) {
    if (bytesInspected + candidate.size > INSPECTION_LIMITS.maxTotalBytes) {
      filesSkipped += 1;
      truncated = true;
      continue;
    }
    const source = await readFile(candidate.absolutePath, "utf8");
    bytesInspected += Buffer.byteLength(source, "utf8");
    sources.push({ file: candidate.relativePath, source });
  }

  const combined = sources.map(({ source }) => source).join("\n");
  const turnkeeperDetected =
    /@turnkeeper\/sdk|ControlClient|\/api\/v1\/checks|replay\.ingestBatch/u.test(
      combined,
    );
  if (!turnkeeperDetected) {
    addFinding(findings, {
      code: "turnkeeper_not_detected",
      severity: "error",
    });
  }

  const sideEffectPattern =
    /\b(?:cancelAccount|changePayment|confirmBooking|createCharge|deleteAccount|issueRefund|refund|sendPayment|transferFunds)\s*\(/u;
  const controlPattern =
    /ControlClient|evaluateBeforeExecution|\/api\/v1\/checks/u;
  const stopBranchPattern =
    /decision\s*={2,3}\s*["'](?:block|review)["']|["'](?:block|review)["']\s*={2,3}\s*decision/u;

  for (const { file, source } of sources) {
    if (sideEffectPattern.test(source) && !controlPattern.test(source)) {
      addFinding(findings, {
        code: "possible_side_effect_without_control_check",
        file,
        severity: "error",
      });
    }
    if (controlPattern.test(source) && !stopBranchPattern.test(source)) {
      addFinding(findings, {
        code: "possible_missing_review_or_block_branch",
        file,
        severity: "error",
      });
    }
  }

  if (turnkeeperDetected && !/Idempotency-Key|idempotencyKey/u.test(combined)) {
    addFinding(findings, {
      code: "possible_missing_idempotency_key",
      severity: "warning",
    });
  }
  if (
    turnkeeperDetected &&
    !/replay\.ingestBatch|ReplayClient|TurnkeeperClient/u.test(combined)
  ) {
    addFinding(findings, {
      code: "possible_missing_replay_delivery",
      severity: "warning",
    });
  }
  if (
    turnkeeperDetected &&
    !/actionBinding|createActionBinding/u.test(combined)
  ) {
    addFinding(findings, {
      code: "possible_missing_action_binding",
      severity: "warning",
    });
  }
  if (findings.length >= INSPECTION_LIMITS.maxFindings) truncated = true;

  return {
    bytesInspected,
    confidence: "heuristic",
    filesInspected: sources.length,
    filesSkipped,
    findings,
    truncated,
    turnkeeperDetected,
  };
}
