# Versioning

The two public packages use semantic versioning. The Ward safety-exchange wire contract uses the
dated `2026-08-08` version exported as `EXCHANGE_CONTRACT_VERSION`.

| Package source version | Exchange contract version | Status |
| --- | --- | --- |
| 0.2.0-alpha.0 | 2026-08-08 | Ward contract and adapter prerelease |

Pin exact alpha versions. A wire-contract change requires a new dated schema, matching SDK
validators and fixtures, updated documentation, and a deliberate compatibility decision.

## npm distribution channels

The current prerelease source tracks npm's `next` channel. `latest` promotion, package publication,
and deprecation of earlier tooling are separate maintainer decisions.

- Prefer exact versions such as `@turnkeeper/sdk@0.2.0-alpha.0` in application manifests and
  reproducible commands, together with `@turnkeeper/adapter-sentinel@0.2.0-alpha.0` when needed.
- Use `@turnkeeper/sdk@next` only when intentionally following the moving prerelease channel.
- Avoid unversioned package specs during alpha because they resolve through `latest`, not `next`.
