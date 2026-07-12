# Replay privacy

Replay accepts operational metadata, not customer content.

Never send:

- messages, prompts, completions, summaries, or transcripts
- names, emails, phones, addresses, or raw customer/contact identifiers
- provider or webhook payloads
- extracted values
- tool arguments or results
- credentials, cookies, headers, or tokens
- arbitrary free-form metadata

Allowed strings are constrained to short code-like values. Extracted field names may describe which fields changed, but values are forbidden.

Predictable identifiers must be full-length HMAC-SHA-256 pseudonyms with environment-specific keying. The SDK accepts and validates 64-character lowercase hexadecimal identifiers; it does not accept raw source identifiers and does not manage HMAC secrets.

The SDK does not log requests or responses and removes sensitive inputs from its error shapes.
