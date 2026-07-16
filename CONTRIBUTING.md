# Contributing

This monorepo contains the public SDK, CLI, MCP server, agent-builder skill, and synthetic examples.
Changes must preserve the public/private repository boundary, Replay metadata allowlist,
fail-closed Control behavior, deterministic event identity, and secret-safe errors.

## Development

Use Node.js 22 or newer.

```bash
npm ci
npm run check
```

Every contract change needs:

- a dated API-version decision
- matching type, validator, fixture, and documentation updates
- tests for invalid input, malformed responses, retries, and secret-safe errors
- synchronized SDK, CLI, MCP, skill, example, and documentation changes where applicable
- a package-content review

Do not add routing, prompt, memory, evaluation, handoff, workflow execution, approval resumption, or
orchestration claims before matching public server endpoints exist. Never include customer content,
credentials, production identifiers, internal runbooks, deployment configuration, or private
strategy in issues, fixtures, errors, logs, or package files.
