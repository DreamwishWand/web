# 01A CORE — R04 Worker → Rust WASM single-session handshake (source slice)

Task `W-CORE-004`; START_QUEUE 01A row16; `R04` **FIRST, non-writer slice only**.
Source base: protected main `586d4e662fb20bd90e0e2cbf23b92f3615bc4ad1`, where 09 INT integrated R02/R03 ProductRust ABI PR698 after independent QA692. Do not merge research PR530/QA538 again.

## Single authority and trust

- ProductRust's own `ProductSession` is the only session used by this **isolated opt-in Worker** adapter; `product_session.rs` has no second TrustedReadCore or research Stage session.
- A trusted Worker supplies 32 random CSPRNG bytes. Rust binds entropy to its decoded JSON SHA256 and derives one opaque 128-bit SessionID, guarding Revision0/IndexGeneration1 and one Core-owned `/GameInfo/Version` read witness.
- Build identity allows only exact Switch v1.25.3 BID9A239D3DB569756D or Steam v1.25.3 FullVersion `releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22` candidate and requires externallyConfirmed=true, **not physical build identity evidence or accepted Product reader**. Uploaded Owner Steam P1G's exact build remains UNKNOWN.
- Rust strict full-document JSON scanner rejects duplicate keys and missing required roots, but all-domain Native reference closure is still false.
- WASM `WorkerWasmSource` is constructed *inside Worker only*; accepts encoded JSON decoded **by a trusted Worker codec** in <=1MiB chunks, 128MiB total. The profile, key and ciphertext are never included in GitHub/CI or posted to UI.
- JS `createProductWasmReadOwner` rejects malformed/forged Rust receipt, extra user readset, stale SessionID/Revision/IndexGeneration/decodedSHA, unverified build, oversized chunks, missing module, Close/racing reopen, and Writer/Export/Apply.
- `productWorkerBound=true` describes the isolated Rust Worker facade when actually instantiated; **`productReadAccepted=false`, `allDomainReferencesVerified=false`, canStage/canExportEditedCopy/canApply all false**.

## Important scope exclusions

The shipped existing `local-timing-read.worker.ts` and `local-save-session-bridge.mjs` remain **unchanged** and retain their accepted legacy 128MiB read-only Session. The new opt-in facade is not wired into the browser, cannot open a P1G itself, and has no compiled WASM JS bundle deployment pipeline. Therefore this slice proves **source ABI + wasm32 compilation + synthetic Worker mocked bridge** only. It is not Product SingleSaveSession browser acceptance nor genuine Steam V2/Native V3/Device V4; no automatic cloud, app writer, provider or community permission.

## Check / evidence / negative tests

- Native Rust R02 tests inherited 4/4 scoped, unchanged Native ProductSession receipt remains productWorkerBound=false.
- R04 Cargo feature `worker-wasm`, target wasm32-unknown-unknown compile; new Node `product-wasm-read-owner.test.mjs` 9 tests: valid receipt/witness, wrong Build, forged scope, forged Rust receipt, forged read result, <=1MiB chunk checks, delayed Open A vs Close and Open B, delayed chunk resurrection, missing module. Synthetic mock != real WASM runtime.
- CI workflow `core-product-session-boundary.yml`: native cargo tests, wasm32 compilation, Node new-only tests and private-file scan. Freeze HEAD after CI; independent 05 QR-C changed-risk only. 09P-CODE E670 26/26 and Product QA692 9/9 reused, do not repeat ancestors.

## Integration Ready / rollback

01A draft new main-based Source, no main merge. 05 QR-C independently QA new feature and JS receipts; 09P-CODE new ABI collision only if there is a real new conflict; 09 INT alone selects accepted changed paths, new integration CI/Main CI/Pages/rollback. Rollback = remove R04 adapter+type+tests+wasm module and revert gated Cargo/workflow additions, retaining R02 ProductRust and legacy JS Worker.

**Next distinct R04 slice**: connect real packaged WASM and trusted P1G codec in the *same* Worker (no dual reader), test actual 128MiB and synthetic 200MiB transfer strategy, then backup→distinct Edited-copy→separate-process Reopen with explicit old-value CAS and exact diff; 05 QR-L owner-private real Steam V2 later. Writer/Cloud/Provider/Community/Public flags OFF.
