import assert from "node:assert/strict";
import test from "node:test";

import { accountActions } from "../src/index.ts";

const BINDING_SECRET = "synthetic-test-only-binding-secret-000001";

test("allows low-risk profile updates for the expected role", () => {
  assert.equal(
    accountActions.updateProfile(
      "profile_patch_demo_001",
      ["account_agent"],
      BINDING_SECRET,
    ).decision,
    "allow",
  );
});

test("requires review for cancellation and payment-reference changes", () => {
  assert.equal(
    accountActions.cancelAccount(
      "account_demo_001",
      ["account_admin"],
      BINDING_SECRET,
    ).decision,
    "review",
  );
  assert.equal(
    accountActions.changePayment(
      "payment_ref_demo_001",
      ["billing_admin"],
      BINDING_SECRET,
    ).decision,
    "review",
  );
});

test("blocks unauthorized or incomplete account actions", () => {
  assert.equal(
    accountActions.cancelAccount(
      "account_demo_001",
      ["account_agent"],
      BINDING_SECRET,
    ).decision,
    "block",
  );
  assert.equal(
    accountActions.changePayment("", ["billing_admin"], BINDING_SECRET).decision,
    "block",
  );
});
