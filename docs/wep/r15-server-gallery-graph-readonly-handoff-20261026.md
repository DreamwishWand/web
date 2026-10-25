# 02 WEP — R15 Server-issued Gallery Graph Preflight Read-only Consumer

Date: 2026-10-26 (JST). Owner: existing 02 WEP / World Editor & Presets. **DRAFT SOURCE/SYNTHETIC ONLY**.

## Branch and ancestry

- New isolated child Draft PR #147, `wep/r15-server-gallery-graph-readonly-20261026`, based on unchanged **02 WEP Draft PR #135** source HEAD `d07b6bb5e976afb9df790562f9eb3fc2baf73d63`.
- Source contract: 03 COMM PR #134, verified exact Source124 HEAD `41fbbaf6aba8326fe9935955879218f8b9c35a91`, 124 migrations (incl. 02840/02850/02860/02870/02880); community-command `preflightGalleryGraph` -> service-only `community_gallery_graph_preflight_r15`. Source124 is **not imported** onto this child branch. No PR #134/#135 rebase, merge or force push, QA branch repin, Staging migration, ACL grant or Native DDV write.
- Parent WEP PR #135 remains Draft and preserves old Scene Capture and offline intent. Control/03 COMM must approve exact Source integrated ancestry later; this child is a narrow reader, not the Server Gallery publishing patch.

## Actual Source124 response and WEP handling

Source124 Owner signed command payload `{workId:galleryWorkUuid,presetRevisionIds:[currentPresetRevisionUuid]}` through the existing authenticated Community transport returns `{ok:true,command,data}`; only `data` is passed to WEP validation. The SQL response is `{schemaVersion:1,registryVersion:'gallery-scene-scoped@r15',expectedGraphSha256,expectedGraph,expectedWorkStates,expectedArtifactIds,expectedPresetWorkIds,expectedGalleryWorkIds,historicalPresetLinks,mediaReferences,coverReferences,authoritative:true,graphComplete:false}`.

- `src/lib/wep/r15-server-gallery-graph-readonly.ts`: strict typed validation and sanitized `R15ScopedGraphObservation`; rejects schema/version, malformed SHA, UUID/count/duplicate, missing or changed cross-projected Work State/owner/creator/current pointer/RowVersion, missing artifact/unknown preset facet/multi-Artifact, historical unresolved link, media on wrong WorkRevision, Cover missing from the same revision's Media set. Verifies immutable Preset WorkRevision maps to current PresetRevision via `presetPublications`; they are NOT the same UUID. Refuses a stale public-versus-owner Gallery current Revision or Preset current Revision. Validates actor subject/account ID from the SAME signed bridge where available, checks every Work/Artifact creator and account against scoped root. Do not display account/JWT subject identifiers.
- SHA is server-issued lowercase SHA256, preserved **verbatim**. Never recompute PostgreSQL jsonb canonical digest in JavaScript. The Graph contains sensitive account/subject and historical Media metadata: return only sanitized ID/version/counts/observed server digest; **do not retain/return the raw `expectedGraph` or Storage key**. Historical Media/Cover remains numeric *reference counts*, no historical signed URL or Storage bytes.
- Existing `preset-community-bridge.ts` adds `inspectGalleryGraphPreflight` as **read-only signed Owner command** and `getAuthenticatedSubjectId`. Existing `SceneRevisionReadOnlyPanel.svelte` allows Owner-only inspect, validates `diagnoseSceneRevisionPairing`, then compares server Gallery and Preset rowversions to owner-readiness, sanitizes and renders only safe metadata; clears Graph when selection changes, owner bridge changes, or disconnects; invalidates pending async responses when session subject changes. Missing signing, invalid session, unsupported facet, stale graph, unknown relation or mismatched scope are visible Fail-closed errors; no positive action/button.
- Eight locale strings in existing `scene-revision-copy.js`. Existing synthetic Chrome verifies 320px, keyboard Enter, invalid/expired public Cover and **no Owner R15 graph leakage on public-only selection**; synthetic HTTP is NOT a signed real actor test.

## Distinct contracts in Offline Revision Intent

1. `artifact.checksumSha256`: existing local portable Scene JSON **UTF-8 bytes**, with exact size; captureRegion, selected dependency/SubGrid closure, requested Road/Fence topology, verified Switch1.25.0 BID `52BD625D9B4E0053`, schema624 only.
2. `observedScopedSceneHistoricalEdgeSha256`: Scene-scoped `scene-historical-edges-v1` Owner Readiness; advisory/non-atomic.
3. `observedServerGalleryScopedGraphSha256`: exact server `gallery-scene-scoped@r15` Graph SHA from R15 signed Preflight. Advisory for **WEP Scene Revision** despite being server-authoritative for the limited Gallery caller-Graph preflight. It is **not** the same as the first two.
4. `fullGlobalAllWriterGraphSha256=null`: global five-facet/all-reference Graph is not issued/complete.
5. `actualStorageBlobReceipt=null`: actual Cloud object bytes, provenance, owner Media READY/CLEAR and signed CDN not attested by R15 preflight.

`expectedHistoricalEdgeSetSha256`, `expectedGalleryWorkRowVersion`, `expectedCreatorProfileId` (for future actual Scene save command) remain **null/disabled**. `saveRevisionAuthorized=false`, `pairedGalleryPublishAuthorized=false`, `graphComplete=false`, `productApplyAuthorized=false`. R15 metadata cannot authorize Wand Scene Save Revision/paired Gallery Cover or native DDV edit, nor a future positive retirement.

## Source124 compatibility and follow-ups

03 COMM source `20261025002840_gallery_caller_pinned_graph_r15.sql` hashes PostgreSQL jsonb canonical text, not JS stringification; `20261025002850_gallery_r15_signed_preflight.sql` returns the exact DTO and grants only service_role SQL execute through authenticated Edge; `community-command/index.ts` has `preflightGalleryGraph`, followed by the R15 **Gallery Publish only** caller-pin flow. Source124 R15 scope covers zero/one known Scene; multi Artifact, Biome, Floating Island, ToM Furniture/Clothing, Media/Cloud/native graph remains unknown and must fail closed. R15 `authoritative:true` plus `graphComplete:false` is legitimate only for this bounded preflight and never user-job release authority.

UNRESOLVED: No complete global registry, all facet and all Writer lock/caller versions, cross-product historical Media/Cover/Cloud graph, native writer; no authentic signed disposable Owner A/non-owner B/Moderator M Staging/Storage/CDN E2E or CDN old bearer revocation; no 40P01/40001 Edge timeout acceptance; true Account/Creator/Auth session authorization requires server verification and future Scene writer recheck. 09 INT/03 COMM remain owners of Writer Contract; 04 QR owner of independent QA. No new PR #135 parent rebasing. R17 stays 30 nodes 0 PASS / 12 PARTIAL / 18 BLOCKED. All drafts DO_NOT_MERGE/DEPLOY, DDV1.25.3 schema626 remains read-only, Steam626 unsupported.

## Verification

`tests/wep-r15-server-gallery-graph-readonly.test.mjs`: scoped valid, wrong registry/schema, SHA, owner/Creator/account/subject, stale revision/Work mirror, unknown facet/multi artifact, dangling history/media/cover. `tests/wep-r15-gallery-graph-owner-ui.test.mjs`: signed Bridge calls only preflight; auth session-switch, eight locales, Keyboard/320px and no Writer. `tests/wep-scene-revision-offline-intent.test.mjs`: content vs historical vs Gallery SHA separation, global graph/blob null, stale Source rejection and continued hard Block. Exact HEAD Actions Run IDs should be read from GitHub at close, not inferred from old CI. Backend branch not integrated; signed E2E NOT EXECUTED.
