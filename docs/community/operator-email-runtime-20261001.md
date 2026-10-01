# Community Core operator critical email runtime — 2026-10-01

Status: **CONFIRMED DELIVERY / PARTIAL INBOX PLACEMENT**

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

**CONFIRMED additional acceptance**

- human operator confirmed the first critical-alert message was visible in the configured mailbox;
- reopening the same canonical alert produced occurrence 2 and a distinct second external delivery;
- occurrence 2 reached Resend with provider status `delivered`;
- a controlled internal relay failure produced HTTP 404, delivery state `pending`, attempts = 1,
  and preserved the canonical open alert;
- the relay endpoint was restored to `community-email-resend`;
- the exact same delivery retried and completed with HTTP 200, state `delivered`, attempts = 2;
- Resend recorded the recovered delivery as `delivered`;
- both acceptance fixture alerts were resolved afterward;
- open critical alert count returned to 0;
- canonical relay endpoint is restored.

Provider delivery, retry and recurrence are CONFIRMED. Human mailbox delivery is also CONFIRMED, but iCloud placed the two rapid recurrence/retry test messages in Junk. Inbox placement is therefore PARTIAL and remains a launch-hardening item.

Observed deliverability caveat:

- the initial operator message was visible to the human operator;
- the two additional rapid test messages were found in the iCloud Junk folder;
- this test pattern was unusually bursty for a brand-new sending domain and is not representative of normal incident volume;
- do not use synthetic warmup traffic; build reputation with real low-volume transactional mail and positive recipient feedback.

Still open:

- iCloud inbox-placement recheck after the operator marks the messages as Not Junk;
- DMARC publication check/hardening;
- real browser Auth verification/recovery email acceptance.


## Low-volume observation update — 2026-10-01

No synthetic warmup traffic was sent for this observation.

Existing provider traffic for the preceding seven-day window was reviewed through Resend:

- sent: 5;
- delivered: 5;
- delivery rate: 100%;
- bounced: 0;
- failed: 0;
- complained: 0;
- delivery-delayed: 0.

The five existing messages covered real staging Auth verification/recovery and previously executed
operator acceptance alerts. The sender domain remains verified with sending enabled in the
ap-northeast-1 region.

Classification:

- **CONFIRMED provider delivery health:** 5/5 existing messages delivered with no bounce/complaint/failure signal;
- **PARTIAL inbox placement:** provider `delivered` does not distinguish Inbox from Junk, and the
  prior iCloud Junk observations remain relevant;
- **POLICY:** continue observation from normal low-volume transactional use only. Do not generate
  synthetic warming traffic.
