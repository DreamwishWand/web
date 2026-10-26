# DDVRE / 09 INT — R18-work Dual Scene Publisher / Provider Verification Boundary (2026-10-26)

**Existing workstream**, Source-only independent integration validation. NOT a new workstream or Release Acceptance R18. No merge, deploy, Staging mutation, or full graph promotion.

## Exact source/commit pins and scope

- Deployed Staging `wep-scene-preset-product` ACTIVE v1, source bundle SHA256 `6f04d6cfdae3aea99d78b1b12f0e37575c11afb04cf7584b89fda936df690045`; separate `community_publish_scene_preset_product_v1`.
- Deployed Staging `wep-preset-artifact` ACTIVE v14, source bundle SHA256 `fe7b0fa1f7c1c0bfec79f45da53b6d37bf43b430859f1ab6c0be410fbe57dfaa`; separate `community_publish_preset_envelope`.
- Deployed Staging `wep-preset-retention` ACTIVE v6, source bundle SHA256 `675b3a2213ad3233e875f9120cb89151ff3b360fc33b4a282616725b5bed6f7e`.
- **Frozen 03 COMM Source136 Owner pin** `a5bb6d24166eed66fc895447029c75b8014b81ec` = new 03000 migration plus terminal `supabase/functions/wep-scene-preset-product/index.ts`. No physical Storage API in this new owner alias. 03000 dynamically revokes anon/authenticated/service_role EXECUTE from ANY existing public Scene publish/unpublish/delete overload, while declaring historical Staging aliases SOURCE_PRESENT_UNENROLLED and source alias FAIL_CLOSED.
- **Frozen separate 02 WEP PR #163 source pin** `45963f55c1f53e5d2d8d08996098d0039be6fcfb` = distinct more strictly validated Edge issuer with own Account/Creator/key validation, but all valid prepare/publish/delete/unpublish/read/discard/compensation positive actions return inert denial. These source files are **not identical** and must not be cherry-picked over each other as wholesale replacements. 02 WEP does not own COMM Schema/Writer.
- **Independent 09 INT PR #162** at `c93f00db730a7d716474d423c0e7b9da6fdf186d` CI `40258494806` SUCCESS; actual deployed TypeScript handler snapshots executed using deterministic Mock Storage+RPC; not real PG/Provider. New cross-RPC cases: A Scene physical Copy then B generic Publisher uses SAME Account+Idempotency published key and registers, A failed SQL compensation physically removes B bytes; inverse A generic then B Scene, late claimed retention deletes B referenced key; same-key differing content conflict before RPC; foreign key denial. Witnesses describe old deployed behavior and are **not proof of an actual incident** or safe positive lifecycle.
- **Independent 09 INT PR #164** frozen Source136, additional actual Edge/SQL tests:
  - Actual new owner Source136 Scene Edge transpiled and invoked, all old actions return 409 **before any positive RPC / Storage.copy / remove**, revoked/session actor denial.
  - Actual two-backend local PostgreSQL (on disposable 136 ordered source migrations): fresh empty DB has no historically staged Scene legacy RPC. Independent fixture detects absence correctly, creates 3 named synthetic legacy RPCs inside a transaction with grants to anon/authenticated/service_role, executes the EXACT 03000 Owner dynamic revoker and confirms no role retains EXECUTE; transaction is rolled back. Writer registry contains six new graph/reference entries and eight new routes with correct SOURCE_PRESENT_UNENROLLED versus FAIL_CLOSED states; release gate remains false. No live staging was changed.
  - NEW parallel dual candidate test reads immutable copy of WEP #163 Source Edge alongside actual COMM #136 Source Edge; both invoked concurrently with mock session and Creator authority. Same-key publish, published/staging compensation, and foreign Account request all deny without ANY Storage Copy/Remove/Sign or positive SQL RPC. This proves **source-level fail-closed compatibility under mocks only**, not deployed or signed Provider parity.
- Acceptance: only report exact PR #164 HEAD and corresponding PASS actions after CI logs have proven new cases. Prior R11–R17 and PR #155/#156/#158/#161 accepted suites not recreated.

## Registry / full Writer graph

| Route / deletion issuer | New source status | Deployed Staging status | Proven boundary |
|---|---|---|---|
| Generic Preset Artifact `community_publish_preset_envelope` | Source135 SQL+Edge FAIL_CLOSED | ACTIVE v14 old physical Copy/compensation/Discard | Source-only; deployment unaligned |
| Distinct Scene Product `community_publish_scene_preset_product_v1` | Source136 Edge FAIL_CLOSED; SQL EXECUTE revoked | ACTIVE v1 old Copy-before-SQL/compensation | Source-only; deployed unreachable/protected status NOT_EXECUTED |
| Scene Product `community_unpublish_scene_preset_v1`, `community_delete_scene_preset_v1` | Source136 SQL revokes all overload EXECUTE and Edge terminal | ACTIVE v1 old SQL route | Historical/Cloud/moderation graph NOT CLOSED |
| Two Source Scene Edge candidates (COMM136 and WEP163) | Both fail-closed with different key/session/Creator DTO shape | Neither proven deployed | No unsafe copy under actual handler mocks |
| Physical Publisher compensation and staging Discard | New Scene source no Storage calls | ACTIVE Scene v1 + Artifact v14 physical removes | Must neutralize BOTH deployable endpoints |
| Physical Preset Retention Worker | Owner new source denies | ACTIVE worker v6 token/claimed blobs→Storage.remove→finalize | Current/historical refs + late deletion not proof-safe |
| Reservation/Fence/Readback | Source135 SQL lease token, fence, state/bytes | Source135 absent in managed historical116 | Claimed match = `EDGE_READBACK_UNATTESTED`, no positive Commit |
| Positive verified Blob+Work+PresetRevision+Outbox Commit | Owner private candidate behind disabled gate/no attestor | NOT DEPLOYED | Actual provider conditional bytes/ETag/version + attested Postgres relation UNKNOWN |
| Historical Gallery/Scene/Cloud/Native refs, legal holds and delayed cleanup | SOURCE_PRESENT_UNENROLLED or UNKNOWN | UNKNOWN | No global atomic physical-delete proof |

`SOURCE_FULLY_ENROLLED=0`; `graphComplete=false`; `retirementAuthorized=false`; `saveRevisionAuthorized=false`; `pairedGalleryPublishAuthorized=false`; `physicalCleanupAuthorized=false`. New immutable key identity/ETag/provider CAS, Account/Creator/Privacy/Retired and Moderator Restrict at actual signed Provider E2E are NOT_EXECUTED.

## Cross-system proof gap and 03 COMM/02 WEP fixes

A PostgreSQL lock and increasing Fence Counter do not prevent a timed-out but still-running Storage `copy` from overwriting a later successful object. Nor can DB `COMMIT` enforce continued byte existence if a separate stale retention worker can `Storage.remove`. Positive publication must remain OFF until an immutable provider object/version precondition prevents overwrite; independently downloaded byte length/SHA is verified and bound to Reservation/Fence/Owner/Idempotency; all physical deletion issuers require an authority snapshot covering current **and historical** Gallery/Scene/Preset/Cloud references, outstanding leases, legal holds; and crash/Retry/Compensation never removes another Writer's bytes. Verify Postgres transaction rollback separately from Storage orphan safe retention.

03 COMM must retain the Source136 global RPC revoke and Owner stronger failclosed Edge while consolidating WEP #163's safe per-account validation selectively, not force pushing #134 nor merge the old Source133 WEP #154. 02 WEP should not enable `prepare`/publish/cleanup on its separate issuer pending the shared authorization contract.

## 04 QR real signed Provider acceptance matrix

| Scenario | Real provider criterion |
|---|---|
| A Scene Product and B generic Preset SAME account/idempotency | independent edge aliases cannot create inconsistent hashes, metadata, Blob/Revision/Work or missing public bytes |
| Same key, DIFFERENT payload and target | one immutable winner, rejected loser has no physical compensating delete |
| Copy initiated before Lease expires but completes AFTER new fence | provider conditional version rejects old copy; no overwrite |
| COPY success, SQL fail or crash | durable orphan without deleting another committed/leased object; audited retry |
| SQL COMMIT success, provider Readback missing or hash mismatch | never discoverable committed Preset with absent object; safe quarantine/recovery |
| Late old worker v6 claim, current/historic references/legal hold | hard deny physical deletion even if metadata lookup momentarily sees no row |
| Signed Owner A, nonowner B, Moderator M and Retired/Privacy suppression | wrong Session/Account/Creator fail closed; no leaked binary |
| Same-key completed replay, staleness and Provider ETag | stable response; stale fence/version rejects irreversible writes |
| Signed URL/CDN t0/t60/t300/post-expiration | independently measure old issued bearer and warm/cold cache visibility |
| True SQL fault injection 55P03/40P01/40001 | retry with prior Provider state is idempotent and byte-safe |

NO Staging rollout until operator #130 approves semantic 116→136 ordered migrations, ALL 21 deployed Edge+worker bundle/SQL/Cron mapping, backups/PITR and ordinary signed A/B/M disposable users. A service_role script does not substitute for real actor E2E. **Real signed Provider: CONFIGURATION_BLOCKED / NOT_EXECUTED**.

## Release

All positive Preset publishing, physical cleanup/72h, Scene paired Save, Cloud Private/Restore, Native DDV Writer/Apply OFF. R17 launch Product Tree 30: PASS0 / PARTIAL12 / BLOCKED18. No formal Release R18. All Draft PRs DO_NOT_MERGE/DEPLOY.
