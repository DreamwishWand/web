# 08 WEB — Creator → Community DreamSnaps typed Work route, safe fallback (2026-10-27)

**Existing 08 WEB stream / Issue #214 / new-only child Draft PR #222**, stacked onto PR #215 exact `ca46279f5da996f335ab011b627a4f5b5ba99235`, independently 04 QR #218 Source+Chrome fail-closed accepted. PR #218, parent Source/Chrome artifacts and Gallery PR #105 / Guide #133 / Collection #192 **unchanged**. Draft / DO_NOT_MERGE / DO_NOT_DEPLOY. No staging mutation.

## Confirmed defect and repair

Old Creator Git Blob `28d2305dad36e3be6fb5d9cb394e8be9fa47d589` defaulted all non-gallery/non-question Work types to `/qa/?tip=...`, including `dreamsnap`. This is a confirmed misroute, NOT evidence of a privacy incident.

`src/lib/community/typed-work-route.js` is the sole bounded resolver:
- `gallery` + canonical Work UUID → pre-existing `/gallery/?work=<UUID>`.
- `question` → pre-existing `/qa/?question=<UUID>`.
- `tip` → pre-existing `/qa/?tip=<UUID>`.
- `dreamsnap` + valid Work UUID → **GATED**, safe `/dreamsnaps/` PRODUCT LANDING ONLY with **no WorkID in the link**. User can navigate to the owner canonical `Community DreamSnaps` root, which remains deliberately fail-closed. No invented `/dreamsnaps/community/?work=<WorkID>` positive route is constructed; no fake read receipt/official results/media is rendered.
- unknown Work type, invalid/nil UUID, explicit PRIVATE/UNPUBLISHED/DELETED/RETIRED/unsupported moderation/privacy state → no link, neutral unavailable label. This is a navigation guard, not an ACL decision or alternative to server authorization.

Creator clears stale profile/Works on route change and fences prior in-flight reads. A search document is an untrusted discovery candidate: DreamSnaps cards never render raw title/text and show only localized generic Community label. Personal/private Work must remain suppressed by the source itself; the UI cannot sanitize previously issued URLs/CDN.

Saved inside Gallery My uses typed metadata from `saved.work`; no blind `targetEntityId` → Gallery fallback when type is UNKNOWN or `accessible!==true`. Existing known Gallery DTO `galleryKind` still maps to Gallery. Question/Tip/Gallery direct query parsing denies unknown, duplicate and malformed identifiers before detail RPCs, preserving their existing per-product read services.

Existing `/gallery/dreamsnaps/?work=...` stays inert. A direct `/dreamsnaps/community/?work=...` is **not** a supported Work Detail: at most an authority-pending generic message without WorkID echo, media signed URL, Work claims or phase data. No new UI Positive Work Detail/Signer was activated.

## Evidence/holds

Node tests: `tests/creator-typed-work-route-failclosed.test.mjs` explicit known route matrix and negatives for type, UUID, duplicate query, PRIVATE/unpublished/retired/revoked, Saved, old routes, eight locales, source no media. Chrome: `scripts/creator-typed-work-browser-acceptance.mjs` actual Chrome with **SYNTHETIC intercepted HTTPS** only, 8-locale, 320px/keyboard, explicit fake Creator/Gallery/Tip/Question/DreamSnaps candidates, old URL and invalid query, no real credential, Provider, signed Actor, Media or Staging. `.github/workflows/web-creator-typed-work-chrome.yml` runs only on isolated Owner child branch and stores synthetic results.

03 COMM Source143 account-global official DDV result consent and Source144 F08/F09 effective Work liveness SQL remain owned by Backend PR #216/#220 and QR #217/#221. Source144 positive WAND Work SQL Source/local PG **does NOT authorize** real signed Consumer, current Stage116, revoked old signed URL/CDN or public DreamSnaps Detail. 09 INT X01–X12 cross-product graph still separate. Neither private official rank/reward nor unpublished competition Work should be inferred.

Independent 04 QR: request NEW-ONLY against exact child Owner SHA after final CI/Chrome. Historical accepted QR218 base remains frozen. Do not promote R17 (30 PASS0/PARTIAL12/BLOCKED18) or production capability from source/browser mock evidence; no Publish, Cloud, Native Writer, Apply, physical deletion.
