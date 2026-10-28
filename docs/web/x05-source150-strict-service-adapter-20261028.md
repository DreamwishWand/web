# 08 WEB X05 — Source150 Service@1 to WEB248 Consumer@1 Strict Adapter
2026-10-28. EXISTING 08 WEB STREAM. DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY.

## Evidence and status

03 COMM Source150 Owner PR249 frozen `4117d98666a3c3c2ae5891c043e9a83756f92fdc`; Source150 migration blob `85e9de1874ca489133fd39be522f57ee1cfac6ab`, Edge blob `6315ba37d285a2646a3dd56dd796572fc1d3bedf`. Independent 04 QR Source150 PR250 final `f83bad74701241a54bf1a8a2e41dac3af7304722`: SOURCE/LOCAL two actual disposable PG PASS, **no real signed actor Stage**.

WEB248 frozen PR248 Owner `e2e965c113fd2fc651b81a21e82b90f1c26d1090`, independent QR251 `a81476c9a51e03591813ddb9b9de83fbadea2e2d`: SOURCE/MOCK PASS; WEB245 Owner and QR247 UI accepted limited synthetic Chrome remain unchanged. The Source150 SQL/Edge and WEB248 Type modules sit on **different unmerged branches**; no integrated owner HEAD, deployment, real HTTP/Session or public activation.

This additive adapter must not act as a trust root. It validates synthetic `wand.dreamsnaps.owner-management-service@1` read/action envelopes using strict exact keys and fails closed. It **cannot** produce WEB248 `wand.dreamsnaps.private-owner-consumer@1` Owner projection from actual Source150 payload; no `ownerAccountId` or other missing proofs are filled by route/actor Context. All successful-looking locally mocked envelopes return `NEED_BACKEND_PROJECTION` with `snapshot:null`, `ownerReadVerified:false`, `actionsEnabled:false`.

## Field-exact matrix

| Source150 flat authenticated Owner projection | WEB248 nested Consumer candidate | Handling |
|---|---|---|
| envelope ok:true + operation read + contractVersion owner-management-service@1 + data | nested private-owner-consumer@1 | Validate only. No direct alias/cast |
| action data:{result,owner,publicActivationAllowed:false} | fresh Owner snapshot after mutation | Strict envelope with no positive mutation claim; new authoritative reread needed |
| workId,creatorProfileId,kind,challengeId | work.workId,creatorProfileId,kind,challengeId | Validate strict UUID/type; WorkID only route ID |
| photoRevisionId / photoMediaId | work.photoRevisionId / work.mediaId | Explicit identity mapping, never upload/signature authority |
| conceptRevisionId / concept | work.conceptRevisionId / work.conceptText | Validate; Concept not frozen photo |
| Original entryId+frozenEntryRevisionId matching photoRevisionId | Original Entry pair | Required. PostEvent MUST OMIT both keys even if null; no ranks |
| rowVersion+authorizationEpoch | authority.rowVersion+authorizationEpoch | Positive safe integers, independent; requestGeneration/latestGeneration SPA race fence separate |
| ownerAuthorized,true+Account/Identity active+Privacy false etc | authority booleans | Validate emitted claims only; **not** browser/session verification |
| imageGrant.policyVersionText | grant.policyIdentifier TEXT | Opaque, preserve exact spelling including `00003`; never Number()/parseInt() |
| imageGrant.policyVersionOrdinal | NO equivalent policy identifier | Optional strict vN-derived UI ordinal only; never substitute for TEXT |
| imageGrant.consentRevision | grant.consentEventVersion | Last Source149 **grant** event_version, not Work rowVersion nor authorizationEpoch |
| imageGrant.workId,state | grant.workId,state | Validate; imageGrant.mediaId/selfCapture/grantAcceptance/scopes NOT in wire |
| erasure.state,providerStatus,publicDisabled,physicalPurgeVerified | deletion.controlState,raw purgeState,publicDisabled,providerVerificationAccepted,purgeScopeComplete,legalHold | No authoritative controlState/complete Provider+Cloud+CDN/hold booleans. NOT equivalent to MEDIA_PURGED |
| Source150 intentionally **NO** ownerAccountId | work.ownerAccountId WEB248 mandatory | NEED_BACKEND_PROJECTION; cannot fill from URL, local browser profile, JWT-looking string or synthetic context |
| Photo/Media constraints checked internally SQL, no explicit certification in payload | authority.photoBindingVerified,mediaOwnershipVerified WEB248 mandatory | NEED_BACKEND_PROJECTION, server-only evidence required |

Full `SOURCE150_MISSING_AUTHORITY` list is exported from the new adapter and returned unchanged on valid mock payload: work.ownerAccountId, authority.photoBindingVerified, authority.mediaOwnershipVerified, grant.mediaId, grant.creatorSelfCaptureDeclared, grant.explicitGrantAccepted, grant.scopes, deletion.controlState, deletion.providerVerificationAccepted, deletion.purgeScopeComplete, deletion.legalHold.

Source150 `MEDIA_PURGED` is scoped to local Source149 provider receipt + Media purged_at and public-hidden, **not** independent Provider/Cloud/CDN/previous signed bearer full-scope erasure. `REQUESTED`, `provider_pending`, `provider_reported`, `LEGAL_HOLD` and Source150 service `MEDIA_PURGE_PENDING` must never be elevated to verified full physical deletion. Source150 can suppress present public readers but cannot retroactively revoke already-issued signed URL or CDN caches.

## Error, cache, CAS, and SPA mock-only contract

- Source150 actual HTTP: POST `/functions/v1/community-dreamsnap-owner`, Edge with verified Supabase JWT auth:user, signed subject must match DB `auth.uid()`; request never accepts AccountID or SubjectID. **No network transport is implemented in WEB.**
- 200 success-shaped synthetic DTO: strict Source150 version, flat provenance, safety state and cache headers; still `NEED_BACKEND_PROJECTION`, no owner read accepted.
- 401/403/404/410/503 (also 500, malformed): `BACKEND_UNAVAILABLE`; clear prior Owner view.
- 409/412: `REFRESH_REQUIRED`; `clearPriorSnapshot:true`, `autoRetry:false`. Future Owner caller must make a fresh server-authenticated read and re-check rowVersion/authorizationEpoch; never auto-replay consent/delete.
- 200 missing `Cache-Control: private, no-store`, CDN/Surrogate no-store or `Vary:Authorization`: `UNSAFE_CACHE_POLICY`; no private cache inheritance. Header check is a synthetic **guard**, not observed production proxy behavior.
- `requestGeneration !== latestGeneration`: `STALE_RESPONSE` regardless of backend success-looking payload. Current SQL `authorizationEpoch` is a separate, monotonic server-side authorization fence; Client Generation is **not** a DB Epoch.
- No optimistic 2xx consent, publish, delete, physical purge or signed URL success state is emitted.

## Needed 03 COMM source contracts (WAIT_BACKEND_PROJECTION / WAIT_PREGRANT_BOOTSTRAP)

1. Authenticated, least-privilege, fresh **server-derived ownerAccountId binding** or a negotiated redesigned Consumer@2 that removes raw AccountID and verifies owner proof server-side (preferred to minimize raw Owner ID). Do not send `ownerAccountId` by arbitrary client context.
2. Proven photo revision and owned Media relation; explicit grant-to-immutable MediaID and Source149 self-capture/grant acceptance/scopes with active consent-event provenance; no guessed bool.
3. Authoritative Control State and separate Provider/Retention/Cloud/CDN purge completion scope + legal-hold truth. If full proof is unavailable, expose `publicDisabled` or `MEDIA_PURGE_PENDING` only and negotiate narrower restricted Consumer DTO; never claim MEDIA_PURGED.
4. Authenticated PRIVATE Pre-Grant Owner read of real registered Work/Entry/Photo/Media/Challenge **without Source149 control row**; controlled policy registry seed and signed owner-facing version/digest receipt, exact first Grant CAS(0,0). Source150 read currently fails absent Source149 control/latest grant and registry remains intentionally empty. Must not invent a policy receipt, consent, screenshot, session or approval.
5. Field/versioned return, fresh current rowVersion/authEpoch, strictly isolated signed actor A/B/Moderator and real no-store Edge/DB QA, trusted errors/reload after CAS, no external public API; 09 INT to re-crosswalk after a new Source Owner HEAD.

## Tests and boundaries

New-only Node fixture is pure, negative-first: precise photoMediaId→mediaId and Concept lineage, Original vs PostEvent Entry proof, TEXT preserved, last Grant consentRevision vs rowVersion/epoch, wrong/retired/Privacy/owner, forbidden injected AccountID/Media/signer, stale SPA/CAS, PUBLIC_DISABLED/hold/requested/pending vs Source150 local MEDIA_PURGED missing Cloud proof, status 401/403/404/409/410/412/503 and private no-store headers, no Browser transport. Source-only CI checks exact changed paths against WEB248 final Owner SHA, static Svelte/build. Do NOT rerun WEB248/QR251, WEB245/QR247, Source150/QR250 or prior Chrome. Preserve all existing UI action flags OFF.

Target only after final Owner HEAD + dedicated and ordinary CI green: `PRIVATE_OWNER_SERVICE_ADAPTER_SOURCE_READY / LIVE_BACKEND_DISABLED`. Independent 04 QR new-only required; not integrated, not Production, not signed real Actor or public Work acceptance. Operator A0–A7 NO-GO; B HOLD; C NOT_AUTHORIZED. Release R17 30 PASS0/PARTIAL12/BLOCKED18+7 governance gates; graphComplete=false.
