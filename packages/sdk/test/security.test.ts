import assert from "node:assert/strict";
import test from "node:test";

import {
  TurnkeeperClient,
  TurnkeeperProtocolError,
  TurnkeeperValidationError,
  classifyRetry,
} from "../src/index.js";
import { API_KEY, NOW, acceptedResponse, replayBatch } from "./helpers.js";

test("rejects insecure remote URLs and credential-bearing URLs", () => {
  for (const baseUrl of [
    "http://example.invalid",
    "https://user:password@example.invalid",
    "https://example.invalid/private",
    "https://example.invalid?token=value",
  ]) {
    assert.throws(() => new TurnkeeperClient({ apiKey: API_KEY, baseUrl }), TurnkeeperValidationError);
  }
  assert.doesNotThrow(() => new TurnkeeperClient({ apiKey: API_KEY, baseUrl: "http://localhost:3000" }));
});

test("reports client configuration failures with safe field-level diagnostics", () => {
  const malformedApiKey = `tk_test_${"a".repeat(31)}`;
  const invalidBaseUrl = "https://example.invalid/synthetic-configuration-canary";
  const cases = [
    {
      options: {
        apiKey: malformedApiKey,
        baseUrl: "https://example.invalid",
      },
      issue: { path: "$.apiKey", code: "invalid_api_key" },
      rejectedValue: malformedApiKey,
    },
    {
      options: { apiKey: API_KEY, baseUrl: invalidBaseUrl },
      issue: { path: "$.baseUrl", code: "invalid_base_url" },
      rejectedValue: invalidBaseUrl,
    },
    {
      options: {
        apiKey: API_KEY,
        baseUrl: "https://example.invalid",
        timeoutMs: 0,
      },
      issue: { path: "$.timeoutMs", code: "invalid_timeout" },
      rejectedValue: "0",
    },
  ];

  for (const { options, issue, rejectedValue } of cases) {
    assert.throws(
      () => new TurnkeeperClient(options),
      (error: unknown) => {
        assert.ok(error instanceof TurnkeeperValidationError);
        assert.equal(error.code, "invalid_client_configuration");
        assert.equal(
          error.message,
          "Turnkeeper client configuration failed local validation.",
        );
        assert.deepEqual(error.issues, [issue]);
        assert.equal(JSON.stringify(error).includes(rejectedValue), false);
        return true;
      },
    );
  }
});

test("refuses redirects without retrying or forwarding credentials", async () => {
  const batch = replayBatch();
  let redirectMode: RequestRedirect | undefined;
  const client = new TurnkeeperClient({
    apiKey: API_KEY,
    baseUrl: "https://example.invalid",
    fetch: async (_input, init) => {
      redirectMode = init?.redirect;
      return new Response(null, { status: 302, headers: { Location: "https://other.invalid" } });
    },
  });
  await assert.rejects(
    () => client.replay.ingestBatch(batch, { now: NOW }),
    (error: unknown) => {
      assert.ok(error instanceof TurnkeeperProtocolError);
      assert.equal(error.code, "redirect_not_allowed");
      assert.equal(classifyRetry(error).retry, false);
      return true;
    },
  );
  assert.equal(redirectMode, "manual");
});

test("bounds chunked response bodies before buffering the full payload", async () => {
  const chunk = new Uint8Array(1024 * 1024);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let index = 0; index < 5; index += 1) controller.enqueue(chunk);
      controller.close();
    },
  });
  const client = new TurnkeeperClient({
    apiKey: API_KEY,
    baseUrl: "https://example.invalid",
    fetch: async () => new Response(body, { status: 200, headers: { "Content-Type": "application/json" } }),
  });
  await assert.rejects(
    () => client.replay.ingestBatch(replayBatch(), { now: NOW }),
    (error: unknown) => {
      assert.ok(error instanceof TurnkeeperProtocolError);
      assert.equal(error.code, "response_too_large");
      return true;
    },
  );
});
