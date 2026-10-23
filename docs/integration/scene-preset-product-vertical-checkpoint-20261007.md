# Scene Wand Preset product vertical — 2026-10-07

Status: IMPLEMENTATION / VERIFICATION IN PROGRESS

Target: Nintendo Switch DDV v1.25.0 / BID 52BD625D9B4E0053 / profile schema 624.

This branch implements one coherent Scene Wand Preset vertical:

World Editor Capture Region -> private local master -> explicit public Publish -> associated Gallery Work -> public Preset Detail -> Library save -> exact signed revision read -> World Editor handoff/preflight.

Safety remains fail-closed:
- published revisions are immutable;
- first public Publish requires a title and at least one public image;
- Scene artifact schema v1 only;
- exact signed bytes, SHA-256, byte size, revision identity and schema are revalidated before reuse;
- clipped Road/Fence topology is rejected;
- unsupported Scene object classes and unsupported Switch build/schema are rejected;
- persistentWriteAuthorized=false;
- productApplyAuthorized=false;
- directSourceReplacementAuthorized=false;
- whole-Scene automatic persistent Apply is not authorized.

The existing WEP artifact bucket and Community PresetArtifact/PresetRevision/ArtifactBlob domains are reused. No duplicate Item, Creator, Preset payload-store or entitlement model is introduced.

Verification notes:
- Staging DDL rollback parse: PASS; no migration state or synthetic product data retained.
- Internal CI PR: #101 against temporary integration base only; DO NOT MERGE.

- CI run 37625518152 classified 7 failures as integration regressions; legacy signed-read compatibility and obsolete direct-publish localization assumptions were corrected.

- Staging temporary E2E harness v8 honors Supabase per-trace retryAfterMs once; product rate limits are unchanged.

## Final 09 INT checkpoint — 2026-10-08

Status: PARTIAL / READY_FOR_BROWSER_CONFIGURATION

Exact current-main parent:
- 52166f81c107de66dbfab8a6c16aaecc33b21ee0

Implementation checkpoint:
- 949cd47c7aa03c6063caf6124f7fdef8598f1a6b

Authoritative vertical:
- one Scene Preset publication relationship: preset_artifacts.associated_gallery_work_id
- one dedicated WEP product Edge: wep-scene-preset-product
- first Publish requires public Title + >=1 Gallery-owned public image
- Publish Update may reuse current Gallery media
- published Preset revisions remain immutable
- failed Publish Update leaves the previous public revision active
- failed publication best-effort discards only unattached finalized media through Community ownership checks
- exact signed revision read verifies artifact/revision/blob/storage key/content type/byte size/SHA-256/schema before reuse
- World Editor performs destination-specific v1.25 build/object/topology/native-placement preflight after handoff
- automatic whole-Scene persistent Apply remains unauthorized

Superseded alternate implementation removed:
- 20261007201500_scene_preset_product_vertical_v1.sql
- preset_gallery_work_links relationship model
- scene-preset-master.ts duplicate private-master domain
- scene-product-copy.js alternate product surface
- alternate publication RPCs in legacy wep-preset-artifact

Final CI:
- run 37681276491: SUCCESS
- 907 tests / 895 PASS / 0 FAIL / 12 fixture-dependent SKIP
- svelte-check: 0 errors / 10 warnings in 4 files
- integratedReady=true / requireReady=true / migrations=84
- static build PASS
- /presets/publish/ and /presets/detail/ static route gates PASS

Live staging HTTP acceptance:
- run 37679074412: SUCCESS
- scope SCENE_WAND_PRESET_PRODUCT_STAGING_HTTP
- 25/25 acceptance assertions PASS
- immutable revisionCount=3
- artifact objects removed=3
- media objects removed=1
- public search residue=0
- engineering_fixture origin excluded from public metrics
- disposable account cleanup PASS
- authored ArtifactBlob/media payloads removed
- minimal structural tombstone/audit history retained only per Community retention invariants

Staging post-acceptance state:
- wep-preset-flow-e2e v9: verify_jwt=true, STAGING_E2E_DISABLED
- wep-scene-preset-product v1: verify_jwt=true
- community-media v9: verify_jwt=true
- community-public-query v4: public read boundary; hidden/deleted Scene detail normalized to 404
- migrations: scene_preset_product_vertical_v1 + scene_preset_unattached_media_discard_v1
- no production resources created

Browser acceptance:
- CONFIGURATION_BLOCKED, not product/integration failure
- GitHub Actions public Community variables DREAMWISH_SUPABASE_URL / DREAMWISH_SUPABASE_PUBLISHABLE_KEY are unavailable
- signed Scene Chrome assertions were NOT_EXECUTED
- pageErrors=NOT_EXECUTED
- consoleErrors=NOT_EXECUTED
- a workflow success caused by skipped Chrome assertions must not be classified as browser PASS

Hard flags remain false:
- persistentWriteAuthorized=false
- WORLD_PERSISTENT_WRITE_V125=false
- PERSISTENT_WRITE=false
- productApplyAuthorized=false
- directSourceReplacementAuthorized=false

Smallest remaining Scene technical slice:
configure the reviewed GitHub public Community runtime values and disposable signed-actor browser path, then execute only the Scene vertical Chrome assertions. Do not begin another Preset type until that browser slice is closed.
