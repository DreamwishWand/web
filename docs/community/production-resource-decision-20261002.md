# Community Production Resource Decision — 2026-10-02

Status: **OWNER APPROVED / PROVISION AT RELEASE STAGE**

The Product owner explicitly approved the production infrastructure direction:

- **Supabase Pro** for the Dreamwish Wand production backend;
- **Cloudflare R2 Standard** for the independent private Storage recovery copy;
- provision both at the **release stage**, not during the current preparation phase.

This closes the provider/plan selection decision gate. It does **not** create or authorize immediate
resource provisioning in the current phase.

## Supabase

Approved launch direction:

- distinct production Supabase project;
- Pro plan;
- never reuse the staging project;
- enable Leaked Password Protection in production;
- managed daily database backup is the baseline production DB recovery mechanism;
- PITR is not launch-required under the current <=24h RPO contract;
- production configuration/secrets must be independent from staging.

No production project or paid plan was created by this decision record.

## Cloudflare R2 Standard

Approved launch direction:

- use R2 Standard as the independent Storage recovery domain;
- recovery copy remains private;
- target <=24h RPO;
- target 7-day recovery-copy retention;
- production restore remains quarantine-first;
- Recovery Deletion Ledger reconciliation is required before any restored objects become
  user-visible;
- actual R2 bucket/account configuration is deferred until release-stage provisioning.

No R2 bucket or paid external resource was created by this decision record.

## Privacy / Legal boundary

Provider **selection** is now CLOSED. Provider **binding/approval** is not.

Before final Privacy/Legal approval, the release-stage implementation must bind and review:

- actual Supabase project region/configuration;
- Supabase DPA/subprocessors/transfers/provider-controlled retention;
- actual Cloudflare R2 account/bucket configuration and applicable location behavior;
- Cloudflare DPA/subprocessors/transfers;
- actual DB backup, logs, Storage-copy retention and deletion behavior;
- final Privacy Policy processor/provider disclosure.

Therefore:

- Product resource decision = **APPROVED**;
- Privacy = **PENDING**;
- Legal = **PENDING**;
- launchApproved = **false**.

## Execution boundary

The next production resource creation occurs only when Release Control reaches the production
provisioning phase.

Until then:

- do not create the production Supabase project;
- do not upgrade/pay for Supabase Pro;
- do not create the R2 recovery bucket;
- do not deploy production secrets/Cron/Functions;
- do not treat provider selection as restore/runtime evidence.

Machine record:
`ops/community-production-resource-decision-20261002.json`.
