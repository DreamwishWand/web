# Community Retention D1/D2 Single-Stage Runtime — 2026-10-01

Status: **CONFIRMED / ENGINEERING CLOSED**

## Scope

This evidence supersedes the temporary D2 90-day routine / 365-day elevated implementation.

Current intended launch implementation:

- D1 content payload: **7 days maximum**;
- D2 operational detail: **90 days**;
- D4 moderation / security / legal hold: exception path for justified retention beyond 90 days;
- no separate fixed-duration elevated operational stage.

## D1 staging state

Migration:
`20261001115028_community_retention_content_purge_7d`.

Observed:

- `deleted_account_content_days=7`;
- four existing pending content jobs were rescheduled;
- zero became immediately due at migration time;
- the seven-day interval is backend cleanup/retry only, not recovery.

## D2 staging migration

Migration:
`20261001122209_community_retention_operational_90d_single_stage`.

Before migration, the temporary tiered state contained:

- `deleted_account_operational_days=90`;
- `deleted_account_elevated_operational_days=365`;
- four elevated jobs;
- no completed routine/elevated stage markers.

Therefore the elevated tier had not processed account data and could be removed without losing
completed retention history.

After migration, live staging readback confirmed:

- `deleted_account_operational_days=90`;
- elevated policy rows: 0;
- elevated jobs: 0;
- elevated/routine-only deletion-event columns: 0;
- pending operational jobs remain scheduled at 90 days.

## Runtime function boundary

Live `pg_get_functiondef` readback confirms:

- claim checks `not private.community_account_has_retention_hold(account_id)`;
- operational jobs require content purge to have completed first;
- operational completion removes/minimizes closed report detail;
- resolved/closed moderation-action free text/state is minimized;
- account-linked audit actor/correlation/metadata is minimized;
- completed recovery/provider-cleanup detail is removed;
- released retention-hold reasons are minimized;
- the deletion event is marked operationally scrubbed / purged;
- unsupported stages fail closed.

The worker type again accepts only:

- `content_payload`;
- `operational_detail`.

The previously proven retention E2E exercised this same single operational-stage plumbing before
the temporary policy experiment. The current migration restores that structure while changing the
operational due time to 90 days and additionally minimizing released hold reasons.

## D4 semantics

D4 remains the only long-retention exception mechanism.

An applicable active moderation/security/legal hold prevents the due 90-day job from being claimed.
When the hold or other active blocking moderation condition no longer applies, an overdue job
becomes eligible for the normal scrub path. There is no automatic 365-day extension.

## Advisors

Post-migration Supabase Advisor readback:

- no new blocking Security finding caused by this migration;
- the only Security WARN is the already-known
  `auth_leaked_password_protection` plan limitation;
- RLS-without-policy findings are INFO on existing service/RPC-bounded tables;
- performance findings are unused-index INFO only.

No index was removed based solely on staging usage.

## Classification

**CONFIRMED / CLOSED**

Engineering is closed on:

`immediate irreversible removal -> D1 7-day payload purge -> D2 90-day operational scrub`

with D4 holds as the sole policy exception path beyond 90 days.

This is an engineering/runtime conclusion only. Product, Privacy and Legal approval remain
explicitly PENDING.
