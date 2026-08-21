# Safety Exchange Governance and Human-Review Profile v0.1

Status: **working draft**  
Applies to contract version: **2026-08-08**

This profile defines the institutional controls required before live multi-company exchange. It is
a design requirement, not an implemented hosted governance service.

## Child-centered purpose

The exchange exists to help trained people investigate potential risks to children with greater
clarity, care, and accountability. It MUST NOT become a general surveillance system, shared
blacklist, identity graph, engagement product, law-enforcement proxy, or autonomous decision engine.

The best interests, dignity, privacy, safety, and ability to seek correction for affected children
and families MUST be considered alongside operational safety goals.

## Membership

Before activation, an operator MUST verify that a member:

- has a legitimate child-safety or trust-and-safety function;
- identifies accountable legal, security, privacy, and safeguarding contacts;
- documents allowed purposes, jurisdictions, retention limits, and reviewer roles;
- can protect signing and private-match keys;
- can receive urgent revocations and security notices;
- passes conformance and incident-response exercises; and
- accepts audit, suspension, correction, and redress obligations.

Membership MUST be least-privilege. Publish, lookup, receive, audit, and operator permissions MUST
be granted separately. A member MUST NOT receive every category merely because it can publish one.

## Publication authority

- A detector output alone MUST NOT authorize publication.
- Every publication MUST reference a locally authorized proposal and policy version.
- Members MUST define which trained role may publish each category and evidence tier.
- Weak or uncorroborated signals SHOULD receive narrower distribution and shorter expiry.
- A reviewer MUST be able to decline publication without creating an adverse subject record.
- Publication volume, revocation rate, challenge rate, and category drift MUST be monitored for
  misuse and calibration failure.

## Recipient review

A recipient MUST:

1. treat the signal as an unverified lead;
2. apply its own policy, jurisdiction, evidence, and counterevidence;
3. require an authorized human reviewer before any consequential decision;
4. record the source signal separately from local inference and adjudication;
5. expose uncertainty and relevant limitations to the reviewer; and
6. apply its own appeal and execution controls.

No signal, category, strength band, evidence tier, or match handle may independently trigger account
restriction, external reporting, outreach, preservation, parent notification, or law-enforcement
contact.

## Challenge, correction, and redress

- Members MUST maintain a channel for another member to challenge provenance, matching, category,
  purpose, or continued use.
- A challenge MUST suspend new reliance when it identifies plausible key compromise, mistaken
  identity, prohibited data, or invalid source evidence.
- The origin member MUST investigate, respond, and revoke or reaffirm through an append-only record.
- Recipients MUST propagate validated corrections into affected local review records.
- Operating agreements MUST define how affected people can exercise available correction, appeal,
  and redress rights without exposing another member's raw evidence or compromising child safety.
- Redress records MUST distinguish a corrected signal from deletion of audit history.

## Safeguarding and escalation

Protocol records are not emergency services or legal reports. Members MUST maintain separate,
jurisdiction-appropriate procedures for imminent danger, mandatory reporting, preservation, and
lawful process. Those procedures MUST require their own evidence and authorization; they MUST NOT be
inferred from receipt of an exchange signal.

## Oversight and transparency

A future operator MUST publish at least aggregate membership counts, signal and revocation volumes,
challenge outcomes, suspensions, security incidents, and conformance status where publication does
not create new safety or privacy risk. Members SHOULD provide similarly bounded transparency about
how exchanged signals enter human review.

The governing body MUST include safeguarding, privacy, security, technical, and affected-community
expertise. Commercial participants alone MUST NOT be able to widen purposes or weaken the four core
protocol invariants.

## Suspension and termination

The operator MUST be able to suspend a member immediately for key compromise, bulk probing,
prohibited data, automated enforcement, undisclosed secondary use, repeated false publication, or
failure to process revocations. Termination MUST revoke credentials, stop delivery, preserve the
minimum audit evidence, and activate the lifecycle profile for outstanding records.
