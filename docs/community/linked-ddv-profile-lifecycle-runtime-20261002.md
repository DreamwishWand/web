# Linked DDV Profile Lifecycle — Staging Runtime — 2026-10-02

Status: **DB LIFECYCLE STAGING PASS / USER LINK TRANSPORT NOT YET EXPOSED**

## What is implemented

Staging migration `20261001221620_community_linked_ddv_profile_lifecycle_v1` is applied and mirrored
in the repository.

The database now supports:

- `self` and `parent_guardian_managed` profile relationships;
- the existing transaction-safe three-profile account cap;
- 15-minute recent-auth for high-impact profile linking;
- an engineering rate limit of 12 link attempts/hour/account;
- service-only binding using a versioned keyed-digest format;
- no raw Player ID database field;
- `verification_evidence_ref = NULL` for normal linking;
- no ordinary self-service unlink;
- admin-only exceptional correction with recent auth, reason and AuditEvent;
- automatic 7-day binding-digest tombstone when a link is removed;
- account-deletion link removal flowing through the same tombstone mechanism;
- D4 retention-hold-aware tombstone expiry;
- expired tombstone purge through the existing retention worker, without adding a new Cron job.

## Staging runtime evidence

A disposable PostgreSQL transaction created a synthetic account, verified DDV Profile and
`parent_guardian_managed` link, then removed the link.

Observed:

- exactly one 7-day tombstone was created;
- the relationship kind was preserved in the tombstone;
- the active `ddv_profiles` row was removed;
- after forcing the test tombstone expiry, the purge RPC removed it;
- the transaction was rolled back;
- staging returned to zero DDV Profile rows, zero links and zero tombstones.

Updated Edge Functions:

- `community-query` v9 — owner-safe linked-profile list;
- `community-admin` v13 — exceptional correction operation;
- `community-retention` v5 — expired binding tombstone purge.

Security Advisor added no new warning attributable to this migration. The existing Free-staging
Leaked Password Protection warning remains expected; production policy still requires enabling it
on Supabase Pro.

## Deliberately not exposed yet

The user-facing link command is **not** wired into `community-command` yet.

The database RPC accepts only a keyed digest and is service-role-only. The unresolved Product/security
question is how the trusted Edge layer obtains enough evidence before deriving that digest.

This keeps the completed lifecycle work usable without prematurely choosing a weaker or more
privacy-invasive link-verification model.
