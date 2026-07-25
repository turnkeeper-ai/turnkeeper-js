# Versioning

The public packages use semantic versioning. Replay uses a separate dated wire version.

| SDK version   | Replay API version | Status              |
| ------------- | ------------------ | ------------------- |
| 0.1.0-alpha.5 | 2026-07-09         | contributor hardening prerelease |
| 0.1.0-alpha.4 | 2026-07-18         | review retrieval prerelease |
| 0.1.0-alpha.3 | 2026-07-09         | prepared prerelease |
| 0.1.0-alpha.2 | 2026-07-09         | public prerelease   |
| 0.1.0-alpha.1 | 2026-07-09         | public prerelease   |

SDK, CLI, and MCP releases use the same version while their public contracts are evolving together.
Pin exact alpha versions. Adding support for a new dated Replay API version does not silently
change existing event serialization.
