import path from "node:path";
import { fileURLToPath } from "node:url";

const CHANGELOG_AUDIENCE = "turnkeeper-changelog";
const CHANGELOG_ENDPOINT = "https://turnkeeper.ai/api/internal/changelog/drafts";
const RELEASE_TAG = /^v\d+\.\d+\.\d+-[0-9A-Za-z.-]+$/u;

function required(env, key, maxLength = 24_000) {
  const value = typeof env[key] === "string" ? env[key].trim() : "";
  if (!value || value.length > maxLength) throw new Error(`Missing or invalid ${key}.`);
  return value;
}

export function releaseChangelogDraft(tag) {
  if (!RELEASE_TAG.test(tag)) throw new Error("Release tag is not a supported prerelease tag.");
  const version = tag.slice(1);
  return {
    content: [
      `Published @turnkeeper/sdk, @turnkeeper/cli, and @turnkeeper/mcp at ${version} on the npm next channel.`,
      "The release includes npm provenance, verified package signatures, checksums, SBOMs, and clean consumer-install checks.",
      `Install the exact SDK prerelease with npm install @turnkeeper/sdk@${version}.`,
    ].join("\n\n"),
    source: "public-packages",
    sourceId: tag,
    sourceRef: tag,
    sourceUrl: `https://github.com/turnkeeper-ai/turnkeeper-js/releases/tag/${tag}`,
    summary: `SDK, CLI, and MCP ${version} are available on the npm next channel with provenance.`,
    title: `Turnkeeper developer packages ${version}`,
  };
}

async function requestGitHubOidcToken({ env, fetchImpl }) {
  const requestUrl = new URL(required(env, "ACTIONS_ID_TOKEN_REQUEST_URL", 4_096));
  if (
    requestUrl.protocol !== "https:" ||
    requestUrl.hostname !== "pipelines.actions.githubusercontent.com"
  ) {
    throw new Error("GitHub OIDC request URL is not trusted.");
  }
  requestUrl.searchParams.set("audience", CHANGELOG_AUDIENCE);
  const response = await fetchImpl(requestUrl, {
    headers: {
      Authorization: `Bearer ${required(env, "ACTIONS_ID_TOKEN_REQUEST_TOKEN", 12_000)}`,
    },
  });
  if (!response.ok) throw new Error(`GitHub OIDC request failed with status ${response.status}.`);
  const body = await response.json();
  const token = typeof body?.value === "string" ? body.value : "";
  if (!token || token.length > 12_000) throw new Error("GitHub OIDC response was invalid.");
  return token;
}

export async function syncReleaseChangelogDraft({ env = process.env, fetchImpl = fetch } = {}) {
  if (env.GITHUB_REPOSITORY !== "turnkeeper-ai/turnkeeper-js") {
    throw new Error("Changelog sync may run only in turnkeeper-ai/turnkeeper-js.");
  }
  const draft = releaseChangelogDraft(required(env, "RELEASE_TAG", 120));
  const token = await requestGitHubOidcToken({ env, fetchImpl });
  const response = await fetchImpl(CHANGELOG_ENDPOINT, {
    body: JSON.stringify(draft),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    method: "POST",
    redirect: "error",
  });
  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const code = typeof body?.error?.code === "string" ? body.error.code : "unknown_error";
    throw new Error(`Changelog draft request failed with status ${response.status} and code ${code}.`);
  }
  if (
    (body?.action !== "created" && body?.action !== "updated") ||
    body?.status !== "draft" ||
    typeof body?.slug !== "string"
  ) {
    throw new Error("Changelog draft response was invalid.");
  }
  return { action: body.action, slug: body.slug, status: body.status };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = await syncReleaseChangelogDraft();
  process.stdout.write(`Changelog draft ${result.action}: ${result.slug}.\n`);
}
