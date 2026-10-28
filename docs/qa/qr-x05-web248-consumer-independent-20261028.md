# 04 QR — WEB248 independent private consumer mock source acceptance (2026-10-28)

**Decision at independently executed Source/Mock test-code SHA `978f145e6f60fe35998d3bba82fc6cdfb9f56f11`:** bounded `INDEPENDENT_WEB_PRIVATE_CONSUMER_CONTRACT_SOURCE_MOCK_PASS`. **No live HTTP backend or Source150 wire/E2E acceptance.** DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY; public release NO-GO.

## Frozen independent scope

- Owner [08 WEB PR248](https://github.com/DreamwishWand/web/pull/248) HEAD `e2e965c113fd2fc651b81a21e82b90f1c26d1090` exactly; base prior UI Owner PR245 `50a8bd4812df2c9caff04d0a26b58d28042943ab`. The four new Owner paths are private consumer pure JS, Owner's own mocked Node test, source doc, and dedicated workflow. No prior accepted WEB245/QR247 source/Chrome rerun.
- Independent [Draft QR PR251](https://github.com/DreamwishWand/web/pull/251): new QA-only `tests/qr-x05-web248-consumer-independent.test.mjs`, `.github/workflows/qr-x05-web248-consumer-independent.yml`. No Owner `src/`/Supabase changes.
- Independent [dedicated push CI40675325762](https://github.com/DreamwishWand/web/actions/runs/40675325762) **SUCCESS**, Node **8/8 PASS/0 FAIL** at tested QA HEAD. Independent [dedicated PR CI40675569626](https://github.com/DreamwishWand/web/actions/runs/40675569626) **SUCCESS**. Ordinary PR CI40675569698 SUCCESS. Do not substitute Owner CI40670649588 or Owner dedicated40670649567 for independent evidence. Final evidence-only HEAD CI to be recorded separately after readback.

## Independent tests

- Exact immutable WorkID, verified OwnerAccount context/CreatorProfileID, Challenge, PhotoRevisionID/MediaID, ConceptRevisionID and only OriginalCompetition requiring EntryID plus Frozen Entry Revision matching Photo. PostEventCreation strictly Entry-free; no URL/Storage/bearer tokens allowed.
- Opaque policy TEXT (including **'00003'**), no Number/parseInt conversion; consentEventVersion 3, Work rowVersion 7, authorizationEpoch 11 and SPA generation 19 independent. Increment/epoch spoofing and foreign/retired Identity, privacy, moderation and wrong Media/Creator rejected.
- HTTP 409/412 classified `REFRESH_REQUIRED`, clear prior snapshot, autoRetry=false; 200 is `AUTHORITATIVE_REREAD_REQUIRED` rather than optimistic success.
- P03: requested/provider_pending/provider_reported cannot become MEDIA_PURGED. Verified synthetic DTO requires proof flags and no legal hold; this represents proposed shape, **not a provider receipt**.
- `PRIVATE_OWNER_BACKEND_ACTIVATED=false`, every capability false, no transport call, zero `fetch` attempted even with caller-supplied fake session; no signer, provider, published output or native writer.
- Source150 implemented service discriminator `wand.dreamsnaps.owner-management-service@1` is **not** same as WEB248 proposed `wand.dreamsnaps.private-owner-consumer@1`. Decoder rejects the former directly; no silent integration/compatibility claim. 09 INT must define a separate validated read/action adapter with grant-event consentRevision semantics.

## Remains UNKNOWN / OFF

Actually signed JWT, authorized runtime Owner service, real Work/Media/Storage, real HTTP response/error headers, Player save, saved/share/comments, Public Work Detail, Publisher, Signer, CDN, Provider purge, Stage and full cross-product integration. No Source141–149 reacceptance, no Chrome rerun for QR247. Gate A0–A7 HUMAN NO-GO, B HOLD, C physical NOT_AUTHORIZED; R17 Product Tree30 PASS0/PARTIAL12/BLOCKED18 plus7 human gates; graphComplete=false; Public Release NO-GO.
