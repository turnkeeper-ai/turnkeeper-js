# Public roadmap

This roadmap covers the public Turnkeeper Ward contract SDK, claim-safe detector adapter, synthetic
fixtures, specifications, and documentation. It is directional, not a release-date commitment.
Actionable work is tracked in GitHub issues and milestones.

## Implemented

- Versioned Ward exchange envelopes, revocation, private-match contracts, and validators for
  synthetic privacy-minimized collaboration. See the
  [Safety Exchange Protocol v0.1 working draft](docs/safety-exchange-protocol-v0.1.md).
- Claim-safe mapping for customer-hosted Sentinel-like detector candidates.
- Alpha package release and verification automation for the SDK and detector adapter.
- Additive v0.1 working profiles for cryptography, private matching, delivery, governance, threat
  modeling, and conformance, plus a machine-readable schema suite and negative fixtures. These are
  implementation requirements, not evidence of a live exchange or operational certification.

## Now: v0.1 stabilization

- Tighten documentation around errors, retries, compatibility, and supported boundaries.
- Improve diagnostics without exposing secrets or customer data.
- Expand cross-platform and package smoke coverage.
- Resolve defects found by alpha adopters without widening public contracts casually.

## Later

Additional language SDKs, a Ward-specific CLI, and a Ward-specific MCP server are considered only
after the public contract is stable and sustained design-partner demand justifies their maintenance
cost. They are not current public tooling commitments.

Live multi-company case rooms, governed membership, provider feeds, and an industry conformance
program also remain later roadmap work. The public exchange contracts do not imply a live network,
an adopted standard, or an official partner relationship.

## Out of scope

This public roadmap does not include hosted dashboards, organization management, review storage,
authorization, billing, production infrastructure, or private application implementation. It also
does not promise raw-content transport, automatic enforcement, general routing, prompt management,
memory, evaluation, handoff, or workflow-execution APIs.

## Find work

- [Open milestones](https://github.com/turnkeeper-ai/turnkeeper-js/milestones)
- [`good first issue`](https://github.com/turnkeeper-ai/turnkeeper-js/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22good%20first%20issue%22)
- [`help wanted`](https://github.com/turnkeeper-ai/turnkeeper-js/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22help%20wanted%22)
- [All open issues](https://github.com/turnkeeper-ai/turnkeeper-js/issues)

See [GOVERNANCE.md](GOVERNANCE.md) before proposing a new public surface.
