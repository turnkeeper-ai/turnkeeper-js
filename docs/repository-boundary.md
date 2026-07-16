# Public SDK and hosted-platform boundary

Turnkeeper separates public developer tooling from the private hosted service.

## Public SDK repository

This repository owns artifacts that developers install, inspect, extend, or use as examples:

```text
packages/
  sdk/
  cli/
  mcp/
skills/
  turnkeeper-agent-builder/
examples/
docs/
spec/
```

Public code may contain:

- stable public request and response contracts;
- client-side validation and typed errors;
- deterministic policy helpers and simulations;
- local CLI and MCP tooling;
- metadata-only Replay helpers;
- synthetic examples, fixtures, and public documentation.

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

- Depend from CLI and MCP toward the public SDK, never toward the hosted application.
- Keep database models, migrations, internal collections, queue internals, and deployment
  configuration private.
- Keep internal URLs, feature flags, service credentials, customer data, and production
  identifiers out of this repository.
- Keep action-binding secrets in application secret storage; examples must never contain one.
- Document only public behavior and supported status.
- Use synthetic values in tests, examples, screenshots, and error fixtures.
- Keep exact customer action parameters in the integrating application, not in Replay events.
- Treat local policy simulation as development-time behavior, never hosted authorization.
- Synchronize SDK, CLI, MCP, skill, examples, and docs when a public contract changes.

## Change checklist

Before merging a public-contract change:

1. update the SDK types and validators;
2. update CLI and MCP schemas that expose the contract;
3. update the agent-builder reference that describes the behavior;
4. update at least one runnable example;
5. update public docs and version compatibility;
6. verify package contents contain no hosted internals or secrets;
7. run package, example, security, and contract checks.

If a change requires private persistence, migrations, hosted authorization, billing, or operations,
implement that portion in the hosted-platform repository and expose only the approved public
contract here.
