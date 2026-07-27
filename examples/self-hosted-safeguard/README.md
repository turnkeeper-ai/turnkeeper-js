# Self-hosted Safeguard example

Provider-neutral walkthrough for converting an already validated Safeguard classification into
bounded `model.output.safety` Control signals and metadata-only Replay lifecycle facts.

The README may reference GPT-OSS as an example self-hosted stack. This example does not import
private model-lab code, policies, or weights.

```bash
npm install
TURNKEEPER_BINDING_SECRET=synthetic-test-only-binding-secret-000001 npm test
TURNKEEPER_BINDING_SECRET=synthetic-test-only-binding-secret-000001 npm run demo
npm run typecheck
```

Install `@turnkeeper/cli@0.1.0-alpha.7` for policy validation helpers. This example does not call
production Control APIs by default.

## Safeguard input shape

The caller boundary accepts an already validated result:

```json
{
  "violation": false,
  "category": null,
  "requires_review": false,
  "classification_state": "available"
}
```

Optional `classification_state` values are `available` or `unavailable`. Timeout or invalid model
output should map to `unavailable` before reaching Turnkeeper.

## Policy preference

1. `classification_state=unavailable` → `block`
2. `safeguard_violation=true` → `review`
3. `classification_state=available` with no violation → `audit`

Replay records `provider: "self_hosted"` and a bounded model code such as
`gpt_oss.20b.support_v1` on `model.completed`.
