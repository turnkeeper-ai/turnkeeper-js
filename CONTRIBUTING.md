# Contributing

This monorepo contains the public SDK, CLI, MCP server, agent-builder skill, and synthetic examples.
Changes must preserve the public/private repository boundary, Replay metadata allowlist,
fail-closed Control behavior, deterministic event identity, and secret-safe errors.

## Choose work

Start with the [public roadmap](ROADMAP.md) and an open issue with complete acceptance criteria.
Issues labeled `good first issue` are bounded for new contributors. Issues labeled `help wanted`
are ready for external implementation but may require more repository context.

Read the [contributor architecture map](docs/contributor-architecture.md) before changing more than
one package or public contract. It identifies dependency direction, contract ownership, tests, and
the files that must stay synchronized.

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

### Environment troubleshooting

Confirm the active runtime before investigating an install or native dependency failure:

```bash
node --version
npm --version
node -p '`${process.platform} ${process.arch}`'
```

After changing Node installations or CPU architecture, run `npm ci` again. It recreates
`node_modules` from the committed lockfile; do not regenerate `package-lock.json` to conceal a
runtime mismatch. On Windows, the link-boundary tests use directory junctions so they do not
require Developer Mode or administrator-only symbolic-link privileges. If a supported Windows
environment still reports `EPERM`, include the command, runtime values above, and relevant policy
restrictions in the pull request instead of skipping the test.

Do not bypass tests or edit generated package output while troubleshooting. Return to the
[development commands](#development) after correcting the environment.

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

Maintainers target initial issue triage and an initial response to review-ready pull requests within
five business days during the alpha period. This is a response target, not a resolution or release
SLA. The governance document explains how ready work, paused work, and accepted proposals are
identified.

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

Contributions are accepted under the repository's Apache-2.0 license. By contributing, you certify
every commit under the [Developer Certificate of Origin 1.1](DCO). Each commit must contain a
`Signed-off-by` trailer whose name and email match the commit author:

```bash
git commit -s -m "feat(scope): describe the change"
```

The sign-off records your certification; it is not a GPG or cryptographic signature. Configure your
Git identity before committing, and amend an unsigned latest commit with:

```bash
git commit --amend --no-edit --signoff
```

Pull requests cannot merge until the required DCO check confirms every commit. Participation is governed by
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
