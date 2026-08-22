# Turnkeeper Ward public contracts

Public, privacy-minimized developer contracts for Turnkeeper Ward safety intelligence.

```text
packages/sdk                 Ward contracts and validators
packages/adapter-sentinel    Claim-safe Sentinel-like → DetectorCandidate mapper
spec/                         Dated safety-exchange schemas
docs/                         Protocol, conformance, and package documentation
```

This repository contains public contracts and developer tooling only. Hosted dashboards,
organization management, case review, authorization, audit storage, billing, and production API
implementations remain in the private hosted-platform repository.

## Development

Use Node.js 22.20 or Node.js 24.

```bash
npm ci
npm run check
```

The packages are pre-release software. Pin exact versions and review the documented safety
boundaries before using them in a production workflow.

## Install the current alpha

npm's unversioned `latest` channel still resolves to `0.1.0-alpha.2`. Use the exact current alpha
for reproducible installs; the moving `next` channel is available for deliberate prerelease
tracking.

```bash
npm install @turnkeeper/sdk@0.2.0-alpha.0 @turnkeeper/adapter-sentinel@0.2.0-alpha.0
```

Equivalent moving-channel package specs are `@turnkeeper/sdk@next` and
`@turnkeeper/adapter-sentinel@next`. Do not use an unversioned install until the project
explicitly promotes a release to `latest`.

## Packages

- [`@turnkeeper/sdk`](packages/sdk/README.md)
- [`@turnkeeper/adapter-sentinel`](packages/adapter-sentinel/README.md)

Maintainers should use the [public package release process](docs/releasing.md).

For the privacy-minimized Ward exchange contracts, read the
[Safety Exchange Protocol v0.1 working draft](docs/safety-exchange-protocol-v0.1.md), its linked
operational profiles, and the
[synthetic conformance fixtures](docs/examples/safety-exchange-v0.1.conformance.json). The public
SDK validates structural contracts with synthetic data. Cryptographic helpers, live membership,
durable delivery, operational conformance, and multi-company collaboration remain roadmap.

## Privacy and safety

The retained contracts are synthetic-first and advisory. They accept opaque references and bounded
metadata only. Do not send raw messages, attachments, direct identifiers, customer credentials, or
free-form detector output. A valid candidate is not a review decision or authorization to act.

## Community

Start with the [public roadmap](ROADMAP.md) and choose an issue whose acceptance criteria are
complete. New contributors should begin with an unassigned
[`good first issue`](https://github.com/turnkeeper-ai/turnkeeper-js/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
and the [first contribution walkthrough](docs/first-contribution.md). Read
[CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request, and use the issue forms for bugs,
documentation improvements, and feature proposals.

- [First contribution walkthrough](docs/first-contribution.md)
- [Contribution workflow](CONTRIBUTING.md)
- [Contributor architecture map](docs/contributor-architecture.md)
- [Public roadmap](ROADMAP.md)
- [Support](SUPPORT.md)
- [Governance](GOVERNANCE.md)
- [Code of conduct](CODE_OF_CONDUCT.md)

## Security

Keep credentials, raw content, and direct identifiers out of public contract inputs. See
[SECURITY.md](SECURITY.md) and [docs/privacy.md](docs/privacy.md).
