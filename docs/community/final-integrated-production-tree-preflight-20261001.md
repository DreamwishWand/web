# Community final integrated production-tree preflight — 2026-10-01

Status: **STATIC INTEGRATION GUARD IMPLEMENTED / FINAL INTEGRATED TREE NOT YET BUILT**

## Why this exists

Community and WEP are intentionally separate workstreams, but production migration replay must come
from one reviewed final integrated tree.

A direct branch comparison shows that the branches have diverged from merge base
`cfda06eb904544bbfa5286c4eb61b5856dd3ea51`. This is expected, but it creates one concrete
production risk: WEP still carries an older Community migration snapshot while COMM carries later
operations/replay fixes.

This is not evidence that Git itself will necessarily produce a conflict. It is evidence that a
final content-level replay audit is mandatory.

## Confirmed migration hazards

At the audited checkpoints:

- COMM: `dev/community-core-v0-20260930@aaa20a29d7230862757ca32f2cabc3b209335909`;
- WEP: `dev/wep-v125@c396413dc349829bc91f89b397321de38b55a3ba`.

COMM has the canonical support-recovery migration at:

`20260930081600_community_core_v0_support_recovery_verification.sql`.

The WEP branch still contains the older duplicate-prefix path:

`20260930081500_community_core_v0_support_recovery_verification.sql`.

The final integrated tree must contain **81600 only**.

COMM also moved the one-time staging pg_net SQL out of the production migration chain into
`supabase/staging/`. The WEP branch still contains the historical copies under
`supabase/migrations/`.

The final integrated production migration chain must not contain:

- `20260930035820_community_staging_pg_net.sql`;
- `20260930040500_community_staging_remove_pg_net.sql`.

At the same time, final integration must include the three WEP Preset production migrations and the
new environment-aware Preset bucket resolver/functions.

## New verifier

`scripts/verify-community-integrated-production-tree.mjs`

Normal Community CI runs it without `--require-ready`.

On a Community-only branch it is allowed to report:

`integratedReady=false`

provided the tree is internally safe and explicitly declares that the Community branch alone is not
production-complete.

It fails normal CI if a **partial** WEP production integration is detected. This prevents a tree
where, for example, a WEP migration is copied without the matching resolver/functions.

For Release Candidate / production replay, run:

`npm run verify:community-integrated-tree -- --require-ready`

That mode requires all of the following together:

- unique production migration versions;
- no staging-only SQL under `supabase/migrations`;
- canonical support-recovery migration at 81600;
- obsolete 81500 support-recovery path absent;
- staging pg_net SQL retained only under `supabase/staging`;
- all three WEP Preset production migrations present;
- both WEP Preset Edge Functions present;
- shared WEP bucket resolver present;
- both functions actually use the resolver;
- no direct `const BUCKET = 'wand-preset-artifacts-staging'`;
- non-staging missing bucket fails closed;
- non-staging staging-bucket selection fails closed;
- production manifest requires `WEP_PRESET_ARTIFACT_BUCKET`;
- WEP production bucket blocker remains CLOSED;
- production replay remains pinned to `final-integrated-main`.

## Boundary

This verifier does not merge branches and does not decide conflict resolution automatically.

It does not create a production Supabase project, bucket, backup, branch or paid service.

It does not rerun Community browser acceptance, Preset retention E2E or Scene reuse acceptance.

Its purpose is to make an unsafe final source-tree composition fail before any production migration
replay is attempted.


## WEP migration baseline refresh / production bucket provisioning gap

Current WEP branch:
`dev/wep-v125@3684939a5c147430e6c41bedc6620c9b6f030b6d`.

**CONFIRMED STATIC — baseline migration consistency is improved:**

- canonical Community support-recovery migration `20260930081600` is present;
- obsolete `20260930081500` path is absent;
- one-time pg_net SQL is under `supabase/staging`, not `supabase/migrations`;
- all three WEP Preset production migrations remain present;
- both WEP Preset functions use the environment-aware bucket resolver.

**OPEN — production bucket provisioning migration:**

`supabase/migrations/20260930124055_wep_preset_artifact_storage_v0.sql`
still inserts the literal bucket:

`wand-preset-artifacts-staging`.

This means Edge runtime selection is production-safe, but a fresh production migration replay would
still create the staging-named bucket.

The final production tree must not do that.

Required WEP-side resolution:

- move staging bucket creation to staging-only provisioning; or
- otherwise make production bucket provisioning environment-specific;
- preserve the generic `preset_artifact_prepare` action-rate policy from the migration;
- do not use the staging bucket name in production.

The Community integrated-tree verifier now fails a fully integrated tree while that staging bucket
literal remains in the WEP production migration.

This does not reopen the already-confirmed Scene reuse or ArtifactBlob retention runtime semantics.
