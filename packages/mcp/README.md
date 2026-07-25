# Turnkeeper MCP server

`@turnkeeper/mcp` is a local stdio Model Context Protocol server for deterministic Turnkeeper
development tools. It generates and validates bounded policies, returns starter integration
guidance, creates scaffold plans, generates tests, simulates development-time decisions, and
heuristically inspects source code.

During Turnkeeper's alpha, the server exact-pins the official split MCP v2 beta packages. The
stdio boundary accepts a v1-compatible 2025 client handshake, while tool-schema metadata may
continue to evolve before the MCP v2 packages become stable.

It never executes refunds, bookings, account changes, provider tools, or any other real-world
action. Simulation is not production authorization.

## Run

Run the exact current alpha from npm. The unversioned `latest` channel still resolves to
`0.1.0-alpha.2`; use `@turnkeeper/mcp@next` only to follow the moving prerelease channel.

```sh
export TURNKEEPER_WORKSPACE_ROOT=/absolute/path/to/your/project
npx -y @turnkeeper/mcp@0.1.0-alpha.6
```

When working from this monorepo, build first and then start the local package binary with an
explicit workspace boundary:

```sh
export TURNKEEPER_WORKSPACE_ROOT=/absolute/path/to/your/project
turnkeeper-mcp
```

Portable stdio process settings (**unverified in external clients**):

```json
{
  "command": "turnkeeper-mcp",
  "env": {
    "TURNKEEPER_WORKSPACE_ROOT": "/absolute/path/to/your/project"
  }
}
```

Adapt these process settings to the outer schema and configuration location documented by the
specific MCP host. The repository does not claim that this fragment is a complete client
configuration.

The server refuses to start without `TURNKEEPER_WORKSPACE_ROOT`. Inspection accepts only relative
paths whose real paths remain beneath that root. Symlinks are not followed, and traversal is
bounded by directory, entry, file, depth, and byte limits.

## Tools

- `get_turnkeeper_quickstart`
- `get_sdk_examples`
- `scaffold_turnkeeper_agent`
- `generate_policy`
- `validate_policy`
- `simulate_action`
- `generate_policy_tests`
- `inspect_integration`
- `get_migration_help`

All tools have strict top-level schemas and bounded JSON input and output. Errors return stable
codes without source content, credentials, absolute paths, or raw exception messages.

Local simulation uses a fixed, public development-only binding value so it never accepts, reads, or
echoes a production binding secret. Its action binding cannot authorize a runtime Control check.

`inspect_integration` is a heuristic development aid, not a security proof. Review every generated
integration and ensure all side effects remain behind one authenticated, server-side executor.

For the current client verification matrix, shared stdio requirements, read-only tool-discovery
check, and troubleshooting steps, see the canonical [Turnkeeper MCP
documentation](https://github.com/turnkeeper-ai/turnkeeper-js/blob/main/docs/mcp.md).
