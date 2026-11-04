# 02 WEP — Owner-private real P1G world-to-2D acceptance (2026-11-04)

**Scope:** W-DEC-018; reuse QA387/QA415 synthetic actual Chromium and QA423/424 fixed 624/626 source. Draft PR445 is the current main composition. This is *not* an automated genuine Save receipt. Local executor was authored but **NOT_RUN because no authorized original P1G is mounted in this workspace**.

## Exact source / platform discrimination

- Supported **schematic 2D** source: Nintendo Switch DDV **1.25.0**, executable Build ID **52BD625D9B4E0053** externally verified; raw save schema **624**. The file alone does **not** attest the executable BID. Projector's original GridObject native ID/map key, source X/Y, cardinal/16-orientation, root GridDataPath, dimensions and Area membership must match the same P1G source. Child SubGrid has separate unproven parent-to-world transform: **do not draw an invented world-space child**.
- Nintendo Switch DDV **1.25.3**, external BID **9A239D3DB569756D**, raw save schema **626**: the repaired 01B `read626SpatialReferences` can establish serialized Area/Grid/SubGrid/Object references and exact revision/hash-backed *read-only inspector* lookup. It has **geometryFor2d=NOT_VERIFIED**. This does not authorize schematic or Native 626 2D rendering, Move, placement, import of schema624 dimensions, or persistent write.
- 01A product **Single SaveSession** currently exposes only RecurringEvents in a Source/Revision/IndexGeneration-scoped Worker read. `Spatial` returns `LOCAL_READ_CAPABILITY_NOT_ACCEPTED`. The existing World Editor's local `EditorSession` is one consistent read/preview/Undo owner, but its UI SHA/epoch guards **are not** Core-issued Session/Revision CAS. Do not claim product Spatial capability or Writer acceptance.

## Local-only execution; never send a real P1G to GitHub/CI/Provider

On the OWNER's own PC, from a local checkout of the reviewed **fixed** PR445 HEAD, with Chrome and locally available `playwright-core` and an independent local source/BID attestation:

```sh
npm run dev -- --host 127.0.0.1 --port 4197
# In another LOCAL process:
export WEP_PRIVATE_P1G_PATH=/absolute/private/path/to/profile
export WEP_PRIVATE_BUILD_ID=52BD625D9B4E0053
export WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED=YES
export WEP_PRIVATE_LOCAL_ONLY_ACK=YES
export WEP_PRIVATE_CHROME_BIN=/absolute/path/to/google-chrome
node --experimental-strip-types scripts/wep-private-real-save-2d-local-only-20261104.mjs
```

On Windows PowerShell use `$env:WEP_PRIVATE_P1G_PATH="C:\\..."` etc. There is no need to copy a genuine P1G into the repository. `playwright-core` is a local prerequisite, not fetched/installed by the script. The executor explicitly refuses `CI`/`GITHUB_ACTIONS` and any URL other than HTTP loopback, blocks non-local network requests and does not screenshot or send profile contents. No browser download of an *edited* copy, no Apply, no backup overwrite. The original source P1G must remain byte-identical. The full receipt—including source hash/IDs—stays only as an owner-private `0600` file in OS temp; stdout prints only check statuses and this temporary receipt path. Redact this file before sharing QA evidence.

**If no file is present**, outcome `NOT_RUN_PRIVATE_SOURCE_NOT_AVAILABLE`—never silently replace with synthetic evidence. Schema626 outcome `NOT_RUN_626_NATIVE_2D_GEOMETRY_UNVERIFIED` despite its independently inspectable Source references. A real 624 run only qualifies as an OWNER-private local **Read/Preview/Undo** candidate if the Browser actually loads the Area, a raw-verified GridObject ID maps to a drawable SVG node and the same Inspector, local Move draft diff appears and Undo clears the same diff, no off-host request/error occurs, and P1G original SHA remains immutable. If the Save lacks a safe candidate, classify as `PARTIAL_NO_NATIVE_VERIFIED_SAFE_MOVE_CANDIDATE` without faking PASS.

## Acceptance matrix (record independently)

| Domain | Required evidence | Current boundary |
| --- | --- | --- |
| V0 source | Encrypted original SHA/size + external Platform/FullVersion/BID + parsed schema + ZIP integrity | Private supplied source required; none mounted here |
| V1 real source | Native source Area/GridIDs/Grids/DiffGrids/Object IDs; exact raw MapKey/ID/X/Y/Orientation; no unknown-child fabrication | Private 624/626 script prepared, NOT_RUN; 01B synthetic QA423/424 reused |
| Read/Scene | Same local source ID across 2D/Hit/Inspector, pan/zoom, Source Revision and A→B stale denial, unknown/duplicate parent | Existing synthetic actual Chrome QA415 PASS, new main composition CI/QR separately |
| Preview/Undo | Same selected ObjectID, local schematic Move Review diff and Undo with original file SHA unchanged | No authentic private browser receipt yet |
| V2 edited copy | Original backup, typed Core old-value/Revision CAS, atomic intended diff, encrypted exported edited-copy, independent Reopen | Not covered/NOT_ACCEPTED for Grid |
| V3 Native | Exact same Build Consumer/Producer, terrain/occupancy/attachments, subgrid transform, unknown/negative cases | NOT_ACCEPTED |
| V4 device | Only if a concrete V0-V3-undecidable Native question remains, with named observation | NOT_RUN; not universal blocker |
| Release | 04 QR new-only, 09 INT cumulative exact HEAD, 00 CTRL per-operation permission, exact scope flags | Persistent Grid/Road/Fence/Building Writer, Apply, original replace, Provider/Managed/Public **OFF** |

**Next:** Independent 04 QR inspect exact PR445 new-only source, 01B directRoot binding, genuine test harness's fail-closed privacy path and actual Chromium synthetic E2E; 09 INT main-first after PASS only. 01A/01B/01E parallel genuine V1 source indexes and native coordinate/footprint semantics without propagating private Save into CI.
