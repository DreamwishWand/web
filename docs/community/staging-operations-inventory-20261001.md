# Community Core staging operations inventory — 2026-10-01

Status: **CONFIRMED LIVE OBSERVATION / SECRET-FREE**

Machine-readable evidence: `ops/community-staging-operations-observed-20261001.json`.

This is a point-in-time observation of the live staging project. It is **not** a production template
and is **not** the migration source of truth.

## Project

- project: `dreamwish-wand-staging`
- ref: `ptpdoxhrqopvczpclcij`
- region: `ap-northeast-1`
- status: `ACTIVE_HEALTHY`
- PostgreSQL: 17.6.1.171
- Supabase development branches: 0

## Storage

Both observed buckets are private:

- `community-media-staging`
- `wand-preset-artifacts-staging`

The Preset bucket name remains staging-specific. WEP production bucket externalization is tracked
separately and remains an 02 WEP blocker.

## Scheduled operations

Seven expected Community Cron jobs are present and active:

- Community Operations Alert scan;
- Operations escalation alert scan;
- Operations external escalation worker;
- outbox processor;
- provider-account cleanup;
- retention alert scan;
- hourly retention worker.

The exact names/schedules are recorded in the machine-readable observation.

## Vault

Only secret **names** were queried. No secret values were read or recorded.

The seven expected worker/destination Vault names are present.

## Edge Functions

Twelve production-shaped Community/WEP functions are ACTIVE in staging.

Six acceptance/E2E-only functions also remain deployed in staging for historical acceptance
provenance. Every one was fetched and inspected from the live deployment.

**CONFIRMED:** all six are currently inert HTTP 410 stubs:

- `community-auth-acceptance`
- `community-auth-e2e`
- `community-e2e-once`
- `community-wep-retention-e2e`
- `wep-preset-flow-e2e`
- `wep-retention-e2e`

The two staging-only functions with `verify_jwt=false` also contain only the 410-disabled stub.
No acceptance harness was re-enabled for this audit.

These functions remain forbidden by the production function denylist. Their safe disabled staging
presence is evidence only and does not justify deploying them to production.

## Migration history

Supabase reports 55 applied migration-history entries in the staging database.

The live history intentionally differs from the canonical production replay chain. It contains:

- historical staging media-bucket setup;
- one-time staging `pg_net` enable/remove records;
- historical incremental fixes that were later normalized in repository source;
- three WEP Preset storage/access/retention migrations.

Therefore the live staging migration table is **not** the production migration SSoT.

Production must replay the reviewed migrations from **final integrated source-tree main** into a
distinct environment. It must not reproduce staging merely by copying the historical migration
versions/names shown by Supabase.

This distinction is especially important because the Community branch currently owns 51 reviewed
Community migration files while WEP still owns its Preset Storage/retention migration source until
final integration.

## Security Advisor

Current live result:

- one WARN: `auth_leaked_password_protection` — known/unavailable on the current plan;
- nine `rls_enabled_no_policy` INFO findings — the already-reviewed intentional server-only
  deny-all tables.

No new external security WARN appeared.

## Recovery significance

The observed inventory establishes what the staging system currently depends on, but restore
acceptance must reconstruct from reviewed source/configuration rather than clone staging state.

A future restore drill should compare:

- required production function allowlist;
- absence of staging-only functions;
- expected Cron inventory;
- expected Vault secret names without reading values;
- private Storage buckets;
- migration/source revision;
- Security Advisor;
- minimal Auth + publish/discover/read smoke.

## Evidence classification

**CONFIRMED**

- project health/region/Postgres version;
- no Supabase development branches;
- two private staging buckets;
- seven active Cron jobs;
- seven expected Vault secret names;
- live Edge inventory and function versions;
- all six staging-only acceptance functions are disabled 410 stubs;
- 55 staging migration-history entries;
- current Advisor WARN/INFO state.

**BOUNDARY**

This snapshot must not be promoted into a production replay recipe. Production remains gated by the
final integrated source tree, environment-specific bucket/configuration, restore/rotation drills and
the production readiness verifier.
