# Community Ops v0 — internal support and dead-letter console

Internal route: `/community-ops/`

This route is intentionally absent from public Dreamwish Wand navigation. It is for staging/support
operations only.

## Security boundary

- Browser uses only Supabase project URL + publishable key.
- Operator identity comes from a verified Supabase Auth user JWT.
- `community-admin` is JWT-required.
- Actor identity is always `ctx.userClaims.id`.
- High-risk admin writes also require verified `jwtClaims.session_id`.
- Server-side RPCs bind recent-auth to `auth.sessions.created_at`; JWT refresh does not reset the
  recent-auth window.
- Read-only admin operations require admin role.
- Recovery open/complete and provider-cleanup dead-letter requeue require admin role + recent
  provider session.
- No service-role/secret credential is present in browser source.
- Recovery/provider cleanup listings intentionally omit provider subjects.
- Recovery listing exposes only whether a verification reference exists, not its value.

## Supported operations

### Recovery cases

Read:

- list all/open/completed/rejected/cancelled recovery cases;
- return case ID, WandAccount ID, state, provider type, reason, timestamps and
  `verificationRefPresent`;
- do not return requested provider subject or verification-reference value.

Write:

- open a support-assisted recovery case with:
  - target WandAccount ID;
  - new provider type;
  - newly verified provider subject;
  - support reason;
  - optional verification reference;
- complete an open recovery case by case ID + completion reason.

The underlying recovery invariant remains:

- same WandAccount;
- same CreatorProfile/content ownership graph;
- old AuthIdentity retired;
- new verified AuthIdentity becomes active;
- replay/non-open completion rejected;
- privileged actions audited.

### Provider cleanup queue

Read:

- pending;
- processing;
- completed;
- dead_letter.

The admin listing exposes operational fields only and never provider subject.

Write:

- requeue a `dead_letter` job after review;
- attempts reset to zero;
- lock/dead-letter state cleared;
- action audited.

Actual provider deletion remains the job of the secret-only `community-auth` worker.

### Outbox dead letters

Read:

- dead-lettered outbox events through the existing staff-only query.

Write:

- reviewed event can be requeued with mandatory reason;
- existing audit path remains authoritative.

### Operations alerts

Persistent alert sources:

- provider-cleanup job reaches `dead_letter`;
- Community outbox event reaches dead-letter state;
- provider-cleanup scheduler/worker heartbeat becomes stale or inactive.

Alert states:

- `open`;
- `acknowledged`;
- `resolved`.

Behavior:

- conditions are refreshed every minute by `community-operations-alerts-every-minute`;
- underlying recovery auto-resolves the alert;
- recurrence reopens a clean incident under the same dedupe key;
- operator acknowledgment requires admin role + session-bound recent-auth;
- acknowledgment is audited;
- provider subjects and worker/Vault secrets never appear in alert metadata or operator responses.

## Recent-auth procedure

Current staging admin policy is 900 seconds.

A refreshed JWT from an old provider session does **not** satisfy recent-auth. When an operation
returns `RECENT_AUTH_REQUIRED`:

1. sign out the current provider session;
2. sign in again with the operator's credentials;
3. retry the high-risk operation.

The production threshold remains configuration-driven and is not finalized by this runbook.

## Runtime evidence still needed

With one disposable staging admin and one disposable target account:

1. sign in to `/community-ops/`;
2. load recovery cases;
3. open a recovery case after external verification;
4. confirm the listing omits provider subject and verification-reference value;
5. complete the case and verify target ownership remains stable;
6. create or use a provider-cleanup dead-letter fixture;
7. list and requeue it through the UI;
8. list/requeue an outbox dead-letter fixture;
9. load Operations Alerts and confirm the expected dead-letter alert appears;
10. acknowledge an open alert and confirm it moves to `acknowledged`;
11. clear/requeue the underlying condition and confirm the alert auto-resolves;
12. wait beyond the recent-auth window or use an old session and confirm high-risk write rejection;
13. sign out/sign in and confirm the same operation is accepted;
14. capture only opaque actor labels and Community IDs.

Never record passwords, JWTs, refresh tokens, provider subjects, recovery codes, verification
artifacts, API secrets or signed URLs in evidence docs.

## Current boundary

Backend/RPC behavior is CONFIRMED in staging, including persistent operations-alert detection,
acknowledgment, audit, auto-resolution and recurrence reopening. The internal UI + Edge boundary are
implemented and CI-green. Browser/operator runtime acceptance is still pending. Detailed alert
evidence: `docs/community/operations-alerts-runtime-20260930.md`.
