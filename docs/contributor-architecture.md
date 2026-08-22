# Contributor architecture map

This repository owns Turnkeeper's public Ward contract SDK, claim-safe detector adapter, dated
public specifications, synthetic fixtures, and their documentation. It does not contain the hosted
application, production API implementation, customer operations, deployment configuration, or
private product strategy.

## Dependency direction

Public dependencies flow in one direction:

```text
dated schemas in spec/
        |
        v
packages/sdk
   |
   v
packages/adapter-sentinel

docs/ and synthetic fixtures describe these shipped public surfaces; they are not runtime dependencies.
```

The SDK owns public contract types and validators. The detector adapter maps customer-hosted,
bounded candidates into that privacy-minimized shape. Documentation and fixtures describe behavior
with synthetic data only.

## Where changes belong

| Surface | Primary source | Tests and synthetic fixtures | Package or boundary check |
| --- | --- | --- | --- |
| Ward SDK | `packages/sdk/src/` | `packages/sdk/test/` | `packages/sdk/scripts/check-package-contents.mjs` |
| Detector adapter | `packages/adapter-sentinel/src/` | `packages/adapter-sentinel/test/` | `packages/adapter-sentinel/scripts/check-package-contents.mjs` |
| Public contracts | `spec/` and SDK validators/types | SDK schema and contract tests | release artifact checks in `.github/workflows/release.yml` |
| Documentation | `README.md`, package READMEs, and `docs/` | executable examples where declared | root documentation and repository checks |

Test fixtures must be synthetic and remain next to the tests that consume them. Never add customer
content, credentials, production identifiers, private endpoints, or internal runbooks as fixtures.

## Contract ownership

Dated schemas in `spec/` describe public wire shapes. Matching SDK types and validators enforce those
shapes for callers. A wire-contract change must update the schema, SDK implementation, invalid and
valid cases, package documentation, changelog, and release artifacts together.

The hosted server implementation lives outside this repository. Public tooling may describe only
server behavior supported by an implemented public endpoint. A merged client change is not a
published capability until its versioned packages and release artifacts are available.

## Synchronization checklist

- SDK behavior: update SDK source, tests, package README, public docs, and changelog.
- Wire shape: also update the dated schema, schema tests, release artifacts, and API-version notes.
- Detector adapter mapping: update adapter source, tests, package README, and its source-detector
  boundary claim.
- Synchronized prerelease: update the retained workspace packages, shared contract version,
  documentation, release metadata, and lockfile.
- Privacy or safety boundary: update `docs/privacy.md`, the nearest validator, negative tests, and
  package-content checks.

Run `npm run check` after any cross-surface change. The public-surface validator intentionally
fails when package versions, public contracts, or repository boundaries drift.

## Status and boundaries

- **Implemented** public behavior is evidenced by source and passing tests in this repository.
- **Gated** behavior may exist in source but is not shipped until its release and hosted dependency
  are available.
- **Roadmap** ideas are not supported APIs and are not ready for implementation without an accepted
  issue.

Start with [CONTRIBUTING.md](../CONTRIBUTING.md), [GOVERNANCE.md](../GOVERNANCE.md), and the
[public roadmap](../ROADMAP.md). The durable boundaries are documented in
[repository boundaries](repository-boundary.md), [privacy](privacy.md), and
[versioning](versioning.md).
