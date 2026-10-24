# 08 WEB / V17 private consumer compatibility and issue return — 2026-10-24

**Status:** PRIVATE_REVIEWER_COMPATIBILITY_PASS / PUBLICATION_GATE_HOLD. This is NOT a public Guide content import.

## Evidence consumed
- Drive current V17 machine `DDV_07DBK_GUIDE_SYSTEMS_GAME_NATIVE_LOCALIZATION_V17_2026-10-24.json`, SHA-256 `64a6aea830f8d3e371bcb23cc122e5bf2b45d70384f7e6d869d4e7682df39f9b`, exact byte SHA verified in isolated local runtime.
- 07 DBK 45 Reviewed EN crosswalk `1LBzUVcwlRV9ViaYIcMjqaqV_2CtShehK`, all 45 `articleId|sourceEnglishGuidanceSha256` matches V17 EN `articleId|previewBodySHA256` after sorted 45-pair digest crosscheck; no 45-page source identity drift.
- Existing 7 Owner-approved category definitions, 21 groups, 45 article IDs / 44 distinct primary anchors unchanged.
- Switch v1.25.0, BID `52BD625D9B4E0053`, save schema `624`, fullVersion `releases_1.25-v1.25.0-8687-gdd3d3a5ae738-incremental-14` is the **source-tree** provenance. Co-location with NSO does NOT prove an independent cryptographic signature tying every LocDB ZIP to NSO. v1.25.3 / Steam not approved.

## Real V17 inspection (counts are source-derived; no bodies copied into this repo)
| Contract | Result |
|---|---|
| V17 root schema | `ddv.guide-systems-native-locdb-provenance-promotion@17`, PASS |
| Locale code bridge | V17 `EN,FR,IT,DE,ES-ES,JA,ZH-CN,PT-BR` → UI `en,fr,it,de,es-ES,ja,zh-CN,pt-BR`, explicit bridge required |
| Canonical IDs / Source SHA | 45/45 exact crosswalk match, PASS |
| 360 article-locale keys | 360 unique, all 8 per article, PASS |
| 315 non-EN AI editorial titles/bodies | 315/315 match consumer title / body SHA; recomputed text SHA 315/315 PASS |
| Human Review QA | 0/315 approved; all 315 remain HOLD |
| Per-article Rights / Runtime checks | 45/45 NOT_SIGNED; Switch1.25.0 current-runtime recheck false; Switch1.25.3 / Steam NOT_REVIEWED |
| Public eligibility | 0/45, unchanged |
| Native correction overlays | 11 checked as exact v1.25.0 ZIP SHA / UI term only, not mechanic proof or article-translation approval |
| Long localized titles | 22 of 360 are >=40 Unicode code points; max 56; DE 6 / FR 4 / IT 5 / ES-ES 4 / PT-BR 3 |

## Actual consumer incompatibilities / issues back to 07 DBK
1. **CONTRACT GAP (not corrupted data):** V17 is a private reviewer corpus with `editorialGuidanceText` (flat five-section prose) and `previewBodySHA256`. Existing public `ddv.guide.systems-public@1` requires distinct reviewed `prerequisites[]`, `instructions[]`, `warnings[]` plus all-eight-reviewed localized objects. Do not split sections heuristically; 07 DBK must deliver an explicit independently reviewed structured-public-article producer and ownership/provenance fields after human approval.
2. **TRANSLATION PUBLICATION HOLD:** all 315 non-EN texts are AI-edited; 0 human-approved. The correct fallback is private reviewer state / public empty. Neither translated public title nor full body should appear in `src/`, `static/`, or built assets before human signoff.
3. **NATIVE TERM SCOPE:** `nativeZipToTargetBuild=CONFIRMED_SWITCH_V125_VERSION_TREE` for 315 localized consumer records refers to file-tree provenance, whereas `gameArchiveZipToExactBuildBinding=UNVERIFIED` in individual editorial rows indicates the narrower cryptographic binding has not been proven. This is a deliberate evidence granularity distinction, **not** permission to call a UI label mechanic truth. Keep `verifiedV16NativeCorrections11` as private search aliases only until human QA.
4. **RESPONSIVE NAME RISK MITIGATED in WEB:** 22 long localized titles (maximum 56 code points), including unbroken synthetic test strings. `/guide/systems/` browse now applies `overflow-wrap:anywhere`; 320px + keyboard Browser checks use synthetic long-name content.
5. **LOCALE NORMALIZATION:** explicit uppercase V17 locale IDs mapped to supported UI locale values, `EN` vs `en`, `ES-ES` vs `es-ES`, and ZIP archive `en-US` / `es` vs article locale code. Unknown locale must be rejected, not silently EN-public-fallback.
6. **CURRENT VERSION CONTEXT:** article IDs/category/subgroup/source SHA are consistent; no detected duplicate, swapped category or bad Source ID. But native exact UI terminology does not establish live-content events, entitlement or time-sensitive rotation. Additional live QA needed.

## 08 WEB implementation / CI
- Existing Draft PR #133 continues; no Gallery PR #105 files touched. All public compiled approved-page allowlists and shipping `systems-public.json` remain empty. Legacy static Guide Systems/CHC Issues remain empty as separately gated.
- A **test-only** V17 reviewer adapter resides at `tests/fixtures/guide-systems-v17-private-consumer.mjs`; `scripts/audit-guide-v17-private-corpus.mjs /private/path/V17.json` checks the *exact* V17 raw SHA and validates joins while outputting only aggregate, non-publication-safe facts. It is deliberately not imported in `src/`.
- Synthetic contract tests exercise 360/315 joins, English hash, rights HOLD, human review HOLD, fake approval, unknown locale/version/schema, Native ZIP term-only scope, and ensure private text isn't emitted to public adapter results.
- Isolated Chrome test rejects V17-shaped private corpus at the public manifest URL, still rejects forged public flags with the compiled empty allowlist, exercises 7 categories, JA/EN search, supported version only, published-only Detail, 8-locale/320px and long strings.
- Existing built static release audit inspects emitted assets for all 45 unpublished EN SHA signatures and checks `publicApproved=0`. **It is not a guarantee against all possible future unapproved text leaks; public publication remains a reviewed, separate change gate.**

## Release acceptance (unchanged)
All eight human-approved pages = 0/45; rights/independent locale approval/version and real publicly reviewed page seed incomplete. 04 QR public/signed production acceptance not executed here. R17 GDE-SYS and SEED-GUIDE BLOCKED. All Draft PRs unmerged. DDV Native Writer / Product Apply and Gallery unsafe mutations OFF.
