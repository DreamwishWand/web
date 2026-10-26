# 02 WEP — Operator Gate A Source142 Three-Route Total Stop Bundle (OFFLINE CANDIDATE)

Date: 2026-10-26 JST. Workstream: existing 02 WEP / World Editor & Presets.
Status: DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY. Release R17 unchanged (Product Tree PASS0/PARTIAL12/BLOCKED18).

## Ownership and exact source provenance
- Source142 functional owner commit: `0b90e6681507a20c5cfa637752fb6c5a575c5d06`.
- Source142 current owner PR134 Docs-only commit: `daeca51eb6c838d9042322a2f3f67fe744e9d01f`.
- Source **Git blob** IDs, **not deployed Edge artifact hashes**:
  - `wep-preset-artifact/index.ts`: `7b07f750a9770886e4cf587537fed466b1965040`.
  - `wep-scene-preset-product/index.ts`: `89338d77937729b170d7ec5940b3683be88248b9`.
  - `wep-preset-retention/index.ts`: `052c642a2c739eb686e259135db8a2d33c26b965`.
- Existing Owner Source142 Generic has ZERO Storage.copy/remove but still READ `createSignedUrl(...,300)`. Source Scene Product and Preset Retention are fail-closed for mutation; none of the three is an independently validated, completely inert signed-read Gate A cutover bundle.
- Prior WEP PR163 Scene Stub and PR154 Source133 preservation are independent, untouched. Existing PR135/#147 Read-only Consumer and Scene Save Revision/Native DDV Writer untouched.
- Deployed staging still reports 21 ACTIVE Edge functions and 7 ACTIVE Cron jobs on historical managed116, with legacy Generic v14 / Scene Product v1 / Retention v6 behavior. Source files in this PR do NOT protect this live runtime.

## Complete targeted Gate A route / action inventory
All of the following are terminally denied in the transition candidate after basic authorization and scoped input checks; no code path accesses Storage or writer/signer RPC:

| Route | Source142/current contract entry | Gate A candidate valid-auth response |
|---|---|---|
| Generic `wep-preset-artifact` | `prepare` | 409; no signed upload |
| Generic | `reservePublication` | 409; no reservation RPC |
| Generic | `recoverPublication` | 409; no recovery-state mutation |
| Generic | `inspectPublishedObject` | 409; no lease or Provider readback |
| Generic | `publish` | 409; no Copy/SQL publication |
| Generic | `revisionReadiness` | 409; no Owner readiness SQL |
| Generic | `resolveWork` | 409; no Owner/Blob lookup |
| Generic | `read` | 409; **no metadata SQL or signed URL** |
| Generic | `discard` (Staging or Published) | 409; no SQL cleanup preflight / Remove |
| Scene `wep-scene-preset-product` | `prepare`, `publish`, `read` | 409; no upload/Copy/read sign |
| Scene | `unpublish`, `delete` | 409; no lifecycle SQL |
| Scene | `discard`, `compensate`, `failedSqlPublishCompensation`, `cleanup` | 409; no physical deletion |
| Worker `wep-preset-retention` | POST with Worker token, `retentionJobId`, `lockToken` (including retry/compensation/cleanup jobs) | 409; no claim/purge/remove/finalize |

- Explicit legacy aliases (`retry`, `retryPublish`, `prepareUpload`, `ownerRead`, `readPreset`, `publishScene`, plus scoped Scene aliases) receive **409** `OPERATOR_GATE_A_LEGACY_ALIAS_DISABLED`. Unrecognized future action: **400** `UNSUPPORTED_ACTION`; it is **not** silently accepted.
- Methods: POST only; invalid GET/PUT/DELETE: **405**; OPTIONS: **200** harmless CORS response. Missing or revoked Actor/iat/current Account: **401**; missing/invalid Worker token: **401**; malformed JSON/required parameters: **400**; cross-owner/traversal storage key and foreign Creator: **403**. All valid but switched-off operations: **409**, `retryable:false`, `Cache-Control:private,no-store`, `nextAction:WAIT_FOR_OPERATOR_REOPENING`. Creator ownership uses one permitted read-only creator_profiles lookup; the only remaining intended RPCs are `community_authorize_session` and `community_verify_worker_token`. These are necessary for meaningful 401/403 authority checks and must not be confused with a zero-SQL isolation guarantee.
- User-facing message key: `preset-temporarily-unavailable`. Render a localized Gate A temporary-unavailability message; disable upload/publish/read/apply buttons, do not imply the preset vanished, and do not auto-retry/resubmit idempotency keys. Manual retry only after operator-confirmed reopening. A 409 here is a managed stop, not proof the original operation was rolled back.

## Deterministic artifact build
The three production-independent, isolated **candidate** `index.ts` entrypoints are held under:
`operator/gate-a/wep-source142-stop-candidate/supabase/functions/{wep-preset-artifact,wep-scene-preset-product,wep-preset-retention}/index.ts`.

Dependencies: Node.js 22+, GNU tar (Ubuntu GNU tar), repository checkout at this PR HEAD, and (for full CI) `npm ci` / TypeScript and Deno v2.1.4. The builder itself uses only Node built-ins plus GNU tar and performs no network/provider calls.

Build from the repository root:

```bash
node scripts/gate-a/build-wep-source142-stop-bundle.mjs
cd dist/wep-gate-a-source142-stop
sha256sum -c SHA256SUMS
tar -tf wep-gate-a-source142-stop-candidate.tar
```

The builder copies exactly three sources and deterministic `BUNDLE_MANIFEST.json` into a staging directory, generates a GNU ustar tar using `--sort=name --mtime=@0 --owner=0 --group=0 --numeric-owner`, then emits `SHA256SUMS` and `BUILD_PROVENANCE.json` plus `GATE_A_BUNDLE_SHA256` on stdout. The manifest records parent commits, distinct Source Git blob IDs, per-file SHA256 and explicit **false** operational proof flags. This tar is an OFFLINE CANDIDATE, not an exported Supabase deployment bundle, and the tar hash MUST NOT be presented as an active Edge bundle SHA.

Verify actual candidate handlers:
```bash
npm ci --no-audit --no-fund
deno check --node-modules-dir=auto operator/gate-a/wep-source142-stop-candidate/supabase/functions/wep-preset-artifact/index.ts operator/gate-a/wep-source142-stop-candidate/supabase/functions/wep-scene-preset-product/index.ts operator/gate-a/wep-source142-stop-candidate/supabase/functions/wep-preset-retention/index.ts
node --test tests/wep-gate-a-source142-stop-bundle.test.mjs
npm test
npm run check
BASE_PATH=/web npm run build
```
No GitHub workflow in this candidate performs any deploy or SQL action. The CI upload is an offline artifact only.

## Test scope and limits
- The Handler test dynamically transpiles and executes all three **actual candidate TypeScript** files with withSupabase dependency mocked, a Storage property that throws on ANY attempted access, explicit RPC whitelist (current-session authorization / worker-token verification only), read-only Creator lookup, and refusal of all known and legacy actions. Includes same-key dual Publisher requests, invalid foreign creator/path, revoked session, read signing denial, Worker retry and method/unknown alias coverage.
- This is deterministic **mock SOURCE validation**, not genuine Supabase Edge gateway/JWT/DB/Provider/CDN verification, not deployed SHA readback, not proven storage byte recoverability, and not durable flight drain.
- A network request started before cutover can still be executing in an old runtime; an old signed bearer can remain usable until expiry/cache invalidation. Creating or uploading the tar does not cancel either. Concurrent old Worker/cron leasing, retries, SQL sessions, Vault/non-repository callers, and 21 Edge/7 Cron other issuers require separate independently evidenced quiescence.

## 04 QR / Owner #130 Gate A4–A5 acceptance: **NO GO**
1. Explicit human Operator #130 approval and protected inventory for 21 Edge/7 Cron + Vault/OID/nonrepo caller + background jobs.
2. Complete durable ingress freeze, pending job/lease and in-flight old issuer drain by source/worker/version/replica; real evidence that every old Copy/Remove/Sign route has stopped, including retries.
3. Historical staging116→Source142 NONPREFIX clone and data-preserving semantic SQL/ACL/RLS/triggers parity with backup, PITR, Storage byte-restoration and Legal holds, not automatic SQL append.
4. Operator-controlled deployment of audited inert per-route bundles only after quiescence plan, then **readback of actual deployed per-replica/version Edge bundle hashes** separately from source blob IDs and deterministic tar digest, negative signed A/B/M/Worker test and signed URL absence.
5. Preserve fail-closed rollback to a reviewed inert bundle if parity/migration fails; NEVER restore old positive copy-first handler as an automatic rollback. Gate A read-only reopening is a separate explicitly authorized step.
6. This WEP tar alone neither satisfies Gate A4 nor permits SQL change or real deployment. Gate B Provider immutable CAS/attestation remains NO-GO, Gate C physical cleanup/Privacy/Legal and Cloud remains OFF.

**Unchanged flags:** `SOURCE_FULLY_ENROLLED=0`, `graphComplete=false`, `saveRevisionAuthorized=false`, `retirementAuthorized=false`, `pairedGalleryPublishAuthorized=false`, `physicalCleanupAuthorized=false`; Native DDV Persistent Writer/Product Apply OFF. All changes are isolated under the candidate directory, one build script, test, workflow, and this document.
