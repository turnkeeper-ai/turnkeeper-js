# Governance

Turnkeeper JS uses a maintainer-led governance model while the packages are pre-release. The goal is
to make contribution decisions predictable without presenting private product strategy as public
commitment.

## Scope

This repository governs the public SDK, CLI, MCP server, agent-builder skill, synthetic examples,
public specifications, and their documentation. Hosted application code, customer operations,
deployment configuration, billing, cloud persistence, and private strategy are out of scope.

## Decisions

- Reproducible bug fixes and bounded documentation improvements may proceed from accepted issues.
- New commands, tools, exports, schemas, compatibility changes, and package dependencies require an
  accepted feature proposal before implementation.
- Public contracts must be supported by implemented server behavior. A roadmap idea is not a shipped
  API.
- Maintainers may decline changes that weaken privacy, deterministic behavior, secret safety,
  compatibility, package boundaries, or long-term maintenance capacity.

Technical decisions should be recorded in the issue or pull request that owns the outcome. Large
proposals should be split until each pull request can be reviewed and reverted independently.

## Review and merge

Every external pull request requires passing checks and at least one maintainer approval. Authors
must resolve review conversations before merge. Maintainers own release timing, compatibility
classification, security response, and final merge decisions.

Maintainers should explain rejected or deferred proposals in public when privacy and security allow.
There is no guaranteed review or release SLA during the alpha period.

## Maintainers

Maintainers are responsible for issue triage, review quality, release integrity, security handling,
and enforcement of repository boundaries. Maintainer access is granted by existing maintainers based
on sustained, trusted contributions and demonstrated judgment; it is not automatic from a fixed
number of pull requests.

## Community standards

Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Support and vulnerability
routing are documented in [SUPPORT.md](SUPPORT.md) and [SECURITY.md](SECURITY.md).
