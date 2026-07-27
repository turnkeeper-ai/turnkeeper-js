# Account contact change (`account.contact_information.change`)

Synthetic local example for Turnkeeper's Implemented bounded
`account.contact_information.change` Control contract. Requested channel values
are opaque codes, not customer free text. It does **not** contact a hosted API
or change any account.

Interactive website companion:
[https://turnkeeper.ai/demo/account-change](https://turnkeeper.ai/demo/account-change)

## Status

| Surface | Status |
| --- | --- |
| Public SDK local simulation | Implemented |
| Hosted template library | Implemented |
| Runtime use beyond authorized synthetic/pilot traffic | Gated |
| Automatic execution / approval resumption | Roadmap |

## Trusted signals

```ts
type AccountChangeSignals = {
  customer_verified: boolean;
  step_up_complete: boolean;
  requested_channel: string;
  account_restriction_present: boolean;
  recent_profile_changes: number;
  preflight_complete: boolean;
};
```

`step_up_complete` is the canonical signal key (avoid `auth` substrings rejected by
SDK metadata safety filters).

## Local simulation

```sh
TURNKEEPER_BINDING_SECRET=synthetic-demo-only-binding-secret-000001 npm run demo
npm test
npm run typecheck
```

Turnkeeper does **not** execute contact changes. `audit` is observational evidence,
not authorization to mutate the account.

Install `@turnkeeper/cli@0.1.0-alpha.7` for policy validation helpers.
