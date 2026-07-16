import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("package is an Apache-2.0 public prerelease with a bounded dependency surface", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as Record<string, unknown>;
  assert.notEqual(pkg.private, true);
  assert.equal(pkg.license, "Apache-2.0");
  assert.equal(pkg.type, "module");
  assert.deepEqual(pkg.dependencies, { zod: "4.4.3" });
  assert.equal(Array.isArray(pkg.files) && pkg.files.includes("LICENSE"), true);
  assert.equal((pkg.publishConfig as Record<string, unknown>).access, "public");
});
