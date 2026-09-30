# Community Core launch operations escalation policy — 2026-09-30

Status: **HIGH CONFIDENCE LAUNCH CONTRACT**

The internal `/community-ops/` console is necessary but is **not sufficient** for unattended
production operations.

## External escalation requirement

At public launch, **operator email** is the single required external notification channel for
**critical** persistent Operations Alerts. Discord/Slack are not launch channels.

Critical sources currently include:

- provider-cleanup dead letter;
- provider-cleanup scheduler/worker heartbeat stale or inactive;
- retention dead letter;
- retention scheduler/worker heartbeat stale or inactive.

The initial `outbox_dead_letter` alert remains warning severity; it is visible in Community Ops and
may be escalated externally by future policy.

## Implemented provider-neutral delivery boundary

The Community backend now has a provider-neutral external escalation worker and durable delivery
queue. This implementation is intentionally separate from provider selection.

- Critical alert delivery is keyed by `alert_id + occurrence + channel`.
- Reopening a previously resolved alert increments its occurrence, so recurrence produces a new
  external delivery instead of reusing a stale acknowledgment/delivery record.
- Delivery claims are concurrency-safe with `FOR UPDATE ... SKIP LOCKED`.
- Failed deliveries retry with bounded exponential backoff and dead-letter after 5 attempts.
- The worker authenticates with a dedicated Vault-backed worker token.
- The external HTTPS endpoint and optional bearer token are read through Vault-backed configuration;
  no provider credential is committed to the repository.
- The delivery subsystem is **disabled by default** until a real external destination has been
  configured and accepted.
- Staging worker scheduling is active and its dedicated worker heartbeat has been verified while the
  external destination remains disabled.
- The delivery subsystem has its own persistent Operations Alerts for delivery dead-letter and
  scheduler/worker heartbeat failure.
- Those self-monitor alerts are intentionally excluded from the same external delivery queue to
  prevent recursive escalation loops.
- Community Ops can list external delivery state and recent-auth requeue a dead-letter delivery only
  while its originating critical alert occurrence is still open/current.

This closes the provider-neutral transport contract, but **does not satisfy launch acceptance by
itself**. A real external channel still has to be configured and observed end-to-end.

## Data minimization

External escalation payloads contain only operational data needed to respond:

- schema/version identifier;
- alert ID;
- alert type;
- severity;
- occurrence number;
- first/last seen timestamp for the current occurrence;
- environment;
- instruction/path to the internal operations console.

Do not include:

- provider subject;
- email address;
- password/token;
- recovery reference;
- raw user report detail;
- media signed URLs;
- Wand/DDV private profile data.

## Provider boundary

The external channel is now fixed as normal transactional **email** to the operator's usual mailbox.
The email-delivery provider itself is not yet canonicalized.

Where practical, use the same transactional email provider selected for Supabase Auth and approved
Wizard transactional mail. Provider reuse must not merge data models: Wand persistent Operations
Alert state remains canonical and email remains a delivery projection.

Current provider evaluation favors services that offer both production SMTP and HTTPS APIs. Resend is
a leading candidate because it supports Supabase Auth integration, SMTP/API delivery, idempotency and
delivery observability, but provider selection is deliberately deferred until account/domain setup is
required.

A failure of the selected email provider cannot notify the operator through that same provider. That
blind spot is explicitly accepted for first launch: a second independent notification channel is not
launch-required for the current single-operator, non-life-safety/non-financial workload. Provider
failure remains durable/visible in Community Ops. A second channel or backup provider becomes a
hardening requirement if operational coverage, SLA or business criticality increases.

## Launch acceptance

Before public release:

1. configure one real transactional email provider and operator mailbox destination;
2. enable the operator-email delivery configuration using Vault/secret-held destination data;
3. induce a safe critical staging alert;
4. confirm one external delivery;
5. acknowledge the alert in Community Ops;
6. clear the condition and confirm auto-resolution;
7. induce the same condition again and confirm a new occurrence/new external delivery;
8. confirm no prohibited user/private data appears in the provider payload or provider logs used for
   acceptance evidence.

Backend transport, worker-health monitoring, dead-letter visibility, and reviewed retry are
**CONFIRMED** at the staging backend boundary. External escalation as a launch capability remains
**PARTIAL / launch-blocking** until a real provider/channel passes the end-to-end acceptance steps
above.
