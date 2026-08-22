# Safety-exchange privacy

The public Ward contracts accept privacy-minimized structural metadata, never customer content.

Never send:

- messages, prompts, completions, summaries, transcripts, attachments, or URLs
- names, usernames, emails, phones, addresses, or direct identifiers
- provider or webhook payloads, detector indexes, embeddings, or free-form explanations
- credentials, cookies, headers, tokens, or arbitrary free-form metadata

Allowed strings are constrained to short code-like values and opaque customer-controlled references.

Predictable opaque references should use an environment-scoped pseudonymization strategy in the
customer environment. The SDK validates format and prohibited content-shaped fields; it does not
create or manage pseudonymization keys.

A structurally valid signal is advisory only. It does not imply a verified finding, authorize
cross-organization sharing, or authorize customer action. Follow the protocol’s purpose, expiry,
provenance, revocation, and reviewed-outcome requirements.
