# Contributing

This package is server-side and Replay-only. Changes must preserve the metadata allowlist, deterministic event identity, safe error handling, and the absence of automatic retries.

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
- a package-content review

Do not add policy, routing, prompt, memory, evaluation, handoff, or orchestration APIs before matching public server endpoints exist. Never include customer content, credentials, production identifiers, internal runbooks, deployment configuration, or private strategy in issues, fixtures, errors, logs, or package files.
