# 08 WEB X05 — Source151 private Pre-Grant consumer, inert contract adapter
Date: 2026-10-28 JST. Same 08 WEB stream. Target: SOURCE-ONLY PREGRANT_CONSUMER_READY / LIVE_BACKEND_DISABLED / NEED_POLICY_ARTIFACT / 04QR_SOURCE151_PENDING.

## Frozen sources

- 03 COMM Source151 Draft Owner PR253 exact HEAD `9c96de3e1f003c160beffc0395dfbe35314dff3d` based on frozen Source150 PR249 HEAD `4117d98666a3c3c2ae5891c043e9a83756f92fdc`, Source151 SQL blob `451735e05b6a18c826851a51000909c40c42bb9f` and Owner Edge blob `1a05cdc540a45fe1b1656d64a151d1c1ca28c8be`. Owner ordinary CI `40678615074` and disposable real FULL151 2-PG dedicated CI `40678615144` SUCCESS. **Source151 independent 04 QR PENDING** at this handoff; no real Stage-signed actor, session, policy approval or Media evidence. Separate legacy migration-count auto-workflow failed hardcoded predecessor; it is not the new Source151 dedicated receipt.
- Earlier Source150 independent QR250 SOURCE_LOCAL_PASS final `f83bad74701241a54bf1a8a2e41dac3af7304722`; WEB248 independent QR251 SOURCE_MOCK_PASS final `a81476c9a51e03591813ddb9b9de83fbadea2e2d`; WEB245 QR247 fixed. WEB252 Source150 strict Adapter Owner fixed `c80b48336fa6b0f5de9afd24b452387116f283f4` has Owner dedicated CI `40678462679`, normal `40678462704` PASS, **independent QA on WEB252 not yet seen**. Do not duplicate prior QA or alter their accepted files.

## Actual Source151 wire contract, separate from postgrant Source150 and WEB248

Source151 appends `operation:"pregrant"` to the existing `POST /functions/v1/community-dreamsnap-owner` Edge (same verified-JWT bearer actor bound by PostgREST, `private,no-store`). Exact request body is `{operation:"pregrant",workId:<UUID>}`, **without** user-provided AccountID, SubjectID, policy acceptance or media signer key. Wrapper success schema:

```text
{
 ok:true,
 operation:"pregrant",
 contractVersion:"wand.dreamsnaps.owner-management-service@1",
 data:{
  contractVersion:"wand.dreamsnaps.pregrant-service@1",
  state:"NEED_POLICY_ARTIFACT"|"PREGRANT_READY",
  ownerAuthorized:true, authenticatedAccountBound:true,
  workId, kind:"OriginalCompetition"|"PostEventCreation",
  creatorProfileId, challengeId, photoRevisionId, photoMediaId,
  // Original ONLY: entryId and frozenEntryRevisionId==photoRevisionId
  workPhotoBindingVerified:true, mediaOwnershipVerified:true,
  originalImageImmutable:true, expectedRowVersion:0, expectedAuthorizationEpoch:0,
  grantRecorded:false, publicActivationAllowed:false,
  officialChallengePhaseVerified:false,
  policyReceipt: {policyVersionText, policyDigest, scopeId, canonicalText}, // ONLY PREGRANT_READY
  grantAvailable:false|true,
  erasure:{state:"NOT_REQUESTED",physicalPurgeVerified:false,publicDisabled:boolean}
 }
}
```

The outer `contractVersion` intentionally remains Source150 Service@1 even though inner data is Source151 PreGrant@1, **not** Source150 postgrant owner read or WEB248 Consumer@1. Backend Source151 SQL ensures the Work is actually owned by JWT-bound active Account and Creator, no Source149 Control/Consent/Purge, actual eligible and self-attested unedited frozen photo, matched owned READY Media, age/privacy/moderation gate and Original Entry vs private STAGED no-Entry PostEvent. This is DB relational evidence only, not independently signed official DDV Challenge phase or rights-holder permission. The frontend may validate syntactic UUID and typed statements but **cannot** claim these server proofs from locally supplied Mock objects.

`NEED_POLICY_ARTIFACT` is the expected **actual current** state for registered eligible Work because Source151 policy registry is intentionally empty; `policyReceipt` must be absent, `grantAvailable=false`. `PREGRANT_READY` requires an actual independently approved immutable canonical policy text length20..16000, exact `vN` version, SHA256 digest, scope `wand.dreamsnaps.creator-photo-grant@1`, recorded Owner approval reference and controlled private registry activation. The Source151 response omits the internal approval reference and sends only typed policy receipt; the adapter must never invent true Owner approval from a mock. No live real policy text/version/digest has been provided or seeded, so **first Grant remains blocked**. Source151 two-PG synthetic test single initial `CAS(0,0)` winner after fixture-only synthetic seeded policy does not authorize production Policy or Creator consent.

## New-only 08 WEB static adapter

`src/lib/dreamsnaps/source151-private-pregrant-adapter.js` imports the existing frozen Source150 contract discriminator but does not edit WEB252. Strict allowlist: versioned wrapper+inner, self-owner bind flags, immutable Work/Photo/Media/Creator/Challenge identifiers, Original Entry pair or PostEvent no Entry keys, `expectedRowVersion=0` and `expectedAuthorizationEpoch=0` distinct from positive Source150 postgrant CAS, no recorded consent/public activation/external official-phase evidence, and canonical policy receipt is present **only** when state PREGRANT_READY. For the absent current policy: returns `NEED_POLICY_ARTIFACT`, no policy text, no data. For positive-looking synthetic policy fixture: returns `PREGRANT_CONTRACT_CANDIDATE_ONLY`, no policy text, Owner Read claim, image grant receipt, media ID, JWT or action. Invalid/malicious/unexpected keys -> `SOURCE_CONTRACT_REJECTED`. All calls to `createSource151PregrantConsumer().pregrant()/acceptGrant()` return `BACKEND_UNAVAILABLE`; exported capabilities are all false. No HTTP, JWT, Storage, CDN, image signing, owner grant, publishing, deletion or UI changes. Source150 strict postgrant decoder remains unchanged and failclosed.

Synthetic HTTP helper: 409/412 -> `REFRESH_REQUIRED`, clear old data, no auto replay; 401/403/404/410/503 and all non-200 -> `BACKEND_UNAVAILABLE`. Mock 200 still requires private,no-store, CDN/Surrogate no-store, `Vary: Authorization`; stale SPA generation -> `STALE_RESPONSE`. Client Request Generation is separate from DB authorizationEpoch and zero pregrant CAS. No browser session or signed Stage used.

## Next engineering gates

1. 04 QR Source151 **independent NEW-ONLY full151** exact PR253 HEAD and genuine two-PG negative acceptance, no Source150/149 replays.
2. 04 QR new-only this WEB Source151 adapter exact Owner SHA once Owner CI GREEN; no WEB252/248/245 Chrome or Source151 SQL QA repeated.
3. 03 COMM controlled real Owner-approved policy text/digest/approval evidence and verified active registry (NO invented consent), authenticated registered Work/Photo/Media at real runtime, owner service contracted pregrant/read/initial Grant+CAS verified signed actors A/B/moderator and cache/Privacy/incident, then 09 INT cross-branch reconciliation on fixed Heads.
4. WEB follow-on: only after genuine signed actor+Owner policy and independent QR may design owner-facing pregrant UI and typed canonical Policy text display/grant consent. Live feature remains OFF; no positive Public Detail, Media Signer, Share, Publisher, physical purge, external Challenge Phase until separately accepted.

Operator A0–A7 HUMAN NO-GO; Provider B HOLD/CAPABILITY_BLOCKED; physical C NOT_AUTHORIZED, graphComplete=false; R17 Product Tree30 PASS0/PARTIAL12/BLOCKED18 and human gates; public launch NO-GO. All PRs Draft DO_NOT_MERGE DO_NOT_DEPLOY.
