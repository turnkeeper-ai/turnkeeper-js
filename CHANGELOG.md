# Changelog

## Unreleased

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
