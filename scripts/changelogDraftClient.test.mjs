import assert from "node:assert/strict";
import test from "node:test";

import {
  releaseChangelogDraft,
  syncReleaseChangelogDraft,
} from "./changelogDraftClient.mjs";

test("release changelog copy is deterministic, bounded, and exact-versioned", () => {
  assert.deepEqual(releaseChangelogDraft("v0.1.0-alpha.6"), {
    content: [
      "Published @turnkeeper/sdk, @turnkeeper/cli, @turnkeeper/mcp, and @turnkeeper/adapter-sentinel at 0.1.0-alpha.6 on the npm next channel.",
      "The release includes npm provenance, verified package signatures, checksums, SBOMs, and clean consumer-install checks.",
      "Install the exact SDK prerelease with npm install @turnkeeper/sdk@0.1.0-alpha.6.",
    ].join("\n\n"),
    source: "public-packages",
    sourceId: "v0.1.0-alpha.6",
    sourceRef: "v0.1.0-alpha.6",
    sourceUrl: "https://github.com/turnkeeper-ai/turnkeeper-js/releases/tag/v0.1.0-alpha.6",
    summary:
      "SDK, CLI, and MCP 0.1.0-alpha.6 are available on the npm next channel with provenance.",
    title: "Turnkeeper developer packages 0.1.0-alpha.6",
  });
  assert.throws(() => releaseChangelogDraft("latest"), /supported prerelease/u);
});

test("release workflow exchanges GitHub OIDC and creates only a hosted draft", async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ init, url: String(url) });
    if (calls.length === 1) return Response.json({ value: "header.payload.signature" });
    return Response.json(
      { action: "created", slug: "public-packages-v0-1-0-alpha-6", status: "draft" },
      { status: 201 },
    );
  };
  const result = await syncReleaseChangelogDraft({
    env: {
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: "synthetic-request-token",
      ACTIONS_ID_TOKEN_REQUEST_URL:
        "https://pipelinesghubeus3.actions.githubusercontent.com/oidc?job=synthetic",
      GITHUB_REPOSITORY: "turnkeeper-ai/turnkeeper-js",
      RELEASE_TAG: "v0.1.0-alpha.6",
    },
    fetchImpl,
  });
  assert.deepEqual(result, {
    action: "created",
    slug: "public-packages-v0-1-0-alpha-6",
    status: "draft",
  });
  assert.match(calls[0].url, /audience=turnkeeper-changelog/u);
  assert.equal(calls[0].init.headers.Authorization, "Bearer synthetic-request-token");
  assert.equal(calls[1].url, "https://turnkeeper.ai/api/internal/changelog/drafts");
  assert.equal(calls[1].init.headers.Authorization, "Bearer header.payload.signature");
  const posted = JSON.parse(calls[1].init.body);
  assert.equal(posted.sourceRef, "v0.1.0-alpha.6");
  assert.equal(posted.status, undefined);
});

test("release workflow rejects untrusted OIDC and sanitized endpoint failures", async () => {
  await assert.rejects(
    syncReleaseChangelogDraft({
      env: {
        ACTIONS_ID_TOKEN_REQUEST_TOKEN: "synthetic-request-token",
        ACTIONS_ID_TOKEN_REQUEST_URL: "https://attacker.invalid/oidc",
        GITHUB_REPOSITORY: "turnkeeper-ai/turnkeeper-js",
        RELEASE_TAG: "v0.1.0-alpha.6",
      },
      fetchImpl: fetch,
    }),
    /not trusted/u,
  );
  await assert.rejects(
    syncReleaseChangelogDraft({
      env: {
        ACTIONS_ID_TOKEN_REQUEST_TOKEN: "synthetic-request-token",
        ACTIONS_ID_TOKEN_REQUEST_URL:
          "https://pipelines.actions.githubusercontent.com.attacker.invalid/oidc",
        GITHUB_REPOSITORY: "turnkeeper-ai/turnkeeper-js",
        RELEASE_TAG: "v0.1.0-alpha.6",
      },
      fetchImpl: fetch,
    }),
    /not trusted/u,
  );

  let call = 0;
  await assert.rejects(
    syncReleaseChangelogDraft({
      env: {
        ACTIONS_ID_TOKEN_REQUEST_TOKEN: "synthetic-request-token",
        ACTIONS_ID_TOKEN_REQUEST_URL: "https://pipelines.actions.githubusercontent.com/oidc",
        GITHUB_REPOSITORY: "turnkeeper-ai/turnkeeper-js",
        RELEASE_TAG: "v0.1.0-alpha.6",
      },
      fetchImpl: async () => {
        call += 1;
        return call === 1
          ? Response.json({ value: "header.payload.signature" })
          : Response.json(
              { error: { code: "invalid_automation_token" }, secret: "must-not-echo" },
              { status: 401 },
            );
      },
    }),
    (error) => {
      assert.match(error.message, /status 401 and code invalid_automation_token/u);
      assert.doesNotMatch(error.message, /must-not-echo|header\.payload/u);
      return true;
    },
  );
});
