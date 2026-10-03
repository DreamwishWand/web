# Dreamwish Wand transactional email activation — dreamwishwand.com — 2026-09-30

Status: **OPS EMAIL ACCEPTANCE COMPLETE / AUTH FLOW NEXT**

## Canonical launch configuration

Provider:

- Resend

Verified sending domain:

- `dreamwishwand.com`

Auth sender:

- display name: `Dreamwish Wand`
- address: `no-reply@dreamwishwand.com`

Operator critical sender:

- display name: `Dreamwish Wand Ops`
- address: `ops@dreamwishwand.com`

Operator recipient:

- the operator's normal mailbox;
- stored only as server-side secret/configuration;
- never committed to source control or canonical docs.

Normal Community activity remains in-app only. Comment / Reply / Reaction / Follow / Save do not
produce transactional email.

## Phase A — Resend domain verification — COMPLETE

**CONFIRMED (user-observed Resend UI, 2026-10-01):** `dreamwishwand.com` is `Verified` in Resend.

1. Create or sign in to the Resend account that will own Dreamwish Wand transactional mail.
2. Add `dreamwishwand.com` as a sending domain.
3. Copy the exact DNS records shown by Resend into the authoritative DNS provider for
   `dreamwishwand.com`.
4. Do not invent or normalize record values. Use exactly the host/type/value Resend displays.
5. Wait until Resend marks the domain verified.
6. Preserve any pre-existing unrelated DNS/MX records. Do not replace existing mail configuration
   unless explicitly required by the provider and reviewed first.
7. Do not change DMARC policy blindly. If a DMARC record already exists, inspect it before editing.

The exact SPF/DKIM record values are provider-issued runtime configuration and are intentionally not
stored in the repo. Independent public-DNS re-resolution was not available from the current execution environment, so the evidence source is the Resend provider UI rather than a second resolver.

## Phase B — separate Resend credentials — COMPLETE

Create two separate credentials where the provider allows it:

1. `Dreamwish Wand Auth SMTP`
   - used only by Supabase Auth custom SMTP;
   - never exposed to Edge/browser code.

2. `Dreamwish Wand Ops Edge`
   - used only by `community-email-resend`;
   - HTTPS API credential.

Do not paste either credential into chat or commit them to the repo.

## Phase C — Supabase Auth SMTP

Configure staging Supabase Auth with:

- host: `smtp.resend.com`
- port: `465` for SSL, or `587` for STARTTLS if the dashboard/provider path requires it;
- username: `resend`
- password: dedicated `Dreamwish Wand Auth SMTP` credential;
- sender email: `no-reply@dreamwishwand.com`
- sender name: `Dreamwish Wand`

Keep:

- email/password sign-in enabled;
- email confirmation required;
- PKCE recovery enabled;
- Wand-side session controls unchanged.

After enabling custom SMTP, review the Supabase Auth email rate-limit configuration. Do not weaken
endpoint/IP abuse protections merely to increase throughput.

## Phase D — operator critical Edge secrets — COMPLETE

Configure only these server-side secrets for `community-email-resend`:

- `RESEND_API_KEY` = dedicated `Dreamwish Wand Ops Edge` credential;
- `DREAMWISH_OPERATOR_EMAIL` = operator normal mailbox.

The From address is fixed in code to `Dreamwish Wand Ops <ops@dreamwishwand.com>`.

No new relay secret is required. The internal
`community-ops-email -> community-email-resend` hop reuses the existing Vault-backed
`operations_escalation` worker token.

## Phase E — operator destination — COMPLETE

Configure the durable Operations escalation destination:

- channel: `operator_email`;
- endpoint: deployed `community-email-resend` Edge URL;
- authentication: existing Operations worker token forwarded internally;
- enabled only after Phase D is complete.

The persistent Operations Alert remains canonical. Email is only an external projection.

## Phase F — staging acceptance — OPS COMPLETE / AUTH PENDING

Auth path:

1. real browser signup;
2. receive verification mail from `no-reply@dreamwishwand.com`;
3. verify -> sign in;
4. start PKCE password recovery;
5. receive recovery mail;
6. complete recovery callback/password update;
7. confirm old/new session-cutoff behavior remains correct.

Operator path:

1. induce one safe critical Operations Alert;
2. confirm exactly one mail arrives from `ops@dreamwishwand.com`;
3. verify payload contains only minimized operational data;
4. acknowledge and resolve the canonical alert;
5. recur the same condition and confirm a new occurrence/new mail;
6. induce a controlled provider/delivery failure;
7. confirm canonical alert state remains and external delivery retries/dead-letters visibly;
8. confirm self-monitor alerts do not recurse into the same failed email path.

Community activity negative acceptance:

- Comment / Reply -> no email;
- Reaction -> no email;
- Follow -> no email;
- Save -> no email.

## Production hardening

Before public release:

- confirm sender reputation/deliverability;
- review bounce/complaint signals;
- review Auth email rate limits against expected launch traffic;
- move to an appropriate Resend plan if free-tier daily/monthly limits are insufficient;
- keep Auth and Ops credentials separate;
- rotate credentials without repository changes;
- retain the documented first-launch limitation that a Resend outage cannot notify through Resend.

No second independent alert channel is required for first launch under the current single-operator
non-life-safety/non-financial workload. Revisit this if operational criticality or staffing changes.
