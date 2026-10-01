# Community Core launch privacy / retention review packet — 2026-10-01

Status: **TECHNICAL CONTRACT CONFIRMED / PRODUCT-LEGAL APPROVAL PENDING**

This document is an engineering review packet. It records what the current Community implementation
actually does and isolates the decisions that still require Product/Privacy/Legal approval. It is not
legal advice and does not infer jurisdiction-specific obligations.

## 1. Current technical behavior — CONFIRMED

Account deletion is a staged deletion model, not a single destructive cascade.

Immediately after a valid self-service deletion:

- WandAccount is marked deleted;
- public Creator identity is anonymized;
- owned Community works are hidden/tombstoned and removed from discovery;
- authored comments are anonymized to `[deleted]`;
- private Saved / Follow / Reaction / NotificationDelivery state is removed;
- Linked DDV Profile relations are removed;
- recovery references are cancelled/removed;
- AuthIdentity is retired and Wand sessions are cut off;
- provider-account deletion is queued;
- AccountDeletionEvent and immutable AuditEvent history are written.

The provider account is then deleted asynchronously through the provider-cleanup worker. The
production-shaped staging E2E has already deleted a real disposable Supabase Auth user.

### Content payload stage — current engineering default: 30 days

At 30 days after account deletion, when no retention hold applies:

- Gallery media object bytes are physically deleted;
- MediaAsset storage metadata is tombstoned/neutralized;
- CommunityWork user-authored/shared metadata is cleared;
- Gallery title becomes `[deleted]`, description is removed and metadata is cleared;
- Preset revision metadata is cleared;
- Wand Preset ArtifactBlob bytes are physically deleted through the WEP adapter before the
  Community finalizer tombstones the ArtifactBlob;
- account idempotency rows are removed;
- AccountDeletionEvent records content purge completion.

Gallery media physical deletion and Wand Preset ArtifactBlob physical deletion are both runtime
confirmed.

**Important interpretation:** 30 days is currently a retention-delay parameter. The implementation
does not currently establish a 30-day self-service recovery entitlement and does not make it a
promised 30-day account-recovery or undo window. Product must not describe it as one unless a
separate recovery contract is deliberately approved and implemented.

### Operational-detail stage — current engineering default: 365 days

At 365 days after account deletion, after content payload purge and when no hold applies:

- notification actor linkage is cleared;
- closed/rejected Report free-text detail is removed and deleted-account reporter linkage may be
  nulled;
- resolved/closed ModerationAction detail is reduced while structural case/action records remain;
- deleted-account AuditEvent actor/correlation/payload detail is scrubbed;
- completed/cancelled/rejected recovery cases are removed;
- completed provider-cleanup jobs are removed;
- AccountDeletionEvent records operational-detail scrub completion and reaches the purged state.

**Important interpretation:** 365 days does not mean all account content remains available for one
year. Public access is removed immediately and content payload is scheduled for purge at 30 days.
The later stage concerns restricted operational detail.

## 2. Retention holds — CONFIRMED technical capability

Purge is delayed while an applicable hold exists.

Current technical blockers include:

- explicit moderation/security/legal retention holds;
- open/triaged Reports;
- open/reviewing ModerationCases;
- unresolved provider cleanup.

Hold creation/release, retention dead-letter operations and worker-health alerts are runtime
confirmed and auditable.

The existence of the mechanism does not itself define the legal/product policy for when a hold may
be created, how long it may remain, who may authorize it, or what user notice is required.

## 3. Structural records after payload scrub — CONFIRMED technical behavior

The retention process deliberately preserves referential/structural history needed to keep shared
Community state coherent. Examples include:

- CommunityEntity stable IDs/tombstones;
- CommunityWork and immutable revision IDs/revision numbers;
- revision relationships;
- deletion-event identity;
- minimized structural moderation/report relationships.

Published-revision immutability is not disabled for ordinary retention. Service-only retention
redaction removes payload/detail while preserving the structural graph.

This means "purged" does not currently mean that every database row historically associated with the
account is physically deleted.

## 4. Data that is outside the 30/365 Community-state timer

The 30/365 timers apply to the Community retention state machine. They do not, by themselves, define
retention for every external or recovery copy.

Separate policy/operations decisions are required for:

- database backups and restore snapshots;
- Storage-object backup copies;
- Supabase platform/service logs;
- Resend transactional-email/provider logs;
- infrastructure/security logs outside canonical Community tables;
- any future analytics/error-tracking provider.

The Production Operations contract already requires database and Storage backup/restore paths to be
separate. Launch privacy review must define backup-copy retention and access rather than assuming a
primary-database purge instantly removes historical backups.

## 5. Technical guarantees already available

The current implementation can support different approved durations without redesigning the state
model.

Already proven:

- immediate public-access removal;
- two-stage retention scheduling;
- configurable timing;
- retention holds;
- retry/backoff/dead-letter behavior;
- worker-health alerting;
- physical Gallery media purge;
- physical Wand Preset ArtifactBlob purge;
- structural-history preservation with payload redaction;
- operational-detail scrub;
- service-only finalizers and worker authorization.

Changing 30 or 365 therefore primarily requires configuration/policy review plus regression
acceptance; it does not require replacing the retention architecture.

## 6. Product / Privacy / Legal decisions still required

The following are deliberately **PENDING**. Engineering must not convert the existing defaults into a
legal claim merely because they are implemented.

### D1 — content payload duration

Decision:
- approve 30 days after account deletion; or
- choose another duration.

Questions for approval:
- what product/user purpose justifies retaining deleted-user payload before physical purge?
- should any shorter category-specific period apply?
- should the policy distinguish public media, Preset bytes and text metadata?

Current engineering default: **30 days**.

### D2 — operational-detail duration

Decision:
- approve 365 days after account deletion; or
- choose another duration/category matrix.

Questions for approval:
- which security, abuse, moderation, support or dispute purposes require each retained category?
- does each category need the full duration?
- should a shorter duration apply when no report/moderation/security event exists?

Current engineering default: **365 days**.

### D3 — user-facing deletion promise

Product copy must decide whether deletion is described as:

- immediate account/public removal followed by scheduled backend cleanup; or
- a reversible recovery/grace period.

Current implementation supports the first interpretation. It does **not** currently establish a
30-day self-service recovery entitlement.

### D4 — retention-hold policy

Approve:

- allowed hold reasons;
- privileged roles allowed to create/release holds;
- required reason/audit fields;
- review/expiry expectations;
- any required user-facing disclosure.

Do not expose internal case/security detail merely to explain that a lawful/necessary hold exists.

### D5 — structural tombstone policy

Approve what minimized structural records may remain after operational-detail scrub, for example
stable IDs and immutable relationship skeletons.

Review must answer:

- whether these records are sufficiently minimized/de-identified for their intended purpose;
- whether an additional eventual destruction horizon is required;
- whether any structural field still permits unnecessary re-identification.

### D6 — backup and recovery-copy retention

Define separately:

- database backup retention period;
- Storage-object backup retention period;
- who can access restore media;
- how deleted-user data ages out of backups;
- what happens if old backup data is restored;
- whether post-restore retention jobs must immediately reapply deletions/scrubs.

This decision must align with the Production Operations restore contract.

### D7 — processor/provider retention

Document and review the applicable retention/configuration for external processors used at launch,
including at minimum Supabase and Resend. Do not assume the Community database timer controls
provider logs.

### D8 — policy disclosure and acceptance

Before public launch, user-facing privacy/account-deletion documentation must accurately distinguish:

- immediate loss of public/account access;
- delayed content-payload purge;
- later operational-detail scrub;
- possible retention holds;
- minimized structural/audit records;
- backup/provider copies where applicable.

The wording must be based on the finally approved policy, not on this engineering packet.

## 7. Engineering default recommendation

Absent a Product/Privacy/Legal decision requiring change, keep **30-day content payload / 365-day
operational detail** as the implementation baseline because it is already runtime-proven and
configuration-driven.

This is an engineering change-minimization recommendation, **not** a conclusion that those periods
satisfy any specific law or jurisdiction.

## 8. Launch approval gate

Retention policy is launch-approved only when all of the following are recorded:

- contentPayloadDays approved;
- operationalDetailDays approved;
- hold policy approved;
- structural tombstone policy approved;
- backup-copy retention approved;
- provider/processor retention reviewed;
- user-facing deletion/privacy wording approved;
- implementation/configuration matches the approved values;
- one final retention regression confirms the approved configuration.

Until then, the runtime is **technically proven but policy approval remains open**.

## 9. Evidence classification

**CONFIRMED**

- immediate Wand tombstone/public-access removal;
- actual provider-user deletion;
- 30-day/365-day values are configurable engineering defaults;
- two-stage retention behavior;
- retention holds and operational controls;
- Gallery media physical purge;
- Preset ArtifactBlob physical purge;
- structural tombstone/reference preservation;
- operational-detail scrub.

**HIGH CONFIDENCE**

- current state model can absorb changed durations without architectural replacement;
- backup/provider retention should be reviewed separately from primary Community-state timers.

**PENDING**

- D1 through D8 final Product/Privacy/Legal approval;
- production backup-copy retention implementation;
- final policy-aligned regression acceptance.
