# Community Production Execution Runbook — 2026-10-02

Status: **RESOURCE DECISION CLOSED / PROVISION AT RELEASE STAGE / NO PRODUCTION RESOURCE CREATED**

Machine checklist:
`ops/community-production-execution-checklist-20261002.json`.

This runbook closes everything that can be prepared without creating or paying for production
resources. It does not authorize a production project, paid plan, PITR or backup provider.

## 1. Source freeze and final integration

Production replay source is **final-integrated-main only**.

Review-base / observed heads used for this readiness audit:

- Community review base: `8a25e6cf99e00ca56f3bd359d5560a2e6859c1c3`;
- WEP: `424116bba04be06454db32a422afaeba6e2b0044`;
- merge base: `cfda06eb904544bbfa5286c4eb61b5856dd3ea51`.

These values are evidence baselines, not a production replay pin. Production must record the later accepted `final-integrated-main` SHA.

WEP changes since Community's previous `ba55070f...` observation are Road/Fence, editor,
full-design/preflight and blocker-message work. No Community publication/signed-read/retention/Edge
contract changed, so no closed Community suite is reopened.

When Release Control creates the final integrated tree, pin one exact commit and run:

```bash
npm ci
npm run check
npm test
npm run verify:community-integrated-tree -- --require-ready
npm run verify:community-ops
npm run build
```

Do not proceed to any Supabase production replay unless all pass.

### Integrated-tree invariants

The final tree must have:

- canonical support recovery migration `20260930081600`;
- no obsolete `20260930081500` support-recovery path;
- staging pg_net SQL only under `supabase/staging`;
- all three WEP Preset production migrations;
- WEP Preset artifact/retention functions plus shared bucket resolver;
- no production migration creating `wand-preset-artifacts-staging`;
- current 7-day content-retention migration;
- current single 90-day operational-retention migration;
- current Product approval / Privacy-Legal pending contracts.

Never replay production from either workstream branch alone or from live staging migration history.

## 2. Production resource decision — CLOSED

Owner decision on 2026-10-02:

- **Supabase Pro** is approved for the production backend;
- **Cloudflare R2 Standard** is approved for the independent private Storage recovery copy;
- provisioning is deferred until the **release stage**;
- PITR remains **not required at launch** under the current <=24h RPO contract.

This closes provider/plan selection. It does not create runtime evidence.

Decision record:

- `ops/community-production-resource-decision-20261002.json`
- `docs/community/production-resource-decision-20261002.md`

No production Supabase project, paid plan, R2 bucket, production secret or external production
resource exists yet.

## 3. Production project provisioning protocol

At the release stage, after Release Control authorizes provisioning:

1. create a **distinct** production Supabase project; never convert/reuse staging;
2. target `ap-northeast-1` unless the owner deliberately changes region;
3. record production project ref in machine evidence;
4. set `DREAMWISH_ENVIRONMENT` for production;
5. configure a production `COMMUNITY_MEDIA_BUCKET`;
6. configure a production `WEP_PRESET_ARTIFACT_BUCKET`;
7. bucket names must not be the staging names;
8. both buckets must remain private;
9. use a production publishable key in public browser config;
10. generate new production-only tokens/secrets.

Do not copy staging secret values.

## 4. Fresh migration replay

Replay from the pinned final-integrated-main working tree only.

Rules:

- production DDL changes are migration-only;
- do not execute `supabase/staging` SQL;
- do not reproduce staging's historical migration table;
- do not seed staging fixtures;
- fail on duplicate migration version;
- record exact source commit + exact applied migration list;
- after replay, inspect schema and migration history before deploying public traffic.

A fresh target has no need to import staging data.

## 5. Edge Function deployment

### Production allowlist

Deploy only:

- `community-account`
- `community-admin`
- `community-auth`
- `community-command`
- `community-email-resend`
- `community-media`
- `community-ops-email`
- `community-ops-escalation`
- `community-query`
- `community-retention`
- `wep-preset-artifact`
- `wep-preset-retention`

### Production denylist

The following staging/acceptance slugs must be absent:

- `community-auth-acceptance`
- `community-auth-e2e`
- `community-e2e-once`
- `community-wep-retention-e2e`
- `wep-preset-flow-e2e`
- `wep-retention-e2e`

Production validation is an **inventory comparison**, not another acceptance-suite rerun.

## 6. Cron inventory

Production must provision exactly the reviewed Community scheduled responsibilities:

| Job | Schedule |
| --- | --- |
| community-operations-alerts-every-minute | `* * * * *` |
| community-operations-escalation-alerts-every-minute | `* * * * *` |
| community-operations-escalation-every-minute | `* * * * *` |
| community-outbox-every-minute | `* * * * *` |
| community-provider-cleanup-every-minute | `* * * * *` |
| community-retention-alerts-every-minute | `* * * * *` |
| community-retention-hourly | `17 * * * *` |

Verify job names/schedules/active state after provisioning. Do not compare secret values.

## 7. Vault and Edge secret inventory

Expected Vault names:

- `community_operations_email_relay_url`
- `community_operations_escalation_worker_token`
- `community_operations_escalation_worker_url`
- `community_provider_cleanup_worker_token`
- `community_provider_cleanup_worker_url`
- `community_retention_worker_token`
- `community_retention_worker_url`

Expected Edge secrets:

- `DREAMWISH_OPERATOR_EMAIL`
- `RESEND_API_KEY`

Evidence records names/presence only.

## 8. Secret rotation drill

For each rotatable worker/provider secret:

1. create a new production credential/token;
2. update the consumer that must accept/use it;
3. run the smallest dependent health/smoke check;
4. revoke the old credential;
5. confirm the old credential no longer works where safe to verify;
6. record secret **name**, rotation timestamp, operator, result — never value.

Rotate one dependency at a time to preserve rollback.

Resend production credentials must be distinct from staging/testing credentials where the provider
supports that separation.

## 9. DB backup / restore drill

The drill must not restore over active production.

1. identify source project, source commit and backup timestamp;
2. restore/duplicate into a non-public quarantine target;
3. verify schema/migration invariants;
4. import or access the out-of-rollback-domain Recovery Deletion Ledger;
5. replay all deletion entries applicable after the restore point;
6. reapply account/Creator/work tombstones and due payload purge;
7. invalidate/revalidate restored sessions;
8. verify deleted ledger accounts are neither discoverable nor directly accessible;
9. run minimal Community smoke;
10. run Security Advisor;
11. record measured RPO/RTO;
12. destroy/quarantine the drill environment according to the approved provider procedure.

Promotion is forbidden if deletion reconciliation cannot complete.

## 10. Storage backup / restore drill

Storage object bytes are a separate recovery asset.

1. copy recovery objects into private quarantine buckets;
2. never overwrite live production buckets as part of the drill;
3. replay the deletion ledger before signed-read verification;
4. remove objects that should no longer exist;
5. compare DB metadata to object existence/checksum/byte size;
6. record missing objects and orphan objects;
7. verify buckets are private;
8. verify only authorized signed reads work after reconciliation;
9. record RPO/RTO.

Any unreconciled deleted-user object blocks acceptance.

## 11. Recovery Deletion Ledger

Production implementation must preserve the existing contract:

Allowed fields only:

- `deletionEventId`
- `accountId`
- `requestedAt`

Forbidden:

- email;
- provider subject;
- passwords/tokens;
- content;
- message text.

Operational requirements:

- outside the primary Supabase rollback domain;
- encrypted;
- recovery-operator-only;
- access audited;
- automatic 90-day expiry;
- replay idempotent;
- fail-closed restore promotion.

## 12. Production smoke — deliberately smaller than closed acceptance suites

Do **not** rerun the primary Community browser suite.

Production smoke should prove wiring only:

1. browser config points to the production URL/key, never staging;
2. designated QA account can sign in and query itself;
3. WandAccount/Creator bootstrap works;
4. one QA PRIVATE work is not public;
5. one QA PUBLIC work can be discovered;
6. one authorized media/Preset signed read works from the private production buckets;
7. staging-only Edge slugs are absent;
8. outbox/provider-cleanup/retention/operations worker health can be observed.

Do not exercise persistent DDV world/save Apply.

Do not routinely delete the production QA account unless the drill explicitly allocates a
disposable user for deletion/recovery verification.

## 13. Security Advisor acceptance

Run Advisor only on production after replay/configuration.

Acceptance:

- no unexplained ERROR/WARN;
- all RLS findings mapped to intended policy/server-only boundary;
- no public bucket accident;
- no new insecure-definer/search-path finding;
- no unexpected Auth weakening.

If production is **Pro or above**, enable Supabase Leaked Password Protection. The current Free
staging warning must **not** be carried forward as an accepted Pro-production warning.

If production remains **Free**, the lack of Leaked Password Protection must remain an explicit
compensated limitation with the already-proven 15-character/recent-auth/revocation controls.

## 14. 04 QR evidence set after execution

04 QR should receive:

- pinned final-integrated-main SHA and integrated verifier PASS;
- distinct production project evidence;
- fresh migration replay evidence;
- function allowlist/denylist inventory;
- Cron/Vault name inventory;
- DB backup/restore result;
- Storage backup/restore result;
- deletion-ledger reconciliation result;
- secret rotation result;
- minimal production smoke result;
- production Security Advisor result;
- final Privacy/Legal approval status.

## 15. Current stop boundary

Everything above is prepared and the owner resource decision is closed.

The current phase intentionally stops before provisioning because the owner selected **release-stage
creation**, not immediate creation.

At the release-stage production gate:

1. create the distinct Supabase production project on **Pro**;
2. enable Leaked Password Protection;
3. create/configure the **Cloudflare R2 Standard** private recovery bucket/pipeline;
4. bind actual provider/DPA/subprocessor/transfer/retention facts into Privacy/Legal review;
5. continue with fresh migration replay and the production-only drills in this runbook.

Until Release Control reaches that stage, do not create or pay for the production resources.
