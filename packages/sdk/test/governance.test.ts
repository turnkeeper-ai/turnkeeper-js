import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTION_CONTEXT_SCHEMA_VERSION,
  ControlClient,
  GovernanceInputError,
  TurnkeeperProtocolError,
  canonicalSHA256,
  createActionBinding,
  deriveIdempotencyKey,
  generatePolicy,
  simulateAction,
  validatePolicy,
  type ActionContext,
} from "../src/index.js";

const BINDING_SECRET = "synthetic-binding-secret-that-is-at-least-32-bytes";
const API_KEY = `tk_test_${"a".repeat(40)}`;

function bundle() {
  return generatePolicy({
    actionName: "issue_refund",
    allowedRoles: ["support_agent"],
    approvalRequired: true,
    parameterRestrictions: [
      { kind: "required", parameter: "order_id" },
      { kind: "max_number", maximum: 500, parameter: "amount" },
    ],
    requiredConditions: [
      { operator: "gte", signalKey: "amount", value: 100, valueType: "number" },
    ],
    riskLevel: "high",
  });
}

function action(overrides: Partial<ActionContext> = {}): ActionContext {
  return {
    actionName: "issue_refund",
    actorId: "actor_1",
    actorRoles: ["support_agent"],
    conversationId: "conversation_1",
    environment: "test",
    parameters: { amount: 120, order_id: "order_1" },
    projectId: "project_1",
    proposalVersion: 1,
    schemaVersion: ACTION_CONTEXT_SCHEMA_VERSION,
    signals: { amount: 120 },
    tenantId: "tenant_1",
    turnId: "turn_1",
    userId: "user_1",
    ...overrides,
  };
}

test("policy generation reports sanitized field-level input issues", () => {
  assert.throws(
    () => {
      // @ts-expect-error -- Runtime JavaScript callers can omit required fields.
      return generatePolicy({
        actionName: "issue_refund",
        allowedRoles: ["support_agent"],
        approvalRequired: true,
        parameterRestrictions: [],
        requiredConditions: [],
      });
    },
    (error: unknown) => {
      assert.ok(error instanceof GovernanceInputError);
      assert.equal(error.code, "invalid_policy_generation_input");
      assert.deepEqual(error.issues, [
        { path: "$.riskLevel", code: "invalid_value" },
      ]);
      return true;
    },
  );

  const canary = "api_key_synthetic_canary";
  assert.throws(
    () =>
      generatePolicy({
        actionName: "issue_refund",
        allowedRoles: ["support_agent"],
        approvalRequired: true,
        parameterRestrictions: [],
        requiredConditions: [
          {
            operator: "exists",
            signalKey: canary,
            valueType: "string",
          },
        ],
        riskLevel: "high",
      }),
    (error: unknown) => {
      assert.ok(error instanceof GovernanceInputError);
      assert.deepEqual(error.issues, [
        {
          path: "$.requiredConditions[0].signalKey",
          code: "unsafe_signal_key",
        },
      ]);
      assert.equal(JSON.stringify(error).includes(canary), false);
      return true;
    },
  );
});

test("semantic policy generation errors retain their operation-specific codes", () => {
  assert.throws(
    () =>
      generatePolicy({
        actionName: "issue_refund",
        allowedRoles: ["support_agent"],
        approvalRequired: false,
        parameterRestrictions: [],
        requiredConditions: [],
        riskLevel: "high",
      }),
    (error: unknown) => {
      assert.ok(error instanceof GovernanceInputError);
      assert.equal(error.code, "high_risk_requires_approval");
      assert.deepEqual(error.issues, []);
      return true;
    },
  );
});

test("high-risk conditional policies review matching actions and block the fallback", () => {
  const policy = bundle();
  assert.deepEqual(
    policy.policies.map((entry) => [entry.operator, entry.decision]),
    [
      ["gte", "review"],
      ["always", "block"],
    ],
  );
  assert.equal(validatePolicy(policy).valid, true);
  assert.equal(
    simulateAction(policy, action(), { bindingSecret: BINDING_SECRET }).decision,
    "review",
  );
  assert.equal(
    simulateAction(policy, action({ signals: { amount: 20 } }), {
      bindingSecret: BINDING_SECRET,
    }).decision,
    "block",
  );
});

test("semantic validation rejects missing fallback and any reachable high-risk allow", () => {
  const policy = bundle();
  const missingFallback = { ...policy, policies: [policy.policies[0]] };
  assert.equal(validatePolicy(missingFallback).valid, false);
  assert.ok(
    validatePolicy(missingFallback).findings.some(
      (finding) => finding.code === "missing_explicit_fallback",
    ),
  );

  const unsafe = {
    ...policy,
    policies: [{ ...policy.policies[0], decision: "allow" as const }, policy.policies[1]],
  };
  assert.equal(validatePolicy(unsafe).valid, false);
  assert.ok(
    validatePolicy(unsafe).findings.some(
      (finding) => finding.code === "unsafe_reachable_decision",
    ),
  );
});

test("action binding is keyed, stable, versioned, and strict about JSON values", () => {
  const first = createActionBinding(action(), BINDING_SECRET);
  const reordered = createActionBinding(
    action({ parameters: { order_id: "order_1", amount: 120 } }),
    BINDING_SECRET,
  );
  assert.equal(first, reordered);
  assert.notEqual(first, createActionBinding(action(), `${BINDING_SECRET}-different`));
  assert.match(deriveIdempotencyKey(first), /^tk-check-[a-f0-9]{64}$/u);

  assert.throws(
    () => createActionBinding(action({ parameters: { value: new Date(0) } }), BINDING_SECRET),
    /validation/u,
  );
  const cyclic: unknown[] = [];
  cyclic.push(cyclic);
  assert.throws(
    () => createActionBinding(action({ parameters: { cyclic } }), BINDING_SECRET),
    /validation/u,
  );
});

test("governance signals reject URL-like keys and values before transport", () => {
  assert.throws(
    () =>
      simulateAction(bundle(), action({ signals: { callback_url: "safe_code" } }), {
        bindingSecret: BINDING_SECRET,
      }),
    /validation/u,
  );
  for (const value of [
    "https://customer.example/private",
    "s3://private-bucket/object",
    "ftp://customer.example/private",
    "file://private/path",
  ]) {
    assert.throws(
      () =>
        simulateAction(bundle(), action({ signals: { callback: value } }), {
          bindingSecret: BINDING_SECRET,
        }),
      /validation/u,
    );
  }
});

test("ControlClient blocks local execution guards without a network request", async () => {
  let called = false;
  const client = new ControlClient({
    apiKey: API_KEY,
    baseUrl: "http://localhost:3000",
    fetch: async () => {
      called = true;
      return new Response();
    },
  });
  const result = await client.check(bundle(), action({ actorRoles: ["viewer"] }), {
    bindingSecret: BINDING_SECRET,
  });
  assert.equal(result.decision, "block");
  assert.equal(result.source, "local_guard");
  assert.equal(called, false);
});

test("ControlClient accepts only a correlated, matched decision equal to local policy", async () => {
  const expectedActionBinding = createActionBinding(action(), BINDING_SECRET);
  const expectedRequest = {
    references: { action_id: expectedActionBinding },
    signals: action().signals,
    workflow: action().actionName,
  };
  const client = new ControlClient({
    apiKey: API_KEY,
    baseUrl: "https://api.example.invalid",
    fetch: async (_input, init) => {
      assert.equal(
        new Headers(init?.headers).get("idempotency-key"),
        deriveIdempotencyKey(expectedActionBinding),
      );
      assert.deepEqual(JSON.parse(String(init?.body)), expectedRequest);
      return new Response(
        JSON.stringify({
          request_id: "req_synthetic",
          check_id: "chk_synthetic",
          decision: "review",
          evidence: {
            record_hash: "b".repeat(64),
            record_id: "grc_synthetic",
            request_hash: canonicalSHA256(expectedRequest),
          },
          matched: true,
          policy: {
            id: "pol_synthetic",
            name: "issue_refund review_required",
            condition: { key: "amount", operator: "gte", type: "number", value: "100" },
            rule_code: "issue_refund.review_required",
            version: 1,
          },
          reason_code: "issue_refund.review_required",
          review: { id: "rev_synthetic", status: "open", version: 1 },
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    },
  });
  const result = await client.check(bundle(), action(), { bindingSecret: BINDING_SECRET });
  assert.equal(result.decision, "review");
  assert.equal(result.matched, true);
  assert.equal(result.evidence?.requestHash, canonicalSHA256(expectedRequest));
  assert.equal(result.review?.id, "rev_synthetic");
});

test("ControlClient rejects hosted policy and review versions outside the wire contract", async () => {
  const expectedRequest = {
    references: { action_id: createActionBinding(action(), BINDING_SECRET) },
    signals: action().signals,
    workflow: action().actionName,
  };

  for (const [field, code] of [
    ["policy", "invalid_control_policy"],
    ["review", "invalid_control_review"],
  ] as const) {
    for (const version of [0, 2_147_483_648]) {
      const response = {
        request_id: "req_synthetic",
        check_id: "chk_synthetic",
        decision: "review",
        evidence: {
          record_hash: "b".repeat(64),
          record_id: "grc_synthetic",
          request_hash: canonicalSHA256(expectedRequest),
        },
        matched: true,
        policy: {
          id: "pol_synthetic",
          name: "issue_refund review_required",
          condition: { key: "amount", operator: "gte", type: "number", value: "100" },
          rule_code: "issue_refund.review_required",
          version: field === "policy" ? version : 1,
        },
        reason_code: "issue_refund.review_required",
        review: {
          id: "rev_synthetic",
          status: "open",
          version: field === "review" ? version : 1,
        },
      };
      const client = new ControlClient({
        apiKey: API_KEY,
        baseUrl: "https://api.example.invalid",
        fetch: async () =>
          new Response(JSON.stringify(response), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      });

      await assert.rejects(
        () => client.check(bundle(), action(), { bindingSecret: BINDING_SECRET }),
        (error: unknown) => {
          assert.ok(error instanceof TurnkeeperProtocolError);
          assert.equal(error.code, code);
          return true;
        },
      );
    }
  }
});

test("ControlClient rejects unmatched allows and local/hosted policy drift", async () => {
  for (const response of [
    {
      request_id: "req_synthetic",
      check_id: "chk_synthetic",
      decision: "allow",
      evidence: null,
      matched: false,
      policy: null,
      reason_code: "no_policy_match",
      review: null,
    },
    {
      request_id: "req_synthetic",
      check_id: "chk_synthetic",
      decision: "allow",
      evidence: {
        record_hash: "b".repeat(64),
        record_id: "grc_synthetic",
        request_hash: "c".repeat(64),
      },
      matched: true,
      policy: {
        id: "pol_synthetic",
        name: "Unsafe allow",
        condition: { key: "amount", operator: "gte", type: "number", value: "100" },
        rule_code: "issue_refund.allow",
        version: 1,
      },
      reason_code: "issue_refund.allow",
      review: null,
    },
  ]) {
    const client = new ControlClient({
      apiKey: API_KEY,
      baseUrl: "https://api.example.invalid",
      fetch: async () =>
        new Response(JSON.stringify(response), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    });
    await assert.rejects(
      () => client.check(bundle(), action(), { bindingSecret: BINDING_SECRET }),
      TurnkeeperProtocolError,
    );
  }
});

test("ControlClient rejects a same-decision hosted policy with the wrong rule", async () => {
  const expectedRequest = {
    references: { action_id: createActionBinding(action(), BINDING_SECRET) },
    signals: action().signals,
    workflow: action().actionName,
  };
  const client = new ControlClient({
    apiKey: API_KEY,
    baseUrl: "https://api.example.invalid",
    fetch: async () =>
      new Response(
        JSON.stringify({
          request_id: "req_synthetic",
          check_id: "chk_synthetic",
          decision: "review",
          evidence: {
            record_hash: "b".repeat(64),
            record_id: "grc_synthetic",
            request_hash: canonicalSHA256(expectedRequest),
          },
          matched: true,
          policy: {
            id: "pol_synthetic",
            name: "Different review",
            condition: { key: "amount", operator: "gte", type: "number", value: "100" },
            rule_code: "different_workflow.review_required",
            version: 1,
          },
          reason_code: "different_workflow.review_required",
          review: { id: "rev_synthetic", status: "open", version: 1 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  });
  await assert.rejects(
    () => client.check(bundle(), action(), { bindingSecret: BINDING_SECRET }),
    (error: unknown) => {
      assert.ok(error instanceof TurnkeeperProtocolError);
      assert.equal(error.code, "policy_configuration_mismatch");
      return true;
    },
  );
});

test("ControlClient retrieves a terminal review for durable customer-owned resume", async () => {
  const client = new ControlClient({
    apiKey: API_KEY,
    baseUrl: "https://api.example.invalid",
    fetch: async (input, init) => {
      assert.equal(String(input), "https://api.example.invalid/api/v1/reviews/rev_synthetic");
      assert.equal(init?.method, "GET");
      return Response.json({
        api_version: "2026-07-16",
        request_id: "req_synthetic",
        review: {
          action_ref: "action_binding_1",
          conversation_external_id: "a".repeat(64),
          id: "rev_synthetic",
          policy: {
            id: "pol_synthetic",
            name: "issue_refund review_required",
            rule_code: "issue_refund.review_required",
            version: 1,
          },
          priority: 80,
          requested_at: "2026-07-18T10:00:00.000Z",
          resolution: {
            decided_at: "2026-07-18T10:05:00.000Z",
            outcome_code: "approved_exact_proposal",
            reason_code: "human_review_complete",
          },
          source_event_id: null,
          status: "approved",
          trace_id: null,
          turn_external_id: "b".repeat(64),
          version: 2,
          workflow: "issue_refund",
        },
      });
    },
  });

  const review = await client.getReview("rev_synthetic");
  assert.equal(review.status, "approved");
  assert.equal(review.resolution?.outcomeCode, "approved_exact_proposal");
  assert.equal(review.requestId, "req_synthetic");
});

test("ControlClient rejects malformed review IDs and inconsistent terminal responses", async () => {
  const client = new ControlClient({
    apiKey: API_KEY,
    baseUrl: "https://api.example.invalid",
    fetch: async () =>
      Response.json({
        api_version: "2026-07-16",
        request_id: "req_synthetic",
        review: {
          action_ref: null,
          conversation_external_id: null,
          id: "rev_synthetic",
          policy: null,
          priority: 0,
          requested_at: "2026-07-18T10:00:00.000Z",
          resolution: null,
          source_event_id: null,
          status: "approved",
          trace_id: null,
          turn_external_id: null,
          version: 2,
          workflow: "issue_refund",
        },
      }),
  });

  await assert.rejects(() => client.getReview("unsafe"), /validation/u);
  await assert.rejects(
    () => client.getReview("rev_synthetic"),
    (error: unknown) => {
      assert.ok(error instanceof TurnkeeperProtocolError);
      assert.equal(error.code, "control_review_status_mismatch");
      return true;
    },
  );
});
