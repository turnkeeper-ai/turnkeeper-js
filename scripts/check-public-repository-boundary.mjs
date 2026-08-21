import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const DOCUMENT_PATH = /\.(?:md|mdx|txt)$/iu;
const FORBIDDEN_PATH =
  /(?:^|\/)(?:business|founder|fundraising|investor|linkedin-drafts|outreach|pipeline|prospecting|sales|strategy|yc-application)(?:[-_.\/]|$)/iu;

const FORBIDDEN_CONTENT = [
  /\binternal (?:business|founder|operating|working) (?:brief|document|kit|plan)\b/iu,
  /\b(?:customer|design-partner|investor|sales) pipeline\b/iu,
  /\bdo not publish\b/iu,
  /\bfounder-approved\b/iu,
  /\bfundraising (?:brief|plan|strategy)\b/iu,
  /\bgo-to-market (?:brief|plan|strategy)\b/iu,
  /\bprivate draft\b/iu,
  /\bYC application brief\b/iu,
];

export function findPublicRepositoryBoundaryViolations(entries) {
  const violations = [];

  for (const entry of entries) {
    if (!DOCUMENT_PATH.test(entry.path)) continue;

    if (FORBIDDEN_PATH.test(entry.path)) {
      violations.push(`${entry.path}: internal business-document path`);
    }

    for (const pattern of FORBIDDEN_CONTENT) {
      if (pattern.test(entry.content)) {
        violations.push(`${entry.path}: internal business-document marker (${pattern.source})`);
      }
    }
  }

  return violations;
}

export function trackedDocumentationEntries() {
  const paths = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean)
    .filter((path) => DOCUMENT_PATH.test(path));

  return paths.map((path) => ({ path, content: readFileSync(path, "utf8") }));
}

function main() {
  const violations = findPublicRepositoryBoundaryViolations(trackedDocumentationEntries());
  if (violations.length > 0) {
    process.stderr.write(
      `Public repository boundary check failed:\n${violations.map((item) => `- ${item}`).join("\n")}\n`,
    );
    process.exitCode = 1;
    return;
  }

  process.stdout.write("Public repository boundary check passed.\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
