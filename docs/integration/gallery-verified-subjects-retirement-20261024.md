# 09 INT Gallery verified subjects / cross-product retirement — 2026-10-24

Request: `09-INT-GALLERY-PHOTO-SUBJECT-AND-RETIREMENT-V1` / Issue #110. Status: **PARTIAL / FAIL-CLOSED**.

## Authority and topology

Exact main: `52166f81c107de66dbfab8a6c16aaecc33b21ee0`.
03 COMM only Gallery API: PR #108 / `dev/community-gallery-public-lifecycle-20261023@a7a492254d9e5f571e41adf151e2fe893d84c813`.
09 INT integration branch is stacked on PR #108 (NOT on historical 09 INT PR #77), and intentionally does not merge PR #102 or #105.
PR #102 remains an independent Scene Preset product implementation; PR #105 remains WEB consumer awaiting accepted contracts.

## Reviewed subject source

Canonical identity and displayed region are separate. Never use screenshot labels, raw GridID, GridDataPath, house nickname or approximate item-name matching as a subject ID.

| Gallery subject | v1.25 source identity | reviewed seed count | status |
|---|---|---:|---|
| Decorations Outdoor / Biome | `ddv.outdoor-location-ref@1` with **VillageSceneItemId + AreaType** | 0 | UNKNOWN as complete official subject registry |
| Decorations Outdoor / Floating Island | `ddv.outdoor-location-ref@1` with exact **SceneItemId** | 13 | CONFIRMED v1.25 Core route audit |
| Decorations Indoor / Room | owner-specific House/Room identity, not a global GridID | 0 | UNKNOWN complete canonical photo subject enumeration |
| ToM Furniture / Base Item | exact Game DB confirmed eligible ToM Furniture Base Item ID | 0 | UNKNOWN; no positive reviewed Base Item pack |
| ToM Clothing / Base Item | exact Game DB confirmed eligible ToM Clothing Base Item ID | 0 | UNKNOWN; no positive reviewed Base Item pack |

The **13** audited Floating Island IDs are `1540000147, 1540000148, 1540000149, 1540000150, 1540000151, 1540000152, 1540000153, 1540000154, 1540000192, 1540000193, 1540000194, 1540000238, 1540000246`. These are SceneItemIDs (not save-local GridIDs); evidence is the immutable repo fixture `tests/fixtures/ddv-world/outdoor-location-routing-audit-v125.json`, Git blob `0140d2e416ecc1601f039e1fb1def277a6808e51`, which reports 13/13 map-key equality, 26 direct roots and cross-snapshot route parity. The source's pinned Switch v1.25.0 decrypted-profile SHA-256 is `1cfc40196f7ee36048e1fa98c0835561901c6fed3f19ca8dd6fa36c47740dc10`. No private save bytes are included in this branch. This is version-scoped identity evidence, not native writer capability or entitlement proof.

Core-pinned 13-row enrollment SQL is `supabase/seeds/gallery-verified-subjects-v125-reviewed-20261024.sql`; it targets **the existing** `gallery_verified_subjects` table and conflicts on different provenance instead of silently overwriting a row. The positive adapter is `src/lib/integration/gallery-subject-provenance.ts`. It rejects unsigned/unreviewed kind and ID, absent Base Item proof, wrong platform/version/build/schema and mismatched evidence. v1.25.3 schema626 and Steam are not enrolled.

**Staging enrolled and verified:** 13 permanent `gallery_verified_subjects` rows, all `outdoor/floating_island`, `switch/1.25.0/52BD625D9B4E0053/schema624`, with 13 distinct target IDs and 13 distinct evidence refs. The other four subject types remain 0. These are real subject-classification records, NOT Gallery content/Creator/seed works; rollback fixtures were never counted. Production has not been modified.

## Exact dependency graph

Primary graph owner is Community. It does not duplicate Gallery Work or PresetArtifact:

1. `community_works.work_id` → `gallery_works.work_id` owns PUBLIC media and revision identity.
2. `community_works.current_published_revision_id` → `gallery_work_revisions.revision_id` / `work_revision_media` pins the current media. Old media in historic revisions is NOT automatically public.
3. `gallery_revision_presets.gallery_revision_id` → `preset_revisions.preset_revision_id` → `preset_artifacts.preset_artifact_id`; historic reference does not create editable ownership.
4. PR #102 Scene one-to-one relationship: `preset_artifacts.associated_gallery_work_id` → Gallery Work, `preset_artifacts.community_work_id` → Preset Work. This optional column is only read if PR #102 has actually been deployed. Its absence is UNKNOWN, never no relation.
5. Biome/Floating Island/ToM Furniture/ToM Clothing Preset and native listing backend publications are **not deployed**; no speculative join or new item/preset domain. These remain UNKNOWN and prevent graph completeness.
6. Owner and Creator are exact `owner_account_id` and `creator_profile_id`; SavedItem is reuse/Library, not edit ownership.

The service-only, read-only `private.gallery_photo_dependency_snapshot_v1(workId)` returns known current/historical link references and the explicit coverage/unknown matrix. It never authorizes a retire operation. It does not expose a new Gallery publish API.

## Retirement negative gate

The canonical 03 COMM PR #108 already blocks linked Preset deletion, generic unauthorized Cloud Unpublish and exposure of hidden/deleted photo detail. The additive `20261024201000_gallery_retirement_negative_gate_v1.sql` further blocks classified PHOTO Work DELETE while previously issued Storage signed-URL revocation is unproven, with exact `GALLERY_ISSUED_MEDIA_URL_REVOKE_UNPROVEN`. It is an add-on trigger; it does **not** alter or reimplement `community_publish_gallery_photo_v1`, `community_delete_gallery_photo_v1`, `community-command` or `community-public-query`. Moderation-state hiding paths remain separate.

Reason: revoking new URL issuance and search/detail authorization alone does not invalidate a previously issued signed media URL (currently up to **300 seconds**). A fully safe release requires a proven object-key revocation / media gateway / explicit TTL-and-retention acceptance model, plus signed URL negative tests. Until owner approval, **even unlinked Free Delete remains fail closed** on the integrated branch. No claim of immediate CDN revocation.

Cloud `Unpublish and Keep Private` remains disabled: no demonstrated paid Wand Cloud durable private Work store, account ACL, or restoration proof. Local PC backups are irrelevant to server-private durability.

A pure integration planner `planGalleryRetirement` reports typed blockers for UNKNOWN graph coverage, active public dependents, cross-owner dependencies, missing Wand Cloud preservation and issued-URL proof. Even a hypothetical clean read-only planner returns `GALLERY_SERVER_ATOMIC_RETIREMENT_REQUIRED`; client code cannot grant authority or run unverified multi-command teardown.

## 08 WEB consumer handoff

`src/lib/integration/gallery-public-consumer-contract.ts` consumes the original `src/lib/community/gallery-photo-contract.ts` and exports typed `GalleryPublishAvailabilityV1` / `GalleryRetirementAvailabilityV1` plus the exact existing command/query names. Do NOT enable Delete or Cloud Unpublish merely because the button exists. Needs 03 COMM authorized verified-subject query/list response and complete retired-work authorization semantics before enabling.

Use `publishGalleryPhoto` for Create/Update only when subject is registry-issued and verified. Respect expectedVersion, idempotencyKey, 1..10 READY/CLEAR owned image IDs and originality attestation. Work stays linked to the exact owner+Creator. Gallery media belongs to Work, not a duplicated Preset cover bucket.

## Outstanding release acceptance

- Reviewed real subject enrollment for Biome/Room/ToM requires exact 01D provenance and stable authoritative target serialization. Current only Floating Island 13.
- Native/ToM public listing registration, atomic public retirement and projection revocation are not implemented; until then BLOCKED.
- Wand Cloud durable Private Work/ACL/recovery proof absent; Unpublish remains BLOCKED.
- Existing Storage signed URL immediate invalidation unproven; user-facing Delete remains BLOCKED. 03 COMM/CDN owner and 04 QR must resolve.
- 03 COMM must expose reviewed registry lookup under the **existing** trusted Community public-query boundary; do not grant client direct registry SQL access.
- GitHub Actions public staging values and authorized signed A/B/Moderator actors remain CONFIGURATION_BLOCKED; skipped Chrome E2E is NOT PASS.
- PRs #102/#105/#108/#113 remain unmerged pending controlled acceptance. No whole-release PASS.

Hard flags remain false: `persistentWriteAuthorized=false`, `WORLD_PERSISTENT_WRITE_V125=false`, `PERSISTENT_WRITE=false`, `productApplyAuthorized=false`, `directSourceReplacementAuthorized=false`.

## Engineering and staging verification — 2026-10-24

- Integration branch parent is 03 COMM PR #108 exact head `a7a492254d9e5f571e41adf151e2fe893d84c813`, itself based on main `52166f81c107de66dbfab8a6c16aaecc33b21ee0`. PR #113 is stacked, DRAFT and DO_NOT_MERGE.
- CI run `40022936744`: SUCCESS. 912 tests / 900 PASS / 0 FAIL / 12 existing fixture-dependent SKIP. Svelte 0 errors / 3 warnings. Shared A11Y/L10N, canonical baseline, Community ops, integrated-tree `integratedReady=true / requireReady=true / migrations=89`, and static build/routes PASS.
- Live staging verified subject registry: 13 exact v1.25 Floating Island entries persisted via source-pinned 13-row seed and read back (13 distinct target/evidence refs). Non-Floating subjects remain 0. There were no synthetic Gallery Work or image content seeds.
- New additive migration `gallery_retirement_negative_gate_v1` applied to STAGING ONLY. Runtime readback: `private.gallery_photo_dependency_snapshot_v1(uuid)` present, `graphComplete=false`, `anon EXECUTE=false`, `authenticated EXECUTE=false`, `service_role EXECUTE=true`; `gallery_photo_issued_url_retirement_gate` present (1 trigger). No production changes.
- Prior to staging application, migration+13-row seed parsed within BEGIN/ROLLBACK successfully and returned 13 provisional verified entries. Follow-up transaction invoked graph read with contract `ddv.gallery-public-dependency-retirement@1` and proved negative ACL; rollback returned without retained synthetic changes.
- Security Advisor: 22 INFO `rls_enabled_no_policy` service-owned/restricted tables, 1 WARN `auth_leaked_password_protection` (pre-existing Auth operations issue). No new HIGH/CRITICAL finding was returned. See [Supabase RLS-no-policy info](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- Existing 03 COMM Gallery staging acceptance established PUBLIC create/update/immutability, negative SQL ACL and unlinked delete under the PRE-negative-gate contract. Do not mislabel it as PASS for current negative-gate deletion behavior; fresh signed actors and exact current staging runtime acceptance remain OPEN.
- Delete of classified PUBLIC Gallery photo Work is now deliberately blocked in staging by `GALLERY_ISSUED_MEDIA_URL_REVOKE_UNPROVEN` until infrastructure/03 COMM proves previously issued signed URL invalidation. This intentionally supersedes older unlinked Delete success assertions. Moderation hide/public-query authorization still follows 03 COMM owner; old signed URL remains a security blocker.
- Cloud Unpublish and Keep Private remains unimplemented/unapproved rather than pretending local backup or private draft is durable server preservation.
- Signed browser E2E remains CONFIGURATION_BLOCKED by missing reviewed public GitHub Actions Supabase values and legitimate signed A/B/Moderator actors; `pageErrors` and `consoleErrors` are NOT_EXECUTED for that scope, not [].
- Return classification: PARTIAL / 08_WEB_CONSUMER_WAIT_ON_03_COMM_AND_QR. No whole release PASS; hard DDV writer flags all false.

## Final additional rollback acceptance — 2026-10-24

- Reused PR #108's existing staging acceptance fixture with a single changed unlinked Delete expectation; proof file `supabase/staging/acceptance/gallery-photo-retirement-negative-v1.sql`.
- Live staging SQL transaction PASS: PUBLIC Create, revision update, idempotency, nonowner rejection, linked Preset Delete rejection, Cloud Unpublish rejection, all five synthetic classification branches, plus **unlinked Delete rejection** on `GALLERY_ISSUED_MEDIA_URL_REVOKE_UNPROVEN`.
- Failed unlinked DELETE preserves current public revision, Search and Detail; no partial state change. The entire fixture transaction ROLLBACKs.
- Post fixture readback: 13 persistent reviewed Core subjects, 0 ACCEPTANCE_ONLY fixture subjects, 0 classified synthetic photo Work rows, 0 acceptance/ media rows.
- Final implementation CI run `40023442473` SUCCESS: 913 tests / 901 PASS / 0 FAIL / 12 fixture-dependent SKIP; Svelte 0 errors / 3 existing warnings; integratedReady=true / requireReady=true / migrations=89; static build/routes PASS.
- Signed Chrome: CONFIGURATION_BLOCKED, NOT_EXECUTED. No `pageErrors=[]` or `consoleErrors=[]` claim for this unrun browser slice.


## 09 INT reviewed v1.25 additional Gallery subject enrollment — 2026-10-24

Request `09-INT-GALLERY-V125-REVIEWED-SUBJECT-ENROLLMENT-V1` / Issue #119. Stacked Draft PR #123 is the additive successor ON TOP OF 03 COMM PR #118, not a rewrite of PR #113. Chain: #108 → #113 → #118 → #123; all DO_NOT_MERGE. Source branch `integration/gallery-v125-reviewed-enrollment-20261024` based on #118 `fbee2c452fd6997900f4d3588a9ad99f6d388131`. Current main `d8f88c8dfb7d959164eb32b63f9c80b16bb29faf` after independent 01A #109 squash; compare reports 47 commits ahead / 1 behind (scoped 01A change), PR #123 mergeable=true on exact #118 base; do not rebase upstream draft branches during this pass.

### Source review / identity authority
- Primary source `DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz` Drive `1_iMow5gXJTmgbogw1y7S8vTQp-Bj2vI8`, gzip SHA256 `df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048`, computed directly against raw downloaded bytes and matched 01D contract. Query index SHA256 `f3472e53bfcd55f13249cc79ddeae83ea71168fcb356c7038a0c0935eca2d06e` also matched.
- Typed, schema-resolved `FurnitureItemData` denominator 4,949; `ClothingItemData` denominator 1,900. Native customization eligibility = `CanAddDecals || CanChangeColor`, NOT AND. Exact source audit: Furniture both flags true 40, one-only 0; Clothing both true 35, one-only 0. This exhausts OR-eligible candidates **within this v1.25.0 lossless definition set**, not future patches or unknown concrete types. 01D compact machine contract IDs matched in exact order 40/40 and 35/35. Four `FurnitureAncientMachineItemData` false positives (40800010,40800011,40800012,40800026) excluded. The versioned manifest records exact zero-based source item-index and per-record rawPayload SHA256. Motif, Design.Id, ownership/entitlement and variation/alias without positive proof are never Base Item identity.
- Biome review approved **four and only four** exact explicit Village04 GridData aliases from `grid-role-authority-v125.json` Git blob `184e43b91fd647c9661129cfa07a0f5edb3dda63`: SceneItemId `1540000000` + AreaType `1/4/5/7`. Transport IDs `1540000000:1`, `:4`, `:5`, `:7` are WAND-composite strings, not native ItemIDs; codec only decodes canonical exact reviewed pairs. Partial source universe: do NOT infer all 44 native enum values are publishable Biomes.
- Room is save/account scoped (`HouseItemID + floorIndex + RoomSlot`), not globally enumerable by 60 houses/240 room fixture instances. No safe owner+Linked DDV Profile binding or private Save identity pseudonym/projection contract yet; global Room seed remains 0, rejected by explicit typed guard.

### Implementation and actual Staging acceptance
- Added source manifest: `static/ddv/core/gallery/v1.25/reviewed-tom-base-items-v125.json`; strict source-backed module `src/lib/integration/gallery-reviewed-subjects-v125.ts`; extended only the existing PR #113 `gallery-subject-provenance.ts` validator (preserves its original 13 records); additive seed `supabase/seeds/gallery-verified-subjects-v125-four-kinds-20261024.sql`; PR #118 typed consumer integration in `gallery-public-consumer-contract.ts`, no duplicate RPC/schema.
- Seed preview live STAGING `BEGIN → seed → same seed again → SELECT → ROLLBACK` PASS: 13 prior islands + 4 new Biomes + 40 ToM Furniture + 35 ToM Clothing = 92; idempotent.
- Negative conflict live STAGING `BEGIN → seed → tamper biome evidence_ref → rerun seed (expected GALLERY_SUBJECT_EXISTING_EVIDENCE_CONFLICT caught) → ROLLBACK` PASS. No leaked fixture changes.
- Exact reviewed additional seed then committed to STAGING; readback **92** `verified` rows by kind: Floating Island 13 (original evidenceRef preserved 13/13), Biome 4, ToM Furniture 40, ToM Clothing 35, Indoor Room 0. Public service `community_list_verified_gallery_subjects_v1` results under existing #118 source: Outdoor 17; ToM Furniture 40; Clothing 35. Anon/authenticated raw registry SELECT=false; direct RPC EXECUTE=false; service_role RPC EXECUTE=true. Existing `gallery_photo_issued_url_retirement_gate` trigger count remains 1.
- CI on implementation HEAD `4929e6a1a9018f75027df38c0bacc51d38a000e3`: run `40032141310` SUCCESS, 924 tests / 912 PASS / 0 FAIL / 12 existing SKIP; Svelte 0 errors / 3 warnings; integratedReady=true requireReady=true migrations=90; no production changes. Subsequent documentation-only commits require exact final-head CI readback if claiming final CI status.
- Existing DELETE including unlinked remains denied `GALLERY_ISSUED_MEDIA_URL_REVOKE_UNPROVEN` (old signed URL may survive up to 300s); positive all-linked Preset/ToM/native retirement remains UNKNOWN/unauthorized until actual registries and atomic graph coverage; Wand Cloud private preservation/ACL/restore absent; signed A/B/Moderator Chrome CONFIGURATION_BLOCKED. PR #118 public-query read-only classification does not grant publish ownership or native writer eligibility. All DDV native writer and Product Apply flags remain false.

### Remaining bounded owners
03 COMM / Issue #116: CDN old-URL negative replay/privacy acceptance and durable Wand Cloud private preservation + restore. 08 WEB / Issue #120: consume PR #118 exact service-backed public lookup and 09 INT typed availability; keep Delete/Cloud controls disabled. 04 QR: real authorized A/B/Moderator signed E2E and old signed URL negative test. 01D: no new ToM source scan needed unless content changes; remaining Room scoped identity and missing Biome denominator are separate bounded evidence asks. Positive linked retirement awaits actual deployed listing registries. **Status PARTIAL: reviewed subject enrollment closed for 79 reviewed additional entries, complete Gallery retirement/browser/release blocked.**


## 09 INT — Cross-Product Dependency Coverage & Safe Retirement (2026-10-24)

**Scope:** Existing Issue #119 / request `09-INT-GALLERY-CROSS-PRODUCT-DEPENDENCY-COVERAGE-V1`; no new stream, Gallery RPC or database model. Exact Nintendo Switch DDV v1.25.0 BID `52BD625D9B4E0053`/schema624 only. Previous 13 Island +4 Biome +40 ToM Furniture +35 ToM Clothing = **92 verified subject definitions** persist unchanged; this is not 92 public Works. Steam and v1.25.3 Gallery/publication semantics unaccepted.

**Repo:** commits added on existing Draft PR #123 branch `integration/gallery-v125-reviewed-enrollment-20261024`, based on PR #118. Follow-on PRs #126/#129 (03 COMM owner-only cloud/media preflight) were already stacked from the earlier #123 HEAD; **they do not automatically contain the newer #123 commits**. Reconcile descendants deliberately during integration. Current main observed `71e568c9b576c54f8d100fae2ae883c835de7602`; compare to implementation `cf6bf5ecd6090d6e0b5bdaff5f40ed41e6bac9a4` was diverged, 52 ahead/2 behind. All Drafts DO_NOT_MERGE.

### Exact STAGING inventory / positive evidence
Staging `ptpdoxhrqopvczpclcij` via information_schema + pg_constraint + actual row counts:
- `public.community_works`/ `public.gallery_works`: 8 Gallery Works (3 outdoor, 5 preset_scene). `community_work_revisions` tracks current/historical revisions with FK and sealed_at; owner and creator FK to `wand_accounts` / `creator_profiles`.
- `public.gallery_revision_presets`: 12 FK-backed GalleryRevision -> PresetRevision links, of which 5 current Gallery revision and 7 historical Gallery revision; `preset_revisions` 17; `preset_revision_publications` 17 revision-to-publication associations.
- `public.preset_artifacts` 10, all `preset_type='scene'`; 5 `associated_gallery_work_id` references deployed with FK and 10 `community_work_id` references. The checked schema permits five Preset kinds scene/biome/floating_island/tom_furniture/tom_clothing, **but this does not certify current publication/link completeness for non-Scene types**.
- `gallery_photo_subjects=0`, `gallery_photo_revision_fields=0` (no actual current v1.25 verified Photo public Works in staging); `gallery_verified_subjects=92` is only definition metadata. `work_revision_media`, `media_assets`, `gallery_photo_revision_fields.cover_media_id` and creator/owner links deployed but media integrity and cloud preservation remain **03 COMM's separate** `gallery_cloud_preservation_snapshot_v1` read-only concern.
- No source-accepted deployed authoritative Native/In-Game public listing registry. No independent deployed ToM-specific public listing registry or accepted general Biome/Floating Island ToM publication lifecycle; these are not equivalent to verified Item/Base IDs or the type CHECK constraint.
- Actual observed `gallery_revision_presets` joins: 12; associated artifacts 5; classified `public_active` exact-current Gallery and exact-current preset publication links **0**. This last zero is an observation *within the named relationships*, not evidence of no public dependent work or complete product coverage.

### Coverage classification semantics
- `relationCoverage.gallery_work_revisions`: `VERIFIED` when records present, `VERIFIED_EMPTY` only for that exact FK-backed relation if no records (missing current WorkRevision remains BLOCKED).
- `relationCoverage.gallery_revision_presets`: `VERIFIED` or `VERIFIED_EMPTY` for that exact FK-backed link path only.
- `relationCoverage.preset_artifacts_associated_gallery_work_id`: `VERIFIED` / `VERIFIED_EMPTY` if the column/FK is deployed, otherwise `REGISTRY_MISSING`. Proves only that explicit path, not all Preset publications.
- `relationCoverage.preset_revision_publications=VERIFIED` refers to deployed revision-to-publication path; exact current publication checked with join to current published preset WorkRevision and published/public/clear Work state.
- `coverageClassification.scene/biome/floating_island/tom_furniture/tom_clothing=SEMANTICS_UNKNOWN` for GLOBAL retirement completeness, regardless of source link counts. `native_listing=REGISTRY_MISSING`. `sourceVersionState=VERIFIED` only for existing exact target verified Gallery Photo subject binding, `SEMANTICS_UNKNOWN` for older/unbound Gallery Works and `VERSION_UNSUPPORTED` for explicit mismatch.
- `VERIFIED_EMPTY` is NEVER upgraded to global GraphComplete simply because SQL returned zero. No attempt to fabricate a future Native/ToM registry, scope or publication target from game asset definitions.

### Implementation and unchanged security contract
- New additive migration `supabase/migrations/20261025002000_gallery_dependency_coverage_readonly_v1.sql` **replaces only existing private service-only** `private.gallery_photo_dependency_snapshot_v1(uuid)` read model. Existing `contract='ddv.gallery-public-dependency-retirement@1'`, `linkedPresetRevisionReferences`, `associatedPresetArtifacts`, `coverage`, `graphComplete=false`, `retirementAuthorized=false`, `issuedSignedUrlRevocationProven=false` preserved for #129 caller.
- Additional typed `coverageContract='ddv.gallery-cross-product-coverage@1'`, `coverageClassification`, `relationCoverage`, `missingDependencySources`, `blockedRetirementReasons`, source/version state, WorkRevision list (current/historical/sealed), owner/creator consistency counts, exact current dependent Preset publication state, and **SHA256 graphFingerprint** over stable revisions/dependencies/owner/rowVersion. Fingerprint only provides a conditional preflight comparison input. Without future transaction-level locks + all dependent registries, **concurrent writers remain possible**. No new mutation RPC or authorization is introduced.
- Typed 09 INT consumer/handoff `src/lib/integration/gallery-dependency-coverage-v125.ts` returns readOnly/authorized=false for every path. Rejects stale fingerprint/rowVersion/revision ID, cross-owner mismatch, unsupported version, missing current/unsealed historical revision, known linked-public references, unknown registry. Even a hypothetical complete graph returns `GALLERY_SERVER_ATOMIC_RETIREMENT_REQUIRED`, never a permission grant.
- 03 COMM PR #129 `cloudPreservation` reused as an **independent owner-only DB structural manifest**; no new entitlement/backups/ACL claim or reimplementation. Public `community_gallery_retirement_preflight_v1` untouched. Snapshot service-only EXECUTE: anon=false, authenticated=false, service_role=true. Existing signed URL Delete denial trigger unchanged. Native/DDV writers/Product Apply OFF.

### Real Staging acceptance and CI
- Live `BEGIN`/migration creation/snapshot invocation/`ROLLBACK` PASS, followed by deployed additive function migration `gallery_dependency_coverage_readonly_v1`. Actual readback 8 Gallery snapshots; all `graphComplete=false`, all fingerprints SHA256 syntax valid, observed 12 Gallery->Preset Revision edges, 5 associated artifact edges; 5 Gallery Works with nonempty link relation and 3 `VERIFIED_EMPTY` on that *specific* relation, Native registry missing 8/8. Owner and creator mismatches observed 0 on existing test graph.
- New `supabase/staging/acceptance/gallery-dependency-coverage-negative-v1.sql`: `BEGIN/ROLLBACK` owner/nonowner negative, service-only ACL, stale graph pin via rollback-only Work rowVersion change, false-positive retirement rejection PASS. No persistent data modifications or real user Storage operations.
- Reran original 03 COMM #129 `gallery-cloud-preservation-readiness-v1.sql` and `gallery-retirement-gateway-preflight-v1.sql` as real Staging owner/other/synthetic published Photo rollback: both PASS with **new** 09 INT snapshot. No fixture residue; 92 verified subject definitions, 0 Photo Works, 0 upload intents.
- `tests/gallery-dependency-coverage-v125.test.mjs` covers no-known edges, linked Scene/ToM, historical revision, missing/unsealed WorkRevision, owner mismatch, version unsupported, native registry missing, concurrent fingerprint change, hypothetical complete graph still denied, and SQL no duplicate RPC.
- Exact implementation HEAD `cf6bf5ecd6090d6e0b5bdaff5f40ed41e6bac9a4`: CI `40052742553` SUCCESS, 931 tests / 919 PASS / 0 FAIL / 12 pre-existing fixture SKIP; Svelte 0 errors/3 warnings; integratedReady=true/requireReady=true/migrations=91. Documentation-only commits after this require final-HEAD CI readback.

### Remaining acceptance
1. 09 INT: Product kind publisher/registry and native listing authoritative semantics, version-aware complete dependency namespace and transactional lock/order for all edges. Snapshot fingerprint **alone** is not a consistency lock. No positive dependent delist.
2. 03 COMM: future typed owner preflight may expose `coverageClassification` / `blockedRetirementReasons` from the service snapshot in an additive approved consumer; must keep same Auth owner-only RPC and `cloudPreservation` distinct. No Cloud entitlement, Private Storage byte durability/ACL/restore. 03 COMM signed URL max300s prior bearer token remains unrevoked/unverified; disabled Delete/Unpublish/Restore/Republish and physical Gallery remove/72h TTL.
3. 04 QR #130: genuine signed disposable Owner A/Nonowner B/Moderator testing with old signed bearer replay 0/60/300/post, CDN/browser, actual media/owner ACL, version/preflight concurrent edge changes and denied Delete; not executed by SQL/stub/Chrome synthetic. R17 30 nodes remains 0 PASS /12 PARTIAL /18 BLOCKED; public launch BLOCKED.
**Completion: PARTIAL.** Exact registry inventory/typed fail-closed read-only improvement and Staging compatibility accepted. Safe positive retirement remains BLOCKED.


## 09 INT / #119 — Dependency Registry Closure & Atomic Retirement Preconditions (2026-10-24)

**Scope:** precise Nintendo Switch DDV v1.25.0 BID `52BD625D9B4E0053` / schema624. Continue Draft PR #123 rather than creating another Gallery API, registry or Stream. Previous 92 source-verified subject definitions, eight legacy Gallery Works, 12 GalleryRevision→PresetRevision links, existing `private.gallery_photo_dependency_snapshot_v1` and its service-only ACL were **NOT** reimplemented or changed. Current public Photo Gallery Work count remains zero. No Gallery Delete/Unpublish/Cloud Private/physical cleanup or native DDV writer is enabled.

### Source-verified Registry / publication path audit

| Kind/path | Actual source/deployment | Source classification | Global retirement coverage |
| --- | --- | --- | --- |
| Shared Preset artifact/revision | `public.preset_artifacts`, `preset_revisions`; CHECK enumerates Scene/Biome/Floating Island/ToM Furniture/ToM Clothing | VERIFIED infrastructure | Not a complete Gallery reverse-reference namespace |
| Generic Preset publication | `public.community_publish_preset_envelope` creates PresetArtifact, PresetRevision, `community_works`, `community_work_revisions`, `preset_revision_publications`; PUBLIC visibility inserts `search_documents` | VERIFIED deployed path for five allowed DB types | No Gallery reverse reference in that publisher input or INSERT |
| Scene Preset | `src/lib/wep/preset-community-bridge.ts` exposes `publishScene`, `preflightScene`, resolve/discover/load (type checks enforce Scene) and generic publication above | VERIFIED Scene UI + source-specific FK paths | SEMANTICS_UNKNOWN global reference completeness |
| Biome Preset | DB kind allowed and generic publisher present, no accepted full-product Biome-to-Gallery backlink/retirement coverage | VERIFIED shared schema; end-to-end UNKNOWN | SEMANTICS_UNKNOWN |
| Floating Island Preset | Same distinction as Biome; 13 verified island *subjects* are not Preset publications | VERIFIED shared schema; end-to-end UNKNOWN | SEMANTICS_UNKNOWN |
| ToM Furniture | Typed 40 base game definitions only, general Preset type allowed; no complete ToM revision/Design/ToM publication backlink | VERIFIED shared schema; end-to-end UNKNOWN | SEMANTICS_UNKNOWN |
| ToM Clothing | Typed 35 base game definitions only, same boundary | VERIFIED shared schema; end-to-end UNKNOWN | SEMANTICS_UNKNOWN |
| Native / In-Game Preset Listing | `src/lib/presets/native-preset-runtime.js` reads `World.DecorationPresets` and local backups, `persistentWriteAuthorized:false`; no accepted server-side public native listing registry | Local read VERIFIED, public Registry MISSING | REGISTRY_MISSING |
| Existing Gallery→Preset relations | `gallery_revision_presets` FK to `gallery_work_revisions` and `preset_revisions`; `preset_artifacts.associated_gallery_work_id` FK to `gallery_works`; immutable revision triggers | VERIFIED exact paths (or VERIFIED_EMPTY per linked target) | Global coverage still incomplete |
| Search/Discover | `public.search_documents`, `community_search_public`; generic `work_type='preset'` and Gallery search; `community_publish_gallery_v3/v4` publisher projection | VERIFIED discovery index, **not** a dependency registry | Does not prove reverse references |
| Saved/Reuse | `public.saved_items.target_entity_id` → `community_entities`; client `saveEntity` and `unsaveEntity` | VERIFIED bookmark relationship, **not** creator ownership or publication dependency | Do not unpublish other authors' Works |
| Photo-only Gallery publisher | `community_publish_gallery_photo_v1` existing canonical 03 COMM service | VERIFIED photo image + verified subject binding | 0 public Photo Works in staging is not global graph completeness |

**Precision:** the SQL `preset_artifacts.preset_type` CHECK is not per-product authoring/quality acceptance. `community_publish_preset_envelope` is generic, but no evidence of complete 6-kind Gallery backlinks. A VERIFIED_EMPTY count is scoped to an enumerated FK relation, never to an absent Registry or all product Writers.

### Source-backed Atomic Retirement contract (design-only, no mutation)

**What is confirmed from code:** `community_publish_gallery_v3` obtains `SELECT ... FROM community_works WHERE work_id=p_work_id FOR UPDATE`, uses `row_version`, immutable revision insert/seal, writes `gallery_revision_presets` and `search_documents`. `community_publish_preset_envelope` obtains `pg_advisory_xact_lock(hashtextextended(accountID + ':' + idempotencyKey))`, but this is **only per-account/per-idempotency key**, NOT Gallery graph serialization; its generic publication does not write a Gallery inverse relation. Database has immutability and owner guard triggers on revision tables and `preset_artifacts` identity but **no proven common graph-retirement fence across all reference writers**, including future ToM/native registries.

**Required before any positive operation:**
1. Closed registry schema, exact source-version semantics and all entity references (including local/native public listing bridge if one is ever deployed). Public direct URL, discovery, saves, Creator listings, Preset publications, historical revision citations, ToM and media rights each need explicit retention/revocation semantics.
2. Trusted service-transaction owner/auth/active account and explicit creator/other-owner rights checks; validate expected `row_version` and `current_published_revision_id`. Refuse unsupported version and missing/unsealed/inconsistent immutable revisions.
3. All reference-adding/updating publication writers must acquire a **single work-scoped serialization fence** (DB locking protocol, versioned registry + epoch barrier, enforceable trigger/write surface or equivalent). A Gallery row lock, per-idempotency advisory key or FK KEY SHARE alone is not proof of coverage.
4. Acquire canonical Work and all existing immutable GalleryRevision row locks, plus dependent publication/owner state locks in fixed order. Under these locks re-read **same DB transaction** and compare the prior fingerprint and rowVersion/current revision; refuse stale input. Fingerprint is an **optimistic mismatch detector**, not a lock.
5. Re-scan and attest every dependent Registry within the same transaction and server-owned authority; resolve linked cross-owner Preset rights without deleting third-party originals. Prevent new edge creation throughout commit via the common writer fence; all public projection changes and dependent delisting must be transactionally consistent.
6. Use a dedicated, idempotent, row-version-checked server operation only **after** agreed Cloud/private durable Work+Media copy or PUBLIC Delete policy and previously-issued Storage bearer URL/CDN/privacy evidence. Do not perform physical Storage removal inside an assumed DB rollback. Immutable histories and moderation/legal retention must remain valid.
7. Rollback all DB state on conflict, stale pin, incomplete registry, old signed URL, missing Cloud entitlement or any dependent surface failure. Persist idempotency result only after successful commit. Re-check outside caches and storage via separate authorized acceptance.

**Do NOT implement a positive operation yet:** current #119 graphComplete=false; 03 COMM #116 Cloud entitlement/private durability/old max300s Storage signed bearer/CDN unproven; QR #130 real signed multi-actor HTTP and two-session concurrency tests not executed.

### Implemented bounded artifacts and actual validation
- `src/lib/integration/gallery-atomic-retirement-preconditions-v125.ts`: exact source-backed six-kind registry inventory, required shared writer fence list, independent original Graph Snapshot classifier, explicit version/fingerprint/owner/revision/URL/Cloud blockers, immutable *readOnly:true, operationAuthorized:false, graphComplete:false* for **every** input including forged all-positive flags. No new shared Community model/RPC.
- `tests/gallery-atomic-retirement-preconditions-v125.test.mjs`: typed missing/unknown Registry, wrong Switch 1.25.3 / Steam / BID / schema626, absent snapshot, forged flags, all required fence negative checks, and static source assertions against existing real preset publisher, Scene bridge, public search, native backup and Gallery v3 row lock.
- `supabase/staging/acceptance/gallery-atomic-retirement-preconditions-negative-v1.sql`: actual Staging `BEGIN`→lock existing Gallery Work/CommunityWorkRevisions/GalleryWorkRevisions `FOR UPDATE`→re-read fingerprint/rowVersion→verify deployed FK, generic publisher and publication mapper→assert native Registry still missing and GraphComplete/Authorized=false→`ROLLBACK`. PASS. This **does not test simultaneous transactions** or future uncooperative writers. No new deployed SQL migration, RPC, account, user Work, or media object. Previous 09 INT service-only snapshot and 03 COMM #129 Cloud preservation remain unchanged.
- Source branch `integration/gallery-v125-reviewed-enrollment-20261024`; PR #123 remains DRAFT. Descendant PR #126/#129 forked an older #123 HEAD, require safe deliberate upstream source sync, all Drafts DO_NOT_MERGE; no conflicting Community changes or automatic merge done in this pass.

**Status: PARTIAL** for release-critical Atomic Retirement (registry/work-writer completeness BLOCKED). Narrow source-backed preconditions and read-only transaction negative acceptance delivered; actual multi-connection lock race, foreign Publisher linking, old Storage URL/CDN and Cloud Private still unaccepted.


## 09 INT / Issue #119 — Existing Writer Path Lock Participation and Concurrency Limits (2026-10-24)

**Objective:** tighten known deployed cross-product backlink insertion paths in the existing stacked Draft PR #123. **Scope does not expand DDV native save/version safety:** Switch v1.25.0 BID `52BD625D9B4E0053` schema624 only. Prior 92 verified subject definitions, read-only coverage Snapshot, 6-kind audit and all negative retirement gate flags remain unchanged.

### Actual STAGING writer inventory (source-backed)

- `public.community_publish_gallery_v3` and `community_publish_gallery_v4`: create immutable Gallery WorkRevision and `gallery_revision_presets` edges, update `search_documents`; v3 explicitly locks Gallery `community_works FOR UPDATE`. These are legacy Gallery writers, not Photo publisher.
- `public.community_publish_scene_preset_product_v1`: accepted deployed **Scene-specific paired Preset/Gallery publication** source, unlike generic Preset publisher. On create writes PresetArtifact with `associated_gallery_work_id`, PresetRevision, Preset WorkRevision, `preset_revision_publications`, Gallery WorkRevision, `gallery_revision_presets`, **two Search Documents** with link facets and Outbox entries. On update locks PresetArtifact, Preset Work, Gallery Work `FOR UPDATE`, updates both immutable revisions and public projections in one transaction. This is direct evidence of EXISTING Scene writer, not cross-kind generalized semantics.
- `public.community_publish_preset_envelope`: common 5-kind Preset publisher creates Preset/Work/Revision/Publication and optional public Search, but does NOT write `associated_gallery_work_id` or Gallery inverse relation. Per-account+idempotency key advisory lock protects replay of one request, **not** all Gallery writers.
- `public.community_unpublish_scene_preset_v1` and `community_delete_scene_preset_v1`: deployed preset lifecycle/search projection operations reading associated Gallery reference, but they can affect public-dependent classification without a new reverse-reference INSERT. They are **NOT proven to participate in the new shared Gallery Work-scoped reference lock**.
- `public.community_publish_gallery_photo_v1`, `community_delete_gallery_photo_v1`, 03 COMM Owner-only `community_gallery_retirement_preflight_v1`: canonical Photo API and owner/cloud/read gate unchanged; no 09 INT reimplementation.
- `public.preset_revision_publications`, `public.gallery_revision_presets`, `public.preset_artifacts.associated_gallery_work_id`: actual FK-backed write paths. Historical/current WorkRevision immutable triggers remain; proof of those specific relations, **not** a complete public-dependent registry.
- `public.search_documents`, `community_search_public`, `saved_items`: search/discovery and save/bookmark indexes; they are neither ownership nor complete backlink registries and need a separate transactional projection contract.
- **ToM Furniture/Clothing**, Biome, Floating Island: allowed in shared Preset schema but no proven complete product-specific Gallery reverse edge semantics; global graph `SEMANTICS_UNKNOWN`. **Native/In-Game public listing**: no authoritative deployed public listing registry; `REGISTRY_MISSING`. Local `World.DecorationPresets` backups are not a public listing writer.

### Minimal source-backed shared row fence (verified partial coverage, NOT atomic retirement)

New **additive** migration `supabase/migrations/20261025002200_gallery_known_reference_writer_fence_v1.sql` deployed to Staging as `gallery_known_reference_writer_fence_v1`. It installs **one private trigger function and three triggers**:
1. `gallery_revision_presets` **BEFORE INSERT** finds Gallery Work from immutable revision and acquires `community_works FOR UPDATE`.
2. `preset_artifacts` **BEFORE INSERT OR UPDATE OF associated_gallery_work_id** acquires locks on previous and next Gallery Work (sorted UUID) before adding/changing backlink.
3. `preset_revision_publications` **BEFORE INSERT** finds existing related Gallery Work through associated PresetArtifact and immutable GalleryRevision->PresetRevision links, locks each work sorted UUID.

Function is not EXECUTABLE directly by `anon`, `authenticated` or `service_role`; invocation is via trusted deployed table trigger, not a new public RPC. Unknown GalleryRevision target and wrong Work kind fail closed. Does not mutate Work rowVersion or automatically approve any operation. This **only serializes participating INSERT/bind paths and actual Work row locks**. It does NOT include every Preset publication lifecycle/publication state writer, general Search projection, future ToM/Native listings, CDN or old bearer URL. A later positive operation cannot rely on this partial fence. Cross-work lock ordering across all existing RPC-owned locks is still unaccepted; future reconciliation must audit deadlock order and retry semantics.

**Staging executed:**
- Migration parsed in `BEGIN/ROLLBACK`, 3 trigger count PASS, then installed. Source readback exactly 3 enabled triggers.
- `supabase/staging/acceptance/gallery-known-reference-writer-fence-negative-v1.sql` actual SQL `BEGIN` / synthetic unsealed Gallery Revision / insertion into `gallery_revision_presets` and Preset `preset_revision_publications`, same-value `preset_artifacts.associated_gallery_work_id` UPDATE / Graph SHA change & rowVersion stable, invalid GalleryRevision reject, `ROLLBACK`: **PASS**. Source verified 92 defined subjects, existing 12 Gallery→Preset links, 17 PresetRevision publications, 0 verified Gallery Photo Work left untouched. No user Storage object accessed or removed.
- Reran 03 COMM PR #129 `gallery-cloud-preservation-readiness-v1.sql` and `gallery-retirement-gateway-preflight-v1.sql` rollback owner/nonowner negative fixtures **PASS** with the new triggers. Neither private cloud entitlement nor old Storage signed URL revocation is claimed.
- Tool-supported **two independent SQL backend PID** attempt for advisory transaction lock `(91901,119)` with 8s holder and 2s delayed `pg_try_advisory_xact_lock` contender yielded **`acquired_while_held=true`**, indicating SQL connector dispatch did not overlap the relevant transactions. Thus **MULTI-SESSION CONTENTION NOT OBSERVED / NOT ACCEPTED**; never infer that the lock implementation failed or succeeded against a real contender. No user data mutated.
- Added **two executable separate-connection Staging harnesses** `gallery-known-reference-two-session-holder-v1.sql` and `gallery-known-reference-two-session-contender-v1.sql`. Session A holds a real linked Gallery Work `FOR UPDATE` for 15s, Session B performs rollback-only no-op association UPDATE with 2s lock timeout and **fails the test if no contention**; requires two genuinely simultaneous external DB connections. These were **NOT EXECUTED** in this tool/session environment, and do not prove all-writer coverage even once run.
- Static contract tests `tests/gallery-known-reference-writer-fence-v125.test.mjs` prove 3 trigger paths, UUID lock order, service-only boundary, old negative auth flags, transaction rollback harnesses; full exact-HEAD CI evidence recorded in PR #123.

### True atomic retirement prerequisites still missing

Future operation must enlist **all mutation paths**, including Preset Work current_revision/lifecycle/visibility, creator/owner state, Search/Discovery updates, future Native/ToM public listing writes and revision creation. Resolve immutable history, cross-owner references and UUID lock ordering **before** acquiring locks, otherwise deadlock risk; use deterministic lock order and safe retries. No action may return positive without transaction owner/version/fingerprint recheck under all mandatory locks, a complete authoritative registry namespace, and atomic delist + idempotent rollback. Graph fingerprint is a snapshot mismatch detector, not a lock or cache invalidation. Previously-issued signed Storage URL/CDN and Cloud durable entitlement/owner private ACL/backup/restore require independent 03 COMM and 04 QR acceptance.

**Status PARTIAL.** Known relation writer-fence source + Staging rollback **verified**; external simultaneous contention **NOT EXECUTED**; complete Graph and Positive Retirement **BLOCKED**. No Gallery Delete/Unpublish/Cloud Private/physical cleanup, native writer or Product Apply enabled.

