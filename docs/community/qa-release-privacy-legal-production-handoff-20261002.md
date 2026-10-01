# 04 QR Handoff — Community Privacy / Legal / Production Readiness — 2026-10-02

Status: **EVENT-DRIVEN EVIDENCE DELTA READY**

Machine evidence:
`ops/community-qa-release-evidence-20261002.json`.

## Consume as CLOSED

- Auth/mailbox: CLOSED / PASS.
- Retention Engineering: CLOSED / PASS.
- Product retention approval: CLOSED / APPROVED.
- D1/D2 current Product values: <=7-day payload purge / 90-day operational scrub.
- D4: moderation/security/legal hold only while justified.
- D6 design: quarantine-first recovery + minimal external Recovery Deletion Ledger.
- Production execution **protocol preparation**: complete.

"Protocol preparation complete" is not production runtime PASS.

## Keep OPEN — Privacy

Privacy state:
**REVIEW_READY_WITH_OPEN_PRIVACY_DECISIONS / PENDING APPROVAL**.

Primary blockers:

1. Linked DDV Profile orphan/minimization:
   account deletion removes the WandAccount link but not the underlying DDV Profile row;
   `binding_key_hash` derivation and `verification_evidence_ref` lifecycle are not canonicalized.
2. age/minors:
   launch age floor/consent/assurance policy is not yet selected.
3. production processors:
   actual Supabase plan and independent Storage recovery provider are not selected.

Additional review decisions include correction/unlink, UNLISTED disclosure, moderation free-text
governance, media-key pseudonym acceptance and jurisdiction-specific data-rights workflows.

Evidence:

- `ops/community-privacy-review-readiness-20261002.json`
- `docs/community/privacy-review-readiness-20261002.md`

Do not infer Privacy approval.

## Keep OPEN — Legal

Legal state:
**PACKET READY / EXTERNAL REVIEW REQUIRED / PENDING APPROVAL**.

Packet:
`docs/community/legal-review-packet-20261002.md`.

It separates facts from legal decisions and requires external review of launch jurisdiction/entity,
age/minors, privacy rights, processors/transfers, Linked DDV Profile semantics, Terms/UGC license,
copyright notice/takedown, moderation/appeal duties, legal holds and provider-specific backup
boundaries.

Do not infer Legal approval.

## Keep OPEN — final integrated source

Community and WEP remain separate branches.

Latest observed:

- Community base confirmed at start of this review:
  `8a25e6cf99e00ca56f3bd359d5560a2e6859c1c3`
- WEP:
  `424116bba04be06454db32a422afaeba6e2b0044`
- merge base:
  `cfda06eb904544bbfa5286c4eb61b5856dd3ea51`

WEP `ba55070f... -> 424116bb...` changes are editor/Road/Fence/full-design/preflight only.
No Community publication/signed-read/retention/Edge contract changed, therefore no closed Community
suite is reopened.

Production replay must still wait for accepted `final-integrated-main` and:

```bash
npm run verify:community-integrated-tree -- --require-ready
```

must PASS on that exact tree.

## Keep OPEN — production-only gates

Prepared but **not executed**:

- distinct production Supabase project;
- final integrated fresh migration replay;
- DB backup mechanism;
- DB restore drill;
- independent Storage backup mechanism;
- Storage restore drill;
- Recovery Deletion Ledger externalization/reconciliation;
- controlled secret rotation;
- production function allowlist / staging denylist inventory;
- production Cron/Vault inventory;
- minimal production smoke;
- production Security Advisor.

Execution protocol:

- `ops/community-production-execution-checklist-20261002.json`
- `docs/community/production-execution-runbook-20261002.md`

## User decision gate

The next production step requires explicit owner decision before any resource is created:

1. Supabase production plan:
   - Pro: operationally preferred minimum, managed 7-day daily DB backups and leaked-password
     protection;
   - Free: $0 base but requires self-managed daily offsite DB backup and carries substantially higher
     operations burden.
2. independent private Storage recovery provider/mechanism.

PITR is not required by the current <=24h RPO contract.

## Rerun prohibition

Do not rerun absent semantic change:

- Auth/mailbox;
- primary Community browser closure;
- visibility/ownership;
- Scene Preset vertical;
- ArtifactBlob retention E2E;
- retention plumbing E2E;
- moderation runtime;
- rate-limit runtime.

## QA classification

04 QR should classify this event as:

- **new evidence available** for Product approval, Privacy/Legal readiness and production
  preparation;
- **not launch-ready**;
- **no new Community runtime regression requirement**;
- **Privacy/Legal and production gates remain open**.
