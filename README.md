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

## Packages

- [`@turnkeeper/sdk`](packages/sdk/README.md)
- [`@turnkeeper/cli`](packages/cli/README.md)
- [`@turnkeeper/mcp`](packages/mcp/README.md)

See [bounded Control checks](docs/control.md), [MCP setup](docs/mcp.md), and the
[agent-builder skill](docs/agent-builder-skill.md). Maintainers should use the
[public package release process](docs/releasing.md).

## Community

Start with the [public roadmap](ROADMAP.md) and choose an issue whose acceptance criteria are
complete. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request, and use the issue
forms for bugs, documentation improvements, and feature proposals.

- [Contribution workflow](CONTRIBUTING.md)
- [Public roadmap](ROADMAP.md)
- [Support](SUPPORT.md)
- [Governance](GOVERNANCE.md)
- [Code of conduct](CODE_OF_CONDUCT.md)

## Security

Keep Turnkeeper credentials server-side. Replay accepts metadata only, and a model-generated tool
call is a proposal—not authorization to execute a real-world action. See [SECURITY.md](SECURITY.md).
