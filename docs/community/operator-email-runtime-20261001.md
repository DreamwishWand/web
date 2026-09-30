# Community Core operator critical email runtime — 2026-10-01

Status: **CONFIRMED PROVIDER DELIVERY / USER-INBOX VISIBILITY PENDING**

## Scope

This runtime acceptance verifies the real staging path:

persistent Operations Alert
-> durable external-delivery queue
-> `community-ops-email`
-> internal `community-email-resend`
-> Resend
-> configured operator mailbox.

The operator mailbox address itself is secret configuration and is intentionally omitted from this
evidence.

## Configuration

Provider:

- Resend

Verified sender domain:

- `dreamwishwand.com`

Sender:

- `Dreamwish Wand Ops <ops@dreamwishwand.com>`

Canonical channel:

- `operator_email`

Destination:

- `community-email-resend` Edge Function

Authentication:

- existing Vault-backed `operations_escalation` worker token;
- no separate relay bearer secret.

Required Edge secrets present/configured by the operator:

- `RESEND_API_KEY`
- `DREAMWISH_OPERATOR_EMAIL`

## Runtime acceptance

A safe staging critical-alert fixture was created with:

- alert type: `outbox_dead_letter`;
- severity: `critical`;
- metadata limited to staging acceptance markers;
- no user/report/media/provider identity data.

Observed:

- delivery queue state: `delivered`;
- delivery attempts: 1;
- delivery HTTP status: 200;
- delivery error: null;
- Resend provider status: `delivered`;
- sender: `Dreamwish Wand Ops <ops@dreamwishwand.com>`;
- subject shape: `[Dreamwish Wand][CRITICAL] <alert-type>`.

Provider payload contained only:

- alert type;
- severity;
- occurrence;
- first/last seen timestamps;
- internal `/community-ops/` instruction.

It did not contain:

- operator recipient address in the canonical alert payload;
- provider subject;
- Wand user email;
- password/token;
- recovery reference;
- raw report detail;
- media signed URL;
- private DDV/Wand profile data.

After provider delivery was confirmed:

- the synthetic canonical alert was set to `resolved`;
- its delivered external-delivery record was preserved as audit evidence;
- staging open critical alert count returned to 0.

## Evidence classification

**CONFIRMED**

- real Resend provider delivery from the production-shaped staging transport;
- correct sender identity;
- canonical alert survives independently of external mail transport;
- minimized payload;
- test alert cleanup/resolution.

**PENDING**

- human confirmation that the message is visible in the configured mailbox inbox;
- recurrence -> new occurrence -> second external delivery acceptance;
- controlled external-delivery failure/retry acceptance against the active provider path;
- real browser Auth verification/recovery email acceptance.

The provider-level `delivered` status is sufficient to close the backend/provider transport
boundary, but the full operator acceptance remains open until mailbox visibility is confirmed.
