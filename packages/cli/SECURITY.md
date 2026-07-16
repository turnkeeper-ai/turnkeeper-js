# Security policy

Report suspected vulnerabilities privately to `support@turnkeeper.ai`. Include the affected
version and safe reproduction steps, but do not include real API keys, binding secrets, customer
content, PII, production identifiers, or unredacted logs.

## Security boundary

- The CLI is a local development tool and never authorizes or executes a production action.
- Generated action bindings must use the SDK's keyed binding API. A plain predictable hash is not
  an opaque identifier.
- Generated projects must derive tenant, project, environment, actor, and role identity from
  authenticated server state.
- `review`, `block`, timeout, malformed response, and unavailable service outcomes must never
  become approval.
- Scaffold writes refuse symlinks and non-file replacement targets. Replacement requires
  `--force`, stages content before committing, and restores backups after a commit failure.
- Integration inspection is deliberately bounded and heuristic. It does not return inspected
  source, follow symlinks, read environment files, or claim complete static-analysis coverage.

Never give the CLI or a coding-agent host production credentials merely to generate, validate,
simulate, or inspect an integration.
