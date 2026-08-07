# Changelog

## Unreleased

- Add `@turnkeeper/adapter-sentinel`, a claim-safe zero-dependency mapper from
  Sentinel-like window candidates to Turnkeeper `DetectorCandidate` metadata (not a Roblox
  partnership or endorsement).

## 0.1.0-alpha.7 - 2026-07-27

- Add dated Replay contract `2026-07-27` with `self_hosted` provider metadata while preserving the
  immutable `2026-07-09` schema for historical compatibility.
- Add `@turnkeeper/example-self-hosted-safeguard`, a provider-neutral Safeguard-to-Control and
  Replay lifecycle walkthrough.
- Bump synchronized workspace packages to `0.1.0-alpha.7`.

## 0.1.0-alpha.6 - 2026-07-25

- Replace the host-specific MCP configuration example with a portable stdio process fragment,
  add an honest client-verification matrix, and document safe tool discovery and troubleshooting.
- Make exact alpha installation commands explicit across the SDK, CLI, MCP, and repository docs,
  distinguish npm's `latest` and `next` channels, and validate release-version alignment.

## 0.1.0-alpha.5 - 2026-07-25

- Replace the monolithic MCP SDK with exact-pinned split v2 beta server and test-client packages,
  removing known dependency advisories while preserving the local stdio-only boundary and stable
  v1-compatible 2025 client handshake.
- Gate pull requests and pushes on a production-dependency audit that fails for high or critical
  advisories.
- Run the complete repository gate on Windows and exercise linked-directory boundary tests with
  junctions that do not require elevated symbolic-link privileges.
- Report client-configuration and policy-generation failures with sanitized field-level issues
  while preserving existing Replay validation behavior.
- Pin the CLI installation example to the current prerelease so new contributors do not
  accidentally install an older npm prerelease tag.

## 0.1.0-alpha.4 - 2026-07-18

- Add project-scoped `ControlClient.getReview` retrieval for durable customer-owned review polling.
- Publish the dated Control review-response schema and include it in immutable release artifacts.

## 0.1.0-alpha.3 - 2026-07-17

- Add dated machine-verifiable Control request/response schemas and enforce parity with the SDK
  and hosted fail-closed no-policy response.
- Add npm trusted-publishing release automation with provenance, dependency-ordered clean-consumer
  checks, SBOMs, checksums, and immutable GitHub release artifacts.
- Add JSON Schema parity tests for Replay privacy validation and reject credential-, URL-, PII-,
  and content-shaped values consistently.
- Add publishable CLI and MCP packages, the agent-builder skill, and three synthetic examples.
- Require action-bound Control requests and enforce the public response-version bounds at runtime.

## 0.1.0-alpha.2 - 2026-07-16

- Reject Anthropic- and OpenAI-shaped credential values in every Replay free-code field.

## 0.1.0-alpha.1 - 2026-07-16

- Convert the repository into the public Turnkeeper SDK monorepo.
- Add Apache-2.0 licensing and publishable `0.1.0-alpha.1` package metadata.
- Add strict Replay validation, server compatibility exports, safe transport errors, and retry
  classification.
- Add fail-closed Control policy generation, local execution guards, keyed action bindings, and
  correlated hosted checks.
