# Community Core provider cleanup queue/runtime evidence — 2026-09-30

Project: `dreamwish-wand-staging` / `ap-northeast-1`

Status:

- **CONFIRMED PASS** — database queue/claim/retry/dead-letter behavior.
- **HIGH CONFIDENCE / IMPLEMENTED** — secret-only Edge worker is deployed and CI-green.
- **PENDING** — real provider-user deletion through the worker and production scheduler invocation.

## Purpose

Account tombstone deliberately separates Wand-side deletion/de-identification from provider-account cleanup.

The tombstone transaction:

1. immediately retires Wand AuthIdentity mappings;
2. advances the Wand session cutoff;
3. hides/tombstones public Community state;
4. removes private interaction state owned by the deleted account;
5. creates a private provider-cleanup job containing the original provider subject;
6. replaces public/community-facing provider subjects with tombstone identifiers.

Provider cleanup is therefore retryable and does not require retaining the original provider subject in public Community tables.

## Queue hardening

Migration:

`supabase/migrations/20260930074500_community_core_v0_provider_cleanup_worker_queue.sql`

State machine:

`pending -> processing -> completed | dead_letter`

Concurrency / recovery controls:

- claim uses `FOR UPDATE SKIP LOCKED`;
- every claim carries a random lock token;
- a second worker cannot claim a currently-processing job;
- a processing lock older than 5 minutes is reclaimable;
- completion/failure requires the matching lock token;
- failure applies exponential retry backoff;
- the fifth failed processing attempt transitions the job to `dead_letter`;
- completed jobs anonymize their stored provider subject.

All queue RPCs are revoked from `public`, `anon` and `authenticated` and granted only to `service_role`.

## Real staging DB runtime

The test ran inside a transaction and rolled back the synthetic account/job afterward.

Confirmed:

1. first claim returned exactly one pending job;
2. a second lock token could not claim the already-processing job;
3. completion with the wrong lock token was rejected;
4. failed jobs became retryable after backoff;
5. the fifth failure moved the job to `dead_letter`;
6. the dead-letter job was no longer claimable.

All six logical checks passed.

## Secret-only provider worker

Edge source:

`supabase/functions/community-auth/index.ts`

Deployed staging function:

`community-auth`

Security boundary:

- function uses `withSupabase({ auth: 'secret' })`;
- deployment uses `verify_jwt=false` because Supabase secret API keys are not user JWTs;
- browser/user JWTs do not satisfy the worker auth mode;
- the worker claims jobs through the service-only claim RPC;
- only `provider='supabase'` is currently supported;
- it uses Supabase Auth Admin `getUserById` / `deleteUser`;
- a provider user already absent is treated as idempotent completion;
- failures are persisted through the queue fail RPC;
- response summaries do not echo the provider subject.

CI for commit `06d6048d8fbcb8cd8cd95a586cf5069c772da728` passed type/component checks, contract tests and static build.

## Remaining runtime closure

The following remain intentionally **PENDING**:

1. create a disposable real staging Auth user;
2. tombstone its WandAccount so a real provider-cleanup job is queued;
3. invoke `community-auth` through the production secret-auth path;
4. confirm the Supabase Auth user is actually deleted;
5. confirm the job transitions to `completed` and no original provider subject remains;
6. configure/verify the production scheduler or operations trigger that invokes the worker;
7. verify alerting/manual review for provider-cleanup `dead_letter` jobs.

Do not mark provider cleanup operationally complete until those steps pass.
