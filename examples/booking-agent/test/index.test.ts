import assert from "node:assert/strict";
import test from "node:test";

import { evaluateBooking, searchAvailability } from "../src/index.ts";

const BINDING_SECRET = "synthetic-test-only-binding-secret-000001";

test("keeps availability lookup read-only and deterministic", () => {
  assert.deepEqual(searchAvailability("2026_07_20"), [
    "2026_07_20_0900",
    "2026_07_20_1300",
  ]);
});

test("requires review for an authorized booking confirmation", () => {
  assert.equal(
    evaluateBooking(
      {
        slotRef: "slot_demo_0900",
        subjectRef: "subject_demo_001",
      },
      ["scheduler"],
      BINDING_SECRET,
    ).decision,
    "review",
  );
});

test("blocks unauthorized and incomplete booking proposals", () => {
  assert.equal(
    evaluateBooking(
      { slotRef: "slot_demo_0900", subjectRef: "subject_demo_001" },
      ["viewer"],
      BINDING_SECRET,
    ).decision,
    "block",
  );
  assert.equal(
    evaluateBooking(
      { slotRef: "", subjectRef: "subject_demo_001" },
      ["scheduler"],
      BINDING_SECRET,
    ).decision,
    "block",
  );
});
