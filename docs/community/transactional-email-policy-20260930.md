# Community Core transactional email policy — 2026-09-30

Status: **HIGH CONFIDENCE LAUNCH CONTRACT**

## Separation of concerns

Dreamwish Wand uses three separate email purposes:

1. **Auth-provider email**
   - email verification;
   - password recovery.

2. **Wizard transactional email**
   - important security notices;
   - important moderation notices;
   - Wand Cloud purchase notices;
   - Gift notices.

3. **Operator-only Operations email**
   - critical persistent Community Operations Alerts.

These surfaces must not share product semantics merely because they use the same delivery provider.

## Community activity is in-app only

Normal Community activity is **not** an email channel at launch:

- Comment / Reply;
- Reaction;
- Follow;
- Save;
- normal publication/activity fan-out.

These remain Wand notification/inbox experiences. Adding an in-app NotificationDelivery must not
implicitly create an email delivery.

## Operator Critical Alert contract

The canonical record remains `private.community_operations_alerts` plus its durable delivery state.
Email is only an external delivery channel.

- A failed email does not delete, resolve or replace the canonical Operations Alert.
- Delivery remains occurrence-keyed so retries/reopens cannot silently collapse distinct incidents.
- The operator recipient address is configuration/secret material and must not be committed to the
  repository or exposed through Community APIs.
- API keys, SMTP credentials, relay tokens and equivalent secrets stay in Vault/provider secret
  storage.
- The external transport channel is `operator_email`, not Discord/Slack/community notification.
- The email relay receives only minimized operational data; private Wizard/DDV/provider data is
  prohibited.

## Shared transactional provider

Where practical, the same transactional email provider should serve:

- Supabase Auth verification/recovery;
- approved Wizard transactional email;
- operator critical Operations email.

This is a provider reuse decision, not a data-model merge. Auth tokens/recovery payloads remain owned
by Supabase Auth; Wizard notification policy remains separate; operator alerts remain canonical in
the Operations Alert substrate.

Supabase production Auth must use a production email provider rather than the default testing sender.
The preferred integration shape is either custom SMTP or the Send Email Auth Hook. A provider that
offers both SMTP and an HTTPS API reduces operational duplication.

## Provider outage boundary

A failure of the transactional email provider cannot reliably notify the operator through that same
provider. Dreamwish Wand therefore:

- records provider/relay send failures in the existing durable external-delivery state;
- surfaces dead-letter and worker-health failures in Community Ops;
- excludes those self-monitor alerts from the same email delivery path to prevent recursive failure
  loops;
- preserves the canonical alert even when no external message arrives.

A second independent notification channel is **not a first-launch requirement** for the current
single-operator, non-life-safety/non-financial Operations workload. Email-only launch is acceptable
provided the internal canonical alert/queue remains durable and provider status can be checked
independently. A second channel or secondary email provider becomes a hardening item if operator
coverage expands, incident volume increases, or an SLA/business-critical requirement appears.

## Provider selection boundary

The first-launch provider default is now **Resend**, with activation still pending sender-domain and secret configuration. The selection favors a transactional provider that supports:

- production SMTP for Supabase Auth or a supported Send Email Hook/API;
- HTTPS transactional API for Wand/operator mail;
- domain authentication;
- idempotent send semantics or equivalent duplicate protection;
- delivery/bounce/failure observability;
- secret rotation without repository changes.

Resend is isolated behind the provider adapter documented in `docs/community/transactional-email-provider-resend-20260930.md`; the canonical Operations Alert/delivery queue remains provider-neutral.

No provider API key, SMTP password, operator recipient address or verified-domain credential may be
placed in chat, source control or public configuration.

## Launch acceptance

Before launch:

1. configure the selected Resend transactional email provider;
2. verify the sending domain;
3. configure Supabase Auth production email delivery;
4. store operator recipient and provider/relay secrets outside the repository;
5. enable `operator_email` delivery;
6. induce a safe critical staging alert and confirm one email reaches the operator mailbox;
7. clear and recur the condition and confirm a new occurrence/new email;
8. test a controlled email-delivery failure and confirm the alert remains canonical and the delivery
   failure/dead-letter remains visible in Community Ops;
9. confirm Comment/Reaction/Follow/Save do not produce email.
