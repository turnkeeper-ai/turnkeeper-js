import assert from "node:assert/strict";
import test from "node:test";

import {
  PayloadBoundaryError,
  assertBoundedInput,
  serializeBoundedOutput,
} from "../src/bounds.js";

test("input bounds reject cycles, sparse arrays, non-JSON values, and oversized payloads", () => {
  const cyclic: unknown[] = [];
  cyclic.push(cyclic);
  assert.throws(() => assertBoundedInput(cyclic), PayloadBoundaryError);

  const sparse = new Array(2);
  sparse[1] = true;
  assert.throws(() => assertBoundedInput(sparse), PayloadBoundaryError);
  assert.throws(() => assertBoundedInput({ value: BigInt(1) }), PayloadBoundaryError);
  assert.throws(
    () => assertBoundedInput({ value: "x".repeat(70 * 1024) }),
    /input_payload_too_large/u,
  );
});

test("output serialization is deterministic and bounded", () => {
  assert.equal(serializeBoundedOutput({ z: 1, a: { y: 2, b: 3 } }), `{
  "a": {
    "b": 3,
    "y": 2
  },
  "z": 1
}`);
  assert.throws(
    () => serializeBoundedOutput({ value: "x".repeat(300 * 1024) }),
    /output_payload_too_large/u,
  );
});
