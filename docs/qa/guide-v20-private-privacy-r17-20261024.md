# 04 QR — Guide V20 P0-C01 Private Corpus & Legacy Drive ACL Acceptance (2026-10-24)

Scope: **existing 04 QR**, companion Draft PR #137 based on owner WEB #133. No raw/private editorial bodies are committed or published. Material is source/evidence-only; R17 GDE-SYS and SEED-GUIDE remain BLOCKED.

## Independent read-only validation of actual Drive V20 source

Two files obtained through the authorized connected Google Drive read path and examined in an isolated runtime; their contents were NOT checked into web or exposed in issue comments:

| Input | Actual local raw SHA-256 | Status |
|---|---|---|
| V20 P0-C01 private evidence/reviewer JSON | `9b3bc9301d2052f42c3152d85fd4b594b67f24a781d2e77d0c820b3ddc280118` | Owner-only metadata |
| Matching V20 metadata-only publicsafe return JSON | `cbbb4f3d8c6320c56dc68d005f888c2ef4f474fc61f00ad1e843634753b5a502` | Owner-only metadata |

**Actual source content cross-check:**
- Private source schema `ddv.guide-systems-p0-collection-inventory-source-evidence@20`, `REVIEW_ONLY_DO_NOT_PUBLISH`; publicsafe schema `ddv.guide-systems-p0-c01-publicsafe-return@20`, `PUBLICATION_BLOCKED`.
- Exactly 4 article identities (Collection discovery, Backpack inventory, Storage chests, Scrooge shop catalogue), **28 unique non-EN reviewer rows (4 × 7)**, six distinct source documents and 12 source-document proof occurrences.
- All 28 reviewer source-English SHA values match the corresponding 4 source audit rows. Each source row is pinned to Nintendo Switch 1.25.0, BID `52BD625D9B4E0053`, schema624; 1.25.3 and Steam review are NOT accepted.
- Private 4-audit metadata and publicsafe 4-audit metadata were **identical**. Publicsafe JSON has no `reviewerOnly28` or editorial body/title/source English prose field; `reviewerOnlyTextIncluded=false`, `noPublicDraftPayload=true`. This inspection does not prove the **entire Google Drive link-sharing history** is private, nor authorize serving the publicsafe JSON as an article.
- Human/native QA signoffs **0**, rights approvals **0**, Switch1.25.3 **0**, Steam **0**, public eligible **0**. Of the 28, 17 had no direct native oracle attached and 11 had an attached oracle requiring independent scope review; such source references never stand in for human approval.

**Reproducible CLI/test:** `node scripts/qa-guide-v20-private-privacy.mjs --check-private-and-publicsafe <private-local-file> <publicsafe-local-file>`; output is metadata counts, SHA and BLOCKED only. `node --test tests/qr-guide-v20-private-privacy.test.mjs` checks 4×7 completeness, tampered locale/SHA/source version, rights/publication and recursively nested reviewer body injection. GitHub CI tests **synthetic mock data only**; actual private files were inspected separately read-only, not run through Actions.

## Direct Drive ACL vs Web manifest

**CONFIRMED CURRENT metadata:** old legacy Broad-share folder has **0 direct children** but retains `anyone:reader` (link-only, file discovery disabled). Private reviewer folder, V17 raw corpus, V20 private and V20 publicsafe return each are **`shared=false` with only owner permission**. Existing old-folder anonymous permission is an Ops/privacy hygiene issue despite the empty folder. Current access control does **not** establish that historical third parties accessed/downloaded content, or that previously distributed copies/caches have been removed: those remain **UNKNOWN**. QA made no changes to permissions and does not provide public issue links to raw reviewer material.

Public `systems-public.json` contains zero eligible articles, and 08 WEB static audit examined 211 emitted text assets with no detected unapproved source leakage in its bounded scanners. These facts are independent of Drive ACL correctness and past link access.

**Privacy/Ops gate:** responsible 07 DBK / Drive Owner must explicitly approve removal of obsolete anonymous permission, verify that no legitimate ETL or reviewer workflow uses legacy folder, grant only named reviewers, and review provider audit logs if available. Do not assert any historical exposure as fact. Issue #138 remains OPEN.

## Release acceptance

| Gate | Evidence | R17 |
|---|---|---|
| V20 4×7 private source crosswalk | Actual raw read-only match | SOURCE PASS, not publication |
| V20 publicsafe metadata / no draft fields | Actual read-only + synthetic mutation tests | Bounded PASS |
| Web 8 locale / 320px / static / unauthorized browser | Existing isolated Chrome; positive articles synthetic | PARTIAL |
| Human native UI signoff 315 & rights 45 | 0 signed | BLOCKED |
| Approved current Switch1.25.3 / Steam article mapping | 0 signed | BLOCKED |
| Legacy Drive anonymous folder ACL | Folder empty but anyone-reader still present | PRIVACY BLOCKED |
| Historical accesses/downloads/cache | No logs or evidence inspected | UNKNOWN |

No Guide node promotion: **R17 30 nodes PASS0/PARTIAL12/BLOCKED18**; GDE-SYS and SEED-GUIDE BLOCKED, no R18. No draft merge, no Cloud Private, Gallery positive retirement, physical deletion/72h, Native DDV Writer or Product Apply.
