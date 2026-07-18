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

## Triage and response targets

During the alpha period, maintainers target:

- initial triage of a new public issue within five business days
- an initial response to a review-ready pull request within five business days
- a public status update when accepted work is paused for more than ten business days

These are response targets, not resolution or release SLAs. Security reports follow the private
process in [SECURITY.md](SECURITY.md) and must not be filed publicly.

An issue labeled `good first issue` or `help wanted` with complete acceptance criteria is ready for
external work. A feature proposal is accepted only when a maintainer explicitly confirms its public
scope and compatibility direction. A milestone or assignment alone does not accept a proposal.

Maintainers may close stale requests for missing reproduction details or mark work paused when
review capacity is unavailable. The reason and the condition for reconsideration should be recorded
publicly when privacy and security allow.

## Review and merge

Every external pull request requires passing checks and at least one maintainer approval. Authors
must resolve review conversations before merge. Maintainers own release timing, compatibility
classification, security response, and final merge decisions.

Maintainer-authored release or repository-administration pull requests may use the administrator
bypass when no independent maintainer is available. Required status checks, linear history,
conversation resolution, and release verification still apply. External contributions never bypass
maintainer review.

Maintainers should explain rejected or deferred proposals in public when privacy and security allow.
There is no guaranteed resolution or release SLA during the alpha period.

## Maintainers

Maintainers are responsible for issue triage, review quality, release integrity, security handling,
and enforcement of repository boundaries. Maintainer access is granted by existing maintainers based
on sustained, trusted contributions and demonstrated judgment; it is not automatic from a fixed
number of pull requests.

## Community standards

Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Support and vulnerability
routing are documented in [SUPPORT.md](SUPPORT.md) and [SECURITY.md](SECURITY.md).
