# 04 QR — R18-work Source138 Operator Gate A/B/C Evidence Ledger

Status: DRAFT / EVIDENCE REQUIREMENTS ONLY / HUMAN NOT APPROVED / NOT EXECUTED / DO_NOT_MERGE / DO_NOT_DEPLOY. Date: 2026-10-26 JST. Existing 04 QR Workstream; this ledger supplements, does not recreate or supersede, Draft PR #167 cutover Runbook and its complete 21-Edge/7-Cron Issuer Matrix. No Staging mutation authorized.

## 0. Evidence identities and accepted boundaries

- Current Owner Source138 Draft PR #134 immutable exact SHA 7d509c1a0a934b32e20d93439314168267184cc6. Owner CI40269186095 PASS, isolated local actual PostgreSQL clean138 Bootstrap40269186076 PASS. No post-Source138 Owner code delta at this read-only audit; future Postcommit Read Suppression, Incident Resolution, or Provider Attestation will require independent NEW delta review.
- 04 QR independent Source138 Draft PR #169 exact ef4e18ba89db3439fba9199f5a6b85236f7fb9af, CI40269189996 PASS and separate actual local two-PG40269190041 PASS. 09 INT inverse-order Draft PR #170 exact d7be92ebfd7fc07b09f9a85be3e04ad7ef3f3659, CI40270011446 PASS, local actual two-PG40270011461 PASS. These are isolated Source/SQL synthetic acceptance, NOT actual signed Provider.
- Prior 04 QR Draft PR #167 exact 870c3cdf034cbf587e84548be928ed49db988dfe, CI40265328660 PASS, contains complete traffic cutover and recovery Runbook plus exact full 21 deployed Edge/7 Cron manifest. Do not recreate it or re-run Source-only suites PR #153–169.
- Connected Staging ptpdoxhrqopvczpclcij rechecked READ ONLY on 2026-10-26: 116 managed historical SQL migrations, last 20261024043436; 21 ACTIVE Edge; 7 ACTIVE Cron. Old physical WEP Generic Artifact v14 SHA fe7b0fa1f7c1c0bfec79f45da53b6d37bf43b430859f1ab6c0be410fbe57dfaa, separate Scene Product v1 SHA 6f04d6cfdae3aea99d78b1b12f0e37575c11afb04cf7584b89fda936df690045, Preset Retention v6 SHA 675b3a2213ad3233e875f9120cb89151ff3b360fc33b4a282616725b5bed6f7e remain ACTIVE. Source138 private reservation, integrity journal and release gate are ABSENT. No licensed actor login, real Storage calls or remote DDL/DML/Deploy performed.
- All A/B/C independently require an explicit human Operator record on Issue #130, NOT just a GitHub PR PASS/comment. Legal/Privacy #139 remains open; #138 Guide shared-folder exposure remains open. Source release flags graphComplete=false; retirementAuthorized=false; saveRevisionAuthorized=false; pairedGalleryPublishAuthorized=false; physicalCleanupAuthorized=false; SOURCE_FULLY_ENROLLED=0. Formal Release R17 Product Tree PASS0/PARTIAL12/BLOCKED18; do not start Release R18.

## 1. New semantic comparison snapshot for Operator Gate A

Source138 contains 138 SQL files; Staging managed history 116. Based on unique SQL filename name and version extracted from exact frozen Git tree versus read-only managed ledger:
- exact Version+Name matches: 23 historical rows;
- Staging rows with same names as a Source138 file: 111 rows representing 107 DISTINCT names (four repeat-history rows);
- shared-name Staging rows whose versions differ from Source138: 88;
- Stage-only distinct historical names: five; Source138-only names: 31.
- Stage-only names: community_core_v0_staging_media_bucket; community_staging_pg_net; community_staging_remove_pg_net; scene_preset_product_vertical_v1; scene_preset_unattached_media_discard_v1.
- Source-only contains R12–R18 gated contract and cleanup/Privacy/Identity/Writer graph migrations, especially 20261025002600 through 20261025003020; this is not a safe prefix, nor a change set to blindly apply as +22 SQL files.
- Name equality/renumbering does NOT prove identical schema semantics or compatible data transformations. Exact historical SQL content, schema shape, overloaded function signatures, triggers, RLS/ACL, job targets and versioned Storage reference/hold data MUST be manually reconciled against a disposable historical116 clone before approval.

Read-only SQL fingerprints from actual Stage at audit instant (md5 of pg_get_functiondef, for comparison reference ONLY, not cryptographic deployment attestation):
| Existing Stage public SECURITY DEFINER RPC | MD5 definition | service_role EXECUTE |
|---|---|---|
| community_publish_preset_envelope | 777735bf5fbadf5904cb1041c5f36b43 | true |
| community_publish_scene_preset_product_v1 | 6edf29d98d2454e8b69bdb3041086e56 | true |
| community_unpublish_scene_preset_v1 | 731cb9160a5bc36e14486f4a13f9ace7 | true |
| community_delete_scene_preset_v1 | 415baeb0057d5e61463f589a375ccc37 | true |

Direct authenticated/anon EXECUTE on all four inspected RPCs was false, but service-only SQL privilege does not prevent old privileged Edge Copy BEFORE SQL nor unsafe compensating object remove. All nine inspected public tables had RLS enabled (artifact_blobs, community_work_revisions, community_works, idempotency_keys, outbox_events, preset_artifacts, preset_revision_publications, preset_revisions, search_documents); actual trigger names and policy counts were read from pg_catalog and must be included in Operator's frozen raw catalog evidence, not inferred from this summary. In particular historical artifact_blobs has immutable UPDATE/DELETE trigger but not the new Source138 Published Blob registration reservation guard.

## 2. Human Operator Gate A — cutover evidence acceptance ledger (all NOT APPROVED)

A is only the **safe fail-closed swap** from old physical Preset publishers/workers, NOT permission to enable positive publication.

| Checkpoint | Must be independently verifiable before advancing | Required human role | State |
|---|---|---|---|
| A0 manifest freeze | Staging project ID, full 21 Edge old/new versions and entire fetched bundle byte SHA-256, route aliases, JWT modes, signed URL issuers, 7 active Cron jobs and actual scheduler/worker endpoint mappings, all privileged RPC call sites, raw SQL catalog/ACL/RLS/trigger policy snapshot with checksum | Deployment owner + security reviewer | READONLY PARTIAL; NOT APPROVED |
| A1 legal recovery | Protected environment settings, signed disposable change request, named change owner/rollback authority, DB PITR and tested *actual Storage bytes/version* restore on isolated clone, legal holds #139 and privacy #138 signoff, change window and abort monitors | Human Operator + Privacy/Legal | BLOCKED |
| A2 ingress barrier | Outside-legacy-Edge hard barrier covers BOTH WEP Generic and Scene, WEP Retention, alternate object/bucket aliases, direct SQL service callers, queue/webhooks, old worker tokens and old presigned upload issuers; no unrelated privacy suppression disabled | Security + deployment owner | NOT_EXECUTED |
| A3 durable drain | Zero unaccounted in-flight Copy/SQL commit/rollback/failed compensation/remove, storage version changes, claim leases, retries, signed upload capability, Cron/worker jobs; any orphan held and immutable bytes preserved. A timed sleep is not evidence. | DB owner + Storage owner | NOT_EXECUTED |
| A4 failclosed swap | Deploy precisely approved disabled Generic/Scene/Retention Edge/Worker in staged rollout while A2 barrier stays ON; attest each actual deployed bundle SHA and every old/new ingress/replica identity after deployment. No reachable old physical Copy or Remove. | Edge owner + separate QA witness | NOT_EXECUTED |
| A5 historical SQL reconciliation | Run reviewed tailored 116→Source138+ SQL in a disposable historical clone first; compare executable function definitions, per-signature EXECUTE, SECURITY DEFINER callgraph, all RLS/using/check, Trigger old/new, index/foreign-key, Storage bucket policies and old Scene-only migrations. | DB owner + Privacy/Security | NOT EXECUTED |
| A6 live SQL cutover | ONLY after A2–A4 attested, perform approved targeted SQL/ACL changes; revoke legacy Scene RPC grants and historical Generic positive route; Source138 release gate OFF, all physical Cleanup OFF. No one may revoke Scene SQL first while old Scene Edge can Copy before RPC and physically compensate SQL errors. | Human Operator + DB owner | NOT_EXECUTED |
| A7 verify/limited reopening | Fresh live actual bundle readback SHA, SQL ACL and RLS/trigger comparison; old all mutation routes deny without Storage/Work/Outbox side effects; safe public/private reads and Phase1 suppression remain. Reopen ONLY explicitly safe read/Community routes. | Independent QA + Operator | NOT_EXECUTED |

STOP/NO-GO if any unknown ingress/worker direct RPC, stale bundle/replica, unresolved Lease/Copy, stale Storage key, unexpected SQL grant/policy difference, failed PITR/actual Storage restoration, legal hold, privacy suppression regression or rollback ambiguity. Rollback must keep hard write/physical-delete barrier ON: do NOT redeploy old destructive Edge and reopen. DB PITR alone does NOT restore overwritten/deleted external Storage bytes. Record incident ID, responsible operator and signed abort result.

**Approval fields (unfilled)**: authorized project ID; signed human approval ID; named Operator, DB owner, Storage owner, privacy/legal owner and QA witness; exact frozen Owner+Edge hashes; protected Environment approval; A0–A7 raw evidence URI+SHA (restricted, no JWT/bearer/media data); schedule and drain proof; expiry and veto/abort authority; rollback+PITR and Storage-object byte recovery verified; limited reopening scope. None has been signed or supplied; do not infer success from this document.

## 3. Human Operator Gate B — real signed Provider acceptance case-to-evidence matrix

Prerequisite: A COMPLETE and independently attested; NEW Owner actual verified positive Provider contract reviewed at an immutable Exact HEAD/SQL blob; second explicit human B approval for disposable normal signed Owner A / Nonowner B / Moderator M, protected actions/consent, Provider object permissions and isolated test keys; actual Provider precondition guarantee documented (not merely Storage.copy defaults). service_role CANNOT substitute for Actor A/B/M.

| Case | Actual evidence required | State |
|---|---|---|
| B01 Owner/Creator/Auth | Valid normal signed Owner A opens eligible scoped reservation and initiates Publisher; Nonowner B and forged Creator cannot mutate; expired/retired identity and moderator-role scope rejected with independently logged JWT/session checks | NOT_EXECUTED |
| B02 Immutable create-if-absent | Real Provider atomic condition destination **absent**, source version bound, no upsert; test existing destination and competing Generic/Scene same key; one winner without overwrite, caller-visible provider precondition error; external API contract + actual raw Version/ETag | NOT_EXECUTED |
| B03 actual bytes | Approved normal PUT/Copy/GET reads full published immutable exact version, independent verifier calculates downloaded actual SHA-256, byte size, MIME and object version/ETag; no Edge/self-reported checksum accepted as provider-origin attestation | NOT_EXECUTED |
| B04 dual publisher conflicting payload | Generic and Scene same (Owner, idempotency, published key), different digest/metadata, concurrent Copy/Publish vs Discard; winner bytes stable, other returns conflict, no orphaned committed metadata and no failed compensation deleting winner | NOT_EXECUTED |
| B05 stale Lease/Fence | Timeout, late Copy after lease expiry, old-fence reporter, delayed SQL; reject promotion even if Provider responded success and retain/quarantine uncertain destination bytes without physical delete | NOT_EXECUTED |
| B06 uncertain acknowledgement | Copy completes but network ACK lost, client retries, lease renew; preserve stable version, independently re-read and reconcile idempotently without blindly overwriting or deleting | NOT_EXECUTED |
| B07 SQL atomic Commit/Outbox | Blob/Work/Revision/Publication/Search/Outbox/Idempotency all atomic under Account/Reservation/Creator/Incident lock; no partial rows from failed transaction; read back Version+bytes after actual SQL commit, repeat completed operation returns exact immutable response | NOT_EXECUTED |
| B08 Reporter-first / Commit-first | On two real DB connections with real Provider object: durable incident first prevents new Commit/replay; in opposite order, reporter blocks under lock then newly quarantines committed reference; no period of unguarded newly issued signed reads until real suppression is independently proven | NOT_EXECUTED |
| B09 Incident operator resolution | Version-fenced, independently attested Provider recovery with append-only resolution audit, explicit human authorization and actor/Creator/privacy/Moderator consistency; neither a mutable SHA report nor direct service_role UPDATE can clear incident | NOT_IMPLEMENTED / NOT_EXECUTED |
| B10 postcommit public read | Inject missing/wrong immutable object after synthetic approved published fixture and ensure public/private read, Search, Gallery/Scene/Cloud association and new Signed URL issuers deny/suppress; no unauthorized restore, while old URLs are documented separately | NOT_IMPLEMENTED / NOT_EXECUTED |
| B11 Privacy / Moderator | Restrict/restore, retired Account, Creator visibility, moderation takedown; direct URL/read endpoint and search/outbox converge, no illicit cross-Owner read, retain legal audit | NOT_EXECUTED |
| B12 old bearer/CDN | Previously signed bearer at t=0/60/300s, after expiry, warm cache and cold cache; record actual observed access including limitations and residual expiry windows; never claim retroactive immediate revocation of prior tokens | NOT_EXECUTED |
| B13 durable retry/recovery | Crash after Copy / before SQL; rollback SQL, worker restart, at-least-once retry and duplicate idempotency, no new Work on replay, quarantine object on unknown | NOT_EXECUTED |
| B14 current+historic references | Preset/Scene/Gallery/Cloud parent revisions and linked saved Published key cannot be orphaned, even after switch/restore/old referral; absence of complete graph => deny | NOT_EXECUTED |

The complete B case log must include UTC timestamp, opaque Actor label, Owner/Creator/Reservation/Fence/Idempotency/Published-version IDs, exact Edge/Provider/DB catalog hashes, expected and observed status, actual independently observed binary SHA/size/ETag, DB before/after counts, worker/Outbox traces, incident/disposition and artifact URI. Never publish email, JWT, signed bearer URL, secret, actual private media or Provider access key. Local Mock, isolated filesystem O_EXCL, synthetic database attestation and generic Storage.copy cannot satisfy B01–B14.

## 4. Human Operator Gate C — reference-and-lawful physical cleanup (separate approval)

Gate C is NEVER implied by A or B. Must first establish immutable, version-specific authorized cleanup claim and provider conditional-delete with no stale fence:
- C01: resolved/incidental current/prior-fence integrity incident with append-only operator attestation and no unknown source; otherwise DENY.
- C02: Current and historical Preset/Revision/Work/Artifact/Scene/Gallery/Cloud, Save/Restore and object-ownership graph COMPLETE, no live reference or orphaned serialized point; unknown means DENY.
- C03: outstanding Provider Copy/stage upload, lease/reservation/idempotent retry, pending Worker Claim or compensating task drained; delayed job cannot delete another Publisher's version.
- C04: Legal hold, subject access/erasure/privacy and Moderator appeal reviewed, signed approver for physical erasure, audit/evidence retention documented (#139).
- C05: Previously issued signed bearer/CDN warm/cold and actual expiry must be measured; no false promise of immediate revocation.
- C06: Worker checks source version/ETag, immutable object generation and full graph again **after** claim and immediately before conditional version-only delete; fail closed if provider lacks conditional delete. Retain dead-letter/retry/incident audit.
- C07: Controlled disposable real Provider conditional delete + exact post-delete existence check only after human C approval and independently green signed acceptance. No 72h blind TTL delete.

All C cases: NOT AUTHORIZED / NOT_EXECUTED. Reference-aware negative source-only preflight does not approve bytes removal.

## 5. New Owner delta trigger (no current implementation changes to retest)

Current verified 03 COMM PR134 Source138 SHA 7d509c1a0a934b32e20d93439314168267184cc6; no subsequent Owner patch found at this snapshot. QR PR169 & INT PR170 accepted local Source138 remain frozen and should NOT be rerun.
On newly submitted Postcommit Read Suppression or Incident Resolution or Provider Attestation, scope independent QA to changed SQL/Edge/bundle blob hash:
- Read suppression: public/private direct read, indexed Search, Gateway media, signed URL issuance, previously issued bearer limitations, Account/Moderator privacy and postcommit missing/mismatched bytes; zero unrelated suppression and no hidden Positive Commit enablement.
- Incident resolution: default deny; operator-signed immutable evidence version CAS and genuine Provider-origin independent GET+SHA+byteSize, earlier fence incidents, Completed Replay/read and physical cleanup claim, durable append-only audit and race with Reporter/Commit/Worker; no role/grant route for unconstrained resolution or service_role actor impersonation.
- Attestation/commit: actual atomic source-version-bound conditional destination creation, provider generation/ETag, independent receipt issuer, fenced DB atomic metadata commit, postcommit recheck, delayed ACK/failed SQL crash; distinguish Source tests, Mock, actual local PG, filesystem LocalCAS and Operator-approved real signed Provider. If any piece missing, no positive PASS.
Do not extend old PR #153–#169 accepted test suite. Fail unsupported new versions/functions closed, leave unaffected Guide/Moodboard/Community reads available.

## 6. Disposition and next approval request

A = **BLOCKED / NOT APPROVED / NOT_EXECUTED** (read-only old 116 / 21 Edge / 7 Cron inventory valid but not Operator signed; no quiesce/drain, no remote deployment, no semantic migration review).
B = **CONFIGURATION_BLOCKED / NOT APPROVED / NOT_EXECUTED** (positive Provider contract/independent attestor/read suppression unresolved; normal disposable signed Actor A/B/M consent and approved protected Actions missing).
C = **NOT AUTHORIZED / NOT EXECUTED** (no independent complete historical/current Cloud/Scene/Gallery graph, legal holds and conditional-version delete acceptance).

No connected Staging DDL/DML, Auth, Edge deploy, Storage Copy/Remove, signed Actor or CDN E2E executed. All Drafts DO_NOT_MERGE/DEPLOY. R17 PASS 0 / PARTIAL 12 / BLOCKED 18, seven Seed Gates blocked; Guide Human Native QA 0/315, Rights 0/45 and Ops/Privacy #138/#139 unresolved. NO formal Release R18.

Next concrete handoff: Operator #130 signs Gate A only after reviewing PR #167 and this supplemental A0–A7 evidence form, naming owners/approvals and proving clone/PITR/actual bytes restore; 03 COMM submits exact code/SQL delta for Postcommit Read Suppression, Operator-authorized Incident Resolution and independent Provider receipt. Only then 09 INT and 04 QR separately check NEW diff; protected signed B remains a distinct human-gated exercise; C separate again.
