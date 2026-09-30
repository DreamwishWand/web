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
3. **Stable identity + CreatorProfile edit**:
   - call `community-command.ensureAccountCreator`;
   - immediately call `community-query.me`;
   - capture WandAccount ID, CreatorProfile ID and CreatorProfile `rowVersion`;
   - edit handle/display name/bio/profile visibility through `community-command.updateCreatorProfile` using `expectedVersion` + a new idempotency key;
   - call `community-query.me` again;
   - require the same WandAccount and CreatorProfile IDs, with an incremented `rowVersion` and the edited profile fields.
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
7. **A readback / actor switch context**:
   - query the published work through `community-query.work`;
   - confirm the same stable `workId`, published lifecycle, visibility and revision;
   - retain only the target `workId`, A's `creatorProfileId`, current `rowVersion` and later moderation `caseId` in tab-scoped `sessionStorage`;
   - sign out A.
8. **User B interaction path**:
   - sign in as B and run Stable identity for B;
   - query A's target work;
   - Save, Follow A, Like, Comment and Report through the same JWT-authenticated Community Edge command boundary;
   - query B's SavedItems and Notifications;
   - run the negative-authorization probe and require B's `changeVisibility`, `unpublishWork` and `deleteWork` commands against A's work to all fail.
9. **Moderator path**:
   - sign out B and sign in as a staging moderator;
   - apply `restrict` to the Report-created moderation case with a mandatory reason;
   - query the target after restriction;
   - apply `restore` and query again;
   - normal-user invocation of `moderateWork` remains expected to fail because role authorization is enforced inside the server RPC.
10. **Notification convergence**:
   - after the cron/outbox interval, sign in to the relevant recipient account and query Notifications;
   - confirm the expected interaction/moderation deliveries without treating Notification presence as an authorization grant.

## Runtime evidence needed

### VS-02 / VS-12 media portion

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

### VS-01 stable identity/profile-edit portion

- A WandAccount ID before/after profile edit;
- A CreatorProfile ID before/after profile edit;
- CreatorProfile rowVersion before/after;
- edited handle/display name/bio/visibility readback;
- explicit stable-ID PASS;
- stale expectedVersion rejection when exercised.

### A -> B -> moderator product-shaped path

Record only opaque actor labels (A/B/M) plus stable Community IDs:

- A identity round-trip PASS;
- A Gallery publish/readback PASS;
- B target read PASS;
- B Save/Follow/Reaction/Comment/Report PASS;
- B SavedItem query contains the target;
- B owner-mutation negative probe: all three commands rejected;
- Report `caseId` captured;
- normal-user moderation attempt rejected when exercised;
- moderator restrict PASS and target/discovery behavior converges;
- moderator restore PASS;
- relevant Notification queries after cron processing;
- post-test cleanup/tombstone state as required.

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

The Lab is an implementation checkpoint, not acceptance proof by itself. The A -> B -> moderator route is implemented and CI-validated, but no new VS status is promoted until the real browser flow is executed. VS-02/VS-12 remain PARTIAL until a real image completes the browser path above. VS-01 stable-ID/profile-edit backend semantics are CONFIRMED and the Lab path is implemented, but VS-01 remains PARTIAL until that path is executed in the product-shaped browser flow; broader account recovery remains a separate launch requirement. VS-13 still requires a true parallel-session test.

The WEP workstream continues to own Preset payload semantics, compatibility preflight and apply behavior. Community owns the publication envelope, exact revision link, permissions and SavedItem/Library reuse.
