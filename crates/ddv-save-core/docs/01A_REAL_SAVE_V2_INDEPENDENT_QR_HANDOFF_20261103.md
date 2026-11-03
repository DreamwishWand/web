# 01A CORE — real schema626 V2 independent QR contract (2026-11-03)

**Research/QA only. No original save, decrypted JSON, edited P1G, AES key, registry raw bytes, credentials or game binary in GitHub or CI.** This handoff is scoped to an Owner-authorized, privately retained Switch v1.25.3 / schema626 source. Timekeeper Issue #19/#32 and the shared 00 CTRL SSoT govern scope. **Developer local proof ≠ independent QR acceptance ≠ Native semantic acceptance ≠ product Writer.**

## Frozen inputs and ancestry

- Base Wand PR #312: `c6b152512d3bc901fd1474dbcfcb07253ae1b347`.
- CORE Draft PR #329: pin the **current exact HEAD at execution**, workflow run, Cargo binary digest, JS codec blob/commit identities. Parent stays PR312; PR322/323 source-derived <=2MiB Grid/Chest guard is **not** merged into PR329.
- Canonical Wand JS Codec comes from that same pinned Wand source; canonical Timekeeper JS Codec was copied as **source-only** from Timekeeper commit `393222e7832461ef5fea847b6fff475fedc45017` by focused CI.
- Independent QR #324/#325 proves prior synthetic, separate scopes. QR #332 `6467065e98ace6e5972bfd7096208b632dd076f0` is **synthetic only**, based on old CORE PR329 `4c8cf5568ad767c5712dbe948fc6d9dc4dbbac76`. New CORE HEAD/real save requires **new-only** QA receipt; do not transfer its PASS.
- Private V0 intake 01E: immutable encrypted P1G source hash/size, decoded JSON SHA/size, ZIP envelope and outside-build evidence (Switch BID and native build provenance) retained in **private** validation record. ZIP profile metadata must be independently inspected and compared. `GameInfo.Version=626` does not encode/extract a Switch BID.
- A prior developer executed **three real codecs** (Rust/Wand JS/Timekeeper JS), each **No-op + one-W1-edit** on the **same private original**; six encrypted outputs independently reopened, exact non-target decoded-token preservation, supported ZIP metadata parity and original source SHA unchanged. Rust negative inputs rejected 11/11 with no edited output. This is `REAL_SAVE_OFFLINE_EDITED / DEVELOPER_LOCAL_PASS`, NOT QR real-save PASS.
- Persisted SHA-only output identities from the developer run are in private shared SSoT (including 6 outputs), not fixtures/public real save bytes. A verifier must independently compute and compare hashes when authorized.

## QR independent execution (strictly private machine; no raw artifact upload)

1. Capture **head, base, parent, CI workflow SHA**, Cargo binary SHA, script SHA, canonical Wand JS blob SHA and Timekeeper codec+dependencies blob SHAs. For provenance, use exact checkout/run SHA rather than PR number alone. Trust the downloaded *source-only* one-day GitHub artifact only after verifying the fixed-HEAD workflow and file inventory; artifact contains executable/source, **never a save**.
2. Read authorized original **locally**. Before starting, rehash source encrypted bytes (V0), check size, schema, independent decoded JSON SHA, full strict JSON parser and **external** BID/build evidence (never infer from schema or filename). Confirm one observed W1 EventID, savedIndex, oneof variant and old raw JSON string+decoded UTC value. Capture Registry SHA from the **authorized exact registry bytes**, separately; do not infer registry provenance from the original P1G.
3. Run pinned local verifier `crates/ddv-save-core/scripts/offline-real-save-v2.mjs` with `DDV_PRIVATE_P1G_PATH`, `DDV_EXPECTED_P1G_SHA256`, `DDV_EXPECTED_JSON_SHA256`, `DDV_EXTERNAL_SWITCH_BID`, `DDV_W1_EVENT_ID`, `DDV_W1_SAVED_INDEX`, `DDV_W1_ONEOF`, `DDV_W1_OLD_UTC`, `DDV_W1_NEW_UTC`, `DDV_TIMEKEEPER_CODEC_MODULE`, `DDV_REQUIRE_RUST=1` and optional `DDV_RUST_PROBE_BINARY` pointing to pinned *locally executed* binary. Never log environment. Run the independent verifier under QR-controlled process/context; do not submit the original via Actions, web service, email or Issue attachment.
4. **For all six outputs**, independently decrypt P1G and verify ZIP32 exactly-one `profile`, Deflate method8, local/central `extractVersion`, flag bits, method, DOS date/time, filename, CRC, compressed/uncompressed size, central host-version and attributes, disk offset, extras, comments, EOCD and ZIP64/descriptors unsupported. Inconsistent unsupported envelopes and unknown ZIP metadata **deny this operation**; do not normalize unknown fields. Distinct ciphertext hashes across Deflate implementations are acceptable only with exact decoded lexical JSON and accepted semantic metadata parity.
5. No-op: re-encoded decoded JSON must equal original **byte-for-byte**. W1 edited copy: exactly one *old-value-CAS-bound* `/World/RecurringEvents/<savedIndex>/<oneof>/NextOccurrence` JSON string token changes. Original prefix/suffix byte identity and full semantic JSON equality after restoring old value are required; no other unknown/scalar, nested state, reference or unrelated field may change. Verify raw JSON token, decoded UTC and new UTC semantics independently. Original encrypted SHA **before and after each operation** must match V0.
6. Negative inputs must fail closed with no edited P1G on the rejected operation: incorrect encrypted source SHA, decoded SHA, external BID, schema, savedIndex, EventID (not ItemID), oneof, old UTC CAS, old==new, corrupted/truncated P1G, wrong ZIP local/central fields, unsupported comment/extra/descriptor/ZIP64, unknown nested State, missing required source refs. Distinguish **tested** negatives from suggested tests. A JS/UI-side stale Session/Revision claim is not a Rust Core revision CAS until the source-owned Session API proves it.
7. Publish **only a redacted attestation**: exact branch/commit; test-run ID; fixed source and codec revisions; input size/SHA and output size/SHA if permitted; pass/fail of decoded diff/ZIP metadata/CRC/unknowns/original invariance and each negative case; source-supported vs native-unknown categories. Secure raw QA logs and bytes stay in the authorized private environment. No in-place original overwrite, persistent replace, external network, uploaded game binary, or leaked profile.

## Proposed QR result shape (schema is a handoff, not a product API)

```json
{
  "contract": "dreamwish.ddv.v2-private-qr-attestation.proposed@1",
  "coreHead": "<full Git SHA>",
  "coreParent": "c6b152512d3bc901fd1474dbcfcb07253ae1b347",
  "source": {"encryptedSha256": "<private recorded SHA>","decodedSha256": "<private recorded SHA>","schema":626,"externalBuildVerified":true},
  "w1": {"eventId":2010000021,"savedIndex":155,"oneof":"ItemSpawning","targetPointer":"/World/RecurringEvents/155/ItemSpawning/NextOccurrence","rawOldCasMatched":true,"utcOldCasMatched":true,"registryShaVerified":false},
  "outputs": {"rustNoop":"<SHA>","rustW1":"<SHA>","wandJsNoop":"<SHA>","wandJsW1":"<SHA>","timekeeperJsNoop":"<SHA>","timekeeperJsW1":"<SHA>"},
  "checks": {"originalUnchanged":true,"zipLocalCentralParity":true,"crcValid":true,"noOpExactJsonBytes":true,"w1ExactlyOneTokenDiff":true,"unknownFieldsPreserved":true,"independentSixReopen":true},
  "rejectedCases": {"count":0,"names":[]},
  "evidence": "QR_PRIVATE_REAL_SAVE_NOT_YET_RUN",
  "nativeSemantics": "STATIC_ONLY",
  "sourceRevisionCas": "NOT_TESTED",
  "operationReferenceClosure": "UNVERIFIED",
  "productWriterAuthorized": false
}
```

Do not publish placeholders or change `evidence` to QR PASS without actual independent execution. HASH is a validator result, not an authorization token.

## W1 SemanticCommand acceptance delta — typed proposal, not accepted implementation

`W1SetNextOccurrence` requires Core-minted `{sessionId,revision,sourceEncryptedSha,decodedJsonSha,externalPlatform,externalBid,schema,registrySha,identity:{eventId,savedIndex,oneof},targetPointer,rawOldJsonToken,decodedOldUtc,newUtc,readSet,writeSet,dependencySet,capability}`.

- Ownership: source SHA and decoded SHA refer to different byte domains; revision/session/generation are assigned by trusted Worker/Core and CAS-checked against same source backing. Registry SHA is computed from verified registry bytes; valid SHA does **not** prove EventID is authorized by Native. BID must have external provenance.
- Identity: EventID `2010000021` is not ItemID. savedIndex is bound to exact original source row. oneof must be unique and recognized. Raw old JSON lexical CAS and decoded UTC old-value CAS both required. Future `2126` timestamp is intentional unless user explicitly requests a change; no auto repair or normalize.
- Domain gate: only W1 allowlisted active ordinary spawning types; protected Moonstone/TimeBending/W2/Quest/DLC/inactive Fish/unknown oneof reject. Validate required semantic reads (event scheduling/LastOccurrence/catch-up/recreate logic, Area/Grid/progression side effects if applicable). Validate **complete dependency closure for this operation**, not all 11 domains universally. PR322/323 Grid/Chest 2MiB closure is not that proof.
- Transition: atomic CAS + domain-typed ChangeSet, invalidation, Undo/Redo same Revision, final validated copy + independently reopened exact changed paths and unknowns; any stale token or mismatched dependency **fails closed for this operation**.
- Current Rust `create_p1g_copy_research` and private probes do **not** implement formal Core-owned Revision, Registry-backed Native semantics, complete W1 dependency closure or product capability; `ENCODE_COPY=false`, `PERSISTENT_REPLACE=false`, `APPLY=false` regardless of successful V2 bytes.

## 03 WEB minimal READ-only interface and boundary

**Actually present research code** (not product WASM): `decode_p1g_research` validates restricted P1G and JSON; `index_selected_tokens` inspects bounded strict source pointers; `inspect_w1_source_research` returns structural W1 witness with Registry digest matching but Native/ref/Writer flags FALSE; `p1g_offline_private_probe` is CLI only. Existing Timekeeper JS Worker/READ UI is separately implemented and evaluated, not a Rust product integration.

**Proposed, NOT YET IMPLEMENTED as Rust product Worker API**:
```ts
type OpenReadOnly = {source: File; externalBuildEvidence: string};
type CoreReadSession = {sessionId: string; revision: string; encryptedSourceSha256: string;
 decodedJsonSha256: string; schema: number; externalBuildVerified: boolean;
 capability: {read: true; encodeCopy: false; persistentReplace: false}};
type ReadW1Page = {sessionId: string; revision: string; records: readonly W1Projection[];
 nextCursor: string | null; complete: boolean};
type W1Projection = {eventId: number; savedIndex: number; oneof: string;
 currentUtc: string; supportedForEdit: false};
```
Core owns authenticated `sessionId/revision`, source-indexed bounded typed projection and opaque cursor. Reject forged cursors, source/Session/Revision switches, missing/contradictory `complete`, stale responses; UI does not issue authority. Existing WEB research envelopes include ≤200 rows/page, ≤64KiB serialized UTF-8/row, ≤2MiB/page. Do not expose arbitrary raw JSON graph or original P1G in projections; no stage, undo, export or Writer API enabled by a READ proposal. Issue #19 defines final integrated Rust/WASM/Worker boundary.

## Per-operation evidence status

| Axis | Current |
|---|---|
| V0 encrypted source/ZIP and separately evidenced BID | historical verified real source |
| V1 strict real JSON/schema626 read-only | accepted 01E |
| V2 3-codec six-copy genuine developer local mechanical verification | PASS developer; independent QR pending |
| V2 QR #332 | synthetic-only old parent; not real-save QR pass |
| V2 source/Session Revision CAS | **NOT TESTED** in the private CLI |
| W1 full required reference closure and unknown Native consumers | **UNKNOWN / FAIL CLOSED** |
| V3 W1 Native scheduler/load/recreation meaning | TIME PR37 STATIC_ONLY / PARTIAL |
| V4 device runtime | not run; conditional on a precise unresolved runtime behavior |
| Product W1 ENCODE_COPY / APPLY / persistent original overwrite | **OFF** |

No generic device/Owner approval requirement prevents isolated V2/V3 engineering. 00 CTRL and independent QR decide per-operation promotion after concrete evidence, not on the basis of a calendar deadline.

## 2026-11-03 independent QR #334 / latest script receipt closure delta

**QR #334 independent verdict as actually observed:** QA HEAD `b0823d8ce15e5711505d84e1b94c44f9db072082`, parent PR329 `9c2945a6ac41e584a49394bd1b39865c6d68daeb`, focused CI `41554563786` SUCCESS and ordinary CI `41554563347` SUCCESS. QA independently inspected the published source-only artifact and ran the actual pinned ELF against **synthetic** schema626 P1G with independent Python reopen and 11 negative refusals. There was **no authorized private real source in the QA environment**. Therefore the only defensible classification remains `QR_SYNTHETIC_PASS / QR_PRIVATE_REAL_SAVE_NOT_RUN`. This is an **access/evidence gap**, not a contradiction with developer-local genuine six-output proof. QA #332 remains separately old-source synthetic PASS.

**New developer receipt (strict format, generated locally only):**
- `contract = dreamwish.ddv.v2-local-redacted-receipt@1`, `evidence = LOCAL_RESEARCH_EXECUTION_ONLY_NOT_INDEPENDENT_QR_ACCEPTANCE`. A passing schema is **not** a cryptographic signature or trusted QA issuer.
- `source_ciphertext_sha256`, `source_json_sha256`, `edited_json_sha256`; `outputs` contains **six named SHA256** or `null` for each comparator not executed. `source_sha_verified`, `decoded_sha_verified`, `original_unchanged`, `zip_header_local_central_parity`, `crc_independent_reopen` and lexical/semantic source-diff results must agree.
- `w1 = {eventId,savedIndex,oneof,changedPointer,oldUtcSha256,newUtcSha256,rawOldCas,decodedOldUtcCas}`; the only accepted target for this witness is `/World/RecurringEvents/155/ItemSpawning/NextOccurrence`. These SHA/token fields record *observed source* and **do not constitute formal trusted Core Session/Revision CAS**.
- `negativeCases` lists the **three actually executed local JS CAS** denials `wrongEventId`/`W1_EVENT_ID_CAS_FAILED`, `wrongOneof`/`W1_ONEOF_CAS_FAILED`, and `staleOldUtc`/`W1_TIMESTAMP_CAS_FAILED`; each has `result=DENIED`, `editedOutputBytes=0`. Rust's historically observed 11 private negative cases are a *separate* source-identified developer record, not silently part of these three or new QR PASS.
- The receipt must explicitly retain `registry_sha_verified:NOT_RUN`, `full_w1_reference_closure:NOT_VERIFIED`, `session_revision_cas:NOT_RUN`, `product_encode_copy_authorized:false`, `persistent_replace_authorized:false`. An independent QR receipt must be produced by the **QR actor** after QR obtains lawful local source access; copying the developer JSON is not independent acceptance.

**Exact source-only QR delta procedure:** inspect current PR329 source vs QR334 frozen parent `9c2945a...` (script header parity and receipt only; no regression of unchanged Rust P1G core). Reuse QA #334 independent frozen synthetic proof for Rust ELF and QA #332 old synthetic JS test; rerun their test only if the affected code or conditions changed. QR must separately validate the new script's redacted receipt shape and independent metadata checks with **new-only** synthetic negatives and optionally a **single private genuine source** execution in QR-owned isolation. Compare independent QR source/copy hashes and original invariant against previously accepted developer hash identities. The QR actor should find the already authorized 01E source through its own approved private environment/Drive access; **never ask CORE to put the original in a GitHub attachment, workflow secret, public artifact or issue comment**. If source inaccessible, record `PRIVATE_SOURCE_NOT_AVAILABLE_TO_QR` and continue all other isolated development. Do not substitute a fake fixture for `REAL_SAVE_OFFLINE_EDITED`.

**Source/Revision/Registry/Native distinct gates:** production-grade `W1SetNextOccurrence` is unimplemented. Current local CLI only checks immutable source SHA, decoded SHA, external BID, exact EventID/index/oneof and decoded old UTC, plus byte-level target diff. It does **not** establish Core-minted SessionID, generation/revision CAS, read/write/dependency reference closure, Registry EventID-to-definition semantic relationship or Native appointment/catchup/LastOccurrence reschedule. Each is its own fail-closed operation flag. The accepted product Rust READ Worker ABI `openLocal/queryIndexedPage/verifyIndexedPage/close` does **not** yet exist: WEB44's `createProspectiveCoreReadWorkerBridge` is an isolated mock/proposal, not integrated Core. The existing Rust research `decode_p1g_research/index_selected_tokens/inspect_w1_source_research` is real source code but not a production bound lazy cursor or authenticated `complete` receipt. READ-only RC text UI and product Rust READ are separate evidence, with all W1 Writer/EncodeCopy/Apply/original overwrite OFF.
