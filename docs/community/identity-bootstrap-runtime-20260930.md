# Community Core identity bootstrap runtime evidence — 2026-09-30

Project: `dreamwish-wand-staging` / `ap-northeast-1`

Status:

- **CONFIRMED PASS** — first-time WandAccount/Creator bootstrap contract at the real staging DB boundary.
- **IMPLEMENTED / DEPLOYED** — `community-command` routes only `ensureAccountCreator` through the dedicated bootstrap authorizer.
- **PENDING** — normal browser/signup execution with a real end-user staging session.

## Problem found

A newly authenticated Supabase user had no WandAccount mapping yet.

The prior `community-command` flow called `community_authorize_session` before parsing the command.
That authorizer correctly requires an existing active WandAccount mapping, so a genuinely new user
could never reach `community_ensure_account_creator`.

Simply skipping authorization for `ensureAccountCreator` would have created a more serious issue:
a provider subject associated with account deletion or recovery could potentially create a fresh
WandAccount after its old mapping was retired/anonymized.

## Safe bootstrap contract

Migration:

`supabase/migrations/20260930081500_community_core_v0_safe_identity_bootstrap.sql`

New authorizer:

`community_authorize_identity_bootstrap(authSubject, issuedAt)`

Rules:

- no existing identity mapping:
  - bootstrap is allowed only when the provider subject is not retired/reserved/deletion-pending;
- existing active identity:
  - normal `community_authorize_session` and Wand session cutoff still apply;
- retired AuthIdentity:
  - bootstrap denied;
- provider subject present in pending/processing/dead-letter provider cleanup:
  - bootstrap denied;
- provider subject reserved by an open recovery case:
  - bootstrap denied;
- existing non-active/deleted WandAccount:
  - creation path fails closed.

`community_ensure_account_creator` repeats the same retired/deletion/recovery guards server-side so
the invariant is not dependent on the Edge adapter.

All bootstrap/ensure RPCs remain service-role-only.

## Real staging DB runtime

A transaction-scoped runtime test exercised the safe bootstrap contract and rolled back the fixtures.

Confirmed **10/10**:

1. completely new provider subject authorized in `bootstrap` mode;
2. new subject created exactly one active WandAccount/AuthIdentity + CreatorProfile;
3. subsequent authorization for the same active identity switched to `existing` mode;
4. existing identity respected the Wand session cutoff;
5. retired provider subject rejected by bootstrap authorization;
6. retired provider subject rejected by account creation;
7. provider subject pending deletion rejected by bootstrap authorization;
8. provider subject pending deletion rejected by account creation;
9. provider subject reserved by an open recovery case rejected by bootstrap authorization;
10. recovery-reserved provider subject rejected by account creation.

## Edge routing

`community-command` now parses/validates the command before Wand authorization.

- `ensureAccountCreator` -> `community_authorize_identity_bootstrap`
- every other Community command -> `community_authorize_session`

Actor identity remains the verified Supabase user subject from `ctx.userClaims.id`.
No client-supplied actor identity is accepted.

## Evidence boundary

This closes the database/Edge bootstrap deadlock and the deletion/recovery re-bootstrap safety gap.

It does not by itself prove public signup/browser onboarding UX. That remains part of the real
provider/browser VS-01 acceptance path.
