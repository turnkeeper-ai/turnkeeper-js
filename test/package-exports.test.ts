import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("package remains private, unlicensed, ESM-only, and runtime-dependency free", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as Record<string, unknown>;
  assert.equal(pkg.private, true);
  assert.equal(pkg.license, "UNLICENSED");
  assert.equal(pkg.type, "module");
  assert.deepEqual(pkg.dependencies, {});
  assert.equal(Array.isArray(pkg.files) && pkg.files.includes("LICENSE"), false);
});
