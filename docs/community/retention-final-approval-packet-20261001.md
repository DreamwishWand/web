# Community retention final approval packet — 2026-10-01

Status: **ENGINEERING CLOSED / PRODUCT PENDING / PRIVACY PENDING / LEGAL PENDING**

Machine-readable approval state:
`ops/community-retention-approval-state.json`.

## What Engineering has already closed

The Community retention implementation and runtime evidence are complete for the current contract:

- immediate public/account removal;
- real provider-account deletion;
- two-stage retention scheduler;
- current engineering defaults of 30-day content payload purge and 365-day operational-detail scrub;
- retention holds;
- Gallery media physical deletion;
- WEP Preset ArtifactBlob physical deletion before Community finalization;
- structural tombstone/reference preservation;
- operational-detail scrub;
- retry/backoff/dead-letter and operator controls.

The 30-day value is **not** a 30-day account-recovery promise.

Engineering does not need to redesign or rerun the retention plumbing merely because launch approval
has not yet been granted.

## Approval boundary

The remaining launch question is policy approval, not implementation proof.

### Product approval — PENDING

Product must explicitly approve or replace:

- the 30-day content-payload duration;
- the 365-day operational-detail duration;
- deletion UX/copy;
- allowed retention-hold policy;
- structural tombstone expectations;
- backup-copy behavior;
- user-facing privacy/deletion disclosure.

No Product approval is inferred from the fact that the current defaults are implemented.

### Privacy approval — PENDING

Privacy review must approve or change:

- data-category durations;
- hold purposes;
- structural minimization;
- backup-copy lifecycle;
- processor/provider retention treatment;
- user-facing disclosure.

No Privacy approval is inferred from Engineering's runtime PASS.

### Legal approval — PENDING

Legal review must approve or change the launch policy where legal review is required, including:

- retention durations/purposes;
- hold handling;
- backup/provider copy handling;
- structural residual records;
- disclosure obligations.

Engineering does not make a legal sufficiency determination.

## Decision IDs

The canonical D1-D8 decisions remain in
`ops/community-retention-launch-review.json`.

The three approval tracks above intentionally overlap: a single D-item may require more than one
approval.

## Release behavior

Until all required approvals are explicitly recorded:

- `launchApproved=false`;
- Community production `--require-ready` must fail;
- 30/365 remain engineering defaults only;
- no user-facing legal/privacy claim should present them as approved policy.

After approvals:

- if approved values remain 30/365, run one final policy/configuration regression;
- if values change, update configuration and run the regression against the approved values;
- do **not** rerun the already-passed retention plumbing E2E unless implementation semantics changed.

This packet closes Engineering's retention decision boundary while preserving the launch approval
gate.


## D1-D8 explicit approval matrix

Engineering status for every item below is **CLOSED**. The remaining status is policy approval only.

| ID | Decision | Product | Privacy | Legal |
| --- | --- | --- | --- | --- |
| D1 | Content-payload retention duration | PENDING | PENDING | PENDING |
| D2 | Operational-detail retention duration | PENDING | PENDING | PENDING |
| D3 | User-facing deletion promise / recovery wording | PENDING | — | — |
| D4 | Retention-hold policy | PENDING | PENDING | PENDING |
| D5 | Structural tombstone policy | PENDING | PENDING | PENDING |
| D6 | Backup-copy retention | PENDING | PENDING | PENDING |
| D7 | Processor/provider retention | — | PENDING | PENDING |
| D8 | Policy disclosure and launch acceptance | PENDING | PENDING | PENDING |

Approval rule: an item is approved only when **every approval required for that row is explicitly
APPROVED**. Engineering defaults or runtime evidence never imply approval.

Current engineering defaults remain:

- content payload: 30 days;
- operational detail: 365 days.

Those values are not legal conclusions and remain changeable by the approval process.
