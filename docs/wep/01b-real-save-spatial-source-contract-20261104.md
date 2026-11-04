# 01B CORE -> 02 WEP / W-DEC-018 Real-save spatial reference contract

2026-11-04 (Japan). Source base: **Wand TEST main `d3a2dbfa76d041e7edc30abbd89f5fc264a540f8`**. Source-only/synthetic code with **19/19 Node tests and strict TypeScript check**. **NOT real P1G QA or Native V3.** Writer, encoded edited-copy, Apply, original overwrite, Road/Fence and Grid mutation remain **OFF**.

## Existing accepted surfaces and immutable identity

Reuse **PR382 + independent QA387** 2D SVG/selection/Hit Test/Move/Undo synthetic limited PASS, **main PR388** accepted integration, and independent-review-pending **PR386** (Source HEAD `5dfc7d45f6dae658b1bd3d6d424b5a02c1f695c5`, 01B `source-spatial-model.ts`). Do not clone the 2D renderer or create new geometry ID systems. PR386 is **v1.25.0/schema624/Switch BID `52BD625D9B4E0053`** root+SubGrid source-addressed model, *not* v1.25.3/626.

Original source object identity always `(GridID, GridObject.ID, canonical map-key)`; existing WEP `editorId` remains `g${GridID}:o${GridObject.ID}`. GridObject.ItemID is an item type and NOT an instance ID. Every scene node/hit/selected inspector/Move Preview must retain this exact address and a Source Revision epoch. A reused scene/cross-save or stale hit is not authoritative. The native coordinate grid is local X/Y with a 16-step native orientation. The user-interface screen transform is for display only; **no unverified Grid/Unity world affine transform**. Child-grid X/Y are child-local; parent `State.SubGrid.GridID` and parent address are links, not a proven transform/attachment/support cascade.

## New real Save reference API

**`src/lib/wep/real-save-spatial-source.ts`**:

1. `read626SpatialReferences(profile, context)` strictly matches external source claims Nintendo Switch DDV **v1.25.3/BID `9A239D3DB569756D`/schema626** and profile's GameInfo.Version. Source hash/revision arguments remain **caller supplied reference tokens**: this module is NOT itself a trusted Core-minted Session/CAS/verifier. It reads current Save `World.GridCollection.Grids`, `DiffGrids`, `World.Villages[].Areas[].GridIDs`, `Grid.Objects` map keys, `GridObject.ID`, `ItemID`, `X/Y`, `Orientation`, serialized `State.SubGrid.GridID` and parent relationships. Returns **only structural references and serialized local coordinates**, not proven footprint, rendered Node, world coordinates, placement, Grid writer, or an authoritative Native 2D model.
2. `inspect626SourceObjectAtRevision(index, editorId, expectedRevision, expectedSha)` keeps the **same** `g{id}:o{id}` source address, matching current UI epoch/hash. Any changed revision/hash or unresolved selected Grid is denied. It is a readonly Inspector projection, **not an input Save Writer authorization**.
3. `assert624ProjectedObjectsMatchSave(profile, editorDocument, context)` is the **pre-Scene trust check** for existing independent v1.25.0 projection. It requires exact v1.25.0/BID/schema source, EditorDocument contract, root Grid path and entire root object-set count. For each projected source object, checks canonical `(GridID,ObjectID,map-key)` and source `ItemID,X,Y,Orientation` against real decoded Save `World.GridCollection.Grids`. For SubGrid, checks exact parent address, parent `State.SubGrid.GridID`, child Grid path and no ancestor cycle. A fabricated/stale source ID, position or child is rejected before a Scene Node or Hit Test is considered source-bound. Consumes the existing WEP EditorDocument, does not modify it. Its stored `sourceSha256` and view epoch DO NOT constitute a cryptographic attestation or full core command CAS.

### 626 read boundary, absence of false geometry

`GridCollection.Grids` and `DiffGrids` have separate Native lookup semantics (previous Source-only verified `GridCollection.TryGetGrid`, 01B Native 22/22). A `DiffGrid` without an available matching and validated Default Layout is **DEFAULT_LAYOUT_UNRESOLVED**, never assumed empty. `Grids` and `DiffGrids` with a common GridID are **AMBIGUOUS** until resolved; do not count twice or overwrite. Area→Grid missing, duplicate area owner, parent cycle, multiple SubGrid parents, invalid saved object ID, invalid object orientation, unknown SubGrid state, parent-grid conflict are fail-closed. Only a structurally resolved source object can appear in a readonly Inspector. No 626 object is promoted into 624 `source-spatial-model.ts`, PR388 SVG source scene, 624 footprint, or Native placement until new same-BID/626 GridData/geometry/area evidence plus 04QR acceptance. Source copy/index cap currently 100,000 projected object references; larger input fails closed instead of unbounded object allocation. Product 100–200MiB Worker memory is still not certified.

**Do not confuse the project review boundary with reality:** this repo's source synthetic tests exercise representative `World` maps only. The authorized private 01E v1.25.3 genuine P1G has saved `Grids` **1371**, `DiffGrids` **1033**, unique `RecurringEvents` 474, but this tool did **not decrypt or examine that private file** in this change. Some actual serialized structures and identity relationships may require adaptation after a private read-only 01E sample review; do not claim real 626 2D acceptance on synthetic fixtures.

## 02 WEP immediate integration

- **Do NOW, independent of 01A:** import new readonly structural inspector in v1.25.3 file open path (the existing `openWorldSaveBytes` 626 route) only after the existing exact BIDs/schema compatibility gate; display original area/grid IDs and unresolved provenance in Inspector; **no source 626 2D coordinates or fabricated Sprite/Footprint**. Propagate Source Revision epoch and hash when available from 01A Worker; otherwise label source hash as caller/reference-only, disable stale selection and edits.
- **For 624 only:** after trusted/locally read `World` and existing 624 `direct-root-editor-document-v125.js`, call `assert624ProjectedObjectsMatchSave()` BEFORE `projectSourceSpatialScene(PR386)` and the existing `buildSpatialScene(PR388)` display. Keep the same `editorId` for Scene Node / Hit Test / selected inspector / Move Preview; no new canvas-local UUID.
- Use PR388 renderer/PR382 QA; source map conflicts and unresolved SubGrid descendants are excluded. Do not auto-paint SubGrid children onto the root canvas without Native parent-child affine evidence. Preserve existing WEP UndoRedo for local synthetic draft only; client epoch does not authorize a Core Writer.
- Do not directly modify main/PR386 while 04QR PR393 is reviewing that fixed HEAD. 09 INT/02 WEP may selectively compose separate changed paths after QA acceptance and compare with latest cumulative main, then run real Chromium and version-negative QA.

## V0–V4 exact operation matrix

| Operation | Status now | Native/Grid Writer gate |
| - | - | - |
| Source Grid/Area IDs, map key, object instance address | Source-only schema626 structural API + synthetic tests | READ/Inspector only; genuine private source-bound V1 and browser E2E still required |
| v1.25.0 geometry, hit, selected inspector, schematic MOVE | Existing PR382/QA387, new source-binding synthetic check; PR386 QA pending | NO Native v1.25.0/626 Writer |
| v1.25.3 626 footprint/rotation/subgrid placement | **NOT_VERIFIED**, source scalar read does not establish geometry | same-build GridData/dimension/geometry + real private V1/V2 + V3 consumer/producer |
| Root MOVE, ROTATE | Existing 624 source/preview only | exact-source Cas, Native object/grid/footprint/collision/rearm/rollback + independent edited P1G reopen/Native V3 |
| SubGrid move/delete | parent IDs structural only, child↔root transform unproved | Native support/cascade, dependencies, grid role + separate acceptance |
| Road/Fence | OFF | 01C quantity/variation/connectivity/Native inventory and graph coupling independently accepted |
| Buildings/PlayerHouse | OFF | storage/interior/doors/supports, skin, quest/owner state, authorizing evidence |
| W1 `NextOccurrence` v1.25.3 Event2010000021 key155 | previous 01B source native and 01E private V1 + QR343 P1G codec mechanics reused | `W-NATIVE-005` unresolved private Wetland default/diff effective grid, Tree anchor/Softwood count, cold-load Actualize/Last/Next authoritative runtime; no new V3 grant |

V4 is optional, **only** for a named operation-specific Native behavior that cannot be closed with Source or isolated offline native producer/consumer. Do not gate schema626 readonly structural Inspector, WEP synthetic 2D or other local Save editing on broad device testing.

## Fixed evidence / tests / next

Base `d3a2dbfa76d041e7edc30abbd89f5fc264a540f8`, prior Owner PR386 HEAD `5dfc7d45f6dae658b1bd3d6d424b5a02c1f695c5`, QA PR393 in progress at initial review. New tests `tests/01b-real-save-spatial-source.test.mjs`: Node22 `--experimental-strip-types` **19/19 PASS**, `tsc --noEmit --strict` PASS. Evidence is **SOURCE_ONLY/SYNTHETIC**; no private P1G, decryption key, decoded JSON or game ROMFS content in this repo/CI. Independent 04QR/new cumulative QA required before product promotion. No automatic raw Save upload or cloud persistence. Source+Revision/CAS trusted Core still belongs to 01A (PR383 QA pending), not this readonly Source projection.
