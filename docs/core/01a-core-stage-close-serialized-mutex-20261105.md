# 01A CORE — Serialize native Core Close with private Stage operations (2026-11-05)

**Operation:** Research-only W1 ItemSpawning NextOccurrence, external Switch 1.25.3/BID `9A239D3DB569756D`/schema626. Child of frozen Source PR512 `0b08ed4f3ee18cd696f78d23796202733b9dfe59`, 05 QR-C PR516 `87745993cdbcb4a11e5db81c23f2df66fd4805db` targeted SOURCE_ONLY/SYNTHETIC PASS. Protected main at selection `fabfd17c8dd192707d55a6cc12cccf65797d564e`; no main changes by 01A. All user-private Save and secret keys stay off GitHub/CI/Cloud.

## Remaining race and source delta

The accepted PR512 native research `Arc<AtomicBool>` invalidated bound Stage **after** Core Close/Drop, but a Stage operation could start with the bit true and continue mutating while another thread called `close()`. This delta replaces the bit-only token with a `CoreStageLifetime` consisting of the existing one-way AtomicBool plus a native `Mutex<()>` barrier.

- A bound Stage acquires the lifetime mutex **before** beginning its public staged Read, source witness audit, reference inspection, query, Stage, Undo, Redo or validation operation and holds it across the complete operation, including CAS/transaction publication. The `materialize()` inner helper checks the bit under its caller's lease; it **does not reacquire the mutex**, preventing self-deadlocks.
- Core `close()` and Rust `Drop` acquire the same exclusive mutex before revoking the AtomicBool; Close cannot complete while a Stage operation is under a valid lease. If Close wins, later Stage fails with `CORE_STAGE_SOURCE_REVOKED` without Revision/IndexGeneration change. Poisoned Stage mutex cannot make revocation fail open: owner recovery sets the bit false, and future Stage lock acquisition rejects poisoning.
- The token may only be borrowed by the exact SHA-verified decoded Arc belonging to the current Core. Same-JSON foreign Core/rebinding, stale source, missing Native semantics and Product Export continue failing closed. No extra decoded/ciphertext buffer copied, no UI Worker ABI change.
- Two deterministic synthetic threaded tests reserve the owner mutex and prove that bound staged validation blocks until released; separately, Core Close blocks behind a held Stage lease, then permanently revokes the Stage (Revision and IndexGeneration remain zero). Prior 05QR-C owner Close/Drop/rebind negatives and 8-source-atom CAS/Node independent synthetic reopen are unchanged; request new-only QA on this concurrent delta, not ancestor revalidation.

## Scope / gates

This is a **single-process native research mutex**, not proof of one Product Rust/WASM SaveSession, a browser Worker production lease, cross-process transactional storage, actual owner-private P1G V2, genuine encrypted Browser200MiB, same-build Wetland Grid+DiffGrid Tree quota Clock Last→Next Native V3, or Device V4. Research TrustedReadCore and SaveSession still have distinct SessionIDs and histories. Original-first backup and edited-copy are synthetic research only. JS Worker128MiB fail-closed stays unchanged. All Writer, Product EditedCopy Export, Apply, OriginalOverwrite, Cloud, Provider, Community Public OFF.

Integrate only after exact new Source Owner CI and new-only 05 QR-C fixed-head PASS; 09P-CODE ancestor ABI/current-main preflight and 09 INT sole selective merge with fresh cumulative CI+QA. Do not merge stacked research branches or QA-only branches wholesale.