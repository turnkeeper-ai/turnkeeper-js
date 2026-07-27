# Turnkeeper SDK

Public developer tooling for building governed AI-agent workflows with Turnkeeper.

```text
packages/sdk      Replay and bounded Control clients
packages/cli      Scaffolding, policy validation, tests, and integration inspection
packages/mcp      Development-time MCP tools
skills/           Turnkeeper agent-builder skill
examples/         Synthetic, runnable agent integrations
docs/             Public integration and package documentation
```

The repository contains client libraries and developer tooling only. Hosted dashboards,
organization management, approvals, audit storage, billing, and production API implementations
remain in the private hosted-platform repository.

## Development

Use Node.js 22.20 or Node.js 24.

```bash
npm ci
npm run check
```

The packages are pre-release software. Pin exact versions and review the documented safety
boundaries before using them in a production workflow.

## Install the current alpha

npm's unversioned `latest` channel still resolves to `0.1.0-alpha.2`. Use the exact current alpha
for reproducible installs; the moving `next` channel is available for deliberate prerelease
tracking.

```bash
npm install @turnkeeper/sdk@0.1.0-alpha.7
npm install --save-dev @turnkeeper/cli@0.1.0-alpha.7
TURNKEEPER_WORKSPACE_ROOT="$PWD" npx -y @turnkeeper/mcp@0.1.0-alpha.7
```

Equivalent moving-channel package specs are `@turnkeeper/sdk@next`, `@turnkeeper/cli@next`, and
`@turnkeeper/mcp@next`. Do not use an unversioned install until the project explicitly promotes a
release to `latest`.

## Packages

- [`@turnkeeper/sdk`](packages/sdk/README.md)
- [`@turnkeeper/cli`](packages/cli/README.md)
- [`@turnkeeper/mcp`](packages/mcp/README.md)

See [bounded Control checks](docs/control.md), [MCP setup](docs/mcp.md), and the
[agent-builder skill](docs/agent-builder-skill.md). Maintainers should use the
[public package release process](docs/releasing.md).

## Examples

- [`examples/customer-support-agent`](examples/customer-support-agent)
- [`examples/booking-agent`](examples/booking-agent)
- [`examples/account-management-agent`](examples/account-management-agent)
- [`examples/financial-services-refund`](examples/financial-services-refund) —
  bounded `support.refund` Control contract with local fail-closed simulation
- [`examples/support-escalation`](examples/support-escalation) —
  bounded `support.escalation` Control contract with local fail-closed simulation
- [`examples/account-contact-change`](examples/account-contact-change) —
  bounded `account.contact_information.change` Control contract with local fail-closed simulation
- [`examples/self-hosted-safeguard`](examples/self-hosted-safeguard) —
  provider-neutral Safeguard classification to `model.output.safety` Control and Replay lifecycle

## Community

Start with the [public roadmap](ROADMAP.md) and choose an issue whose acceptance criteria are
complete. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request, and use the issue
forms for bugs, documentation improvements, and feature proposals.

- [Contribution workflow](CONTRIBUTING.md)
- [Contributor architecture map](docs/contributor-architecture.md)
- [Public roadmap](ROADMAP.md)
- [Support](SUPPORT.md)
- [Governance](GOVERNANCE.md)
- [Code of conduct](CODE_OF_CONDUCT.md)

## Security

Keep Turnkeeper credentials server-side. Replay accepts metadata only, and a model-generated tool
call is a proposal—not authorization to execute a real-world action. See [SECURITY.md](SECURITY.md).
