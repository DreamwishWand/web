# 04 QR — Scene Revision Release Acceptance Contract (R17, 2026-10-24)

Workstream: **existing 04 QR**. This is negative-only acceptance while Scene Save Revision writer, paired Gallery Media/Cover transaction, R6 all-writer lifecycle contract and native Apply are unaccepted. QA companion Draft PR #136 is based on source candidate Draft PR #134 **without integrating that source into Gallery #129 or changing Signed Gallery PR #132**.

Platform scope: Nintendo Switch DDV v1.25.0, BID `52BD625D9B4E0053`, schema 624; no automatic Steam or Switch v1.25.3 write compatibility.

| Case | User job / test contract | Evidence now | Release verdict |
|---|---|---|---|
| SCN-01 | Create a Scene artifact with owner, stable Work/Artifact/Revision IDs | PR134 source/bridge + offline tests, synthetic 113 SQL bootstrap only | PARTIAL, signed owner/media not run |
| SCN-02 | Save revision on an **existing Scene**, preserving ownership and prior revision | Owner diagnostic readiness flags `saveRevisionAuthorized=false`; no production writer | BLOCKED |
| SCN-03 | ArtifactBlob bytes validation, SHA/size, portable identity and SubGrid/Road/Fence normalization | Source type validation + synthetic checks; no signed actual file bytes | PARTIAL |
| SCN-04 | Gallery paired Media 1–10, immutable Cover, atomic Scene + Gallery commit | Inert local paired transaction fixture only, no actual authenticated Gallery media | BLOCKED |
| SCN-05 | Public **current revision only**, no raw Storage Key URL / historical body leakage | Source projection; Staging public current function exists; 0 published Scene Works | PARTIAL |
| SCN-06 | Owner historical revisions, current/historical Gallery references, Creator and Work ownership | PR134 owner readiness source checks; Staging owner readiness RPC **not deployed** | BLOCKED |
| SCN-07 | Signed owner media access, non-owner 403 and anonymous denial | No authorized normal Auth A/B/M / origin bytes | CONFIGURATION_BLOCKED |
| SCN-08 | Stale `rowVersion` 409 / simultaneous writers / global R6 graph locking | Single-host/synthetic fixture only, true independent normal sessions and all-writer graph unaccepted | BLOCKED |
| SCN-09 | Repeated idempotency key same outcome, conflicting key rejects, failure retry | Source and local SQL test only; no real authenticated retry across network | BLOCKED |
| SCN-10 | Rollback after partial Scene/Gallery/Media failure without orphan or double reference | PR134 disposable local SQL rollback suite; no real Storage atomicity or operator race | PARTIAL |
| SCN-11 | Cross-product Preset/Gallery current/historical references during owner/moderator/account-erasure updates | Three known-writer fences, R6 candidate; global all-kind fence not accepted | BLOCKED |
| SCN-12 | Discover → Library Save → Read → WEP Preflight → Reuse; native Apply kept OFF | Existing WEP bridge synthetic flow and source acceptance; not normal user-to-user E2E | PARTIAL |
| SCN-13 | Privacy, RLS, moderation, media rights and update/version resilience | RPC read-only scoping and owner-only negative gates; no reviewed runtime/privacy/legal signoff | BLOCKED |

**Executed:** QA `tests/qr-scene-r17-release-negative.test.mjs` cases SCN-01–07 validate source-only fail-closed properties without a writer; existing PR134 `local-clean-bootstrap-scene-paired-update-v1.sql` is synthetic local-only. Staging read-only SQL returned **10 Scene artifacts / 5 associated Gallery / 0 published Scene Works**, `community_get_scene_preset_public_v1(uuid)` present, `community_scene_revision_readiness_v1(uuid,uuid)` **absent**. Source and Staging functional parity therefore NOT_ACCEPTED. No live publisher, storage or device mutation.

**Not executed:** authorized normal Auth Actor Owner/Non-owner/Moderator, Storage signed binary and CDNs, real Scene Save Revision writer, independent two-session global lifecycle contention, real published revision and moderation, native Apply, production browser, physical Gallery removal, Cloud restore.

R17 bindings: `PRE-DISC` **BLOCKED**, `PRE-LIB` **PARTIAL**, `PRE-ING` **BLOCKED**, `SEED-PRESETS` **BLOCKED**. No Scene-specific seventh product or new Core node. Source/CI is not a release PASS.

Gate to promote: 03 COMM+09 INT+02 WEP must produce a reviewed writer API with owner/version/atomicity contract, artifact/media/storage and global R6 all-writer locks; QR then runs disposable normal-auth positive/negative, real Storage and independent two-session cases; Native DDV Writer/Product Apply remain OFF until their distinct acceptance.

## QR cross-stream integration addendum — after 03 COMM #134 and 02 WEP #135 (2026-10-24)

**Actual source revisions used**: PR #134 `720c1a5155620f652c8cc71c8532bfacaff6d03e`; PR #135 `9fac321f0a3fd469615731db038c2e0ae88277c1`. WEP PR #135 is based on an **older** #134 commit `25202608cad55a203c101bbcd84f52bd0e5797b8`. Its untouched owner branch is therefore not certified synced by its own base. 04 QR's QA-only integration branch `integration/qr-scene-revision-r17-acceptance-20261024` combines their **non-overlapping changed WEP files** with the latest PR #134 via non-force and recorded two-parent commit; it does NOT update #134/#135/#129 or Signed Gallery #132. No owner PR is automatically approved for merger.

**New executed acceptance**:
- `QR-SCN-INT-01`: read `community_get_scene_preset_public_v1` SQL JSON projection keys and compare all typed WEP fields, exclude signed URL/storage key/historical media from DTO.
- `QR-SCN-INT-02`: verify `community_scene_revision_readiness_v1` SQL owner/identity/version/counter/graph flags and four exact WEP write-blocked reasons.
- `QR-SCN-INT-03`: reject mismatched Gallery Work/Revision/Cover, duplicate media, invalid SHA/revision and stale WEP Current↔Owner identity; offline only.
- `QR-SCN-INT-04`: forged `ownerEligible` / graphComplete / saveRevisionAuthorized / atomic fingerprint and missing blockers fail closed, Save Revision always rejected.
- `QR-SCN-INT-05`: 03 COMM private Scene revision paired writer remains **DB-owner-only / REVOKED including service_role**; no Edge command/public positive Writer, regardless of successful synthetic DB fixture.
- `QR-WEP-BROWSER`: actual Chrome against isolated locally running Presets page using synthetic HTTP interception, current Scene+cover display, expiry/retry denial, altered Cover denial, 320px overflow and zero Page/Console error; **no real JWT/Storage/CDN**.
- WEP own tests and 8 locale UI diagnostics now pass in same combined CI, while native Apply/persistent writes remain disabled.

**Executed CI evidence**: combined exact HEAD `9d60fe95e969297fc82f7193fd38e33ba04b1082` [Actions 40081821723](https://github.com/DreamwishWand/web/actions/runs/40081821723) SUCCESS 1021 total/1009 PASS/0 FAIL/12 old SKIP; isolated [Chrome job 40081818046](https://github.com/DreamwishWand/web/actions/runs/40081818046) SUCCESS, 7/7 QR cross-source tests, Chrome synthetic fixture completed with no error. Two distinct kinds of evidence must not be conflated: **real browser process** but **synthetic network/identity/media**; source contract but **not real signed runtime**.

**03 COMM new source-only stage**: `private.scene_save_revision_paired_candidate_v1` can atomically create two new preset/Gallery immutable Revisions and switch Cover in local disposable PG with stale/duplicate/idempotency/rollback negatives, but no service_role grant, Edge Writer, real object bytes or normal Auth; PR #134 source-to-Staging functional parity remains PARTIAL. **09 INT R7** has proven one disposable two-connection source-derived generic PresetWork `community_unpublish_work` lock candidate, but not all writers (Gallery-first, moderation, account erasure, other Preset types), not Staging true session. Keep graphComplete and retirementAuthorized false and do not infer end-to-end transaction safety.

**R17**: PRE-DISC BLOCKED, PRE-LIB PARTIAL, PRE-ING BLOCKED, SEED-PRESETS BLOCKED; all other 30-node scores untouched (PASS0/PARTIAL12/BLOCKED18). Human/real staging acceptance and full historical referential/ownership/three-party signed media/URL/CDN/404/403/409 cases remain NOT_EXECUTED. Positive retirement, Cloud Private/Restore, physical cleanup, 72h retention and native DDV Writer/Product Apply remain OFF.

**Required next**: 03 COMM+09 INT agree one universal R7 all-writer lock/Media order, historical graph validation and moderation/erasure right-to-remove; 02 WEP reviewed 03 COMM API Writer with exact byte validation + TTL/retry; 04 QR authorized real disposable A/B/M staging signed HTTP and independent two-session scenario. Until then no enablement.

## Latest 03 COMM + 02 WEP return: Offline Artifact proof is NOT a Save Revision Writer (2026-10-24)

**Latest owner revisions now integrated only in QA:**
- 03 COMM source Draft #134 HEAD `8857c958c0bdfa657dc4ca9825e24f94a3315655` (3 owner commits after prior source); latest paired Scene Media/Cover SQL guards and owner read-only contract tests.
- 02 WEP source Draft #135 HEAD `26687dadff85fd3a7f30a1c361e8ab0139bb6d1e` (8 owner commits since prior): new `src/lib/wep/scene-revision-offline-intent.ts` + tests, exact Game v1.25.0 BID `52BD625D9B4E0053`/schema624 gating, required SubGrid descendants, capture Road/Fence bits, local JSON UTF-8 byte-length+SHA256 proof. It returns **NO READY Media manifest**, **NO Cover**, **NO registered ArtifactBlob**, **NO authorized writer**, **NO signed URL/Storage**. It is proposal-only and cannot itself prove real ownership, actual byte registration, current Gallery `rowVersion` or global R7.
- 04 QR integrated QA branch `integration/qr-scene-revision-r17-acceptance-20261024` has both latest source lineages with safe expected-SHA two-parent grafts, no changes to original Draft #134/#135/#129, Signed Gallery QA #132 or main. Owner WEP #135 base is still older `25202608cad55a203c101bbcd84f52bd0e5797b8` than latest #134; QA integrated source result is not proof the owner child branch is synchronized.

**Additional formal QA `QR-SCN-INT-06`:** Verify Offline Intent uses verified Switch 1.25.0 source, bytes SHA/size, all media/ArtifactBlob/Writer/Apply flags **FALSE**, no network actions; compare required DB private candidate `p_expected_gallery_work_version`, registered ArtifactBlob ID, READY/CLEAR Media IDs + Cover against the offline-only intent. As expected, offline intent has no authoritative Gallery rowVersion or registered physical blob; no positive Writer may be enabled.

**Latest executable result:** exact QA HEAD `b07b6ca47caf34e33b9ee45cf5a654af2e905b9f` [GitHub CI #40082670521](https://github.com/DreamwishWand/web/actions/runs/40082670521) **SUCCESS: 1028 tests / 1016 PASS / 0 FAIL / 12 inherited SKIP**. [Actual Chrome #40082667825](https://github.com/DreamwishWand/web/actions/runs/40082667825) **SUCCESS**, independent cross-source 6/6 + older negative-only 7/7 (13/13) and synthetic HTTP Current Cover/expiry/tamper/320px browser PASS. Browser is real; identity, Gallery Media, CDN/old issued URLs are synthetic. No actual auth or Storage acceptance.

**R17 status unchanged**: PRE-DISC BLOCKED / PRE-LIB PARTIAL / PRE-ING BLOCKED / SEED-PRESETS BLOCKED; 30 nodes PASS0/PARTIAL12/BLOCKED18. P1I/native Apply independent E2E not touched. Global current/historical/Moderator/Privacy-erasure Gallery/R7 locking and two-session Staging proof remain missing, so `graphComplete=false`, `retirementAuthorized=false`, all unsafe writers/Cloud Private/Restore/physical delete/72h OFF.

## Latest R9/R11 caller-history and known reference writer acceptance (2026-10-24)

**Sources QA actually used:** 03 COMM current Draft #134 `d2e4576830bb7e37e4f7981c5777912e7b3be85c` source; 02 WEP current Draft #135 `2ab11d528d43b54a5afee4856f80ffe9abc4ee69`; 09 INT R11 validation `9e1e714fa495aadfdf5b8190866150aa34d34ced` (test alone is insufficient: it was executed AGAINST the current #134 migration in QR's own 113-migration isolated DB). All sources combined in QA-only Draft #136 via verified non-force source merges; **none of the owner PRs or Signed Gallery PR132 was modified**.

| Release gate | Executed evidence | Verdict |
|---|---|---|
| R9 stale historical caller graph changed BEFORE request | Real local PG17: new noncurrent edge within same GalleryWork leaves both Work versions unchanged, old caller SHA rejected with `SCENE_REVISION_CALLER_EDGE_FINGERPRINT_STALE`; snapshot/rollback unchanged | PASS, isolated only |
| R11 reference INSERT in GalleryRevisionPreset | Two real PG sessions, Gallery Work holder blocks writer; 55P03, rollback | PASS, isolated only |
| R11 PresetArtifact associated Gallery reference update | Same real Gallery Work lock, 55P03 and rollback | PASS, isolated only |
| R11 PresetRevisionPublication INSERT | Same real Gallery Work lock, 55P03 and rollback | PASS, isolated only |
| GalleryWork rowVersion stale/invalid | New QR standalone local source RPC negative requiring `SCENE_REVISION_ROW_VERSION_CONFLICT`, no side effects | Pending exact-head R11 job until proof recorded |
| Concurrent historical edge during held GalleryWork lock | R11 known-reference trigger blocks legitimate edge writer before commit; exact before/after graph source recheck in paired Writer | PARTIAL: bounded 3 trigger paths; unregistered writers unproven |
| PresetWork lifecycle update avoids or follows common locks | Generic owner lifecycle fail-closed pending global Writer registry, no safe positive lifecycle Writer | BLOCKED for global contract |
| Retry after lock contention rechecks effective actor authority/current-history graph | R11 local rollback→new transaction success/replay; same-owner synthetic fixture and source recheck; no independent normal JWT/moderation/erasure actor | PARTIAL |
| Partial Work/Media/Search and late exception rollback | Local 113 migration true SQL rollback, no partial persistent updates; no real Storage/Cloud bytes | PASS isolated, NOT signed Storage |
| Real normal A/B/M Auth, signed Storage, public/current/history, 409, Cloud/CDN | Protected Actor secrets/approval not available | NOT_EXECUTED |

**Latest standalone evidence:** earlier code-head [local R11 #40088243931](https://github.com/DreamwishWand/web/actions/runs/40088243931) SUCCESS against #134 latest source. Output included holder/writer PIDs, Lock/55P03 and `R11_ALL_THREE_KNOWN_REFERENCE_TRIGGER_LOCKS_LOCAL_PASS`, stale old SHA rejection, same-owner fresh caller SHA candidate; **allWriterGraphComplete=false** and retirementAuthorized=false. Source QA positive currently stopped at inert DB candidate; a green Source CI isn't a user-job PASS.

**New independently authored 04 QR regressions:** `QR-SCN-R11-01..03` check current #134 caller-pinned SHA under Artifact/PresetWork/GalleryWork lock ordering and before new Revisions; check Owner Readiness returns GalleryWork rowVersion/current Work revision and scoped historical digest as DIAGNOSTIC only; ensure WEP offline proposal has null expected GalleryWork rowVersion & historical pin and false all authorizations; ensure three trigger definitions exist and local R11 script checks all 3. Additional local actual SQL test verifies GalleryWork stale rowVersion without mutation. R11 fixture is based on independent 09 INT validation but uses latest 03 COMM source, not stale cloned SQL.

**Limit:** signed owner read-only Readiness on Staging is not deployed, real bytes/ACK and global Writer/Owner/Moderation/Erasure graph remain unavailable. All current published/Cloud positive operations and native DDV persistent Apply remain OFF.

**R17 30 PASS0/PARTIAL12/BLOCKED18**, PRE-DISC BLOCKED, PRE-LIB PARTIAL, PRE-ING BLOCKED, SEED-PRESETS BLOCKED. Re-evaluate upon deployed full graph generation + all-writer proof + approved disposable normal A/B/M/storage + moderator/account-erasure acceptance; never promote from local SQL/CI alone.
