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
[agent-builder skill](docs/agent-builder-skill.md).

## Security

Keep Turnkeeper credentials server-side. Replay accepts metadata only, and a model-generated tool
call is a proposal—not authorization to execute a real-world action. See [SECURITY.md](SECURITY.md).
