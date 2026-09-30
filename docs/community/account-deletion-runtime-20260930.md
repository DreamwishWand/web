# Community Core self-service account deletion runtime evidence — 2026-09-30

Project: `dreamwish-wand-staging` / `ap-northeast-1`

Status:

- **CONFIRMED PASS** — session-bound Wand-side account tombstone runtime.
- **CONFIRMED PASS** — actual deletion of an existing disposable Supabase Auth user by the scheduled provider-cleanup worker.
- **IMPLEMENTED / CI PASS** — JWT-authenticated self-service Edge/client/internal acceptance route.
- **PENDING** — execution through the real browser `/community-lab/account/` surface and final retention/purge policy.

## Runtime path

Self-service deletion is split into two stages:

1. immediate Wand-side tombstone/de-identification;
2. asynchronous provider-account cleanup through the private retry queue.

User-facing implementation:

- Edge: `supabase/functions/community-account/index.ts`
- client: `CommunityLabClient.deleteWandAccount()`
- internal acceptance route: `/community-lab/account/`

The Edge derives actor identity only from the verified JWT, requires exact `DELETE` confirmation,
forwards verified `session_id`, and invokes service-only `community_tombstone_account`.

## Session-bound recent-auth

Deletion does not trust refreshed JWT age as recent-auth proof.

The tombstone RPC requires:

- verified provider subject;
- verified provider `session_id`;
- JWT issued-at for normal Wand cutoff enforcement;
- provider session creation time inside the configured deletion recent-auth window.

Refreshing an old provider session cannot reset the window.

## Wand-side tombstone runtime

Transaction-scoped staging tests previously confirmed **8/8**:

1. stale provider session rejected;
2. fresh provider session tombstoned the WandAccount;
3. CreatorProfile anonymized;
4. AuthIdentity retired and public provider subject replaced by tombstone ID;
5. original provider subject retained only in private cleanup queue;
6. AccountDeletionEvent completed immediate deletion flags;
7. former provider subject immediately lost active WandAccount resolution;
8. repeat deletion failed closed.

## Safe first-time identity bootstrap dependency

The real provider deletion E2E exposed a bootstrap deadlock: a newly authenticated provider user had
no WandAccount mapping, but `community-command` previously required one before it could execute
`ensureAccountCreator`.

That is now fixed by the dedicated safe bootstrap contract in:

`docs/community/identity-bootstrap-runtime-20260930.md`

New subjects can bootstrap; active existing subjects still respect session cutoff; retired,
deletion-pending and open-recovery-reserved subjects fail closed.

## Actual existing-provider-user deletion E2E

A disposable **real Supabase Auth user** was created as an admin fixture because staging email
signup hit the provider email-rate limit. The fixture then used the normal user password-sign-in
path.

Confirmed sequence:

1. admin fixture created a confirmed disposable Supabase Auth user;
2. normal `signInWithPassword` produced a real provider user session;
3. deployed `community-command` safe bootstrap created WandAccount + CreatorProfile;
4. deployed `community-account` accepted exact `DELETE` and tombstoned the Wand account;
5. provider cleanup Cron was intentionally paused before the test;
6. immediately after Wand tombstone, the Supabase Auth user still existed;
7. cleanup job was `pending`, attempts `0`, WandAccount was `deleted`, public AuthIdentity was retired/tombstoned;
8. provider cleanup Cron was restored;
9. the next scheduled Cron run succeeded;
10. `community-auth` claimed the job and called Supabase Auth Admin deletion;
11. the Supabase Auth user no longer existed;
12. cleanup job became `completed`, attempts `1`;
13. private stored provider subject was replaced by `deleted:<cleanupJobId>`;
14. scheduler stale alert subsequently resolved after worker heartbeat recovery.

This is the required proof that the provider worker can delete an **actually existing** Auth user,
not only complete an already-absent subject idempotently.

## Fixture and secret cleanup

The temporary Auth E2E harness was immediately returned to a 410
`STAGING_E2E_DISABLED` function with JWT verification enabled.

Temporary E2E worker state was removed:

- temporary worker-auth row: 0;
- temporary Vault token: 0;
- temporary pg_net response bodies: 0.

The disposable provider user, AuthIdentity, CreatorProfile, Creator CommunityEntity, cleanup job,
DeletionEvent and test Outbox row were removed after verification.

One tombstoned WandAccount plus its one immutable `account.tombstoned` AuditEvent remain because
the production audit contract intentionally forbids deleting AuditEvent history and the AuditEvent
has a restrictive WandAccount foreign key. Immutability was **not** disabled to erase test history.

## Immediate deletion semantics

The tombstone transaction:

- marks WandAccount deleted;
- anonymizes CreatorProfile;
- marks Creator CommunityEntity deleted;
- hides/tombstones owned Community works;
- removes work discovery projections;
- anonymizes authored comments to `[deleted]`;
- removes private SavedItem / Follow / Reaction / NotificationDelivery state;
- removes Linked DDV Profile relations;
- cancels open recovery cases and removes verification references;
- retires AuthIdentity rows and advances Wand session cutoff;
- writes AccountDeletionEvent + immutable AuditEvent;
- queues provider-account deletion.

Published revisions, moderation/report history and audit history are not destructively cascaded.

## Browser/client behavior

After successful Wand tombstone, the staging client performs provider-global logout and clears its
tab-scoped local session.

The hidden `/community-lab/account/` route explains restricted retention and is absent from public navigation.

## Remaining closure

Backend/provider deletion is now CONFIRMED.

Still pending:

1. execute `/community-lab/account/` in an actual browser with a disposable staging user;
2. verify stale-session `RECENT_AUTH_REQUIRED` and fresh sign-in success through the browser route;
3. verify browser local/global session cleanup after successful deletion;
4. finalize restricted-retention and purge periods.

Normal public signup/browser onboarding remains separate VS-01 evidence because the staging email
provider rate limit prevented treating this E2E fixture as signup acceptance.

No password, JWT, refresh token, provider subject, email address, worker token or API secret is
recorded here.
