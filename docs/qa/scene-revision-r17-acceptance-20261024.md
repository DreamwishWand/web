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
