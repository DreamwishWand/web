# WEP World Browser Read Runtime — 2026-10-01

## Status

**CONFIRMED IMPLEMENTATION / CI PASS** for the current supported browser read slice.

This checkpoint connects a local DDV save to the product World Editor without enabling any persistent DDV writer.

## Target boundary

- Game contract: Disney Dreamlight Valley v1.25.0
- Profile schema: 624
- Browser projection data: Nintendo Switch v1.25.0 only
- Switch BID pinned by static data: `52BD625D9B4E0053`
- Exact build of an imported save: **not inferred from schema**
- Persistent world write: **disabled**
- Steam/Windows World projection: **not promoted**
- Road/Fence raw-save logical decoding: **not yet bound**

## Source chain

The browser path consumes existing approved contracts rather than redoing native RE.

1. Shared 01A save intake already merged from main:
   - P1G packaged-profile codec
   - safe JSON parser
   - save/platform identity detection
2. Integrator-approved 01B World adapter v1.6:
   - exact package-source SHA-256:
     `60b56d95b263d8ad8401bcacee5e990201d2b854af440bbd257af3348c65b85c`
   - repository path:
     `src/lib/ddv/core/world/runtime-v125/adapter-v125.js`
3. Exact v1.3 Grid role authority:
   - SHA-256:
     `f16fe61adb356b1e46c59ca053588cc1ed5f9ad187866db04905ede31c9184cc`
   - repository path:
     `static/ddv/core/world/v1.25/grid-role-authority-v125.json`
4. Switch-only browser read data derived mechanically from the Integrator-approved 01D canonical package:
   - Drive ID:
     `1gkaPeA3uWcOtdQMK0jVcwVffN6W89Hui`
   - SHA-256:
     `53db127eb796c0d4b103695258700d18de69f5403d1067cd956396cd1b03ffa6`
   - repository path:
     `static/ddv/v1.25/world-read-switch.json`
   - 10,440 compact geometry records
   - 6,233 Furniture scope records

The browser runtime verifies static-data SHA-256 before use and fails closed on a mismatch.

## Product flow now implemented

`/editor/world` accepts:

- canonical WEP EditorDocument JSON;
- decoded DDV `profile.json`;
- normal packaged DDV profile.

For raw saves:

1. user identifies the **source/storage platform** independently from the save's last-save device;
2. shared 01A intake validates schema 624 and enumerates Village → Area → direct Grid routes;
3. Nintendo Switch source may open a root Grid through the pinned 01B v1.6 adapter;
4. the 01D-derived geometry/scope pack resolves supported object footprint/classification;
5. the existing WEP EditorDocument / Canvas / selection / Scene capture surface is reused.

The product does **not** use last-save device as proof of source platform. Cross-save remains possible.

## Mutation boundary

Even if the 01B static classifier marks an ordinary object as editable, the browser route overrides mutation capability because the imported save's exact target build is not proven.

The resulting browser EditorDocument records:

- `exactBuildKnown=false`
- `persistentWriteAuthorized=false`
- `worldPlacementValidate=browser-disabled-exact-build-unproven`
- `worldDryRunMutation=browser-disabled-exact-build-unproven`
- `worldPersistentWrite=unsupported`

The current product route therefore permits read-only projection and portable Scene capture for the supported object subset, but not real-target MOVE/ROTATE/ADD/DELETE.

## Fail-closed boundaries

- Unknown or Steam/Windows source: Area/Grid route enumeration only; Switch static data is not generalized.
- Missing geometry: object remains unresolved/read-only.
- Root Grid dimensions: not yet bound; root bounds may be unresolved.
- Serialized SubGrid child dimensions: not yet fully bound; affected SubGrid portability remains read-only/blocked.
- Building / PlayerHouse / unsupported state classes: remain read-only under 01B classification.
- Road/Fence: 01B delegates them to 01C; they are not reinterpreted by WEP as ordinary furniture.
- Persistent writer: disabled.
- Native GridObject ID allocation: disabled.
- Inventory / Collection / entitlement mutation: absent.
- Save replacement: disabled.

## Regression evidence

Pinned logic/product HEAD:
`1cc5f16032a366c0cdd0aadc1afb7e13bc7df318`

GitHub Actions run:
`36776997269`

Result:

- 302 tests total
- 290 PASS
- 0 FAIL
- 12 fixture-dependent SKIP
- production Svelte static build PASS
- `built in 6.38s`

New browser-binding checks explicitly pass:

- canonical adapter/static-input byte pins;
- compact Switch data verification/expansion;
- raw Switch save → read-only EditorDocument projection;
- unknown/cross-save source-platform rejection;
- static-data checksum mismatch fail-closed.

## Next release-critical WEP action

The next data-plane gap is not another WEP native interpretation.

1. Consume an Integrator-approved current-v1.25 GridData-dimension contract when Core exposes it, so root bounds and supported SubGrid portability can become authoritative.
2. Consume an 01C-owned raw native Road/Fence → logical-network read contract when exposed; then attach/project the already-approved logical networks in Canvas and Scene capture.
3. Keep persistent world/topology mutation disabled until exact-build, placement, identity, transaction and runtime gates are explicitly promoted.
