# Community retention launch policy proposal — 2026-10-01

Status: **READY FOR EXPLICIT APPROVAL / NOT AN APPROVAL**

Machine-readable contract: `ops/community-retention-policy-proposal.json`.

## Scope

Engineering retention implementation/runtime is already CLOSED. This document converts D1-D8 into
a concrete launch proposal so Product, Privacy and Legal can approve, reject, or amend actual policy
choices without reopening the retention plumbing.

Nothing in this document changes an approval status by itself.

## Proposed launch policy

| ID | Proposed launch rule |
| --- | --- |
| D1 | Use a **7-day maximum content-payload purge** window after account deletion. Public/account/work access is removed immediately. 7 days is **not** a self-service recovery window. |
| D2 | Current staging implementation uses **90-day routine operational scrub** plus an elevated moderation/security/legal stage up to **365 days**. This D2 split remains under policy review. |
| D3 | Describe deletion as **immediate account/Creator/work removal followed by backend payload purge within 7 days**. Do not promise a reversible grace period or recovery window. |
| D4 | Allow only **moderation / security / legal** retention holds. Current runtime already requires recent-auth admin authority, a reason, and audited create/release. Use expiry when a determinate end exists; otherwise require explicit admin release. |
| D5 | After scrub, preserve only the minimized identity/relationship skeleton needed for historical integrity: stable IDs, revision relationships/numbers, deletion-event identity and non-sensitive moderation/report structure. No deleted user-authored payload or unnecessary re-identifying detail. |
| D6 | Treat DB and Storage recovery copies separately. Keep launch targets at DB/Storage RPO <=24h and RTO target <=4h. Prefer the shortest production recovery window that meets this. Target Wand-managed Storage recovery copies at **7 days**. Restore into non-production first and reapply deletion/retention reconciliation before reopening writes. |
| D7 | Treat Supabase/Resend copies and logs as **provider-controlled retention** outside Wand's 30/365 timers. Record actual production plan/configuration, minimize processor payload, and disclose material external-copy windows. |
| D8 | User-facing privacy/deletion copy must disclose immediate removal, 7-day payload purge, the current operational-retention policy, permitted holds, minimized structural records, backup copies and provider-controlled copies/logs. |

## Why 30 / 365 remains the proposal

This is the shortest release path because those values are already configuration-driven and
runtime-proven. Keeping them does not make them a legal conclusion. Privacy/Legal may require shorter
or category-specific windows; if so, change the configuration and run one policy-aligned regression.

## Provider retention facts reviewed 2026-10-01

### Supabase

Current official documentation states:

- managed daily database backups: Pro 7 days, Team 14 days, Enterprise up to 30 days;
- database backups contain Storage metadata but **not Storage object bytes**;
- user-accessible logs: Free 1 day, Pro 7 days, Team 28 days, Enterprise 90 days.

Sources:

- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/troubleshooting/check-usage-for-monthly-active-users-mau-MwZaBs

The Wand production Supabase plan is still **UNDECIDED**. D6 therefore defines the product rule now
and binds the exact provider backup window when the production environment is selected.

### Resend

Current official Resend security/GDPR documentation states:

- email and log data: 30 days on Free, Pro and Scale;
- backups: 7 days;
- remaining customer data: deleted within 90 days after account termination;
- stored customer data is in the United States;
- Enterprise supports flexible retention.

Source:

- https://resend.com/security/gdpr

These are provider statements, not a Wand legal sufficiency conclusion.

## Existing runtime alignment

No new retention mechanism is required for D1-D5:

- account/public removal is immediate;
- payload and operational scrub are separate;
- hold types are already limited to moderation/security/legal;
- hold create/release is admin + recent-auth and audited;
- structural tombstones are already separated from user-authored payload.

D6 production backup/Storage mechanism remains a production-operations gate because no production
environment exists yet.

## Approval boundary

Still PENDING:

- Product;
- Privacy;
- Legal.

Approval must be explicit. Engineering defaults, this proposal, runtime PASS, or the instruction to
continue project work do not count as policy approval.

After explicit approval:

1. record D1-D8 approval states;
2. bind D6 to the actual production backup/Storage configuration;
3. if 30/365 remains approved, run one final policy/configuration regression;
4. if values change, update configuration first, then run that regression;
5. do not rerun the already-passed retention plumbing E2E unless implementation semantics changed.
