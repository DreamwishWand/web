# Community Core production operations / backup & recovery — 2026-10-01

Status: **IMPLEMENTED CONTRACT / PRODUCTION ENVIRONMENT + RESTORE DRILL PENDING**

Machine-readable contract: `ops/community-production-operations.json`.

## Current observed environment

**CONFIRMED**

- Supabase project: `dreamwish-wand-staging`.
- Project ref: `ptpdoxhrqopvczpclcij`.
- Region: `ap-northeast-1`.
- Organization plan: **Free**.
- Supabase development branches: none.
- Current staging Storage buckets are private:
  - `community-media-staging`;
  - `wand-preset-artifacts-staging`.
- Current staging has the expected Community outbox/provider-cleanup/retention/Operations Alert Cron jobs and Vault worker configuration.
- Security Advisor after current Auth hardening has exactly one known external WARN: unavailable leaked-password protection.

This staging project is not a production recovery environment.

## Release environment invariant

Public launch must use a production Supabase project that is distinct from staging.

The production project ref must never equal `ptpdoxhrqopvczpclcij`. Staging-only acceptance functions and staging bucket names must not be deployed as production surfaces.

A production project is not created by this checkpoint. Project/branch creation can have cost implications and is therefore a separate operator decision.

## Database backup boundary

Supabase currently documents managed daily backups for Pro, Team and Enterprise projects. Free projects are instructed to perform regular logical exports and retain off-site copies.

Therefore the launch gate is:

- production must have managed daily backup **or** a verified equivalent off-site logical backup process;
- maximum engineering RPO target: **24 hours**;
- pre-deployment backup is mandatory before a destructive or effectively irreversible migration;
- a backup existing is insufficient: a restore drill must pass.

PITR is optional rather than a launch requirement at the current scale. If later enabled, its cost and recovery window are a separate operator decision.

## Storage object boundary

A Supabase database backup contains Storage metadata, not the Storage object bytes themselves.

Community launch therefore requires a separate backup/recovery path for:

- Gallery media objects;
- Wand Preset artifact blobs.

Maximum engineering Storage RPO target: **24 hours**.

A successful database restore does not satisfy Storage recovery acceptance.

## Restore acceptance

Target engineering RTO: **4 hours**.

A production restore drill must restore into a non-production target first and verify, at minimum:

1. schema/migration state;
2. WandAccount/AuthIdentity/CreatorProfile relationships;
3. CommunityWork and immutable revision relationships;
4. SavedItem/Follow/Reaction/Comment cardinality invariants;
5. Report/Moderation/Audit history;
6. SearchDocument rebuild/convergence;
7. retention/provider-cleanup/outbox queues;
8. Storage metadata and actual media/artifact object bytes;
9. signed media/artifact read path;
10. Edge Function deployment inventory;
11. Cron inventory;
12. Vault secret-name inventory without disclosing values;
13. Auth sign-in with a dedicated recovery fixture account;
14. one publish -> discover -> save/read smoke;
15. Security Advisor.

Restore testing must not use real user passwords, provider tokens, or production-only secret values in repository fixtures.

## Migration / rollback policy

`supabase/migrations` is the schema source of truth.

Production rules:

- no ad-hoc/direct production DDL as a normal deployment path;
- all durable schema changes are migrations;
- forward-fix is the default rollback strategy for a committed compatible migration;
- full restore is reserved for data loss, corruption, or a non-reversible deployment failure;
- migrations that delete/transform user data require an explicit pre-deployment backup and recovery plan;
- migration rollback must not silently revert immutable publication/audit history.

The current staging database contains the Community migration chain through WEP Preset retention integration. Exact migration versions remain environment evidence; the repository migration source is the durable implementation contract.

## Edge Function promotion policy

Production allowlist is machine-readable in the operations manifest.

Acceptance/test-only functions must be absent from production, including:

- `community-auth-acceptance`;
- `community-auth-e2e`;
- `community-e2e-once`;
- `community-wep-retention-e2e`;
- `wep-preset-flow-e2e`;
- `wep-retention-e2e`.

Production deployment is fail-closed if an unreviewed function is present or an allowlisted required function is missing.

## Cron and worker recovery

The following classes are production-critical:

- outbox processing;
- provider cleanup;
- retention processing;
- retention alerting;
- Operations Alert generation;
- external escalation;
- external-delivery worker/self-monitoring.

After restore or project recreation, Cron jobs are not assumed healthy merely because tables/functions exist. Inventory and one safe worker heartbeat must be verified before reopening Community writes.

## Secrets / Vault rotation

Secret **names** may be documented. Secret **values** must never enter Git history, runtime evidence, screenshots intended for publication, or test fixtures.

Current required Vault names are recorded in the machine-readable manifest.

Current required Edge secret names include:

- `RESEND_API_KEY`;
- `DREAMWISH_OPERATOR_EMAIL`.

Launch requires one controlled rotation drill that proves:

1. new secret is installed;
2. dependent worker/function succeeds;
3. old secret is invalidated where provider semantics allow;
4. no user-visible canonical state is lost;
5. Operations Alerts remain available during the transition.

Do not rotate all independent worker credentials simultaneously.

## Environment separation

Staging and production must have separate:

- Supabase project refs;
- publishable keys;
- server/Vault secrets;
- Storage buckets;
- Auth users/sessions;
- operational fixtures;
- acceptance-only Edge Functions.

No staging user or staging Storage object is promoted as production data.

Community local-save editing remains independent of Community backend availability.

## Incident recovery order

For a database or deployment incident:

1. stop or fail closed affected Community writes;
2. preserve evidence and current backup/object snapshots;
3. classify whether the incident is code-only, database state, Storage bytes, Auth, secrets, or provider outage;
4. prefer code rollback/forward-fix when persistent data is sound;
5. use restore only when state integrity requires it;
6. restore DB and Storage as separate assets;
7. re-establish reviewed Edge Functions, Cron and Vault configuration;
8. run integrity queries and a minimal product smoke;
9. run Security Advisor;
10. reopen writes only after the recovery checklist passes.

Do not take local DDV save editing offline solely because Community recovery is in progress.

## CI guard

`npm run verify:community-ops` validates the machine-readable contract.

Normal CI verifies that the contract remains internally consistent while allowing
`production.launchReady=false` before production exists.

The release/production gate must run:

`npm run verify:community-ops -- --require-ready`

which intentionally fails until the production project and restore/rotation evidence have been completed and the manifest is explicitly promoted.

## Evidence classification

**CONFIRMED**

- staging project/region/Free plan;
- no Supabase development branch currently exists;
- current staging bucket names;
- current production-shaped Cron/Vault dependency names;
- current active Edge Function inventory;
- Free-plan backup limitation from current Supabase documentation;
- database backups do not contain Storage object bytes.

**HIGH CONFIDENCE ENGINEERING DEFAULT**

- DB RPO <=24h;
- Storage RPO <=24h;
- target RTO <=4h;
- distinct staging/production projects;
- restore-to-non-production-first.

**PENDING / RELEASE BLOCKER**

- production Supabase project selection/creation;
- production backup mechanism selection;
- actual database restore drill;
- actual Storage restore drill;
- controlled secret rotation drill;
- production function/Cron/Vault inventory acceptance;
- final production smoke and Advisor capture.

No production environment, paid plan, Supabase branch, backup add-on or PITR add-on was created by this checkpoint.
