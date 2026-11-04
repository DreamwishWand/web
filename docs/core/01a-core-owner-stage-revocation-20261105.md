# 01A CORE — Native trusted source-owner stage revocation (2026-11-05)

## Gate / provenance

Research-only child of PR #500 frozen Source `8586fd8b79426e7574f39a998a55a4c3e82e341f` (05 QR-C PR #505 new-only SOURCE/SYNTHETIC PASS). Switch DDV v1.25.3, externally attested BID `9A239D3DB569756D`, schema626. Native offline W1 map155 EventID2010000021 NextOccurrence operation ONLY; 2126 source timestamp is intentional, never auto repaired.

The prior research W1 private operator already reused immutable encrypted P1G and decoded JSON `Arc` backing through `TrustedReadCore` + an independent `SaveSession`. However dropping/closing the Core could leave a staged `SaveSession` with retained decoded Arc, able to continue independently of the original trusted source owner. This patch **binds private stage liveness to the owning Core** without changing the product Worker, V2 gate, or Native semantics:

1. `TrustedReadCore` internally owns a one-way `Arc<AtomicBool>` research liveness token, set false on explicit Close and Rust Drop. Only the exact matching decoded source Arc can borrow it after Core verifies its own original/decoded source SHA and active receipt.
2. `SaveSession` research staging binds this token **once** at revision/index generation zero, only while source Arc pointer identity + SHA + Core receipt match. Foreign Core even with identical JSON, rebind attempts, closed Core or previously staged transaction deny.
3. All source-bearing staged research operations (Stage, Undo, Redo, source-backed query, projected reference inspection, materialize / validate) refuse after Core Close or Drop with `CORE_STAGE_SOURCE_REVOKED`. No revision/history/index generation changes occur on denied stages. Already accepted free-standing `SaveSession::open_decoded_research(Vec)` remains independently usable in SOURCE-only research, with product P1G export always denied.
4. The private W1 operator calls the binding before the eight Core source-root CAS atomic stage and keeps the Core alive until original-first backup, research copy and separate-process Node ZIP/CRC reopen complete. As before, source owner and staged transaction retain **different** SessionIDs and histories. This is NOT a single Product SaveSession, not a game Native W1 V3 semantic proof, and not a product Writer authorization.

## Test scope

Native-only synthetic CI: Core Close invalidates Stage/Undo/Redo/Read and leaves Revision0/IndexGeneration0/source SHA unchanged; Drop invalidates retained Arc stage; same decoded bytes from foreign Core are NOT identity and cannot bind; repeated bind denies; legacy standalone research Vec API still allows read validation but denies product export. Existing 8-root CAS, original backup unchanged, 6MiB opaque lexeme survival and fresh independent Node reopen inherited from PR500/QA505 **are not independently reaccepted**. Fixed new-head Owner CI and new-only 05 QR-C negative-scope acceptance required, then 09P-CODE and 09 INT selective main-first ABI review. Do not merge the stacked research ancestor tree.

## Explicit gaps / release

The liveness token is a single-process native research invalidation check, **not a cross-thread serialization lock**, production Worker host suspension barrier, Browser 200MiB encrypted P1G proof, one Product Session, or verified durable separate-disk backup. 05 QR-L genuine owner-private Rust Product V2 remains HUMAN_GATE/NOT_RUN; same-BID Wetland effective Grid/default+DiffGrid Tree/Softwood quota+Clock Actualize Last→Next V3 UNKNOWN. W1 ProductOperationEnabled false, Writer/EditedCopy Product Export/Apply/OriginalOverwrite/Provider/Cloud/Public OFF. No save, decoded JSON or key is present in public CI, and no existing Pages publication is modified.
