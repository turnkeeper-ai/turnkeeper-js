# Versioning

The npm package will use semantic versioning when publication is approved. Replay uses a separate dated wire version.

| SDK version | Replay API version | Status |
|---|---|---|
| 0.0.0-development | 2026-07-09 | private scaffold |

Adding support for a new dated API version does not silently change existing event serialization. A future published package must document its compatibility and deprecation policy before changing the default contract.
