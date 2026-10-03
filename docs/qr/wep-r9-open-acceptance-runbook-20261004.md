# 04 QR — R9 Open Acceptance Evidence / Owner Runbook — 2026-10-04

Status: **EVIDENCE PREPARED / NO R9 GATE CLOSED IN THIS ENVIRONMENT**

R9 remains the current launch-acceptance authority. This document does not create R10 and does not consume a provisional 09 INT checkpoint.

## Target boundary

- Nintendo Switch
- DDV v1.25.0
- BID `52BD625D9B4E0053`
- schema `624`
- R9 WEP source under acceptance: `dev/wep-v125@9229cc5b1df0d9cc77364647df0f0fd65973c07d`
- `persistentWriteAuthorized=false`
- `WORLD_PERSISTENT_WRITE_V125=false`
- `PERSISTENT_WRITE=false`
- `productApplyAuthorized=false`
- `directSourceReplacementAuthorized=false`

## Exact representative raw fixture

- Drive `1FRXl5bYX6HClcVQY2L88eP8Su8lgybyS`
- size `12,846,979`
- SHA-256 `1cfc40196f7ee36048e1fa98c0835561901c6fed3f19ca8dd6fa36c47740dc10`
- stored file is decrypted JSON, not packaged profile bytes.
- its Drive parent contains no packaged sibling.

Current verified-export code deliberately requires `opened.inputFormat === "packaged"`.
Therefore representative `WE-COMMIT` / `WE-RELOAD` cannot be closed from this raw JSON alone without changing the acceptance input.

Classification:
`REPRESENTATIVE_PACKAGED_PRIVATE_FIXTURE_REQUIRED`.

Do not synthesize a package from this JSON and call it the exact source fixture unless Control explicitly changes the acceptance contract.

## Representative Furniture target

The exact raw representative save contains the already-promoted minimum-transform target:

- Grid 3
- GridObjectID / map key `5800`
- ItemID `40002049`
- X `195`
- Y `201`
- Orientation `GridOrientation_Right`
- State `null`

This is the same object identity and source transform used by the closed minimum Furniture runtime contract. It is a suitable representative export target once a byte-corresponding packaged representative source is available.

Suggested known-valid MOVE target from the closed runtime contract:
- X `199`
- Y `213`
- Orientation unchanged.

Do not infer packaged byte identity from matching semantic object identity.

## Representative Road/Fence source audit

Canonical native reader executed on exact raw Grid 7:

- status `supported`
- issues `0`
- Biome2Fence family ItemID `40700246`
- 20 Biome2Fence logical networks found.
- major representative Road families in this save are not promoted persistent-writer classes; do not use them for this gate.

A scan of promoted representation-only `FENCE_INSERT_POST` edits produced:
- 23 degree-2 candidate insertion locations
- 18 exact compiler PASS
- 5 fail-closed due `ROADFENCE_UNRELATED_COORDINATE_OCCUPIED`.

This confirms collision preservation is active; unsupported/colliding candidates are not coerced.

### Frozen representative Fence case

Use:

- Grid 7
- network `fence:40700246:orthogonal:0`
- family `Biome2Fence`
- mode `orthogonal`
- logical quantity `5`
- nodes `v:84:11 ... v:88:11`
- source GridObjectIDs `15660, 15661, 15662`
- source representation: `EXACT_PRESERVATION / PRESERVE_EXISTING`, no degree-2 post.
- operation: `FENCE_INSERT_POST`
- insert at node `v:85:11`, logical `(85,11)`, pinned.

Exact promoted compiler result:

- `ok=true`
- support `FENCE_CONFIRMED_WRITABLE`
- reason `FENCE_ORTHOGONAL_GRAPH_CONFIRMED`
- preserve IDs `15660, 15661`
- delete ID `15662` (Ext key 3)
- create ID `15789`: Biome2Fence Base at save `(170,22)`
- create ID `15790`: Ext key 2 Item `40700248` at save `(172,22)`
- `NextGridObjectID 15789 -> 15791`
- logical quantity `5 -> 5`
- native object count `3 -> 4`
- persistent authorization flags remain false.

This is **CONFIRMED offline compiler evidence only**. It does not close representative Road/Fence Apply/export.

## Browser environment blocker

Current QR container Chromium is managed with an effective URL block-all policy:

- `URLBlocklist=["*"]`
- localhost navigation → `ERR_BLOCKED_BY_ADMINISTRATOR`
- file URL navigation → `ERR_BLOCKED_BY_ADMINISTRATOR`
- routed test HTTPS navigation → `ERR_BLOCKED_BY_ADMINISTRATOR`
- `about:blank` is not a normal secure origin and does not expose Web Crypto `subtle`.

Classification:
`QR_BROWSER_ENVIRONMENT_MANAGED_URLBLOCK_ALL`.

Do not modify/bypass browser policy, inject a crypto shim, or substitute synthetic layout evidence.

This environment therefore cannot formally execute:
- exact-private B/H browser acceptance
- native browser UI zoom
- browser-driven representative verified export.

## PR #47 QA carrier

Existing branch:
`qr/representative-save-acceptance-r3-20261002`

PR #47 is reused; no duplicate product harness was created.

QA-only additions pin/build exact R9 WEP source:
- build run `37154028238` SUCCESS; artifact `11285062986`; build source marker = `9229cc5b1df0d9cc77364647df0f0fd65973c07d`.
- source-pack run `37154568332` SUCCESS; Road/Fence source artifact `11284928937`.
- extended source-pack run `37154785402` SUCCESS; includes Fence representation adapter source.
- representative browser script has been narrowed to the still-open R9 B/H route. The obsolete R6 assertion that no Apply/Commit UI may exist was removed; R9 safety checks direct source replacement instead.

Private save bytes are never committed or uploaded to GitHub.

## Owner execution — B/H

Use a normal local Chrome environment without managed URL blocking.

1. Build/serve exact R9 WEP source `9229cc5b1df0d9cc77364647df0f0fd65973c07d`.
2. Keep the exact private raw JSON local.
3. Run `scripts/wep-representative-save-browser-acceptance.mjs` from PR #47 with `WEP_REPRESENTATIVE_FIXTURE_PATH` pointing to the local file.
4. Required PASS evidence:
   - SHA/size exact
   - FloatingIsland_Urban SceneItemId `1540000147`
   - GridID `760`
   - exact GridDataPath
   - 4,230 Canvas objects
   - no fabricated Area identity
   - one roving Canvas Tab stop
   - inspector reachable on a projected object
   - four Move directions have `aria-disabled=true` + `aria-describedby=wep-reason-move`
   - no direct source-replacement control
   - console errors 0
   - page errors 0.
5. Retain report + sanitized screenshot.

Only an actual browser run closes B/H.

## Owner execution — native browser UI zoom

This remains a separate manual gate.

1. Use the actual Chrome browser UI/menu or browser zoom shortcut, not CSS, viewport resize, DevTools layout emulation, or page-scale simulation.
2. Open the exact-private FloatingIsland_Urban Canvas.
3. Set browser zoom to the R9-required zoom condition, including 200%.
4. Record Chrome version, OS, physical viewport/window size and the browser UI zoom setting.
5. Verify:
   - all primary World Editor content remains available;
   - no unusable clipping/overlap;
   - keyboard access and command reachability;
   - critical status/reason text readable;
   - Canvas and Inspector remain usable;
   - focus remains visible and logical;
   - required scrolling/reflow does not hide actions.
6. Capture independently reviewable evidence showing the actual browser zoom state without private identity/token data.

Only native browser UI zoom evidence closes the gate.

## Owner execution — Furniture verified replacement export

Precondition: obtain a packaged Switch source for the same representative state and independently prove it decodes to the intended representative profile. Do not fabricate exact-source status.

1. Load packaged source locally.
2. Select Grid 3 / GridObject 5800 / Item 40002049.
3. Perform the supported minimum MOVE (known-valid target `199,213`) or an equivalently validated minimum transform.
4. Review Changes.
5. Explicitly confirm verified replacement export.
6. Verify:
   - source package SHA before/after identical;
   - original-backup artifact SHA equals source package SHA;
   - candidate/edited package emitted;
   - manifest and integrity bundle verify;
   - independent package reopen succeeds;
   - canonical profile reopen/reload succeeds;
   - only approved minimum transform semantic paths changed;
   - unrelated state is unchanged by the writer.
7. No direct source replacement occurs.

If all pass, QR may close the representative Furniture `WE-COMMIT` / corresponding `WE-RELOAD` path without changing the global direct-source-replacement flags.

## Owner execution — Biome2Fence verified replacement export

Use the same packaged representative source prerequisite.

1. Open Meadow / Grid 7.
2. Select logical network `fence:40700246:orthogonal:0`.
3. Insert one pinned Fence post at logical node `v:85:11` / `(85,11)`.
4. Review Changes must classify the single-network edit as `FENCE_INSERT_POST`.
5. Explicitly confirm export.
6. Require the promoted compiler result described above.
7. Verify:
   - source package unchanged;
   - exact backup retained;
   - candidate + manifest/integrity emitted;
   - candidate reopens;
   - canonical Road/Fence native reader returns the desired same q5 logical topology;
   - desired representation change is present/valid under `ddv.fence-representation-layout@1`;
   - unrelated GridObjects/state remain unchanged;
   - no inventory/Collection/entitlement mutation is introduced by Wand direct-save semantics.
8. If Core returns `RUNTIME_REQUIRED` or `UNSUPPORTED`, stop and record the blocker; do not broaden the matrix.

## Current acceptance disposition

No R9 gate is closed by this preparation alone.

- `WE-COMMIT`: OPEN — packaged representative input + browser/manual export evidence required.
- `WE-RELOAD`: OPEN — representative exported candidate required.
- `WE-ROADFENCE-PERSISTENT-APPLY`: PARTIAL — exact promoted private-save candidate identified; export/reopen evidence required.
- `WE-INSPECT`: PARTIAL — exact-private browser B evidence required.
- `WE-FIXTURE-COVERAGE`: PARTIAL — exact-private browser H evidence required.
- native browser UI zoom: OPEN.
- 09 INT final checkpoint: intentionally not consumed.

R10 is **NOT WARRANTED** by this evidence preparation.
