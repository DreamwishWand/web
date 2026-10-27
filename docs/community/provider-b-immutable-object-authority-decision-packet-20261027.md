# DDVRE 03 COMM — Provider B Immutable Object Authority / Owner Decision Packet

**Date:** 2026-10-27 JST. **Decision state: HOLD / CAPABILITY_BLOCKED.**
**DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY.** No Source143, positive Writer, new attestor, actor execution, Storage write, Staging migration or physical Cleanup is authorized.

## 1. Baseline: evidence is not runtime authority

- Frozen accepted Owner functional Source142 is PR #134 commit 0b90e6681507a20c5cfa637752fb6c5a575c5d06; CI 40295103790 and local 142 migration Bootstrap 40295103855 SUCCESS. Subsequent PR134 HEAD daeca51eb6c838d9042322a2f3f67fe744e9d01f was docs only.
- Independent QR #185 HEAD 7ba385d81081cfc1aef8c2dc450b686df372d852 and INT #187 HEAD 3aa68a02e08fcbdbf981f6aa8eb3f803b40bc47a accepted bounded Source142 local legacy Media SQL negative behavior. Neither verified remote Supabase Storage bytes, real signed OwnerA/nonownerB/ModeratorM JWT, CDN tokens or the global issuer graph.
- Historical read-only Staging remains managed Migration116 / 21 active Edge / 7 Cron. Generic WEP artifact v14, distinct Scene Product v1 and Retention v6 have old Copy-before-SQL / failed-SQL compensating Remove / physical remove paths. This was the last verified inventory, not proof of live 2026-10-27 quiescence.
- Source135 SQL candidate uses synthetic attestation and private release flag inside a disposable ROLLBACK, not committed real Provider. Source137 versioned Copy adapter is unrouted and local filesystem/MOCK only. Source138–142 incidents and new read suppression are SOURCE+LOCAL; signed previously-issued URLs and Cloud/Legal history remain separate.

## 2. Owner choices and current recommendation

| Alternative | Benefit | Insufficient property / decision |
| --- | --- | --- |
| A — Native Supabase ordinary Copy | Minimal API difference | **REJECT.** Copy may upsert with UPDATE; source ETag condition does not atomically protect destination across old Generic/Scene/privileged issuers. |
| B — Native Supabase Standard Upload, upsert:false, versionless | Documented same-key create-first winner; can re-upload exactly verified staging bytes | **DESIGN HYPOTHESIS ONLY.** No native VersionID, generation-pinned read, Object Lock or global privileged overwrite proof. Requires never-reuse key, all-protocol create-only authority and independent full-byte attestation. |
| C — External genuinely versioned/locked provider | Can potentially preserve actual object VersionID, version-pinned GET, conditional creation and retention policy | **ARCHITECTURE HYPOTHESIS.** Requires new vendor/IAM/VersionID/Object Lock/delete/legal/Cloud design and Operator-approved real tests. Merely enabling versioning does not make latest pointer immutable. |
| D — Positive Publisher remains OFF | Preserves release safety without unproven provider semantics | **CURRENT OWNER DEFAULT: HOLD / CAPABILITY_BLOCKED.** Continue approved negative source work and documentation only. |

**Recommended Owner decision:** Keep D now; permit only preparation (NOT EXECUTION) of Gate A and B tests for B. If the release contract requires actual immutable VersionID and version-specific cleanup, prefer evaluating C. Do not select B based on a single successful no-upsert request. Actual project Provider B approved: NO. Gate A approved: NO. Gate C authorized: NO. Approver, date, approved exact bucket/prefix/actor and budget: NOT PROVIDED. This packet cannot itself authorize an operation.

## 3. Documented provider facts, separately classified

| Requirement | Supabase documentation | Evidence classification |
| --- | --- | --- |
| Same-key Standard Upload atomic first winner | upsert:false returns 400 Asset Already Exists on existing path; concurrent first finisher succeeds, others fail | **CONFIRMED API behavior** for this route, **UNKNOWN** for REST/S3/Copy/TUS plus privileged writers as one indivisible authority |
| Copy destination nonoverwrite | Copy is upsert-capable with UPDATE privilege; no documented destination CAS across every issuer | **UNKNOWN / not established**; never use HEAD-then-Copy |
| Source identity | S3 GET and HEAD If-Match; CopyObject x-amz-copy-source-if-match | **CONFIRMED API headers**, opaque ETag equality only; no native immutable generation |
| Immutable object version / version-target Delete | Supabase S3 Versioning unsupported; S3 Object Lock features not supported | **UNSUPPORTED**; never fabricate VersionID or infer ETag=SHA256 |
| Full published-byte SHA256/size, independent reader | Could fetch and hash bytes, but no independent remotely attested receipt exists | **DESIGN HYPOTHESIS / NOT_EXECUTED** |
| SQL+Storage one atomic ACID commit | Separate fault domains; local SQL transaction does not roll back physical object | **UNSUPPORTED as ACID claim**; bounded saga/quarantine needed |
| Provider-neutral WORM against privileged overwrites or deletes | Neither single Upload success nor RLS alone constrains all service-role/S3/legacy Worker and privileged access | **UNKNOWN**, hard adoption blocker |
| Previously issued signed URL revocation | Storage signed URLs use separate key from JWT and stay valid to expiry despite JWT rotation; CDN/browser caches independent | **UNSUPPORTED as SQL-only retroactive revocation** |

Official:
https://supabase.com/docs/guides/storage/uploads/standard-uploads
https://supabase.com/docs/guides/storage/management/copy-move-objects
https://supabase.com/docs/guides/storage/s3/compatibility
https://supabase.com/docs/guides/storage/serving/downloads
https://supabase.com/docs/guides/storage/cdn/smart-cdn

External provider feature reference ONLY, not accepted Wand capability:
https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html
https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes-enforce.html
https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html
https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-deletes.html

AWS-specific caveat: Object Lock protects specific versions, but does not prevent creation of newer versions or delete markers; unpinned latest readers can see another object. AWS conditional Delete If-Match checks current version, not an arbitrary old VersionID. Never import AWS features into Supabase compatibility assumptions.

## 4. Minimum B contract if Owner authorizes research-only real tests

1. **Issuer quarantine and source:** Protected Operator Gate A first. Establish exact complete Generic/Scene/Retention/Cron/SQL/Edge/Cloud/REST/S3/TUS/direct Storage/privileged capability inventory. Freeze/disable old physical writers and in-flight copy/removal; attest safe fail-closed Edge/worker bytes **before** reviewed Stage116 to Source142 historical SQL/ACL/RLS/Trigger work. Never SQL revoke-first. A clean source PR does not neutralize deployed Stage.
2. **Lease and identity:** One SQL Account+Creator+RequestHash+Idempotency+Reservation+LeaseFence+StateVersion, immutable intended content SHA256/Size, staging key, deterministic never-reused Published Key. Full graph/current-history/Privacy/Moderator/Legal checks. Unknown writer or reference => DENY. Staging is single-writer and frozen after reservation; reused key, stage ABA or mutable source generation means DENY.
3. **Conditional full source read:** S3 GetObject If-Match as opaque ETag precondition; compute SHA256 and byte size from actual bounded, verified Staging response body and validate Scene/schema/mime. Preserve **exact verified bytes** in a trusted buffer/spool; do NOT later Copy a mutable Staging key. Recheck stage immutability condition and current Lease immediately before write.
4. **Create-only published upload:** Standard Upload with upsert:false to never-reused destination; no overwrite, Move, Copy, compensation Delete or silent conflict adoption. Verify privilege policy also denies S3 Put, Copy, multipart/TUS, signed upload, old Scene, Generic, Retention and privileged bypass to that destination. A collision, timeout or ACK-loss gives UNKNOWN winner, not success.
5. **Separate trusted Byte Attestor:** A distinct role/credential/trust boundary directly reads entire origin Published bytes (cache-bypass), computes own SHA256 and size, corroborates content with reservation, request, Actor, key, LeaseFence and observed time. A short-lived nonce/replay-protected attestation receipt must be independently authenticated. Do not accept client-provided SHA, ETag-as-SHA, Storage metadata or reused publisher bytes as independent proof. Existing Source135 readback remains EDGE_READBACK_UNATTESTED.
6. **Commit or quarantine:** A future reviewed authority under Account/Reservation/Work/Historical/Creator/Privacy/Moderator locks checks every old/current Incident fence and independently observed object, then **one SQL transaction** writes Blob/Work/Revision/Publication/Search/Outbox/Idempotency; Provider upload precedes but is never ACID-atomic with this transaction. Source135 private gate and positive transition stay OFF until explicitly implemented and independently signed accepted. Expired lease after upload, failed SQL, lost ACK, different same-key request or crash => preserve orphan/quarantine, never physical compensation Delete.
7. **Postcommit and retention:** Object missing/hash drift => append durable Incident, block new supported readers and completed idempotent replay; no automatic overwrite/recovery/physical Delete. Existing bearer/CDN may remain usable until expiry/cache behavior; Cloud linked profiles, historical Gallery/Scene revisions, legal hold and privacy erasure are not closed by B. Physical cleanup stays C-gated OFF.

**Required invariant:** once any request wins a Published key, no other reachable Publisher/worker/privileged API may change or physically remove its bytes before, during or after database Commit and historical reuse. Source-only restrictions or one API's 400 are insufficient.

## 5. Minimum Gate proof and stop/rollback

**Gate A / protected configuration** — Requires human #130 owner/operator consent, actual backup/PITR and Storage byte recovery; complete current ingress+worker+direct RPC and SQL-callsite/role inventory; joint quiesce, drain all Copy/SQL/compensating Remove; SHA attest inert Edge+Cron workers before Source-vs-Stage semantic change. If any alias still operates, B stays BLOCKED.

**Gate B / test-only, separate explicit human approval** — Permit only disposable private object prefixes, exact project/bucket/region/storage build/SDK, normal signed A/NonownerB/ModeratorM and separate read-only independent verifier credential. Record independent predetermined fixture SHA256/size, request/response code, conditions/ETags, access principals, LeaseFence, object reader result and actor timeline; never log actual bearer tokens or secrets. Prove concurrent Generic-v-Scene same-key winner, every other API overwrite denial, Stage change/ABA, stale Lease, crash, network 5xx/ACK loss, provider success + SQL rollback, SQL commit + Provider missing, incident new-read refusal, distinct real-byte verifier attestation and old issued signed URL t0/t60/t300/expiry (warm/cold cache). **No production positive Writer** even on transport test PASS.

**Gate C / separate human scope** — Legal hold, privacy, full current/history Preset/Gallery/Scene/Cloud/media references, actual version-conditional delete and CDN/cache obligations. Physical Delete and even test-fixture cleanup cannot be assumed authorized by B; quarantine/retain until explicitly approved.

**STOP/rollback triggers:** any unauthorized alternate writer, unknown historical Stage alias, successful overwrite/delete/reuse, missing independent full-byte proof, stage ABA, mismatched content, stale-fence SQL Commit, double idempotency commit, bypassed Privacy/Incident, incomplete Account/Cloud/Legal graph, missing approved actor/PITR, unexpected old bearer exposure, or unclassified timeout. Return CAPABILITY_BLOCKED; halt ingress, maintain safe barrier, preserve quarantined physical objects and all evidence, restore only reviewed **fail-closed** configuration. Do NOT roll back to old Copy/Remove, revoke SQL first, compensate by Delete, or claim a Postgres rollback reverted Provider bytes.

## 6. QR/INT deliverables and resolution

- [04 QR independent real Provider acceptance contract](provider-b-04qr-independent-real-storage-acceptance-20261027.md): independently classify documented API, Gate A/B not executed, signed role/provider/byte/CDN probes; red/unknown => NO-GO.
- [09 INT shared issuer graph and DB-vs-Storage failure contract](provider-b-09int-writer-graph-failure-integration-20261027.md): prove all competing writers and read candidates; pinned lease/incident/SQL atomicity and eventual orphan/late retry; no local Source142 rerun.
- Human Operator #130 retains actual execution authority. #124 Gallery positive remains blocked until this contract AND media-specific signed E2E approved.
- Strict Source137 driver on native Supabase: **CAPABILITY_BLOCKED**. Versionless B: **HYPOTHESIS**. External Versioned C: **HYPOTHESIS**. Selected D: **HOLD**.
- SOURCE_FULLY_ENROLLED=0, graphComplete=false, retirementAuthorized=false, saveRevisionAuthorized=false, pairedGalleryPublishAuthorized=false, physicalCleanupAuthorized=false; Public Positive Publish, Incident Resolution, Physical Cleanup, Cloud Restore, Native DDV Writer/Apply all OFF. R17 ProductTree PASS0/PARTIAL12/BLOCKED18, seven seed/privacy/legal/ops gates still blocked. No formal R18/R19.
