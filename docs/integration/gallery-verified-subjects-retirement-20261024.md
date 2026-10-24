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
