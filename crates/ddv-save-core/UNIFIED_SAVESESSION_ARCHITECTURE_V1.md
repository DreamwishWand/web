# Unified SaveSession Architecture V1 — Wand 01A / Timekeeper 01 CORE

Owner-confirmed target: **Single SaveSession + Full-Document Validation + Indexed/Lazy Access + Cross-Domain Transactional Editing + Verified One-Time Export**. This file distinguishes the accepted TARGET from the current decoded-JSON research implementation. SSoT: Timekeeper Issue #19 and DDV_TIMEKEEPER_SHARED_RESEARCH_AND_REUSE_CURRENT.

## Ownership / precedence

One Wand-owned shared Rust crate at DreamwishWand/web/crates/ddv-save-core; NO separate Timekeeper-only Codec. Actual Wand main JavaScript semantic precedents: src/lib/ddv/core/save/transaction-foundation-base-v125.js, storage-transaction-target-v125.js, transaction-foundation.js, and src/lib/ddv/core/world/storage-active-reference-index-v125.js. Reuse their Pre/Postcondition, object identity and domain semantics; do NOT recode them as competing unverified Rust facts. Wand main schema624 and Timekeeper schema626/BID 9A239D3DB569756D are different Build targets. A save schema does NOT infer an executable BID. 01A owns common source/hash/Codec/spans and transaction mechanics; Wand domain owners own ownership/chest/quest/grid guards; 02 TIME owns W1 native semantic guards; 03 WEB owns typed Worker/Session transport; 05 QR independent QA; 00 CTRL integration.

## Target API vs implemented research slice

| Target | Research implementation | Missing product gate |
| --- | --- | --- |
| open | SaveSession::open_decoded_research(session, decoded bytes, schema, asserted graph); strict full JSON parse, immutable original SHA | P1G streaming AES/ZIP/CRC, File/OPFS backing, verified semantic graph, external BID |
| queryPaged | query_paged(pointers, cursor, limit), revision-bound lazy sparse token spans and bounded previews | Domain-indexed cursors and complete Grid/quest/room collections |
| inspectReferences | typed LogicalIdentity outbound edges with fail-closed missing node/duplicate edge | Verified extraction and completeness provenance from real save |
| stageCommand | stage_command: typed domain commands, read/write witnesses, old-value CAS, exact revision and source hash, postconditions, all-or-nothing raw subtree replacement | Semantic ownership authorization and unknown-preservation INSIDE structural replaced subtrees |
| undo / redo | monotonic revision, atomic ChangeSet/Redo stack and lazy index generation invalidation | Persistent quota-bounded store and async cancellation |
| validateTransaction | strict full candidate reparse, postcondition witness, asserted edge consistency, source immutability; semantic_domain_guards_accepted=false | Independent domain validators and proven cross-domain reference graph |
| exportVerifiedCopy | always rejects with PRODUCT_P1G_ENCODE_COPY_NOT_AUTHORIZED | One-time P1G encode, independent reopen, exact semantic/byte diff, QR permission and original-first download |

**Research-only:** RESEARCH_CAPABILITIES read=true, encode_copy=false, persistent_replace=false. A supplied ReferenceIndex is NOT extracted automatically from save data. Graph integrity only proves edges reference declared nodes; it does not prove that they match a physical Grid/Container/Quest representation. Caller-supplied raw SubtreeReplacement and graph must NEVER be accepted from UI as authorization. This initial staging proof keeps original bytes in an immutable Arc and materializes a TEMPORARY decoded JSON byte buffer on stage/validate; it is not yet true bounded streaming or OPFS/IndexedDB. No retained full serde_json object graph is used.

## Domain transaction boundaries

Domains: Ownership, ListInventory, CollectionSet, ContainerInventory, Chest, Grid, DiffGrid, SubGrid, Quest, Progression, RecurringEvent. LogicalIdentity = (domain, stable key). ReferenceIndex = unique typed nodes and directed edges. TransactionPlan = Worker session ID, expected revision, original source SHA, set of typed SemanticCommand operations with exact raw old token CAS, read set, postconditions, proposed postreference graph. Stage checks every requested operation against ONE current candidate, rejects overlapping spans, invalid structure, malformed/duplicate key, stale state, and missing edge target. Commit publishes only after complete candidate validation; errors leave history/revision untouched. Undo/Redo advance revision and invalidate lazy indexes. A known parent subtree may be replaced for insertion/deletion/array reshape/nested state in synthetic research, but unknown siblings INSIDE that subtree require a domain-owned preservation proof. This is not a blanket structural Writer.

## Target Worker API (NOT product implemented)

open / queryPaged / inspectReferences / stageCommand / undo / redo / validateTransaction / exportVerifiedCopy. All requests require stable request ID, Worker-owned Session ID and current revision with explicit Build identity. Only bounded projection and ChangeSet return to UI. Never expose decrypted full root, UI-supplied source SHA/registry/native ledger/reference graph or capability. Session changes, stale async results and inconsistent source hashes fail closed. Original separate backup attempted BEFORE edited P1G download; never zip or overwrite original.

## Evidence boundaries

SYNTHETIC_TESTED: mixed single-session ListInventory+CollectionSet+ContainerInventory+GridObject nested State+Quest/Progression+RecurringEvents operation; exact source SHA/CAS/Revision, declared graph checks, atomic stage, Undo/Redo, lost reference/invalid postcondition/invalid JSON/duplicate pointer/stale state denials, unknown data outside replaced spans preserved. This demonstrates primitive engine transaction mechanics, NOT trusted domain semantic validation.

Native 256/512 decimal MB stress is opt-in separate: 256MB decoded full JSON strict scan and bounded query, 512MB deliberate denial at temporary 256MiB research guard. Neither defines a permanent format maximum, and 512MB does not PASS as supported.

Older synthetic JSON proof Rust 11/11 + independent JS 1/1 and actual Chrome WASM 16/64/100/200 decimal MB spans is historical. No encrypted Rust P1G AES/ZIP/Deflate/CRC, strict physical ZIP metadata, independent Encode/Reopen, optimized streaming large-save backing, real save Writer/console proof, or product WASM Worker. Product JS Codec remains independent oracle and fallback; current Writer authority unchanged. Final P1G release requires semantic validators/01A streaming serializer, independent 05 QR, then 00 CTRL decision.

See Draft PR #312, Timekeeper Issue #19 and benchmark synthetic 2026-11-02 record for exact HEAD CI and evidence.
