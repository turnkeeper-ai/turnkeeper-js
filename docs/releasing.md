# Releasing the public packages

Turnkeeper publishes `@turnkeeper/sdk`, `@turnkeeper/cli`, and `@turnkeeper/mcp` as one fixed
prerelease group while their contracts are in alpha. Releases run only from annotated tags whose
commits are already reachable from `origin/main`.

## Release contract

1. Update the root and all three package versions together.
2. Pin the CLI dependency on the SDK, and both MCP dependencies, to that exact version.
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
- publishes those exact tarballs in SDK, CLI, then MCP order through npm trusted publishing;
- safely resumes after a partial publish only when the registry artifact has the same SHA-512
  integrity as the local tarball;
- allows up to 15 minutes for each registry write to become readable;
- installs all three exact versions into a clean temporary project and verifies SDK import, CLI
  execution, MCP stdio startup, npm signatures, SLSA provenance, and the `next` dist-tag;
- attaches the identical tarballs, versioned schemas, SBOMs, and checksums to a GitHub prerelease.

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

Configure trusted publishing for all three packages:

- `@turnkeeper/sdk`
- `@turnkeeper/cli`
- `@turnkeeper/mcp`

The release job intentionally has `id-token: write` and does not use an npm token. Do not add
`NPM_TOKEN` or `NODE_AUTH_TOKEN` secrets to this workflow.

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
version="0.1.0-alpha.6"

npm view "@turnkeeper/sdk@${version}" version dist.integrity \
  dist.attestations.provenance.predicateType
npm view "@turnkeeper/cli@${version}" version dist.integrity \
  dist.attestations.provenance.predicateType
npm view "@turnkeeper/mcp@${version}" version dist.integrity \
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
released version.

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

Do not manually upload a tarball built from an uncommitted worktree, publish only one dependent
package, reuse a published version, move `latest` as part of an alpha release, replace a release
tag, or document npm installation before the registry release is verified.
