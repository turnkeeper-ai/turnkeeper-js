# Contributing

This monorepo contains the public SDK, CLI, MCP server, agent-builder skill, and synthetic examples.
Changes must preserve the public/private repository boundary, Replay metadata allowlist,
fail-closed Control behavior, deterministic event identity, and secret-safe errors.

## Choose work

Start with the [public roadmap](ROADMAP.md) and an open issue with complete acceptance criteria.
Issues labeled `good first issue` are bounded for new contributors. Issues labeled `help wanted`
are ready for external implementation but may require more repository context.

- Use the bug form for reproducible defects.
- Use the documentation form for docs and example gaps.
- Open a feature proposal before implementing a new public command, tool, export, or contract.
- Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

Do not start work on a feature proposal until a maintainer has accepted its public scope and
compatibility direction. Comment on the issue before investing in a large change so contributors do
not duplicate work.

## Development

Use Node.js 22.20 or Node.js 24 and npm 11.

```bash
git clone https://github.com/turnkeeper-ai/turnkeeper-js.git
cd turnkeeper-js
npm ci
npm run check
```

Create a focused branch from the latest `main`. Keep each pull request to one issue or one coherent
outcome. Do not include generated local files, credentials, customer data, production identifiers,
or private Turnkeeper material.

Use the nearest package tests while iterating. Before requesting review, run the repository gate:

```bash
npm run check
```

Include the command and result in the pull request. If a check cannot run, explain exactly why and
what remains unverified.

## Pull requests

Pull requests should:

- link the issue they resolve
- describe public behavior and compatibility impact
- include success, failure, boundary, and safe-error coverage where applicable
- update package docs and examples with behavior changes
- keep fixtures synthetic and package contents safe
- avoid unrelated cleanup

Maintainers may ask for a design issue before reviewing code that expands a public surface. See
[GOVERNANCE.md](GOVERNANCE.md) for decision and review ownership.

## Contract changes

Every contract change needs:

- a dated API-version decision
- matching type, validator, fixture, and documentation updates
- tests for invalid input, malformed responses, retries, and secret-safe errors
- synchronized SDK, CLI, MCP, skill, example, and documentation changes where applicable
- a package-content review

## Public boundary

Do not add routing, prompt, memory, evaluation, handoff, workflow execution, approval resumption, or
orchestration claims before matching public server endpoints exist. Never include customer content,
credentials, production identifiers, internal runbooks, deployment configuration, or private
strategy in issues, fixtures, errors, logs, or package files.

Contributions are accepted under the repository's Apache-2.0 license. Participation is governed by
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
