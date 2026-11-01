# 02 WEP / 2026-11-01 DEC-WEP Read-only compatibility and UX delta

**Status:** DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY. Workstream: 02 WEP / World Editor & Presets. Release R17 Product Tree remains PASS0/PARTIAL12/BLOCKED18.

## Canonical / source check
- SSoT: DDV_CURRENT_STATE, DDV_WAND_RELEASE_ROADMAP_CURRENT (2026-11-01), 02 WEP Current Handoff, DDV_CORE_SAVE_HANDOFF_CURRENT, DDV_CORE_RUNTIME_HANDOFF_CURRENT and 01C Road/Fence handoff. No original private save is committed or re-executed.
- Existing approved core exact-build reader is reused by already-merged PR #125, main `71e568c9b576c54f8d100fae2ae883c835de7602`: `openWorldSaveBytes` branches schema 626 to `evaluateProfile626ReadOnlyCompatibility` only if packaged P1G, actual user-attested Switch storage/ExeFS provenance, known Switch BID `9A239D3DB569756D`, schema626. Steam schema626, unknown/mismatched BID and plain JSON626 reject. The exact read contract is NOT a writer permission.
- Earlier 01A P1G acceptance and 01E PR #274 04 QR 8/8 SOURCE acceptance are inherited, not rerun. 01C v1.25.3 Road/Fence source/static COMPATIBLE, native runtime not promoted. ROAD-R04 mirrored negative-Y mixed q5 still deferred and fail-closed per Owner 2026-11-01 policy.
- Existing 624 `world-save-source.ts` Area/Grid/Floating Island route+Core reader and `world-browser-adapter.ts` `projectSwitchAreaGrid` etc unchanged; Editor Runtime, Canvas coordinates, layers, focus navigation, local draft Undo/Redo, history restore, Review Changes, topology-aware Road/Fence preview/negative are unchanged. Prior PR #75/#76/#80 are preserved.
- Existing 626 `compatibility.routesAuthorized=false`, `editingAuthorized=false`, `verifiedReplacementCandidateAuthorized=false`, `productApplyAuthorized=false`, `persistentWriteAuthorized=false`; returned `areas=[]` and `floatingIslands=[]` mean no 624 projector called. UI branch `data-wep-626-readonly` is distinct from all 624 Canvas/edit/export handlers.

## Precisely new delta
- `src/lib/wep/world-save-source.ts`: **structural-only** sum of `GridCollection.Grids[*].Objects` dictionary entries on accepted 626 P1G, as `structuralDiagnostics.gridObjectEntryCount`. If `Grids` or any Grid `Objects` is absent or malformed, use `null` (unknown) rather than misleading zero or interpreting version-624 types. No contents, dynamic IDs or private save data in output.
- An extra machine diagnostic `WEP_SCHEMA626_GRIDOBJECT_ENTRIES_ONLY_SUBGRID_UNVERIFIED` explicitly separates dictionary-entry counts from verified native GridObject placements and SubGrid descendants.
- `src/routes/editor/world/+page.svelte`: render only the aggregate count and SubGrid unsupported note inside `data-wep-626-readonly`, not EditorDocument/Canvas or editable inspector. No 626 local Draft or 624 route changes.
- `src/lib/wep/world-readonly-copy.js`: 8 locales en, ja, de, fr, it, es-ES, pt-BR, zh-CN provide truthful `gridObjects` and `subgrid` copy. SubGrid count/geometry/Native IDs/legality intentionally **UNKNOWN**.
- Scoped `tests/wep-world-readonly626.test.mjs`: synthetic P1G positive count, null unknown on missing `Objects`, unchanged 626 writer locks, 624 regression and eight localized phrases.
- `scripts/wep-schema626-readonly-browser-acceptance.mjs`: synthetic 626 visible count/SubGrid note plus effective 640 CSS px viewport as an **approximation** of 200% browser zoom at physical 1280 px (NOT a native browser-menu zoom proof); no layout overflow, basic Tab focus, 320px noneditor, 624 entry unaffected. Console and page errors zero; no private save.
- A dedicated scoped Node/Build workflow does NOT rerun complete old 01A/01C/01E or previously accepted private-save tests. Browser workflow is existing targeted Chrome test.

## R17 DEC-WEP acceptance boundaries
| Job | Existing / new evidence | Classification |
|---|---|---|
| Switch1253 exact schema626 P1G structural read | Existing 01A/PR125 + new display aggregate | SOURCE/CONSUMER read-only; native meaning UNVERIFIED |
| Area / Grid / GridObject / SubGrid | 626 counts only; object dictionary aggregate is explicitly not placement; SubGrid unknown | PARTIAL / fail-closed |
| 624 local drafts coordinates / selection / layers / keyboard / Undo/Redo / Review | Existing Editor/Canvas/Preview test contract unchanged | EXISTING SOURCE; no new native release authorization |
| Road/Fence representation/topology | Core 01C v1253 static; runtime q5 unobserved/deferred | NATIVE WRITER OFF, uncertain paths blocked |
| 320px navigation / 200% zoom | Narrow synthetic Browser; 640px effective CSS layout proxy for 200% | New scoped Browser evidence, **not actual Chrome menu zoom** |
| Eight launch locales | Exact 8 new copy additions and inventory test | SOURCE localization, QR independent needed |
| Real private save E2E / Source626 semantic object models | Not run by policy; no approved new owner fixture required | NEED_RUNTIME only if separately authorized |
| Native Save Writer / Preset Apply / Premium | No change; never authorized | OFF |

## Required 04 QR new-only independent review
Pin exact WEP PR HEAD and focused Owner CI. Independently inspect `world-save-source.ts` accepted 626 gate and absence of 626→624 route/Canvas/Export; confirm structural counts null-on-missing and no interpreted GridObject placement or SubGrid shape; eight copy keys, 320px, 640 effective zoom and keyboard focus using synthetic local Chrome. Check both page and console errors. No repeat of 01A P1G runtime, 01E PR274 original comparator, 01C native Road/Fence, full 624 suite or private saves. Do not declare native Grid/Area/SubGrid semantics accepted, R17 DEC-WEP PASS or writer promotion.

09 INT: no new Community/Backend consumers or Caller/SQL/Route changes, so **no 09 INT handoff** required.

All PRs Draft DO_NOT_MERGE/DO_NOT_DEPLOY. Source626 read-only and Native persistent writer/Apply remain disabled.
