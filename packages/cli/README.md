# Turnkeeper CLI

`@turnkeeper/cli` provides local development tools for bounded Turnkeeper agent integrations. It
scaffolds TypeScript projects, validates policy bundles, executes deterministic policy cases, and
runs a bounded heuristic inspection of an integration.

The CLI never executes refunds, bookings, account changes, payments, or other business actions.
Its policy simulation is development-time evidence, not production authorization.

## Install

```sh
npm install --save-dev @turnkeeper/cli
```

Run it through the local package binary:

```sh
npx turnkeeper --help
```

## Commands

```text
turnkeeper init [directory]
turnkeeper add-agent [directory]
turnkeeper validate <policy-file>
turnkeeper test-policies <policy-file>
turnkeeper inspect [directory]
```

`init` and `add-agent` preflight every output path before writing. New project roots are staged and
published with one directory rename. Existing roots use staged files, atomic no-clobber links for
new files, backups for explicitly forced replacements, and rollback on a commit error.

Generated projects depend on the exact published `@turnkeeper/sdk@0.1.0-alpha.1` package rather
than monorepo-only workspace references. They include strict TypeScript configuration plus
`typecheck`, `test`, and `check` scripts. `add-agent` leaves an existing root `package.json`,
`tsconfig.json`, and `README.md` untouched; install `@turnkeeper/sdk` separately in that project.
`init --force` still refuses to overwrite an existing `package.json`.

`test-policies` executes every generated case with the SDK simulator and exits nonzero for an
invalid bundle or unexpected decision.

`inspect` reads only a bounded set of source files, skips dependency/generated/secret-like paths
and symlinks, and never returns source contents. Its findings are heuristics and require human
review; absence of a finding is not a security guarantee.

## Runtime boundary

Generated code:

- derives a keyed action binding and idempotency key through `@turnkeeper/sdk`;
- accepts only an untrusted action name and parameter object from model/provider output;
- expects tenant, project, environment, conversation, turn, and proposal-version identity from
  authenticated server state;
- persists the exact proposal before requesting a decision;
- stops on `block` and `review`; and
- leaves downstream execution, review resumption, and durable Replay delivery to the application.

Keep API keys and action-binding secrets separate and server-side. Never pass prompts, transcripts,
tool payloads, PII, credentials, or exact action parameters to Turnkeeper.
