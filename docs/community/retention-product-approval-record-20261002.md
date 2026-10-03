# Community Retention Product Approval Record — 2026-10-02

Status: **PRODUCT APPROVED / PRIVACY PENDING / LEGAL PENDING**

## Approval basis

The Product owner explicitly approved the current Community deletion/retention proposal without
requesting changes.

Approval basis:

- `docs/community/retention-product-approval-checklist-20261001.md`;
- `ops/community-retention-policy-proposal.json`;
- `ops/community-backup-privacy-contract.json`;
- `ops/community-deletion-disclosure-contract.json`;
- `docs/community/delete-account-user-copy-review-20261001.md`.

## Product-approved decisions

### D1 — Content payload

**APPROVED:** immediate Community removal; physical user-authored payload purge within 7 days.
The seven days are backend cleanup/retry time only, not recovery.

### D2 — Operational detail

**APPROVED:** one 90-day operational-detail scrub stage.

### D3 — Deletion promise

**APPROVED:** account deletion is immediate and irreversible to the Wizard; Account, Creator
presence, and owned works stop being available immediately.

### D4 — Retention holds

**APPROVED:** only moderation, security, or legal holds may delay applicable deletion/scrub, and only
while the documented necessity remains.

### D5 — Structural tombstones

**APPROVED:** preserve only the minimum non-content technical structure needed for integrity; do not
retain deleted user-authored payload or unnecessary re-identifying detail for this purpose.

### D6 — Backup / restore privacy

**APPROVED as Product design:** quarantine-first recovery, separate DB/Storage recovery, minimal
external Recovery Deletion Ledger, and fail-closed promotion if deletion reconciliation is
unavailable/incomplete. Production provider/plan and real restore drills remain Release Operations
gates.

### D7 — Provider retention direction

**PRODUCT DIRECTION SUPPORTED:** minimize data sent to providers and disclose material
provider-controlled retention. D7 formal required approvals remain Privacy and Legal.

### D8 — User disclosure

**APPROVED:** category-by-category plain-language deletion disclosure using the current 7-day,
90-day, D4, D6, and D7 semantics.

## Approval boundary

This record closes **Product approval only**.

It does not:

- approve Privacy;
- approve Legal;
- set `launchApproved=true`;
- create production resources;
- select a paid Supabase plan, PITR, or backup provider;
- close production backup/restore or security gates.

Privacy and Legal remain independently PENDING.
