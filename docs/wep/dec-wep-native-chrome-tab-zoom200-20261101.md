# 02 WEP — R17 DEC-WEP actual Chromium tab zoom 200% acceptance

Date: 2026-11-01 JST. Status: DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY. Existing 02 WEP stream, not a new technical workstream.

## Exact ancestry and exclusion

- Exact accepted WEP PR #275 latest Area UNKNOWN owner-fixed HEAD at fork: `78611aca1aec6570e6e1fa37307f2f4dd662a325`. Existing Source and Client fixes remain unchanged.
- This new child source contains **only** an isolated MV3 Chrome test fixture, synthetic Chrome Browser acceptance script, dedicated GitHub Actions workflow and this technical packet. No World Editor product route/Core/Save/Canvas/Storage/Decorate/Community/SQL/native writer sources are changed.
- Prior PR #275 source-only Area UNKNOWN, PR #274 comparator, 01A authenticated P1G, 01C Road/Fence, Decorate Stage 1, Storage Furniture, representative Private Save and ROAD-R04 are **not rerun**.

## Native zoom evidence — NOT a 640 CSS viewport emulation

Test launches the **Playwright-managed full Chromium** (not headless shell), `channel:'chromium'` with an offline MV3 extension in an isolated persistent browser context. The extension invokes Chromium's **actual tab zoom API** `chrome.tabs.setZoom(targetTab, 2.0)`, then verifies `chrome.tabs.getZoom(targetTab)===2.0`. No `page.setViewportSize({width:640})`, CDP `Emulation.setPageScaleFactor`, `deviceScaleFactor:2`, CSS transforms, or pinch zoom.

Actual GitHub Actions Chrome 140.0.7339.16, Ubuntu 24.04, 1280 x 960 initial viewport:

| Metric | Before | Actual tab zoom after |
|---|---|---|
| `chrome.tabs.getZoom` | 1 | **2** |
| `innerWidth` | 1280 | **640** |
| `outerWidth` | 1280 | **1280** |
| `devicePixelRatio` | 1 | **2** |
| `visualViewport.scale` | 1 | **1** |
| `getZoomSettings` | automatic/per-origin | automatic/per-origin |

The Chrome extension tab zoom is the browser's actual content zoom setting. This does **not** prove that a person clicked the Chrome three-dot menu, nor desktop OS DPI, non-headless UI chrome, all hardware fonts or touch/accessibility devices. A separate **manual browser menu 200%** sample may remain in R17 acceptance; this test correctly establishes a real native tab zoom API rather than a responsive layout proxy.

## Source and Browser independent check matrix

Exact final successful workflow: `https://github.com/DreamwishWand/web/actions/runs/41270066846`. Job SUCCESS, offline screenshot + report GitHub artifact ID `13068832686`, uploaded ZIP SHA256 `fc49417008550b9080303a3e0888e3faa7849280eee9a98e7814ebe62fb81c72`.

1. `NATIVE_CHROME_TAB_ZOOM_2X_VERIFIED` — PASS, native API + independent CSS/DPR/visual viewport observed.
2. `NATIVE_ZOOM_POINTER_TO_SVG_WORLD_COORDINATES_AND_SELECTION` — PASS: real pointer center maps through SVG `getScreenCTM().inverse()` to native logical cell **(2.5, 2.5)**, selected `g[data-editor-object]` remains visible/selected at 200%. The cell must first be scrolled into the 960px visual viewport.
3. `NATIVE_ZOOM_DRAFT_MOVE_UNDO_REDO` — PASS: synthetic chair x2→3→2→3, visibly reconciled.
4. `NATIVE_ZOOM_KEYBOARD_SELECTION_MOVE_UNDO_REDO` — PASS: focus SVG roving object, Enter selection, ArrowRight x3→4, Ctrl+Z x4→3, Ctrl+Shift+Z x3→4.
5. `NATIVE_ZOOM_DRAG_FAIL_CLOSED_NO_UNREVIEWED_POSITION_CHANGE` — PASS for **absence of unintended mutation**. Current World Editor SVG has `on:click` / `on:keydown` but no native pointer-drag authoring command. Real dragging remains **NOT IMPLEMENTED**, not a PASS for drag-to-place usability.
6. `NATIVE_ZOOM_LOCAL_REVIEW_NO_DDV_WRITER` — PASS: Review Save Prep is available for local synthetic draft; existing `Review Changes` panel is visible but its export review button is disabled because original source bytes/verified baseline absent, no `.verified-export-success`. Not a real save Review→Commit→Reload PASS.
7. `NATIVE_ZOOM_626_READONLY_NO_CANVAS_DRAFT_APPLY` — PASS on an isolated synthetic packaged P1G Switch1.25.3/BID9A239D3DB569756D/schema626 with supplied external-provenance test flag: read-only visible; no Editor shell, draft toolbar, edited export, or Area route/Apply. Same tab remained zoom2 after reload.

`pageErrors=[]` and `consoleErrors=[]`. All fixtures are generated in test memory; no user save. Screenshots: `native-200-pointer-diagnostic.png`, `native-200-synthetic-editor.png`, `native-200-readonly626.png`.

### Test harness issues observed, not product RED

- Initial GitHub `ubuntu-latest` had become Ubuntu 26.04; Playwright 1.55 Chromium download unsupported on this runner. Fixed workflow test environment to explicit `ubuntu-24.04`. No product defect.
- First pointer test sent `page.mouse.click` to DOM viewport Y~2089 while the visible viewport was 960px high; off-viewport element hit NULL. Test now explicitly `scrollIntoViewIfNeeded()` before computing center; resulting native CSS-client Y~239.8 and SVG logical x/y 2.5 PASS. **No WEP coordinate conversion code changed.**
- Earlier harness assumed the `Review Changes` panel should not exist on synthetic target; actual production UI intentionally shows the disabled panel and explanatory text. Updated assertion to check disabled action instead of missing panel; no WEP product change.

## Version/write/UX boundaries

- 624 synthetic local draft only. This test does not endorse original encrypted or decoded real game save write.
- 626 exact Switch Read-only structural only; unknown/Steam or BID mismatch remains fail closed under existing 01A/PR275. No cross-version object projection, meaning or Native writer/Apply authorization.
- `NATIVE_BROWSER_UI_200_PERCENT_ZOOM`: **BROWSER PASS for actual Chrome API zoom=2.0 on covered synthetic 624 and 626 flows**; **PARTIAL for Chrome GUI menu interaction, manual assistive-technology and real-save representative workflow**. Do not silently mark the entire R17 requirement closed.
- 320px responsive coverage is a **separate existing PR275 Browser acceptance**; this workflow never calls `setViewportSize({width:320})` or treats 640 CSS pixels as that test.
- Existing drag-to-move authoring **NOT IMPLEMENTED**; dragging currently cannot be accepted as a supported mutation. Product work, if needed, requires a separately scoped UX contract.
- Original R17 DEC-WEP remains **PARTIAL** with `REPRESENTATIVE_PACKAGED_PRIVATE_FIXTURE_REQUIRED`, `WE-INSPECT`, `WE-COMMIT`, `WE-RELOAD`, `WE-ROADFENCE-PERSISTENT-NATIVE-TOPOLOGY`, `NATIVE_BROWSER_UI_200_PERCENT_ZOOM` (human/menu segment), `WORLD_EDITOR_REPRESENTATIVE_FIXTURE_COVERAGE` open. Overall R17 unchanged: 30 nodes PASS0/PARTIAL12/BLOCKED18.
- No Source bug found; no coordinate transform code changes. `ROAD-R04` remains owner-deferred, topology persistent writer, Preset Apply, Premium/entitlement and direct Save Writer all OFF.

## Reproducible execution

```bash
npm ci --no-audit --no-fund
npm install --no-save --package-lock=false playwright@1.55.0
npx playwright install chromium
npm run dev -- --host 127.0.0.1 --port 4187
# In a second terminal:
WEP_NATIVE_ZOOM_BASE_URL=http://127.0.0.1:4187/editor/world/ node scripts/wep-actual-chrome-zoom200-browser-acceptance.mjs
```

Requires compatible Ubuntu 24.04 / Playwright Chromium full binary with extension support, Node 22 and local loopback. No Stage, SQL, Storage or network Provider. The MV3 extension is test-only, only controls the local target tab zoom setting. New isolated workflow `.github/workflows/wep-native-browser-zoom200-20261101.yml` uploads report/screenshot evidence.

## 04 QR delta-only independent acceptance

Review only this exact child HEAD against WEP275 pinned ancestor, verify workflow has genuine `chrome.tabs.setZoom` + `getZoom` runtime readback, observed dpr/innerWidth/outerWidth invariants, no viewport 640 spoof, and run its synthetic Browser independent flow/inspect screenshots. Confirm test doesn't accidentally claim native drag authoring, user GUI menu acceptance, private Save, 626 editing or real Save Review/Commit. Any TRUE RED should be new-only and isolated, not a demand for a full old-suite rerun. Because no backend/Community consumer contract changed, **no 09 INT handoff**.

**Operator / public release:** DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY. No Deployment/Cloud/Storage/Native writer/Apply, no external signed actor test.
