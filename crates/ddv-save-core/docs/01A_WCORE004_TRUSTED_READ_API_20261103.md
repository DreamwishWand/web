# 01A W-CORE-004 — Trusted Rust READ / Transactional Foundation Handoff

> State: **isolated research implementation**. Parent Wand Draft PR #329 exact `c3b2e43c76b7c47e6251b93a807ebe45b6d1e347`. Child Draft PR #348. Source ownership is Wand 01A, **not Timekeeper**. Never merge/ship or enable Writer on test results alone.

## What is actually implemented in Rust

Existing 01A `validate_json` full-document parser, `decode_p1g_research`, `index_selected_tokens`, and `session::SaveSession`/research atomic plan history remain owned by Wand. This PR **reuses** them. New `src/trusted_read.rs` provides a separately permission-closed READ boundary:

- `TrustedReadCore::open_p1g_readonly(original:Vec<u8>, key:&[u8;32], expected_encrypted_sha,expected_decoded_sha, registry_bytes,expected_registry_sha,external_bid,schema,max_decoded_bytes)` validates the **immutable encrypted** source SHA, supported AES/ZIP32/CRC P1G envelope, strict full JSON, decoded JSON SHA separately, trusted supplied registry *byte digest* and external Switch BID/schema (do NOT infer BID from save). Registry SHA is **not** EventID semantic authorization; external BID selection does not cryptographically bind game build to P1G.
- `index_direct_children(decoded,"/World/RecurringEvents")` is built **during one complete strict JSON parser traversal**, recording only row spans and numeric source keys. Accepts arrays and numeric-key objects; numeric alias/duplicate, missing parent, malformed full JSON and index row cap fail closed. It does **not** build a whole `serde_json::Value` graph. The parser still allocates pointer paths transiently and P1G decompression currently holds source+decoded in RAM; this is NOT streaming/OPFS/200MiB browser memory acceptance.
- `receipt()` returns Core-generated 128-bit CSPRNG `session_id`, Core revision=0/index generation=0, immutable source encrypted/decoded hash roots, registry SHA, external build selection, structural indexed count, `READ_ONLY`. Product capabilities all false.
- `query_indexed_page(PageQuery)` returns up to **200** bounded typed W1 row projections (each raw record <=**65,536 bytes**; returned metadata only, page budget <=**2MiB**) and Core-owned `indexed_total`, `complete` and `next_cursor`. `Complete` certifies only the strict-parser enumerated RecurringEvents direct-child row list for **this** revision; `complete_all_domains=false`, `source_reference_semantics_verified=false`. Unknown oneof remains read-only, never silently filtered. Unsupported sort/filter/domain refused, not silently guessed. No giant raw row payload or private save bytes are returned.
- Cursor is **256-bit CSPRNG-generated Core-owned opaque** token, stored privately, fixed 300-second `Instant` TTL. It is **single-use** and consumed BEFORE scope/expiry checks. Scope hash covers Core session identity, immutable encrypted/decoded/registry SHA roots, revision/generation, requested domain/sort/filter/limit. Rejects forged/unknown, expired, duplicate/replayed, other session, stale revision/index generation, changed query, out-of-range and >128 outstanding cursors; 0 display authority from UI. This is a Rust native implementation and `getrandom(js)` permits wasm32 *compilation*, not a browser-connected API.
- `preflight_w1(W1CommandIntent)` **only reads** exact source row and verifies Core issued session+revision+generation, encrypted/decoded SHA, registry SHA, external BID/schema, intended EventID distinct from ItemID, numeric savedIndex and unique matching oneof, exact canonical `NextOccurrence` pointer, raw JSON token + decoded old UTC, nontrivial and valid new UTC, and *optionally* Core rescans a bounded required source-path read-set against raw token SHA CAS. It returns `W1PreflightReceipt` with **transaction_stage_authorized=false**, required_registry_semantics_verified=false, complete_operation_references_verified=false, native_consumer_semantics_verified=false, encode_copy_authorized=false. A caller supplying a fake positive `W1PreflightReceipt` can NEVER authorize stage/export; methods refuse unconditionally. Current underlying `session::SaveSession` research transactional plans still accept asserted reference graphs; they are **not connected** to this trusted READ/semantic product authority.
- `stage_w1_transaction()` => `W1_OPERATION_REFERENCE_AND_NATIVE_CAPABILITY_NOT_ACCEPTED`; `export_p1g_copy()` => `PRODUCT_ENCODE_COPY_NOT_AUTHORIZED`; `close()` revokes all cursor state.

## Typed Worker contract handoff for 03 WEB

**Actually available**: this Rust crate's `TrustedReadCore` Rust-native API and synthetic tests, `wasm32-unknown-unknown` crate compile; the product does NOT yet instantiate a Rust Core in a Web Worker. WEB44's `createProspectiveCoreReadWorkerBridge` is mock-only and **not** proof of a trusted Worker issuer.

**Proposed and NOT YET WIRED**: private Worker ownership around `openLocal`, `queryIndexedPage`, `verifyIndexedPage`, `close`. JS/TS UI can provide only `{domain,canonicalSort,canonicalFilters,limit,cursor}`. Worker retains source bytes, AES/codec, registry and authenticated Core session/nonce/cursor ledger, rejects stale generation and tampered cursor, issues a scoped `complete` result only after Core source-index closure. Never trust UI-provided Source/Session/Revision/Capability or a self-claimed complete bit. A browser 100/200MiB end-to-end test with Worker transfer, peak JS/WASM heaps, roundtrips and crash/fail-closed behavior is still required.

Example **Rust** contract, not a product TS declaration:

```rust
let mut core=TrustedReadCore::open_p1g_readonly(
 encrypted,key,expected_source_sha,expected_decoded_sha,
 trusted_registry,expected_registry_sha,external_bid,626,max_decoded)?;
let roots=core.receipt()?;
let page=core.query_indexed_page(PageQuery{
 session_id:&roots.session_id, revision:roots.revision,generation:roots.generation,
 domain:"RecurringEvents", sort:"savedIndex",filter:"",limit:200,cursor:None
})?;
assert!(!page.complete_all_domains);
assert!(!roots.capabilities.encode_copy);
```

## W1/02 TIME transactional change request

`W1CommandIntent` binds `{CoreSessionId,Revision,Generation, encryptedOriginalSha256, decodedJsonSha256,registrySha256, externallySelectedBID,schema626,eventId,savedIndex,oneof,canonicalPointer,expectedOldRawJson,expectedOldUtc,proposedUtc,sourceReadSet:[{pointer,expectedRawTokenSha}]}` for **preflight only**. All accepted conditions are compared against Core-owned bytes/index and current source snapshot; stale source/revision, swapped valid EventID, unknown source path, mismatched reference token, invalid new UTC denied. This does **NOT** prove Registry EventID→definition match, actual Native scheduler/reschedule behavior, Grid/Quest/ConditionalEvent references, 11-domain graph, full W1 read/dependency closure or atomic transaction/export. Semantic positive grant remains OFF until operation-specific Native V3 + complete relevant references + independent QR + 00 CTRL. Never automatically repair intentional 2126 values.

## Verification matrix (no real saves)

New synthetic focused CI `01A Trusted Rust READ Research` executes:
- Full strict JSON scan, numeric array/object indexed complete rows and unknown oneof preserved;
- CSPRNG Cursor replay/query-scope mismatch/forgery, different session, expiry, stale Revision/Generation, close/revocation;
- Original encrypted/decoded SHA mismatch, wrong registry digest, external BID spoof, missing domain root, duplicate keys/object key alias;
- Oversize row fails closed (no partial complete), page overlimit; W1 wrong EventID/oneof/old raw UTC/revision, source read-set missing ref or wrong lexical SHA; spoofed all-positive UI receipt still cannot stage/export;
- Existing crate regression tests; wasm32 **compile only**;
- 16/64/100/200 MiB class synthetic native profile matrix, `/usr/bin/time -v` peak process RSS. Fixture has one synthetic Grid opaque-array blob (not realistic Grid address semantics) plus 474 synthetic RecurringEvent rows. This is **not real P1G performance evidence**, not a browser Worker, not a real 200MiB game save.

First successful new matrix (source ancestor `cb9f9db9860ebeb037891dab2d4500422e185a9a`): 16MiB JSON 16,792,660 B, Core Open 205 ms, peak RSS 72,792 KiB; 64MiB JSON 67,136,536 B, open 822 ms, 241,524 KiB; 100MiB JSON 104,882,140 B, open 1,385 ms, 375,684 KiB; 200MiB JSON 209,736,508 B, open 2,800 ms, 749,136 KiB. These are runner-native measurements and do NOT prove low memory readiness; 200MiB peak ~732MiB RSS requires a separate budget decision. Never use synthetic decoded-only/low entropy to justify a real compressed-P1G bandwidth/memory limit.

## Outstanding operation-specific release gates

1. Core-owned full **11 domain** references and on-demand consistency indexes beyond the single RecurringEvents direct-child index; fully validate dependencies needed per command but do not block unrelated work pending all-domain study.
2. Product ReadOnly **WASM Worker** ABI, truly private source+registry, authenticated cursor proof through JS<->WASM boundary, never exposing internal read roots to UI. React to File/Undo/Redo/Session change and cancellation. Current Rust trusted-read ABI is usable as a *source research implementation only*.
3. Full cross-domain transactional `ChangeSet`+old-value CAS+Atomic Undo/Redo; no UI-generated positive authority; Domain semantic whitelist and unknown field/reference preservation; current W1 is preflight-only.
4. User-protected final export only on accepted operation: overlay immutable source once, validate all-domain consistency, strict ZIP/CRC AES Encode, independent Reopen and separate original-first backup. **All Writer flags OFF**.
5. 05 QR source-only new-head delta and new Rust READ negative tests; separate V3 Native W1 meaning; V4 only if named unresolved game runtime behavior cannot be settled offline. Existing QR343 genuine **real schema626 P1G six-output mechanics** independently accepted at fixed PR329 source; do NOT repeat that previous successful code/test as new READ proof.

DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY. No unapproved source/key upload. RC Nov30 and public/Writer are distinct decisions.
