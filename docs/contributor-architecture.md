# Contributor architecture map

This repository owns Turnkeeper's public TypeScript SDK, CLI, MCP server, agent-builder skill,
synthetic examples, dated public specifications, and their documentation. It does not contain the
hosted application, production API implementation, customer operations, deployment configuration,
or private product strategy.

## Dependency direction

Public dependencies flow in one direction:

```text
dated schemas in spec/
        |
        v
packages/sdk
   |         \
   v          v
packages/cli  synthetic examples
   |
   v
packages/mcp

skills/ and docs/ describe these shipped public surfaces; they are not runtime dependencies.
```

The SDK owns transport, validation, and public client types. The CLI consumes the exact SDK release
when it scaffolds integrations. The MCP package consumes the CLI and SDK to expose bounded,
development-time tools. Examples depend on the SDK and use synthetic data only.

## Where changes belong

| Surface | Primary source | Tests and synthetic fixtures | Package or boundary check |
| --- | --- | --- | --- |
| SDK | `packages/sdk/src/` | `packages/sdk/test/` | `packages/sdk/scripts/check-package-contents.mjs` |
| CLI | `packages/cli/src/` | `packages/cli/test/` | `packages/cli/scripts/check-package-contents.mjs` |
| MCP | `packages/mcp/src/` | `packages/mcp/test/` | `packages/mcp/scripts/check-package-contents.mjs` |
| Agent-builder skill | `skills/turnkeeper-agent-builder/` | examples and reference snippets under the skill | `scripts/validate-skill.mjs` |
| Examples | `examples/*/src/` | `examples/*/test/` | root workspace tests and package smoke checks |
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
- CLI scaffold or generated command: update CLI source, scaffold tests, exact SDK version, and
  affected examples.
- MCP setup or tool behavior: update MCP source, tests, package README, `docs/mcp.md`, and skill
  references when they expose the same workflow.
- Synchronized prerelease: update every workspace package, exact internal dependency, generated
  scaffold version, user-agent/version constant, skill command, example, and lockfile.
- Privacy or safety boundary: update `docs/privacy.md`, the nearest validator, negative tests, and
  package-content checks.

Run `npm run check` after any cross-surface change. The release validator intentionally fails when
package versions, public contracts, skills, or repository boundaries drift.

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
