# Community Core transactional email provider — Resend — 2026-09-30

Status: **HIGH CONFIDENCE PROVIDER DEFAULT / ACTIVATION PENDING**

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

- `COMMUNITY_EMAIL_RELAY_TOKEN`
- `RESEND_API_KEY`
- `DREAMWISH_EMAIL_FROM`
- `DREAMWISH_OPERATOR_EMAIL`

None of these values belong in source control, canonical docs, CI logs, or chat.

The adapter accepts only:

- schema = `dreamwishwand.transactional-email.operator-critical.v1`;
- purpose = `operator_critical_operations_alert`.

It does not accept arbitrary recipient/from addresses in the request body. Recipient and sender are
server-held configuration.

## Delivery safety

The existing `community-ops-email` worker remains the queue/claim/retry owner.

The Resend adapter:

1. fails closed when any required secret/config is missing;
2. requires a dedicated relay bearer token;
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

Production and real-mail staging acceptance require a verified sender domain.

Recommended shape after a Wand domain is selected:

- transactional sender: `no-reply@<wand-domain>` or equivalent;
- optional dedicated sending subdomain may be used later if deliverability isolation is needed;
- operator recipient stays the operator's normal mailbox and is never committed to the repo.

The current project SSoT does not identify a canonical custom Wand domain, so sender-domain selection
is a user-owned prerequisite before real delivery acceptance.

## Supabase Auth

After the domain is verified in Resend:

1. create a dedicated Resend SMTP/API credential for Auth;
2. configure Supabase Auth custom SMTP using Resend SMTP;
3. set the verified From address;
4. preserve mandatory email verification;
5. execute signup -> verification -> sign-in and PKCE recovery through the real browser.

Supabase's built-in default SMTP remains test-only and is not a production dependency.

## Operator critical mail activation

After domain/provider setup:

1. create a dedicated Resend API key for the Edge adapter;
2. generate a separate random `COMMUNITY_EMAIL_RELAY_TOKEN`;
3. configure the four Edge secrets outside source control;
4. configure the durable Operations escalation destination:
   - channel = `operator_email`;
   - URL = deployed `community-email-resend` function URL;
   - Authorization bearer token = the same relay token;
5. enable the destination;
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

- Resend account ownership;
- canonical Wand sender domain;
- DNS verification;
- secrets/configuration;
- Supabase Auth SMTP acceptance;
- real operator mailbox delivery;
- real browser Auth email flows.
