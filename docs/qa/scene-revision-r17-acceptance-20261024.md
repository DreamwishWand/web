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
