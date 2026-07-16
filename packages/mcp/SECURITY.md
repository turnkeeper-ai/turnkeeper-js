# Security

Report suspected vulnerabilities privately through the security contact configured for the
Turnkeeper GitHub organization. Do not include credentials, customer content, production payloads,
or exploitable secrets in a public issue.

## Boundary

- The server is local and communicates over stdio.
- It does not accept or use Turnkeeper API keys.
- It does not call production APIs or execute application actions.
- File inspection is restricted to the configured real workspace root.
- Environment files, dependency trees, generated output, oversized files, and symlinks are skipped.
- Tool inputs and outputs are bounded, and returned errors are sanitized.

MCP hosts remain responsible for deciding which users and agents may start the server or invoke its
tools. Do not expose the stdio process through an unauthenticated network bridge.
