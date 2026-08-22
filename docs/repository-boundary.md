# Public Ward contracts and hosted-platform boundary

Turnkeeper separates public developer tooling from the private hosted service.

## Public SDK repository

This repository owns the public, privacy-minimized Ward contract surface:

```text
packages/
  sdk/
  adapter-sentinel/
docs/
spec/
```

Public code may contain:

- stable public request and response contracts;
- client-side validation and typed errors;
- claim-safe mappings from customer-hosted detector output;
- synthetic conformance fixtures and public documentation.

This repository must not contain internal business documents, including company strategy,
fundraising or investor materials, founder operating notes, prospecting or sales pipelines,
outreach drafts, unpublished marketing copy, or private customer and design-partner plans.

## Private hosted-platform repository

The private platform owns service implementation and operations:

- dashboard and authenticated application UI;
- organization, project, user, and membership management;
- hosted review queues and approval workflows;
- cloud audit and evidence storage;
- billing and usage enforcement;
- production API implementation;
- database schemas, migrations, infrastructure, deployment, alerts, and runbooks.

Public packages may call documented hosted APIs. They must not import or copy the private
implementation.

## Boundary rules

- Keep database models, migrations, internal collections, queue internals, and deployment
  configuration private.
- Keep internal URLs, feature flags, service credentials, customer data, and production
  identifiers out of this repository.
- Document only public behavior and supported status.
- Use synthetic values in tests, examples, screenshots, and error fixtures.
- Keep tenant derivation, review, sharing eligibility, and authorization in authenticated hosted
  or customer-owned boundaries.
- Do not represent a local validator or adapter as a live network, partner integration, or approval
  to take action.
- Synchronize the SDK, adapter, schemas, fixtures, protocol docs, and package checks when a public
  contract changes.

## Change checklist

Before merging a public-contract change:

1. update the SDK types and validators;
2. update the adapter mapping if it shares the contract;
3. update valid and invalid synthetic fixtures;
4. update public docs and version compatibility;
5. verify package contents contain no hosted internals or secrets;
6. run package, security, and contract checks.

The repository-wide check includes a tracked-document boundary scan. Keep internal business
material in an access-controlled company system, not in this public Git history.

If a change requires private persistence, migrations, hosted authorization, billing, or operations,
implement that portion in the hosted-platform repository and expose only the approved public
contract here.
