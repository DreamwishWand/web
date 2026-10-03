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

### P1 — Linked DDV Profile identity/minimization — **identifier resolved / Privacy + Legal review pending**

The previous identity-source blocker is closed.

Confirmed identity source:

- `GameInfo.LastCustomIdOwner`;
- product semantics: DDV Player ID / User ID;
- existing Converter/Wand representation: `mdc{GameInfo.LastCustomIdOwner}`;
- `mdc` is a filename convention, not part of the canonical value.

Current v1.25 evidence shows the same value in accepted Nintendo Switch and later Steam/Windows
saves of the same cloud-linked DDV Profile.

Technical contract:

- parse the save locally;
- do not upload the raw save for normal linking;
- do not persist/publicly expose the raw Player ID;
- transport only the minimal identifier through the authenticated link operation;
- convert it server-side to a versioned keyed digest;
- store only that digest in `ddv_profiles.binding_key_hash`;
- keep `verification_evidence_ref` NULL by default;
- retain an ordinary revoked/unlinked/account-deletion binding digest for at most 7 days.

Evidence:

- `ops/community-linked-ddv-profile-core-identifier-gate-20261002.json`
- `ops/community-linked-ddv-profile-identity-transport-20261002.json`
- `docs/community/linked-ddv-profile-identity-transport-20261002.md`

Privacy/Legal still must review the confirmed Player ID's linkability, transient transport/logging
minimization and the exceptional correction/right-to-correction path before launch.

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

### P4 — age/minors — **Product CLOSED / Privacy + Legal review pending**

Product has now fixed the launch eligibility boundary:

- minimum age for an **independent Wand Account: 13**;
- independent registration by users under 13 is prohibited;
- accountless local functionality remains available, including local save-file editing and local
  Editor/read-only workflows;
- a parent or guardian may associate/manage an under-13 user's DDV Profile through the parent's
  Wand Account;
- no separate under-13 Wand credentials are created;
- the existing maximum-three Linked DDV Profiles per Wand Account still applies.

Decision evidence:

- `ops/community-age-minors-product-decision-20261002.json`
- `docs/community/age-minors-product-decision-20261002.md`

This closes the **Product** age-floor decision only. Privacy/Legal still must determine:

1. the minimal age-gate/age-assurance data flow and whether full DOB collection is necessary;
2. jurisdiction-specific parental notice/consent/verification requirements;
3. the permitted scope and safeguards for under-13 Community participation through a
   parent/guardian-managed account;
4. minor-specific defaults/notices/safety controls for ages 13–17.

Do not implement an age-verification vendor or complex parental-consent system merely from this
Product decision.

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


## Linked DDV Profile Product decision — 2026-10-02

Product has now closed the lifecycle decision:

- maximum three linked DDV Profiles per Wand Account;
- no ordinary self-service unlink/rebind;
- exceptional correction only after recent authentication plus support/admin review;
- correction requires a recorded reason and AuditEvent;
- raw saves and raw verification evidence are not retained after successful verification;
- ordinary binding tombstone duration is **7 days** after unlink/account deletion or support correction;
- after seven days the ordinary tombstone is removed and re-link may be allowed;
- D4 moderation/security/legal hold is the only justified extension;
- entitlement/authentication identifiers are not valid binding inputs.

This resolves the Product portion of P1/P2.

Privacy approval is still pending because DDV Core has not yet confirmed a stable local DDV Profile
identifier. Whole-save hashes/profile hashes are not acceptable substitutes because they change
with save content. The final keyed-digest construction and verification transport must be reviewed
once the stable identifier is confirmed.

Canonical Product record:

- `ops/community-linked-ddv-profile-product-decision-20261002.json`
- `docs/community/linked-ddv-profile-product-decision-20261002.md`
