# Public roadmap

This roadmap covers the public Turnkeeper SDK, CLI, MCP server, agent-builder skill, synthetic
examples, specifications, and documentation. It is directional, not a release-date commitment.
Actionable work is tracked in GitHub issues and milestones.

## Implemented

- TypeScript SDK clients for metadata-only Replay and bounded Control checks
- CLI scaffolding, policy validation, test generation, and integration inspection
- Development-time MCP tools
- Turnkeeper agent-builder skill
- Synthetic governed-agent examples and durable outbox guidance, including bounded Control contract
  examples for [`support.refund`](examples/financial-services-refund),
  [`support.escalation`](examples/support-escalation), and
  [`account.contact_information.change`](examples/account-contact-change)
- Alpha package release and verification automation

## Now: v0.1 stabilization

- Tighten documentation around errors, retries, compatibility, and supported boundaries.
- Improve diagnostics without exposing secrets or customer data.
- Add focused framework examples that keep credentials server-side.
- Expand cross-platform and package smoke coverage.
- Resolve defects found by alpha adopters without widening public contracts casually.

## Next: v0.2 developer experience

- Improve CLI and MCP setup feedback based on documented contributor and adopter friction.
- Add safe integration patterns where the current SDK contract already supports them.
- Reduce time from installation to a validated metadata-only Replay or bounded Control integration.
- Improve contributor tooling and documentation quality checks.

## Later

Additional language SDKs and broader tooling are considered only after the public contracts are
stable and sustained user evidence justifies their maintenance cost. Later items are not ready for
implementation unless a maintainer opens or accepts a scoped issue.

## Out of scope

This public roadmap does not include hosted dashboards, organization management, approval storage,
billing, production infrastructure, or private application implementation. It also does not promise
general routing, prompt management, memory, evaluation, handoff, workflow execution, approval
resumption, or orchestration APIs before matching public server behavior exists.

## Find work

- [Open milestones](https://github.com/turnkeeper-ai/turnkeeper-js/milestones)
- [`good first issue`](https://github.com/turnkeeper-ai/turnkeeper-js/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22good%20first%20issue%22)
- [`help wanted`](https://github.com/turnkeeper-ai/turnkeeper-js/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22help%20wanted%22)
- [All open issues](https://github.com/turnkeeper-ai/turnkeeper-js/issues)

See [GOVERNANCE.md](GOVERNANCE.md) before proposing a new public surface.
