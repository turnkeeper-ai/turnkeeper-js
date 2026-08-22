# Contributing

This monorepo contains the public Ward contract SDK, claim-safe detector adapter, dated schemas,
synthetic fixtures, and developer documentation. Changes must preserve privacy-minimized contracts,
provenance, bounded failure behavior, synthetic fixtures, and secret-safe errors.

## Choose work

Start with the [public roadmap](ROADMAP.md) and an open issue with complete acceptance criteria.
Issues labeled `good first issue` are bounded for new contributors. Issues labeled `help wanted`
are ready for external implementation but may require more repository context.

For a documentation-only first pull request, follow the
[first contribution walkthrough](docs/first-contribution.md). It covers choosing an unassigned
`good first issue`, commenting before starting, install, `npm run check`, a DCO-signed commit, and
what evidence to include in the pull request.

Read the [contributor architecture map](docs/contributor-architecture.md) before changing more than
one package or public contract. It identifies dependency direction, contract ownership, tests, and
the files that must stay synchronized.

- Use the bug form for reproducible defects.
- Use the documentation form for docs and synthetic-fixture gaps.
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

### Focused contributor command map

Use the nearest focused command for the area you changed while iterating, then run the required
`npm run check` gate before requesting review. Every command below already exists in this
repository; this map does not add or rename any package script.

| Area you changed | Nearest focused command |
| --- | --- |
| Ward SDK (`packages/sdk`) | `npm run typecheck --workspace @turnkeeper/sdk` then `npm run test --workspace @turnkeeper/sdk` and `npm run package:check --workspace @turnkeeper/sdk` |
| Detector adapter (`packages/adapter-sentinel`) | `npm run typecheck --workspace @turnkeeper/adapter-sentinel` then `npm run test --workspace @turnkeeper/adapter-sentinel` and `npm run package:check --workspace @turnkeeper/adapter-sentinel` |
| Package contents (any published package) | `npm run smoke:packages` (or `npm run package:check --workspaces --if-present`) |
| Documentation-only changes | No focused package script; confirm links and formatting, then run `npm run check` |

Focused commands speed up iteration but do not replace the gate. `npm run check` remains the
required final command before review — it runs build, workspace typecheck, workspace tests,
package-content checks, package smoke checks, and the public-surface validator.

Use Node.js 22.20 or Node.js 24 and npm 11 for both focused commands and the gate.

### Environment troubleshooting

Confirm the active runtime before investigating an install or native dependency failure:

```bash
node --version
npm --version
node -p '`${process.platform} ${process.arch}`'
```

After changing Node installations or CPU architecture, run `npm ci` again. It recreates
`node_modules` from the committed lockfile; do not regenerate `package-lock.json` to conceal a
runtime mismatch. If a supported environment reports `EPERM`, include the command, runtime values,
and relevant policy restrictions in the pull request instead of skipping the test.

Do not bypass tests or edit generated package output while troubleshooting. Return to the
[development commands](#development) after correcting the environment.

## Pull requests

Pull requests should:

- link the issue they resolve
- describe public behavior and compatibility impact
- include success, failure, boundary, and safe-error coverage where applicable
- update package docs and synthetic fixtures with behavior changes
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

- a dated wire-version decision
- matching type, validator, fixture, and documentation updates
- tests for invalid input, prohibited privacy fields, provenance, and secret-safe errors
- synchronized SDK, adapter, schema, fixture, and documentation changes where applicable
- a package-content review

## Public boundary

Do not add a hosted API client, credential storage, raw-content transport, case-review workflow,
automated enforcement, or another public package without an accepted maintainer proposal. Never
include customer content, credentials, production identifiers, internal runbooks, deployment
configuration, or private strategy in issues, fixtures, errors, logs, or package files.

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
