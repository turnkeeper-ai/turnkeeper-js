import assert from "node:assert/strict";
import test from "node:test";

import { findPublicRepositoryBoundaryViolations } from "./check-public-repository-boundary.mjs";

test("accepts public developer documentation", () => {
  const violations = findPublicRepositoryBoundaryViolations([
    {
      path: "docs/replay.md",
      content: "# Replay\n\nPublic metadata-only SDK behavior.",
    },
  ]);

  assert.deepEqual(violations, []);
});

test("rejects internal business-document paths", () => {
  const violations = findPublicRepositoryBoundaryViolations([
    {
      path: "docs/founder-strategy.md",
      content: "# Company plan",
    },
  ]);

  assert.equal(violations.length, 1);
  assert.match(violations[0], /internal business-document path/u);
});

test("rejects disguised internal business content", () => {
  const violations = findPublicRepositoryBoundaryViolations([
    {
      path: "docs/notes.md",
      content: "Internal founder plan. Do not publish. Design-partner pipeline follows.",
    },
  ]);

  assert.equal(violations.length, 3);
  assert.match(violations.join("\n"), /internal business-document marker/u);
});
