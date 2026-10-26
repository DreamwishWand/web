# 09 INT — Source138 Incident Commit-veto: inverse lock ordering and provider acceptance boundary
2026-10-26 JST. Existing 09 INT, not Release Acceptance R18. **Do not merge or deploy**.

## Owner exact implementation pin

03 COMM Owner Draft PR #134 `7d509c1a0a934b32e20d93439314168267184cc6`, additive migration `20261025003020_r18_preset_integrity_incident_commit_veto.sql` (Source138). It does not rewrite Source134–137: private `preset_storage_assert_no_integrity_incident_r18` checks QUARANTINED_PENDING_OPERATOR for a **Reservation across all historical/current lease fences**, after Account FOR SHARE → Reservation FOR UPDATE, before any positive Blob/Work or completed Idempotent Replay. Public reserve/claim/readback/recovery reject quarantined reservation; Cleanup Preflight counts incident but always physicalDeleteAuthorized=false. The incident UPDATE/DELETE trigger fails closed; no provider-attested operator resolution endpoint is enrolled. Private verified Commit service EXECUTE remains ungranted and public Release Gate disabled. Owner source CI `40269186095` and full disposable actual PostgreSQL Bootstrap `40269186076` SUCCESS (Owner evidence, not independent). 04 QR independent PR169 is separately scoped, do not recreate its existing reporter-first and sibling reservation tests.

## New 09 INT independent test; cannot promote until workflow completed

`tests/09int-r18-source138-inverse-commit-reporter-2pg-independent.py`: actual two distinct PostgreSQL backend connections over original new Source138 SQL. Novel race relative to Owner/QR: **synthetic positive private Commit holds the Reservation row FIRST**, then other backend calls `community_preset_storage_report_integrity_r18`. The reporter must block with SQLSTATE 55P03 while the first transaction has the row; the synthetic release gate, fabricated PROVIDER_ATTESTED and synthetic Blob/Work/Revision/Search/Outbox commit candidate are **always ROLLBACK** before the second independent report is allowed. No false claimed positive Provider acceptance or durable synthetic Blob.

Then independently verify that `PUBLISHED_MISSING_POST_COMMIT` cannot be forged on an actually uncommitted Reservation; a valid `CONDITIONAL_COPY_OUTCOME_UNKNOWN` issue can be committed and remains immutable; even if a new synthetic attestation is fabricated in a fresh ROLLBACK transaction, the Commit now fails with `R18_PRESET_UNRESOLVED_INTEGRITY_INCIDENT_TERMINAL` and no Blob/Work leaks. Deleting/updating the Incident is forbidden, cleanup still denies physical deletion; Source release Gate remains OFF.

This is real SQL concurrency only. Two PG backends are not two signed Owner JWTs; no actual Supabase provider Storage PUT/COPY/GET/ETag/Generation was invoked. Logs/CI are separate from accepted #168 or QR#169. Sibling reservation isolation, reporter-first ordering, postcommit completed replay prior negative suite accepted; deliberately not reimplemented.

## Registry and current/historical reference safety

| Boundary | Source138 result | Release evidence |
|---|---|---|
| Active Reservation with any unresolved previous/current fence | VETO before first Commit and completed Replay | actual SQL; source scoped only |
| Reporter-first vs Commit-first serial order | Row lock Account SHARE → Reservation UPDATE serializes; opposite order independently tested | actual two-PostgreSQL when CI green |
| Immutable incident / manual resolution authority | no UPDATE/DELETE, no release RPC; separate Operator-proof CAS unresolved | FAIL_CLOSED; future design required |
| Preset Blob/Work/Revision/Search/Outbox atomicity | SQL transaction all-or-nothing; no leakage from vetoed Commit | actual disposable PostgreSQL transaction; **not Storage atomicity** |
| Cleanup issuer / late Retention Worker | source denial retained; deployed Staging v6 still removes | STAGING_UNENROLLED / UNKNOWN |
| Current+Historical Scene/Gallery/Cloud/Legal refs | no full graph verification or public postcommit read suppression | UNKNOWN; `graphComplete=false` |
| Privacy / Retired Identity / Moderator Restrict | existing Owner source barriers unchanged, new SQL actor/creator checks retained; no new signed test | SOURCE_SCOPED, genuine signed NOT_EXECUTED |
| Signed Staging / real Provider Version-ETag byte attestation | no conditional immutable Copy/readback attestor accepted; Source Mock and local filesystem differ | NOT_EXECUTED / CONFIGURATION_BLOCKED |
| Reported incident after DB Commit and Provider object missing | journal + replay veto only; already published public discoverability, signed CDN/cache, in-flight cleanup not suppressed by this migration | **UNRESOLVED RELEASE BLOCKER** |

## 03 COMM P0 next contract

- Provide **versioned provider-origin independent attestation**, conditional immutable/no-overwrite byte identity, DB atomic Commit *with* graph-wide current/historical refs; never treat client/Edge-reported SHA or local filesystem O_EXCL as proof of deployed Supabase immutability.
- Preserve unresolved incident immutable journal and non-granting cleanup; design separate **Operator-approved** append-only resolution with provider-origin version/readback, identity, privacy/legal hold, full reference audit and lock-consistent CAS. Do not permit a stale/replayed completion after journal records uncertainty.
- A postcommit missing-object Incident is **not read suppression**; a previously published Work/Revision and prior CDN bearer could remain discoverable. Before enabling positive Writer, enroll full public projection and previously issued signed URL/Cache handling. Disable/deny physical cleanup until every current/historical Gallery/Scene/Cloud reference and worker claim is proven.
- Old Stage116 old active Generic v14/Scene v1/Retention v6 remain; Source138 is unmerged/undeployed. Human Operator #130 must approve quiesce/drain in-flight old Copy and Worker, exact 21 Edge +7 Cron/indirect Vault targets, safe failclosed Edge bundle parity first, then reviewed SQL privileges 116→138 semantic migration, with PITR/rollback/legal protections. SQL-revoke-first against active old Scene Copy→SQL→physical compensation remains unsafe. No Staging changes performed.

## 04 QR real signed acceptance matrix (only after Issue #130 approved)

1. Normal signed disposable OwnerA, nonownerB, ModeratorM, retired/suppressed Account, Creator restricted: new Incident vs first public Commit and old completed replay.
2. Verified actual provider immutable conditional Copy/no-overwrite/version ETag+Generation, independently downloaded SHA256/size readback before/after DB Commit; same key/different bytes/metadata across two independent Scene/Generic RPCs.
3. Reporter-before-Commit, Commit-before-Reporter and simultaneous Provider bytes mutation with 2 PostgreSQL sessions; old/new fence and expired lease; crash after physical Copy/failed SQL, crash after DB Commit/provider missing object.
4. Veto and read suppression of all public current+historical Preset/Gallery/Scene/Cloud references; account legal hold, Moderator Emergency Restrict, delayed Retention Worker physical remove, claim/cleanup and actual negative object GET.
5. Already issued bearer CDN URL t0/t60/t300/post expiry, warm/cold caches, no overclaim of revocation.

**This test is NOT a true Provider/DB atomicity acceptance**, and Source138 repair is source-scoped. Operator Issue130 protected actors, historical migration equivalence, legal/PITR and immutable provider version evidence remain BLOCKED.

## Release

`SOURCE_FULLY_ENROLLED=0`, `graphComplete=false`, `retirementAuthorized=false`, `saveRevisionAuthorized=false`, `pairedGalleryPublishAuthorized=false`, `physicalCleanupAuthorized=false`. Positive Preset/Physical Cleanup, Cloud, Native DDV Writer/Apply OFF; all Drafts DO_NOT_MERGE/DEPLOY. Release Acceptance R17 ProductTree30 PASS0/PARTIAL12/BLOCKED18 unchanged; no Release R18.
