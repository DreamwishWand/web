# Community Core self-service account deletion runtime evidence — 2026-09-30

Project: `dreamwish-wand-staging` / `ap-northeast-1`

Status:

- **CONFIRMED PASS** — Wand-side account tombstone database runtime.
- **IMPLEMENTED / CI PASS** — JWT-authenticated self-service Edge/client/internal acceptance route.
- **PENDING** — browser execution with a disposable real staging Auth user and downstream provider-user deletion through the secret-only cleanup worker.

## Runtime path

Self-service deletion is split into two stages:

1. immediate Wand-side tombstone/de-identification;
2. asynchronous provider-account cleanup through the private retry queue.

The user-facing deletion request is handled by:

- Edge: `supabase/functions/community-account/index.ts`
- client: `CommunityLabClient.deleteWandAccount()`
- internal acceptance route: `/community-lab/account/`

The Edge boundary derives actor identity only from the verified JWT, requires an exact `DELETE`
confirmation, forwards the verified `session_id`, and invokes the service-only
`community_tombstone_account` RPC.

## Session-bound recent-auth

Deletion does not trust JWT age as recent-auth proof.

The tombstone RPC requires:

- verified provider subject;
- verified provider `session_id`;
- JWT issued-at for normal Wand cutoff enforcement;
- the provider session to have been created within the configured deletion recent-auth window.

Refreshing an old provider session cannot reset the recent-auth window.

## Real staging DB runtime

The staging test used synthetic Auth/session fixture rows inside a transaction and rolled back the
fixture after verification.

Confirmed 8/8:

1. a 30-minute-old provider session was rejected under the 15-minute staging deletion window;
2. a fresh provider session successfully tombstoned the WandAccount;
3. CreatorProfile was anonymized to a private `Deleted Creator` identity with no bio/avatar;
4. AuthIdentity was retired and its public/community provider subject was replaced by a tombstone ID;
5. the original provider subject was retained only in a private pending provider-cleanup job;
6. AccountDeletionEvent completed all immediate de-identification/access-revocation flags;
7. the former provider subject immediately lost active WandAccount resolution;
8. repeated deletion failed closed because no active Wand identity mapping remained.

The transaction was rolled back; no synthetic fixture remained.

## Immediate deletion semantics

The current tombstone transaction:

- marks WandAccount deleted;
- anonymizes CreatorProfile;
- marks the Creator CommunityEntity deleted;
- hides/tombstones owned Community works;
- removes work discovery projections;
- anonymizes authored comments to `[deleted]`;
- removes SavedItem / Follow / Reaction / NotificationDelivery private state owned by the account;
- removes Linked DDV Profile relations;
- cancels open recovery cases and removes verification references;
- retires AuthIdentity rows and advances their Wand session cutoff;
- writes AccountDeletionEvent + AuditEvent;
- queues provider-account deletion in the private provider cleanup queue.

Published revisions, moderation/report history and audit history are not destructively cascaded.

## Browser/client behavior

After a successful Wand tombstone, the staging client performs provider-global logout and removes
its local tab-scoped session.

The internal `/community-lab/account/` route is intentionally absent from public navigation and
states the current restricted-retention boundary explicitly.

## Remaining closure

Do not mark end-to-end account deletion operationally complete until all of these pass:

1. run `/community-lab/account/` with a disposable real staging user;
2. verify stale-session `RECENT_AUTH_REQUIRED` and fresh sign-in success through the deployed Edge;
3. verify browser session/local state is removed after success;
4. invoke `community-auth` through the intended secret/scheduler path;
5. confirm the actual Supabase Auth user is deleted;
6. confirm the private cleanup job reaches `completed` and its stored provider subject is anonymized;
7. verify scheduler retry/dead-letter alerting;
8. finalize restricted-retention and purge periods.

No password, JWT, refresh token, provider subject, signed URL or secret key is recorded here.
