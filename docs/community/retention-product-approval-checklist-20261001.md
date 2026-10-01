# Community retention — Product approval checklist — 2026-10-01

Status: **READY FOR EXPLICIT PRODUCT APPROVAL**

This is the Product decision surface for the current Community deletion/retention design.
It does not substitute for Privacy or Legal review.

## D1 — User-authored payload

Approve:

**Immediate Community removal + physical payload purge within 7 days.**

The seven-day interval is backend cleanup/retry time only. It is not a recovery window.

## D2 — Operational detail

Approve:

**One 90-day operational-detail scrub stage.**

There is no fixed 365-day elevated tier.

## D3 — Account deletion promise

Approve:

**Deletion is immediate and irreversible to the Wizard.**

Account access, Creator presence and owned works stop being available immediately. Wand does not
offer a deletion undo/recovery grace period.

## D4 — Retention holds

Approve:

**Only moderation, security or legal holds may delay applicable deletion/scrub.**

Hold creation/release is admin/recent-auth protected, reasoned and audited. A hold should end when
the documented need ends.

## D5 — Structural tombstones

Approve:

**Preserve only the minimum non-content structure needed for integrity.**

Stable identifiers/revision/relationship skeleton may remain where necessary. Deleted user-authored
payload and unnecessary re-identifying detail must not be kept for this purpose.

## D6 — Backup / restore privacy

Approve the design:

**Restore is quarantine-first and cannot resurrect deleted users.**

- PITR is not required for launch.
- DB backup RPO target: <=24h.
- independent private Storage recovery copy target: <=24h RPO / 7d copy retention.
- restore requires a minimal 90d Recovery Deletion Ledger outside the primary rollback domain.
- the ledger contains deletionEventId/accountId/requestedAt only.
- restored sessions must be revalidated.
- promotion is blocked if deletion reconciliation is unavailable/incomplete.

Production provider/plan and real restore drills remain separate launch gates.

## D7 — Service providers

Approve:

**Minimize data sent to providers and disclose material provider-controlled retention.**

Wand must not claim that Supabase/Resend backup/log/email copies follow Wand's primary 7d/90d
timers.

## D8 — User disclosure

Approve:

**Explain deletion by data category in plain language.**

Current review copy:
`docs/community/delete-account-user-copy-review-20261001.md`.

Required meaning includes immediate irreversibility, 7d content purge, 90d operational scrub, D4
holds, structural tombstones, backup recovery boundary and provider-copy boundary.

## Product approval effect

If Product approves D1-D8 above without changes:

- mark Product retention approval APPROVED;
- do **not** mark Privacy or Legal approved;
- do not create production resources;
- continue toward independent Privacy/Legal review and production-only Release Operations gates.

Any requested policy change reopens only the affected contract/runtime regression.
