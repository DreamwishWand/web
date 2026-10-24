# 02 WEP — Scene Revision Current Contract / Safe Source Realignment

Date: 2026-10-24 | Owner: 02 WEP | Status: SOURCE+SYNTHETIC ONLY / DO NOT MERGE OR REPIN

## Source identity and boundaries

- WEP child: Draft PR #135, branch `wep/scene-revision-gallery-consumer-20261024` (actual HEAD must be checked again before integration); forked from older 03 COMM Draft #134 source snapshot `25202608cad55a203c101bbcd84f52bd0e5797b8`.
- Backend owner: 03 COMM Draft PR #134 on `verification/comm-clean-bootstrap-20261024`, evolving. At start of this integration pass the observed PR #134 HEAD was `d2e4576830bb7e37e4f7981c5777912e7b3be85c`. **This is a snapshot, not an approved freeze.**
- Compare current `#135 head...` to `#134 head...` immediately before any non-force synchronization. Initial comparison indicated DIVERGED (21 ahead WEP-only, 23 behind latest backend), including SQL migration `20261025002350`, clean-bootstrap fixture and Scene Readiness/contract tests. No force push, no backend cherry-pick, no rebase during owner contract changes.
- Native source supported for Scene Offline Intent only: Nintendo Switch v1.25.0 Build ID `52BD625D9B4E0053`, schema624. Switch v1.25.3 Build ID `9A239D3DB569756D` schema626 stays strict read-only editor gate; Steam626 unsupported. Road/Fence persistent writing and Product Apply disabled.

## Source contract matrix (Readiness @1, 03 COMM PR #134)

| Field | PUBLIC current read | Authenticated OWNER readiness | WEP permitted interpretation |
|---|---|---|---|
| PresetArtifactId / PresetWorkId / current PresetRevision | Current published public projection | Validated owner+Creator internally; current ID | Compare exact IDs; mismatch stale BLOCK |
| Creator | creatorProfileId exposed publicly | Owner/Creator join validated internally but **no creatorProfileId DTO** | No synthetic cross-read Creator ID; backend authoritative |
| Gallery Work/current Gallery WorkRevision | Current public linked Gallery and media/Cover | `pairedGalleryWorkId`, `pairedGalleryCurrentWorkRevisionId` | Owner hint only; require exact public pair ID match before offline intent |
| Paired Gallery Work rowVersion | **NOT exposed** publicly | `pairedGalleryWorkRowVersion` (non-atomic) | Observe and show only; no independently verified atomic expected version |
| Historical revision pairs | Historical bytes/media/URLs unavailable | `historicalEdgeSetScope='scene-historical-edges-v1'`, SHA256, `historicalEdgeSetIsAtomicFence=false` | Observe scope+hash separately. Not full graph, no unauthorized historical media |
| Old dependency fingerprint | None | `dependencyFingerprintSha256`, `dependencyFingerprintIsAtomicFence=false` | Different algorithm/scope from caller edge-set SHA. **Never convert/rename into R9 pin** |
| Graph locks | None | `graphComplete=false`, `pairedGallerySnapshotIsAtomicFence=false` | Hard-fail all Save/paired publish operations; no source->Staging grant |
| Media/Cover | PUBLIC CURRENT only, signed ephemeral Cover on demand | Version metadata; never historical signed URL | Current cover must belong to current media set; invalid/expired denies preview and enables safe retry |
| Owner/rowVersion and unknown edges | Public query never authenticates owner | authenticated owner JWT/Edge only; unknown foreign refs counted, IDs withheld | Block incomplete, cross-owner/unresolved and stale current graph; never surface raw keys |

**WEP implementation:** `parseSceneOwnerReadiness` accepts optional extra owner fields as non-atomic hints, normalizes missing backward-version fields to null and adds explicit block reasons, rejects invalid ID/rowVersion/hash or any optimistic writer/fence flag. `diagnoseSceneRevisionPairing` compares public current and owner scoped view only when a real owner response is available; private diagnostics are never part of the public RPC. `prepareSceneRevisionOfflineIntent` checks paired IDs, preserves `observed*` hints, keeps `expectedHistoricalEdgeSetSha256=null`, `expectedGalleryWorkRowVersion=null` and all writer flags false. Actual runtime Scene capture/dependency/SubGrid topology proof is distinct from a manually asserted closure flag.

## Remaining exact contract gaps (all BLOCK)

1. Source-backed OWNER Readiness @1 is not necessarily deployed in Staging. A missing field/scope results in explicit WEP blockers, NOT an assumed value. No signed authentic Owner A/B/Moderator M deployed read acceptance.
2. Historical scoped owner SHA is **not** an independently authorized, atomic caller graph seal: no trusted accepted all-Writer graph registry, no versioned full current/historical reference completeness, no native/ToM/public-listing writer certification.
3. PUBLIC current projection omits both Work rowVersions. Owner Readiness exposes only Preset Work rowVersion + Gallery observed version, not atomic consistency with public projection and not an authorized future writer expectation.
4. Source-only private Scene paired transaction under 03 COMM does not prove ArtifactBlob actual byte integrity/owner registration, owner READY/CLEAR media manifest, Storage/cached CDN revocation, whole fresh transactional retry or normal signed roles.
5. No accepted positive lifecycle/retirement, Cloud Private, physical media deletion, 72h TTL, native DDV Writer or Product Apply; unresolved moderation/account erasure global writer order.
6. Requested Current/Historical media display is **metadata diagnostics only** for history. No historical Gallery Media or Cover URL may be signed/displayed in this consumer.

## Safe source synchronization (future control-gated steps; NOT executed)

1. **03 COMM owner** declares exact final PR #134 commit SHA + frozen read/owner/writer DTO, global all-writer graph scope/lock contract and Source↔Staging parity. **09 INT** signs off all applicable lifecycle, Moderator and account-erasure writers, 40P01/55P03/40001 bounded whole-command retry and external Graph Pin.
2. **00 CTRL** fetches #134 and #135 HEADs, confirms stacked base ancestry and full changed-path diff, checks no overlap/renumbered migrations, freezes ownership and chooses a non-force merge on a separate temporary integration branch; preserve individual PR HEAD history and Drafts.
3. Review conflicts and compile source WEP readers against the final 03 COMM Readiness payload; verify that the backend does not imply atomic permission. Do **not** blindly grant/re-export `private.scene_save_revision_paired_candidate_v1` or change Media/storage ACL. No force-push / no automatic PR rebase while Owner PR evolves.
4. Run complete exact combined-source CI, migration clean bootstrap+rollback and 04 QR negative Chrome (8 locales/320px/keyboard, forged Cover, stale/foreign owner/Graph, v1.25.3 writer denial). Independently perform authorized real Owner A/B/Moderator with real Storage byte integrity, signed URL/CDN expiry and independent two-session current+historical race tests.
5. Only after those acceptance gates and explicit Control approval update PR base/QA pinned SHA and separately design future `Save Revision` activation; until then all output has `saveRevisionAuthorized=false` and `productApplyAuthorized=false`.

## QA / handoff

CI on WEP's final exact HEAD must be reported from actual GitHub Actions, not inferred from passing earlier SHA. Synthetic browser mocks HTTP and Media; it is **not** signed Staging user acceptance. Update WEP Handoff, Current State and release Roadmap without promoting R17 release matrix (30 nodes PASS0/PARTIAL12/BLOCKED18). Return contract gaps to 03 COMM Issue #124, 09 INT Issue #119 and 04 QR Scene PR #136 / Issue #130.
