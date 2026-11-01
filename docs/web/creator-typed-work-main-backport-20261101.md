# 08 WEB — Creator typed Work navigation main-based backport, 2026-11-01

Scope: existing 08 WEB / UI Foundation. Controller Issue #214 comment #6553241236 confirms main Creator source Git blob `28d2305dad36e3be6fb5d9cb394e8be9fa47d589`: every non-Gallery/non-Question Work, including `work_type=dreamsnap`, links to `/qa/?tip=<WorkId>`. This is a CONFIRMED source navigation bug, not a proven privacy exposure.

**NO NEW RESOLVER DESIGN:** exact already implemented and independently 04 QR accepted in WEB PR #222 Owner HEAD `99ed88fc717cf18bb4127695f16d6949e7609463`, independent QR PR #226 QA HEAD `8f872fab2a39a5a00d3d122ecb942a4ab3152298`, Source+Chrome CI40504581189 SUCCESS, normal CI40504580984 SUCCESS. Those PRs are still DRAFT on a PR215 stacked baseline and do not alter main. This PR reuses byte-for-byte exact three source Git blobs from PR222 in a **standalone main-based Draft**, without importing unrelated PR215/222 Gallery/Q&A/Saved/Community/Source153 changes.

Byte-equal imported files:
- `src/lib/community/typed-work-route.js` blob `72f57ecc0dfc6b262d84b3e45233eab22e6551e2`: allowlist gallery `/gallery/?work=UUID`, question `/qa/?question=UUID`, tip `/qa/?tip=UUID`, dreamsnap **only** no-ID `/dreamsnaps/` gated; unknown/NIL/non-UUID/private/unlisted/retired/moderated/deleted/owner restricted fail-closed. Path construction confers NO read/media/phase authority. `parseTypedWorkQuery` rejects mixed/duplicate/malformed query.
- `src/lib/dreamsnaps/privacy-copy.js` blob `9b4917e87fc0d4a454ef9e53711682e468e4448f`: eight-locale honest unavailable notices, no publishing authority.
- `src/routes/creator/+page.svelte` blob `21ea34e430f6e202d83ed0dd3baa5424fa99dad2`: type resolution uses shared helper, gated DreamSnaps redacts title and concept and links only to no-ID root; unknown/private/retired state is inert non-link; strict Creator UUID query and navigation generation prevent stale Creator requests from overwriting updated state.

## Version/platform and scope
- This is Community route and UX only, platform/game/save schema independent; no new native DDV Save or reader contract.
- DreamSnaps official DDV + overlapping Wand voting embargo, unpublished competition works, owner privacy/Creator/Account and moderation backend authority remain enforced server-side; this UI never trusts inferred public phase, works' local flags or author labels to grant public detail or photo.
- 06G owner Stage1 product UX closed for design (Submit/Judge/Results/Community/My), but positive Community DreamSnaps individual Work Detail requires separate validated official phase, publication, real signed actor/media authorization and full 04 QR. No public WorkDetail endpoint or Signer/Storage Provider/Cloud/Publisher is enabled or invented by this route.
- Existing main Q&A and Gallery currently accept known typed parameters. Source-only route avoids incorrect Tip type for DreamSnaps. Broader strict Q&A/Gallery deep-link guard and same-route SPA are already part of stacked PR222: this main-only backport deliberately does not duplicate/replace those changes, but new QR should identify any cross-product browser incompatibility.
- WEB215, WEB267, WEB276, Collection192, Guide133, Gallery105, SQL/Community and native Writer/Apply untouched.
- No real user data/signed session/backend publication used in tests. Mock interception synthetic only. All PRs DRAFT/DO_NOT_MERGE/DO_NOT_DEPLOY; R17 30 PASS0 / PARTIAL12 / BLOCKED18 plus seven shared gates, Public NO-GO.

## QA
- New-only `tests/web-creator-typed-main-backport.test.mjs` pure Node strict type/UUID/private/source parity/8 language/safety assertions.
- New-only `scripts/web-creator-main-backport-chrome.mjs` synthetic actual Chrome of Creator data routes, gated embargoed no-ID DreamSnaps keyboard navigation, missing invalid private unknown retired, strict Creator URL and no-sign/media, 8 locales and 320px layout, page/console no errors. No actual protected data.
- New-only CI compares exact three migrated source blobs from PR222, freezes all old Core/Collection/Guide/Gallery/Q&A/Community/WEB267 source, allows only 7 new paths and verifies type/source/build + browser.
- Independent 04 QR review required against exact final Owner HEAD, specifically **this main-based delta**; do not repeat QR226's earlier full PR222/QA SPA or claim main now deployed.
