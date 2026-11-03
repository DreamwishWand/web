# Wand 01A P1G & Source Evidence Research API v1

STATUS: SYNTHETIC_TESTED / RESEARCH ONLY. This is NOT an accepted product API and does not grant Writer capabilities. Shared owner: Wand 01A, crates/ddv-save-core, Draft PR #312. Timekeeper does not own a separate Codec.

## A. Common strict P1G research port

p1g::decode_p1g_research(ciphertext, trusted_key, max_json_bytes) returns decoded JSON, encrypted ciphertext SHA256, decoded JSON SHA256 and ZIP metadata. The AES-256-ECB key is passed by the trusted caller; no game key is stored by the Rust crate.

p1g::create_p1g_copy_research(original_cipher, expected_encrypted_sha, key, expected_schema, token_changes, max_json_bytes) allows only a synthetically proven one-field copy. It recomputes strict source SHA, raw string-token CAS and schema, rebuilds a single ZIP profile, encrypts once, reopens with the Rust decoder and confirms exact decoded bytes. Returned product_encode_copy_authorized=false and persistent_replace_authorized=false. It does NOT write to disk.

ZIP scope: one ZIP32 entry named profile, method 0 Store or 8 Deflate, CRC32, exact local/central/EOCD directory and size agreement. Reject unknown extra, comments, descriptors, multiple entries, ZIP64, gaps, unsupported flags and trailing bytes. Copy accepted fixed-width DOS timestamps, versions and attributes without guessing. Proven with separate Node crypto/zlib/CRC and synthetic negative cases. This is not real-P1G format parity or an independent complete Wand JS Codec reopen.

Current 256MiB decoded and bounded ciphertext/archive caps are research guards only. Streaming, OPFS, large structured editing and a user-save profile are NOT accepted.

## B. Source-derived reference scope

SaveSession::inspect_source_reference_paths(requested domain identities and exact pointers) rescans actual current staged JSON, records source SHA, current SHA, revision, index generation, and hashes of observed lexical tokens. Missing/duplicate paths reject. It always returns cross_domain_reference_closure_complete=false, domain_reference_semantics_verified=false and usable_for_product_writer=false.

The existing ReferenceIndex is caller-asserted, not a complete source-derived graph. A product extractor must derive and prove current-snapshot dependencies for ListInventory, CollectionSet, ContainerInventory/Chest, Grid/DiffGrid/SubGrid, PlayerHouse, Quest/Progression and RecurringEvent; otherwise deny dependent edits. Keep authoritative Wand Transaction Foundation and Storage Transaction semantics and do not duplicate those domain validators in this crate.

## C. Formal typed W1 research witness for 02 TIME

w1_evidence::W1Identity {event_id, saved_index, variant:W1Kind} and inspect_w1_source_research(...) verify exact saved NextOccurrence and RecurringEventItemID paths, that the saved event row contains exactly one oneof subtype, and strict canonical saved EventID. UTC comparison uses decoded RFC3339 strings, but old raw JSON token remains separately recorded for byte-exact CAS.

P1gSourceIdentity includes THREE DISTINCT SHA256 roots: encrypted P1G, decoded JSON and Registry. Explicit Switch BID 9A239D3DB569756D and schema626 must be supplied; schema does not infer BID. A matching SHA to caller-provided Registry bytes is not proof of authoritative 508-definition mapping. The Worker must pin canonical Registry SHA 028a206635d37bffd7f3a8ff820958bdaa201887bacf35e10faa8328d20022ea and import 02 TIME semantic/native ledger.

Result intentionally has registry_event_semantics_verified=false, native_semantics_verified=false, required_reference_closure_complete=false, encode_copy_authorized=false. 02 TIME may begin independent research-only conformance tests against concrete Rust DTOs, but product adapter activation requires canonical registry matching, domain dependency closure and independent 05 QR approval.

## D. 03 WEB target port and gated release

TARGET (not implemented product API): open / queryPaged / inspectReferences / stageCommand / undo / redo / validateTransaction / exportVerifiedCopy. Source File, key, Registry, three hashes, build identity, reference graph, revision and actual permissions must be Worker-owned, not supplied by UI; only small projections and scoped ChangeSets leave the Worker. Never upload or overwrite original save; no ZIP bundle or future-time auto-normalization.

Remain blocked: verified real-format ZIP metadata parity, streaming P1G AES/ZIP/Deflate/CRC, trusted full graph and conditional native evidence, mixed-domain encoded copy+independent Wand JS Codec reopen, browser resource-constrained P1G tests, 05 QR acceptance, product permission. Historic Rust synthetic proofs never imply real save/Wand main compatibility.
