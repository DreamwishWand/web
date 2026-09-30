# Community Ops v0 — internal moderation, support and operations console

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
- Moderation case review requires moderator or admin role.
- Moderation restrict/remove/restore requires moderator or admin role + session-bound recent-auth.
- Other read-only admin operations require admin role.
- Recovery open/verify/complete and provider-cleanup dead-letter requeue require admin role + recent
  provider session.
- No service-role/secret credential is present in browser source.
- Recovery/provider cleanup listings intentionally omit provider subjects.
- Recovery listing exposes only whether a verification reference exists, not its value.

## Supported operations

### Moderation queue

Read:

- list open/reviewing/resolved/closed ModerationCase rows;
- show target work state and report reason/detail needed for review;
- show prior moderation actions;
- deliberately omit reporter WandAccount identity.

Write:

- restrict;
- remove;
- restore.

Writes require moderator/admin role plus the 900-second moderation recent-auth window. The resulting
action remains audited. When an Ops moderation action resolves a case, linked open/triaged Reports
are closed in the same staff operation so stale reports do not indefinitely block retention.

A third-party automated moderation provider is not required for first launch. Manual report -> case
review -> reversible action is the launch baseline.

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
  - verification method;
  - **opaque external verification reference**;
  - support reason;
- verify the pending case explicitly after reviewing the evidence reference;
- complete only a verified/ready case.

Launch support recovery currently permits only `provider_recovery`.
`linked_ddv_profile` remains disabled until CORE confirms a stable DDV Profile claim/binding
contract. Public Creator information, screenshots and other publicly observable data are not
accepted as strong proof by this contract.

The underlying recovery invariant remains:

- same WandAccount;
- same CreatorProfile/content ownership graph;
- old AuthIdentity retired;
- new verified AuthIdentity becomes active;
- unverified completion rejected;
- replay/non-open completion rejected;
- provider subject + verification reference scrubbed after successful completion;
- open / verify / complete are all audited.

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

Launch policy is **900 seconds / 15 minutes** for support/admin high-risk writes, moderator/admin
moderation actions, and self-service account deletion. These remain configuration-driven but are now
canonical launch defaults rather than unresolved staging values.

A refreshed JWT from an old provider session does **not** satisfy recent-auth. When an operation
returns `RECENT_AUTH_REQUIRED`:

1. sign out the current provider session;
2. sign in again with the operator's credentials;
3. retry the high-risk operation.

The threshold remains configuration-driven for future change, but the first-launch default is now
finalized at 900 seconds.

## Runtime evidence still needed

With one disposable staging admin and one disposable target account:

1. sign in to `/community-ops/`;
2. load recovery cases;
3. open a `provider_recovery` case after external verification and supply only an opaque evidence reference;
4. confirm the listing omits provider subject and verification-reference value;
5. attempt completion before verification and require rejection;
6. verify the case through the explicit Verify action;
7. complete the verified case and verify target ownership remains stable;
8. create or use a provider-cleanup dead-letter fixture;
9. list and requeue it through the UI;
10. list/requeue an outbox dead-letter fixture;
11. load Operations Alerts and confirm the expected dead-letter alert appears;
12. acknowledge an open alert and confirm it moves to `acknowledged`;
13. clear/requeue the underlying condition and confirm the alert auto-resolves;
14. wait beyond the recent-auth window or use an old session and confirm high-risk write rejection;
15. sign out/sign in and confirm the same operation is accepted;
16. load a moderation case, confirm reporter identity is omitted, and apply a reversible moderation action;
17. confirm linked Reports close and the action is audited;
18. load Security Policy and confirm all three launch recent-auth windows are 900 seconds and are
    session-bound to `auth.sessions.created_at`;
19. capture only opaque actor labels and Community IDs.

Never record passwords, JWTs, refresh tokens, provider subjects, recovery codes, verification
artifacts, API secrets or signed URLs in evidence docs.

## Current boundary

Backend/RPC behavior is CONFIRMED in staging, including the recovery Open → Verify → Complete
state machine (8/8), sensitive recovery-field redaction/scrub, persistent operations-alert detection,
acknowledgment, audit, auto-resolution and recurrence reopening. The internal UI + Edge boundary are
implemented and CI-green. Browser/operator runtime acceptance is still pending. Detailed alert
evidence: `docs/community/operations-alerts-runtime-20260930.md`.


## Unified browser/operator acceptance

The execution order and secret-free evidence contract for normal signup/recovery, A -> B ->
Moderator, operator support, self-service deletion and operator critical email are canonicalized in:

`docs/community/browser-operator-acceptance-runbook-20260930.md`
