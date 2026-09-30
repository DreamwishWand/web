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

## Data minimization

External escalation payloads must contain only operational data needed to respond, for example:

- alert ID;
- alert type;
- severity;
- first/last seen timestamp;
- staging/production environment;
- link or instruction to open the internal operations console.

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

1. configure one external channel;
2. induce a safe critical staging alert;
3. confirm one external delivery;
4. acknowledge the alert in Community Ops;
5. clear the condition and confirm auto-resolution;
6. confirm recurrence creates a new escalation rather than inheriting stale acknowledgment.
