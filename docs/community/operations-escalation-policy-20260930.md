# Community Core launch operations escalation policy — 2026-09-30

Status: **HIGH CONFIDENCE LAUNCH CONTRACT**

The internal `/community-ops/` console is necessary but is **not sufficient** for unattended
production operations.

## External escalation requirement

At public launch, at least one external operator notification channel must be configured and tested
for **critical** persistent Operations Alerts.

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

The external channel provider is not yet selected. Email, an incident-management service or another
operator channel may satisfy the contract.

Selection must not change the canonical Operations Alert table/state machine. The provider adapter
consumes the alert state; it does not become the source of truth.

## Launch acceptance

Before public release:

1. configure one real external channel;
2. enable the provider-neutral delivery configuration using Vault-held destination data;
3. induce a safe critical staging alert;
4. confirm one external delivery;
5. acknowledge the alert in Community Ops;
6. clear the condition and confirm auto-resolution;
7. induce the same condition again and confirm a new occurrence/new external delivery;
8. confirm no prohibited user/private data appears in the provider payload or provider logs used for
   acceptance evidence.

Until these steps pass, external escalation remains **PARTIAL / launch-blocking** even though the
backend transport substrate is implemented.
