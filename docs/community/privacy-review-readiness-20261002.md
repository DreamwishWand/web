# Community Privacy Review Readiness — 2026-10-02

Status: **REVIEW READY WITH OPEN PRIVACY DECISIONS / PRIVACY NOT APPROVED**

Machine evidence:
`ops/community-privacy-review-readiness-20261002.json`.

This review does not reopen retention Engineering. Product approval remains authoritative. The
purpose is to identify whether the current technical/product contract is sufficiently specified for
independent Privacy review and to isolate only the remaining privacy decisions.

## Executive finding

The current Community design is substantially privacy-ready:

- deletion is immediate and irreversible at the Community/account layer;
- user-authored payload is physically purged within 7 days;
- operational detail is normally minimized at 90 days;
- there is no default 365-day tier;
- exceptional retention uses explicit moderation/security/legal holds;
- private interaction state is self/staff only and is deleted at account deletion;
- moderation/audit state is staff-only;
- observed media and Preset buckets are private;
- media reads are authorization-gated, use five-minute signed URLs, and are returned with
  `Cache-Control: private, no-store`;
- database and Storage recovery are separated;
- restore is quarantine-first and deletion reconciliation is fail-closed;
- provider-controlled copies are explicitly outside Wand's 7-day/90-day claim.

**No retention Engineering rewrite is justified by this audit.**

Privacy approval should remain PENDING because several semantics are not yet sufficiently defined.

## Confirmed privacy controls

### Public / unlisted / private

Current access semantics are technically clear:

- **PUBLIC**: published, moderation-clear work can be discovered and directly read.
- **UNLISTED**: published, moderation-clear work is not public discovery content, but a person who
  has the work identifier/link can directly access it.
- **PRIVATE**: owner/staff only.

This is a disclosure issue, not a runtime gap. The product must not describe UNLISTED as private.

Creator Profile public/unlisted visibility follows the same direct-read principle. Linked DDV
Profile rows remain owner/staff only.

### Media / object storage

Observed staging buckets are private. Community media access resolves authorization before issuing a
signed read URL. The signed URL lifetime is 300 seconds.

The Community media bucket resolver fails closed outside the known staging project when
`COMMUNITY_MEDIA_BUCKET` is absent. The WEP Preset resolver similarly requires an explicit
`WEP_PRESET_ARTIFACT_BUCKET` outside known staging and rejects the staging bucket name outside
known staging.

### Account deletion

The existing deletion transaction immediately:

- anonymizes and privatizes the Creator Profile;
- hides/deletes owned works and removes discovery documents;
- replaces authored comment bodies with `[deleted]`;
- removes Saves, Follows, Reactions and NotificationDelivery rows;
- removes WandAccount-to-DDV-Profile links;
- retires Wand AuthIdentity and advances session cutoff;
- queues provider-account cleanup.

The asynchronous stages then implement D1/D2.

### Backup resurrection

The D6 design is privacy-positive because an old recovery point is not allowed to become
user-visible directly. It must be restored into a quarantine target and reconciled against an
out-of-rollback-domain Recovery Deletion Ledger first.

The ledger contract contains only:

- deletionEventId;
- accountId;
- requestedAt.

Email, provider subject, tokens and content payload are explicitly forbidden.

Actual externalization, encryption/access logging and restore proof remain production-only work.

## Open Privacy decisions

### P1 — Linked DDV Profile orphan/minimization — **BLOCKER**

Account deletion deletes `wand_account_ddv_profiles`, but it does not delete/revoke the underlying
`ddv_profiles` row. That row can retain `binding_key_hash`.

The current source does not define:

- the raw value represented by `binding_key_hash`;
- the hashing/KDF construction;
- salt/pepper/key-management assumptions;
- whether the hash can be enumerated or linked back to a DDV identifier;
- what `verification_evidence_ref` references;
- how long the verification evidence exists.

Privacy review therefore cannot yet determine whether an orphaned DDV Profile is a necessary
minimal anti-abuse/fairness record or unnecessary retained personal/pseudonymous data.

Required decision before Privacy approval:

1. define the complete creation/verification lifecycle before implementation;
2. define the binding input and one-way construction;
3. classify re-identification/linkability risk;
4. define verification-evidence storage and lifecycle;
5. choose post-unlink/account-deletion semantics: delete, revoke + null binding hash, or documented
   minimized retention with a purpose and horizon.

Do not change the schema until that decision is made.

### P2 — Linked DDV Profile correction/unlink — **Privacy/Legal decision**

The model limits a Wand Account to three linked DDV Profiles. A normal self-service
creation/verification/correction/unlink command was not found in the reviewed Community command
surface.

The intended fairness rule ("unlink basically unavailable") is a Product choice, but Privacy/Legal
must determine whether a mistaken link requires a correction path without deleting the entire Wand
Account.

### P3 — UNLISTED wording — **disclosure required**

UNLISTED means "not discoverable, but direct-link/direct-ID readable." The final UI, Terms and
Privacy materials must say this plainly.

### P4 — age/minors — **BLOCKER for final Privacy/Legal approval**

No canonical launch minimum age, minor-consent policy or age-assurance policy was found.

This matters because Wand is an account-based UGC community around a game audience and includes
profiles, images, comments, publishing and moderation.

External Legal must determine launch jurisdictions/audience and whether child/minor-specific rules
apply. Privacy should not invent an age-verification implementation before that decision.

### P5 — production processor binding — **BLOCKER for final Privacy approval**

Provider selection is now closed:

- Supabase **Pro** is approved for the production backend;
- Cloudflare **R2 Standard** is approved as the independent Storage recovery provider;
- both are to be provisioned at the release stage.

This materially narrows P5, but does not close it. No production Supabase project or R2 recovery
bucket exists yet, so final Privacy approval still needs the actual launch facts: project/bucket
configuration and region/location behavior, contractual role/DPA, subprocessors/transfers,
backup/log/object retention, deletion behavior and final processor disclosure.

### P6 — moderation/audit free text — **governance required**

Reports, ModerationAction reasons/state, retention-hold reasons and some audit metadata can contain
free text or JSON.

They are access-restricted and subject to the 90-day normal scrub, but operator guidance should say:

- do not copy unnecessary personal or sensitive information into free text;
- record only what is needed for moderation/security/legal purpose;
- do not use a hold as a general archive;
- release a hold when its documented purpose ends.

No schema change is justified solely by this point.

### P7 — Recovery Deletion Ledger runtime safeguards — **production gate**

The field-level contract is minimal. Production still must prove:

- rollback-independent location;
- encryption at rest/in transit;
- recovery-operator-only access;
- access logging/auditability;
- 90-day expiry;
- reconciliation before restore promotion.

### P8 — media object key pseudonym — **accept or change**

Current media upload keys use the Auth subject as a path prefix. The bucket is private and the
payload is scheduled for purge within 7 days.

Privacy should explicitly decide whether this short-lived backend pseudonymous identifier is
acceptable. If not, a later targeted migration can use an opaque Wand/media identifier. This is not
a reason to reopen retention Engineering preemptively.

### P9 — data-rights workflow — **jurisdiction-dependent**

Account deletion exists, but there is no single canonical launch workflow for access/export,
correction, objection or similar data-right requests.

Legal/Privacy should define only the rights actually required by the launch jurisdictions, then
Engineering can implement the smallest necessary workflow.

### P10 — provider cleanup subject — **necessary-purpose acceptance**

The private provider cleanup queue temporarily retains a provider subject so the external Auth
account can actually be deleted/retried.

Privacy should record the purpose as deletion execution/retry only, prohibit secondary use, and
retain the existing post-completion scrub behavior.

## External review anchors — not legal conclusions

The following official materials are useful review anchors:

- Japan PPC / APPI FAQ: the law does not establish one universal retention period, but data no
  longer needed should be deleted without delay and retention should not be unnecessarily long:
  https://www.ppc.go.jp/personalinfo/faq/APPI_QA/
- Japan PPC general guidelines: deletion can include rendering data unusable as personal data, not
  only physical row deletion:
  https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/
- EU GDPR Article 5: data minimisation and storage limitation:
  https://eur-lex.europa.eu/eli/reg/2016/679/oj
- FTC COPPA materials: child-directed services and general-audience services with actual knowledge
  of collecting data from under-13 users can trigger COPPA duties:
  https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa
- EU DSA minors guidance:
  https://digital-strategy.ec.europa.eu/en/policies/dsa-guidelines

These sources identify questions for external review; this document does not determine their
jurisdictional applicability to Wand.

## Privacy state

**Privacy = PENDING.**

Recommended review result at this point:

`REVIEW_READY_WITH_OPEN_PRIVACY_DECISIONS`.

No further retention runtime test is required. Provider selection is closed. The next substantive inputs are P1/P2 Linked DDV Profile semantics, launch age/jurisdictions, and release-stage contractual/runtime binding of Supabase Pro + Cloudflare R2 Standard.
