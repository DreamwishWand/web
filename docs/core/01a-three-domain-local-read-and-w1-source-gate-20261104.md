# 01A CORE — Single Session Three-domain Read/Capability and W1 Hard Source Gate

Date: 2026-11-04 JST. Protected TEST main ancestor:
`d3a2dbfa76d041e7edc30abbd89f5fc264a540f8`.
Changes on this standalone main-based Draft are **UI-to-Core READ contract only**,
not production Rust SaveSession, Local Writer, P1G edited-copy or merge.

## Read domain status

| Domain | Known root | Session Read (CURRENT) | Preview / Edited Copy / Writer |
|---|---|---|---|
| Timing (W1) | `World.RecurringEvents` | Independently PR383/QA391 W1 scoped synthetic Chrome/Node PASS; PR394 composite candidate Source `c592aeb...` owner four CI PASS and independent 05QR PR404 real synthetic Chromium plus normal CI SUCCESS on QA HEAD `ec8c89ef...`. PR394 still pending final QR signoff/main merge. | W1 intent-only Preview and untouched manual original backup already main PR389; all Writer/Encode OFF |
| Collection | `Player.CollectionSets` | **NOT AVAILABLE** via current Worker, `readOwnership=false`; PR379/QA392 raw bool/ABSENT source structure not a Core-issued live read | Ownership/percent unknown, Writer OFF |
| World | `World.GridCollection` | **NOT AVAILABLE** via current Worker, `readGrid=false`; WEP v1250 spatial synthetic separated from W1 schema626 | Preview/Writer OFF |
| Inventory | `Player.ListInventories` | Not part of these three enabled domains; current `readInventory=false` | Amount CAS research-only Preview, Writer OFF |

Main has read-only W1 page and independent original **Download** (manual original backup) from PR389; it is not confirmed persisted at OS and not a verified edited-copy. PR394 on latest main selectively composes PR383 single Worker with main's RegistrySHA and W1 Preview/backup, avoiding old PR383 whole-branch conflict. This new source contract does not modify the competing PR394 Worker files: it can be consumed after PR394 cumulative main acceptance.

`src/lib/ddv/core/save/three-domain-read-facade.mjs` supplies:
- `describeThreeDomainReadCapabilities`: truthful current per-Domain statuses. Never imply a client-side object is an authority issuer. Product Rust Core/WASM is separate.
- `readThreeDomainPage`: only the supported **Timing→RecurringEvents** via the single Worker bridge API. Must bind active Worker-issued session ID, source encrypted SHA, registry SHA, exact externally-attested Switch 1.25.3 BID9A239D3DB569756D schema626 and revision/index generation. Query 1–64, search/cursor bounded, verify response shape and session unchanged across await. Project selected W1 row fields only; no arbitrary raw profile/bytes exposed. Return `editable:false`; only read.
- Reject Collection/World outright until a **new accepted typed Core Reader and same-Version Native constraints**. Forged UI `readOwnership:true`/`readGrid:true` or worker response full profile cannot turn those reads on.
- JavaScript existing 128MiB expanded Save cap and 200MiB refusal remain. Rust indexed/lazy 200MiB is a separately scoped task, no claim of acceptance.

## Required Core-derived source read-set

PR397 exact Source `72492cb3c758e40e198a8acb9cacd206063b3b8d` already adds a bounded Core-owned W1 **diagnosis** with exactly 8 mandatory original-JSON token paths, independent of caller source_read_set. It returns Native Registry/Area/Quota/Clock/operation closure flags **false**, including when all eight paths are found. PR397 is stacked on PR368 research; do not re-run accepted PR368/QA376 or QR343.

Additional stacked **PR412** (starting from frozen PR397 only, not main) implements `require_w1_core_operation_source_read_set`:
1. invokes PR397 exact Source/Revision/Registry/Oneof/old raw+UTC CAS;
2. **fails** if any of eight required immutable source tokens is missing/oversized despite caller-provided empty/list subsets;
3. rechecks all Core-derived raw token hashes from the same immutable decoded snapshot; and
4. returns a Source-only readset witness with Native V3, Stage/Encode/Writer still **false**.
Do not treat PR412 new diagnostic as a full Native reference closure. Root `GameInfo.Version`, event ID/Next/Last/EndDate, Grids/DiffGrids and Villages do not prove the effective Wetland area/Tree quota/Clock/Last→Next Native dynamics. PR412 is NOT a rewrite of PR397's accepted frozen evidence. Only 01A + 05QR may selectively bring separately approved Rust changes into cumulative Rust main after conflict analysis; no blind PR368/397/412 merging.

## Genuine Save/V0–V4

Reused private historic original profile data: v1.25.3, independently external BID9A239D3DB569756D, schema626. Previous QA343 **genuine** P1G codec tri-producer 6-output byte mechanics and Rust13/13 negatives accepted in its own scope; current PR329 private Python→Node independent original copy lexical edit PASS but canonical Rust/Wand JS/Timekeeper JS operation-specific source-to-edited copy chain incomplete. Private owner 01E record of W1 ItemSpawning key155/EventID2010000021, intended 2126 Next, 2026 Last, EndDate null is V1 structural ONLY. Intentionally future 2126 is not automatic corruption.

A new **user-authorized private** same-source W1 operation V2 to finish still requires:
- fresh encrypted original sha/size and decoded SHA from the permitted private original, independently externally verified FullVersion/Platform/BID/schema; no original/game secrets in repo or CI.
- trusted Rust session/Revision/index generation and RegistrySHA bound to ORIGINAL source; opaque values preserved, one NextOccurrence old raw string and decoded UTC CAS, no inferred missing EndDate/Area/Conditions.
- derive and validate COMPLETE operation refs (source Registry → exact Village04/Wetland1/TreeAny/Default+DiffGrids/Softwood cap/World Quest+clock effects) at same revision. PR412 proves only a subset of SOURCE paths, not Native runtime eligibility.
- exact *one intended field* Atomic ChangeSet/Undo/Redo, isolated copy, original-first manually verified backup, encode edited P1G, independent Rust/WandJS/TimekeeperJS Reopen/CRC/unknown/unrelated data diff, source SHA unchanged; explicit negative tests wrong source/old value/Revision/oneof/BID/registry and expiration.
- V3 Native producer+consumer actual Now/startup Actualize/Execute/Last/Reschedule Next/eligible Grid/Tree/quota and cold-load. If offline static cannot resolve *specific* question, request **named** V4 device evidence separately; never assert device PASS without actual observation.
- operation-specific independent 05QR and 00 CTRL flag authorization. Until then **PRODUCT_OPERATION_ENABLED=false, staged edit/edited-copy export/Apply/overwrite OFF**.

Current source-only code does not have access to any new genuine private P1G original in this specific session. Do not claim fresh V2 or Native V3 performed. Do not open Provider/Stage116 or send raw encrypted/decrypted file to a server. Rights/Community remain separate.

## QA handoff

- 05QR PR404: independent composite PR394 Node + actual synthetic Chrome CI green; its verified Source-only acceptance must remain limited to that fixed HEAD.
- New main-based UI façade: check exact Timing query Session scopes, A→B stale read, malicious row extra property stripping, 200MiB false, Collection/World unconditional deny even if client sets flags. NO actual Save inside tests.
- New PR412 stacked Rust: independent new-only 3 negatives Core own 8 mandatory refs, missing EndDate/Grid/DiffGrid/Villages denied, forged source/ref hashes rejected, staging/edited-copy always off.
- Final accept this task only after genuine private V2 + Native V3 + independent 05QR; Owner SOURCE synthetic green alone not enough.
