---
name: run-turnkeeper-js-dev
description: Install and verify the public Turnkeeper JS monorepo (SDK/CLI/MCP) in OpenCode Lab. Use when the user asks to run, build, test, check, install, or set up turnkeeper-js / the public SDK. There is no hosted dashboard preview—packages and examples only. Never use Codespaces, Gitpod, VS Code Ports, or SSH tunnels.
---

# Run turnkeeper-js locally (Lab mount)

This session is OpenCode Lab. The public SDK monorepo is at `/workspace`. This is
**not** the hosted platform and has **no** Mac `3100` site preview by default.

Also read `/workspace/README.md` and `/workspace/AGENTS.md` when present.

## What “run” means here

| Goal | Command |
|------|---------|
| Install | `npm ci` (preferred) or `npm install` |
| Full verify | `npm run check` |
| Build packages | `npm run build` |
| Tests | `npm test` |

Use Node 22.20+ or Node 24 per `package.json` engines.

## Required workflow

1. From `/workspace`:

```bash
npm ci
```

2. For “run / verify / make sure it works”:

```bash
npm run check
```

For a smaller loop after edits, prefer `npm run build` and targeted workspace
tests instead of inventing a web server.

3. Examples under `examples/` are synthetic integrations—follow each example’s
   README if the user asked to run a specific example. Still no Codespaces/ports.

4. Do not tell the user to open `http://127.0.0.1:3100` unless an example clearly
   starts an HTTP server bound to `0.0.0.0:3000` and Lab `local-preview` applies.
   If that happens, follow
   `/opencode-config/.opencode/skills/local-preview/SKILL.md`.

## Forbidden

Never mention Codespaces, Gitpod, VS Code Ports, SSH tunnels, or cloning the repo.
Never treat this mount as Turnkeeper Ward / platform dashboard.
Never publish npm packages or change release tags without explicit authority.
Never print secrets from env files.
