# Releasing the public packages

Turnkeeper publishes `@turnkeeper/sdk`, `@turnkeeper/cli`, `@turnkeeper/mcp`, and
`@turnkeeper/adapter-sentinel` as one fixed prerelease group while their contracts are in alpha.
Releases run only from annotated tags whose commits are already reachable from `origin/main`.

## Release contract

1. Update the root and all four package versions together.
2. Pin the CLI dependency on the SDK, and both MCP dependencies, to that exact version.
   `@turnkeeper/adapter-sentinel` stays zero-dependency.
3. Update the changelog, examples, docs, MCP metadata, scaffolds, and agent-builder skill.
4. Run `npm run check` with Node 22 and Node 24.
5. Merge the release commit through protected `main`.
6. Create and push the matching annotated `v<version>` tag from that merged commit.

The tag starts `.github/workflows/release.yml`. The workflow:

- verifies that the tag is annotated, matches every package manifest, and points to a commit on
  `origin/main`;
- verifies the exact SDK, CLI, and MCP dependency graph before running the complete repository
  check with Node 24.18.0 and npm 11.6.2;
- creates the package tarballs once, then collects the versioned public JSON Schemas and generates
  CycloneDX SBOMs and SHA-256 checksums;
- publishes those exact tarballs in SDK, CLI, MCP, then adapter-sentinel order through npm trusted
  publishing;
- safely resumes after a partial publish only when the registry artifact has the same SHA-512
  integrity as the local tarball;
- allows up to 15 minutes for each registry write to become readable;
- installs all four exact versions into a clean temporary project and verifies SDK import,
  adapter-sentinel import, CLI execution, MCP stdio startup, npm signatures, SLSA provenance, and
  the `next` dist-tag;
- attaches the identical tarballs, versioned schemas, SBOMs, and checksums to a GitHub prerelease.
- creates or refreshes one unpublished changelog draft through the hosted platform only after all
  package, provenance, consumer, and GitHub prerelease checks succeed.

Prereleases are published under the npm `next` tag. Moving a version to `latest` is a separate,
reviewed decision after compatibility and installation evidence is complete.

## One-time repository configuration

Create a GitHub environment named `npm-release`. If it has required reviewers or deployment tag
rules, ensure a maintainer can approve release deployments for `v*` tags.

For each npm package, configure a GitHub Actions trusted publisher with these exact claims:

| Setting | Value |
| --- | --- |
| Organization or user | `turnkeeper-ai` |
| Repository | `turnkeeper-js` |
| Workflow filename | `release.yml` |
| Environment | `npm-release` |

Configure trusted publishing for all four packages:

- `@turnkeeper/sdk`
- `@turnkeeper/cli`
- `@turnkeeper/mcp`
- `@turnkeeper/adapter-sentinel`

### Adding a new package to the release group (bootstrap)

npm trusted publishing can only be configured **after** the package name exists on the
registry. OIDC cannot publish the very first version of a never-before-published name
([npm/cli#8544](https://github.com/npm/cli/issues/8544)).

One-time bootstrap for a new public package (example: `@turnkeeper/adapter-sentinel`):

1. Authenticate as an `@turnkeeper` maintainer: `npm login` (interactive; do not paste tokens
   into chat or commit them).
2. Reserve the name with a disposable stub (preferred) **or** a one-off token publish of the
   real first version:

```sh
# From packages/adapter-sentinel after build — stub reserve (then configure trust):
npm publish --access public --tag bootstrap --dry-run   # review first
# Real first publish uses a temporary granular publish token or interactive login.
# Prefer publishing 0.0.0 as a stub, then bump to the synchronized alpha on the next release.
```

3. Configure the trusted publisher to match the release workflow exactly:

```sh
npm trust github @turnkeeper/adapter-sentinel \
  --file release.yml \
  --repository turnkeeper-ai/turnkeeper-js \
  --environment npm-release \
  --allow-publish \
  --yes
```

Equivalent UI path: `https://www.npmjs.com/package/@turnkeeper/adapter-sentinel/access` →
Trusted Publisher → GitHub Actions → org `turnkeeper-ai`, repo `turnkeeper-js`, workflow
`release.yml`, environment `npm-release`, allow `npm publish`.

4. Verify:

```sh
npm trust list @turnkeeper/adapter-sentinel
```

5. Confirm the npm org has a **trusted publisher** entry for the package before cutting the next
   annotated `v*` tag. Do not add `NPM_TOKEN` / `NODE_AUTH_TOKEN` to the release workflow.

The release job intentionally has `id-token: write` and does not use an npm token. Do not add
`NPM_TOKEN` or `NODE_AUTH_TOKEN` secrets to this workflow.

The same short-lived GitHub Actions OIDC identity authenticates changelog draft creation. The
hosted endpoint accepts only the `turnkeeper-ai/turnkeeper-js` release workflow, validates the
exact tag and canonical GitHub release URL, and always writes `status: draft`. There is no
changelog automation secret and the workflow cannot publish a note.

Also configure the repository to:

- protect `v*` tags from deletion or replacement;
- enable immutable GitHub Releases;
- require the Node 22, Node 24, and CodeQL checks before merging a release commit;
- keep GitHub Actions pinned to reviewed commit SHAs.

## Cut a prerelease

Start from the protected default branch after the release PR has merged:

```sh
git fetch origin main --tags
git switch main
git pull --ff-only origin main
git status --short

version="$(node -p "require('./package.json').version")"
git tag -a "v${version}" -m "v${version}"
git push origin "v${version}"
```

The workflow rejects lightweight tags, mismatched versions, and release commits that are not on
`origin/main`. Approve the `npm-release` environment deployment if GitHub requests it, then monitor
the `Release public packages` workflow through completion.

## Verify the published release

After the workflow succeeds, verify the registry and release from a clean machine or temporary
directory:

```sh
version="0.1.0-alpha.7"

npm view "@turnkeeper/sdk@${version}" version dist.integrity \
  dist.attestations.provenance.predicateType
npm view "@turnkeeper/cli@${version}" version dist.integrity \
  dist.attestations.provenance.predicateType
npm view "@turnkeeper/mcp@${version}" version dist.integrity \
  dist.attestations.provenance.predicateType
npm view "@turnkeeper/adapter-sentinel@${version}" version dist.integrity \
  dist.attestations.provenance.predicateType

consumer="$(mktemp -d)"
cd "${consumer}"
npm init --yes
npm install --ignore-scripts \
  "@turnkeeper/sdk@${version}" \
  "@turnkeeper/cli@${version}" \
  "@turnkeeper/mcp@${version}"
node --input-type=module -e 'await import("@turnkeeper/sdk")'
./node_modules/.bin/turnkeeper --help
npm audit signatures
```

The GitHub release must be marked as a prerelease and contain the three `.tgz` files, three SBOMs,
the three versioned JSON Schemas, and `SHA256SUMS`. Each package's `next` dist-tag must equal the
released version. The workflow must also report that it created or updated the matching hosted
changelog draft. An authenticated Turnkeeper operator reviews and publishes that draft separately.

## Recovery and prohibited paths

If publishing stops after one dependency is written, rerun the same GitHub Actions job. The
workflow will continue only when an existing package version's registry integrity exactly matches
the tarball built from the tagged commit. A mismatched artifact or a missing provenance
attestation is a hard failure; package versions are immutable, so fix forward with a new version.

If registry publication succeeds but a later verification or GitHub-release step fails, merge the
verifier-only correction, then manually run `Release public packages` from `main` with the existing
annotated tag in `release_tag`. The recovery run checks out that tag, rebuilds its artifacts, and
uses the same integrity and provenance gates before creating or verifying the prerelease. Never
move a tag after any package for that version has reached the registry. Manual recovery runs fail
instead of publishing if any package in the release is missing.

The changelog draft uses the release tag as its deterministic source identity. Rerunning the same
verified release updates the same draft instead of creating a duplicate. If the hosted changelog
endpoint is temporarily unavailable, fix the endpoint or workflow and rerun recovery with the
same tag; do not create a second note or weaken the release checks. A draft that has already been
published is immutable to this automation and causes a hard failure that requires operator review.

Do not manually upload a tarball built from an uncommitted worktree, publish only one dependent
package, reuse a published version, move `latest` as part of an alpha release, replace a release
tag, or document npm installation before the registry release is verified.
