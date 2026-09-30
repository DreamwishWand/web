# Community Core transactional email provider — Resend — 2026-09-30

Status: **HIGH CONFIDENCE PROVIDER + DOMAIN VERIFIED / ACTIVATION PENDING**

## Decision

Dreamwish Wand uses **Resend** as the first-launch transactional email provider default.

This is a delivery-provider choice only. It does not merge Auth email, Wizard transactional email,
or operator Operations Alert semantics.

Resend is selected because the current launch needs line up with one service:

- SMTP suitable for Supabase Auth custom SMTP;
- HTTPS transactional email API suitable for Supabase Edge Functions;
- verified custom domains;
- API idempotency keys;
- delivery/failure observability;
- low-volume staging/closed-beta entry tier.

The provider-neutral Community Operations Alert queue remains canonical. Resend can be replaced later
without changing WandAccount, CommunityEntity, Operations Alert, or Notification models.

## Current implementation

Edge adapter:

`supabase/functions/community-email-resend/index.ts`

Staging deployment:

- function: `community-email-resend`;
- JWT verification: disabled intentionally;
- relay authentication: dedicated bearer secret;
- provider activation: **disabled in practice until required function secrets exist**.

Required Edge Function secrets/config:

- `RESEND_API_KEY`
- `DREAMWISH_OPERATOR_EMAIL`

The canonical sender is code-fixed to `Dreamwish Wand Ops <ops@dreamwishwand.com>`.
The internal relay reuses the existing Vault-backed `operations_escalation` worker token, so no
second relay secret is required.

None of these values belong in source control, canonical docs, CI logs, or chat.

The adapter accepts only:

- schema = `dreamwishwand.transactional-email.operator-critical.v1`;
- purpose = `operator_critical_operations_alert`.

It does not accept arbitrary recipient/from addresses in the request body. Recipient and sender are
server-held configuration.

## Delivery safety

The existing `community-ops-email` worker remains the queue/claim/retry owner.

The Resend adapter:

1. fails closed when any required Resend/recipient configuration is missing;
2. requires the existing dedicated `operations_escalation` worker token;
3. validates the fixed operator-critical schema/purpose;
4. validates subject/text/idempotency lengths;
5. sends plaintext operational mail only;
6. forwards the canonical occurrence idempotency key as Resend `Idempotency-Key`;
7. never returns or logs the operator recipient/API key.

Resend currently retains idempotency keys for 24 hours. The Community queue remains the durable
source of delivery state; provider idempotency is defense-in-depth for retry/network ambiguity.

## Credential separation

Use the same provider but separate credentials where practical:

- **Auth SMTP credential** — Supabase Auth verification/recovery only;
- **Operator/API credential** — Wand Edge transactional API only.

This keeps a compromised application API credential from automatically becoming the Auth SMTP
credential and vice versa.

## Domain / sender boundary

Production and real-mail staging acceptance require a verified sender domain. Resend UI now reports `dreamwishwand.com` as **Verified** (user-observed provider state on 2026-10-01).

Canonical first-launch sender domain:

- verified Resend domain: `dreamwishwand.com`;
- Auth verification/recovery From: `Dreamwish Wand <no-reply@dreamwishwand.com>`;
- operator critical From: `Dreamwish Wand Ops <ops@dreamwishwand.com>`;
- operator recipient stays the operator's normal mailbox and is never committed to the repo.

No marketing/broadcast mail is sent through this launch contract. If marketing is introduced later,
use a separately isolated sending domain/subdomain and policy.

An optional dedicated transactional subdomain may be introduced later only if deliverability,
reputation-isolation or organizational evidence justifies it; it is not required for first launch.

## Supabase Auth

After `dreamwishwand.com` is verified in Resend:

1. create a dedicated Resend credential for Auth SMTP;
2. configure Supabase Auth custom SMTP:
   - host `smtp.resend.com`;
   - username `resend`;
   - password = dedicated Resend credential kept outside repo/chat;
   - sender = `no-reply@dreamwishwand.com`;
   - sender name = `Dreamwish Wand`;
3. preserve mandatory email verification;
4. execute signup -> verification -> sign-in and PKCE recovery through the real browser.

Supabase's built-in default SMTP remains test-only and is not a production dependency.

## Operator critical mail activation

After domain/provider setup:

1. create a dedicated Resend API key for the Edge adapter, separate from the Auth SMTP credential;
2. configure only two Edge secrets outside source control: `RESEND_API_KEY` and `DREAMWISH_OPERATOR_EMAIL`;
3. configure the durable Operations escalation destination:
   - channel = `operator_email`;
   - URL = deployed `community-email-resend` function URL;
   - no separate destination bearer secret is needed; the existing Operations worker token is forwarded internally;
4. enable the destination;
6. induce one safe critical staging alert;
7. require exactly one delivered operator email;
8. clear/resolve and recur the condition;
9. require a new occurrence/new email;
10. induce a controlled provider failure and confirm the canonical alert + delivery failure remain
    visible in Community Ops.

## Plan / volume boundary

Current Resend pricing should be treated as deployment configuration, not product semantics.

For staging/closed beta, the current low-volume free tier is sufficient if aggregate Auth +
transactional traffic stays under its limits.

Before public launch, estimate signup/verification/recovery/security/operator mail volume and move to
a paid plan if the free daily/monthly quota is not adequate.

## Second-channel decision

No second independent alert channel is required for first launch.

A Resend outage cannot notify through Resend itself. That is an explicit accepted blind spot for the
current single-operator, non-life-safety/non-financial workload. Canonical Operations Alerts and
delivery dead letters remain durable in Wand.

Revisit a second provider/channel if:

- multiple operators require independent paging;
- an SLA is introduced;
- Wand Cloud financial operations become materially dependent on immediate operator response;
- incident volume or business criticality increases.

## Evidence boundary

CONFIRMED:

- provider-neutral alert/delivery queue;
- retry/dead-letter/self-monitoring;
- provider adapter code + fail-closed deployment;
- Resend SMTP/API/idempotency capability from provider documentation.

PENDING:

- dedicated Auth SMTP and Ops API credentials;
- secrets/configuration;
- Supabase Auth SMTP acceptance;
- real operator mailbox delivery;
- real browser Auth email flows.
