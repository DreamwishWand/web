# Community Core provider cleanup queue/runtime evidence — 2026-09-30

Project: `dreamwish-wand-staging` / `ap-northeast-1`

Status:

- **CONFIRMED PASS** — database queue/claim/retry/dead-letter behavior.
- **CONFIRMED PASS** — Vault-authenticated Cron -> Edge worker invocation and idempotent provider cleanup completion.
- **IMPLEMENTED / CI-GREEN** — provider cleanup worker and operator setup.
- **PENDING** — deletion of an actually existing disposable Supabase Auth user and production dead-letter alerting/response policy.

## Purpose

Account tombstone deliberately separates immediate Wand-side deletion/de-identification from
provider-account cleanup.

The tombstone transaction:

1. immediately retires Wand AuthIdentity mappings;
2. advances the Wand session cutoff;
3. hides/tombstones public Community state;
4. removes private interaction state owned by the deleted account;
5. creates a private provider-cleanup job containing the original provider subject;
6. replaces public/community-facing provider subjects with tombstone identifiers.

Provider cleanup is therefore retryable and does not require retaining the original provider subject
in public Community tables.

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

All queue RPCs are revoked from `public`, `anon` and `authenticated` and granted only to
`service_role`.

## Real staging DB queue runtime

The queue test ran inside a transaction and rolled back the synthetic account/job afterward.

Confirmed:

1. first claim returned exactly one pending job;
2. a second lock token could not claim the already-processing job;
3. completion with the wrong lock token was rejected;
4. failed jobs became retryable after backoff;
5. the fifth failure moved the job to `dead_letter`;
6. the dead-letter job was no longer claimable.

All six logical checks passed.

## Vault-authenticated provider worker

Edge source:

`supabase/functions/community-auth/index.ts`

Deployed staging function:

`community-auth`

Scheduler/auth migrations:

- `supabase/migrations/20260930080000_community_core_v0_provider_cleanup_scheduler_auth.sql`
- `supabase/migrations/20260930080500_community_core_v0_provider_cleanup_scheduler_setup.sql`

Security boundary:

- the Edge function uses `withSupabase({ auth: 'none' })` only because its authentication is a
  dedicated worker credential rather than a user/API JWT;
- a 256-bit worker token is generated inside Postgres during environment setup;
- plaintext worker token is stored only in Supabase Vault;
- only SHA-256 token hash is stored in the private Community worker-auth table;
- Cron reads the token from Vault at invocation time and sends it in
  `x-community-worker-token`;
- the Edge function verifies the token through service-only
  `community_verify_worker_token` **before** claiming any cleanup job;
- missing/invalid worker token returns 401 and cannot enter queue processing;
- browser/user JWTs are not an alternate worker-auth path;
- only `provider='supabase'` is currently supported;
- provider operations use Supabase Auth Admin `getUserById` / `deleteUser`;
- a provider user already absent is treated as idempotent completion;
- failures are persisted through the queue fail RPC;
- response summaries do not echo the provider subject.

The Vault token itself has never been printed into the conversation, repository, evidence docs or
migration SQL.

## Cron configuration

Staging operator setup:

- Cron job: `community-provider-cleanup-every-minute`
- schedule: `* * * * *`
- worker URL and worker token are stored as named Vault secrets;
- scheduler invocation uses `pg_net`;
- the environment-specific setup function rotates the worker token whenever it is intentionally
  re-run and stores only its hash in Community state.

## Real Cron -> Edge -> queue runtime

A committed staging fixture used a deleted WandAccount plus a pending provider cleanup job whose
provider subject did not exist in Supabase Auth.

Observed runtime:

1. private scheduler invocation queued an HTTP request;
2. Edge log recorded `POST /functions/v1/community-auth -> 200`;
3. Vault worker-token verification updated `last_verified_at`;
4. worker claimed the pending job;
5. Auth Admin lookup confirmed the provider user was already absent;
6. worker completed the job idempotently;
7. job state became `completed` with `attempts=1`;
8. stored provider subject became `deleted:<cleanupJobId>`;
9. the next normal every-minute Cron invocation also returned HTTP 200;
10. fixture cleanup returned the temporary WandAccount and provider-cleanup rows to zero.

This confirms the production-shaped scheduler/auth/worker path without manufacturing a fake claim
that an existing Auth user was deleted.

## Remaining runtime closure

The following remain **PENDING**:

1. create a disposable real staging Supabase Auth user through the normal provider path;
2. tombstone its WandAccount through the deployed self-service deletion path;
3. allow the scheduled worker to process the resulting cleanup job;
4. confirm the actual Supabase Auth user is deleted;
5. confirm the cleanup job reaches `completed` and the stored provider subject is anonymized;
6. implement/verify production alerting and operator response for provider-cleanup `dead_letter`
   and scheduler health failures.

Do not mark provider-account deletion fully operational until the real existing-user deletion and
alerting path pass.
