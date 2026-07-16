# Turnkeeper MCP server

`@turnkeeper/mcp` is a local stdio Model Context Protocol server for deterministic Turnkeeper
development tools. It generates and validates bounded policies, returns starter integration
guidance, creates scaffold plans, generates tests, simulates development-time decisions, and
heuristically inspects source code.

It never executes refunds, bookings, account changes, provider tools, or any other real-world
action. Simulation is not production authorization.

## Run

Build the monorepo, then start the server with an explicit workspace boundary:

```sh
export TURNKEEPER_WORKSPACE_ROOT=/absolute/path/to/your/project
turnkeeper-mcp
```

Example MCP host configuration:

```json
{
  "mcpServers": {
    "turnkeeper": {
      "command": "turnkeeper-mcp",
      "env": {
        "TURNKEEPER_WORKSPACE_ROOT": "/absolute/path/to/your/project"
      }
    }
  }
}
```

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
