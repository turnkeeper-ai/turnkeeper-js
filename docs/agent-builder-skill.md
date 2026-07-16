# Turnkeeper agent-builder skill

The `turnkeeper-agent-builder` skill gives coding agents a repeatable procedure for integrating the
public Turnkeeper packages into a tool-calling agent.

Canonical source:

```text
skills/turnkeeper-agent-builder/
├── SKILL.md
├── agents/openai.yaml
└── references/
```

## Use the skill

Load the skill directory in a compatible coding-agent environment, then invoke it explicitly when
the task involves risky AI-agent actions.

Example prompts:

- `Use $turnkeeper-agent-builder to add approval-gated refunds to this support agent.`
- `Use $turnkeeper-agent-builder to inspect this booking agent for policy bypasses.`
- `Use $turnkeeper-agent-builder to add stable idempotency to account cancellation.`
- `Use $turnkeeper-agent-builder to generate policy tests for these mutating tools.`

## Package roles

- `@turnkeeper/sdk` belongs in authenticated server-side runtime code.
- `@turnkeeper/cli` provides deterministic scaffolding and validation commands.
- `@turnkeeper/mcp` provides development-time tools to coding agents.

The skill must keep these roles separate. MCP and CLI output may guide implementation but cannot
authorize or execute a real action.

## Expected result

A completed integration should:

1. inventory every external side effect;
2. parse each model tool call as a proposal;
3. authorize the actor and validate exact parameters on the server;
4. persist an immutable proposal;
5. derive a stable action binding with a server-side secret and derive its idempotency key;
6. request a decision before execution;
7. stop on `block` and pause durably on `review`;
8. execute only the exact approved proposal;
9. retain the downstream result;
10. enqueue metadata-only Replay evidence from durable background work.

## Progressive references

The skill keeps detailed guidance under `references/`:

- `public-packages.md` describes SDK, CLI, and MCP responsibilities.
- `runtime-architecture.md` defines the required execution sequence.
- `framework-patterns.md` covers common TypeScript and provider placements.
- `security-checklist.md` defines handoff checks.

Load only the reference needed for the current task, and always load the security checklist before
handoff.

## Limitations

The public packages are prerelease at `0.1.0-alpha.1`. The skill does not claim:

- automatic execution or workflow resumption;
- prompt-based authorization;
- a shipped Python SDK;
- provider orchestration;
- permission to send customer content or exact tool arguments to Turnkeeper.

See [Turnkeeper MCP](mcp.md) and [Repository boundary](repository-boundary.md).
