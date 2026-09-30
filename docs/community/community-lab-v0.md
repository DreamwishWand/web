# Community Lab v0 — staging product-shaped runtime path

Internal route: `/community-lab/`

This route is intentionally not linked from the public Dreamwish Wand shell. It exists on the Community development branch to exercise the production-shaped browser path without changing the current public GitHub Pages deployment.

## Security boundary

- Browser configuration uses only the Supabase project URL and a **publishable** key.
- User identity comes from a Supabase Auth password session JWT.
- Access/refresh tokens and the publishable key are stored in `sessionStorage`, not persistent `localStorage`.
- No service-role/secret key is present in browser source.
- The browser never supplies `actorAccountId`; the Edge adapter resolves the actor from verified `userClaims.id`.
- Canonical Community tables remain non-enumerable/non-writable from the browser Data API.

## Product-shaped path v0

1. Configure the isolated staging URL and publishable key.
2. Sign in with a staging Supabase Auth user.
3. **Stable identity**:
   - call `community-command.ensureAccountCreator`;
   - immediately call `community-query.me`;
   - confirm the same WandAccount/CreatorProfile IDs.
4. **Validated media**:
   - choose JPEG/PNG/WebP;
   - call `community-media.prepare`;
   - browser PUTs the file to the returned signed upload URL with Supabase-compatible multipart semantics;
   - call `community-media.finalize`;
   - server downloads the object, detects image signature/dimensions and calculates SHA-256 before READY registration;
   - call `community-media.read` and render the 300-second signed read URL.
5. **Gallery draft**:
   - create an UNLISTED draft by default for lab safety;
   - capture `workId` + `rowVersion`.
6. **Immutable publish**:
   - publish with the finalized `mediaId`;
   - use Gallery publish v3 only;
   - use the draft `rowVersion` as `expectedVersion`;
   - no Preset link is required for this first media-path proof.
7. **Readback**:
   - query the published work through `community-query.work`;
   - confirm the same stable `workId`, published lifecycle, visibility and revision.

## Runtime evidence needed to close VS-02 / VS-12 media portion

Record, without storing passwords/tokens:

- browser timestamp;
- test account identifier as an opaque label only (A/B, not email);
- source file name, MIME, byte size and local SHA-256 if available;
- prepare HTTP PASS;
- signed upload HTTP PASS;
- finalize HTTP PASS;
- server-detected MIME + dimensions + SHA-256;
- returned MediaAsset ID;
- signed read HTTP/image render PASS;
- Gallery draft workId/rowVersion;
- publish revisionId/new rowVersion;
- authorized work readback PASS;
- post-test cleanup status.

Never copy access tokens, refresh tokens, publishable-key input values, signed upload tokens or signed read URLs into canonical project docs.

## Expected failure cases

The Lab should surface normal API failures rather than bypassing them:

- unsupported MIME;
- byte-size rejection;
- malformed/non-image bytes;
- expired/invalid Auth session;
- missing media on publish;
- foreign/non-owner media;
- stale `expectedVersion`;
- private/unpublished access denial.

## Current boundary

The Lab is an implementation checkpoint, not acceptance proof by itself. VS-02/VS-12 remain PARTIAL until a real image completes the browser path above. VS-01 remains PARTIAL until the product-facing Creator edit/recovery lifecycle is exercised. VS-13 still requires a true parallel-session test.

The WEP workstream continues to own Preset payload semantics, compatibility preflight and apply behavior. Community owns the publication envelope, exact revision link, permissions and SavedItem/Library reuse.
