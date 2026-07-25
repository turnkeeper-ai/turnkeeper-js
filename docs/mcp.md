# Turnkeeper MCP

`@turnkeeper/mcp` is a local stdio Model Context Protocol server for coding agents and developer
tools. It exposes deterministic Turnkeeper integration guidance without executing production
actions.

The package is prerelease at `0.1.0-alpha.5`.

## Start the server

After the alpha package is published:

```sh
TURNKEEPER_WORKSPACE_ROOT="$PWD" npx @turnkeeper/mcp@0.1.0-alpha.5
```

Portable stdio process settings (**unverified in external clients**):

```json
{
  "command": "npx",
  "args": ["-y", "@turnkeeper/mcp@0.1.0-alpha.5"],
  "env": {
    "TURNKEEPER_WORKSPACE_ROOT": "/absolute/path/to/your/project"
  }
}
```

Adapt these process settings to the outer schema and configuration location documented by the
specific MCP host. The repository does not claim that this fragment is a complete client
configuration.

## Client setup matrix

The repository currently verifies the protocol surface with the official TypeScript MCP client
and an in-memory transport. No external desktop or editor client is maintainer-verified yet, so the
table deliberately avoids claiming support or publishing client-specific JSON.

| Client or harness | Status | Setup note |
|---|---|---|
| Repository MCP SDK harness | Verified in `npm run check` | Connects to `createMcpServer` and lists tools without running a business action. |
| Claude Desktop | Unverified | Adapt the host-neutral stdio shape to the client's documented config location. |
| Cursor | Unverified | Adapt the host-neutral stdio shape; confirm its project versus user precedence first. |
| VS Code MCP hosts | Unverified | Confirm the extension's stdio and environment schema before adding the server. |
| Other stdio MCP hosts | Unverified | Require support for a command, arguments, and an environment map. |

All stdio hosts have the same runtime requirements:

- Run the published package with `npx -y @turnkeeper/mcp@0.1.0-alpha.5`, or build this monorepo and
  run `turnkeeper-mcp` from the package binary.
- Set `TURNKEEPER_WORKSPACE_ROOT` to an absolute, trusted project directory. Relative inspection
  paths are resolved beneath that boundary; the process does not require a particular current
  working directory when the environment variable is absolute.
- Keep stdout exclusively for MCP protocol messages. Send wrapper diagnostics to stderr.
- Run against trusted development source, use synthetic example values, and do not add credentials
  to the MCP environment.

## Confirm tool discovery

Use the client's tool-list or server-inspector view and confirm that `get_turnkeeper_quickstart`
appears. Listing tools is read-only and does not execute a business action. In this repository,
`npm test --workspace @turnkeeper/mcp` performs the equivalent assertion with the official MCP SDK
client.

## Troubleshooting

| Symptom | Check |
|---|---|
| `command not found` | Use an absolute local binary path, or ensure `npx` is on the GUI client's inherited `PATH`. |
| Missing `dist/bin.js` | Run `npm run build` before using the monorepo binary; published packages include `dist`. |
| Workspace-root startup failure | Set `TURNKEEPER_WORKSPACE_ROOT` to an existing absolute directory accessible to the client process. |
| JSON configuration rejected | Validate strict JSON: no comments or trailing commas, and use the client's exact command/args/env field names. |
| Protocol parse errors or disconnects | Remove shell banners and debug prints from stdout; MCP stdio reserves stdout for protocol frames. |
| Server starts but tools are absent | Fully restart the client, inspect its MCP logs, then use read-only tool discovery before calling a tool. |

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

See the package-level [MCP README](../packages/mcp/README.md), [Agent-builder
skill](agent-builder-skill.md), and [Repository boundary](repository-boundary.md).
