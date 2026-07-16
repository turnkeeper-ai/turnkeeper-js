# Turnkeeper MCP

`@turnkeeper/mcp` is a local stdio Model Context Protocol server for coding agents and developer
tools. It exposes deterministic Turnkeeper integration guidance without executing production
actions.

The package is prerelease at `0.1.0-alpha.1`.

## Start the server

After the alpha package is published:

```sh
TURNKEEPER_WORKSPACE_ROOT="$PWD" npx @turnkeeper/mcp@0.1.0-alpha.1
```

Example MCP host configuration:

```json
{
  "mcpServers": {
    "turnkeeper": {
      "command": "npx",
      "args": ["-y", "@turnkeeper/mcp@0.1.0-alpha.1"],
      "env": {
        "TURNKEEPER_WORKSPACE_ROOT": "/absolute/path/to/your/project"
      }
    }
  }
}
```

Run MCP only in a trusted development environment. Do not pass production credentials, customer
content, transcripts, exact tool arguments, or secrets to the server. The server refuses to start
without `TURNKEEPER_WORKSPACE_ROOT`; inspection paths must resolve beneath that boundary.

## Tools

The MCP package provides these development-time tools:

- `get_turnkeeper_quickstart`
- `get_sdk_examples`
- `scaffold_turnkeeper_agent`
- `generate_policy`
- `validate_policy`
- `simulate_action`
- `generate_policy_tests`
- `inspect_integration`
- `get_migration_help`

Tool results are structured guidance and generated source. They are not hosted decisions and never
authorize refunds, bookings, cancellations, account changes, or other side effects.

## Relationship to the other packages

- Use `@turnkeeper/mcp` while planning, scaffolding, or reviewing an integration.
- Use `@turnkeeper/cli` for deterministic local commands and CI-friendly validation.
- Use `@turnkeeper/sdk` in server-side application runtime code.

Keep SDK, CLI, and MCP versions synchronized. A generated integration must be reviewed and tested
against the matching SDK version before use.

## Safety boundary

MCP may generate or inspect code, but it must not:

- receive or print a Turnkeeper API key;
- call a production side-effecting tool;
- treat local simulation as runtime approval;
- send exact action parameters to Turnkeeper;
- include private hosted-platform source, schemas, migrations, or deployment configuration;
- follow symlinks or scan secret and dependency directories during integration inspection.

## Recommended workflow

1. Ask MCP for the relevant quickstart.
2. Scaffold or inspect the agent.
3. Generate and validate one policy bundle per risky action.
4. Generate deterministic policy cases.
5. Review authorization, parameter binding, idempotency, and fail-closed behavior manually.
6. Run the repository tests and the example closest to the integration.
7. Use `ControlClient` only in authenticated server-side runtime code.

When working from this monorepo before publication, build the workspaces and run the local binary:

```sh
npm run build
TURNKEEPER_WORKSPACE_ROOT="$PWD" npm exec --workspace @turnkeeper/mcp -- turnkeeper-mcp
```

See [Agent-builder skill](agent-builder-skill.md) and
[Repository boundary](repository-boundary.md).
