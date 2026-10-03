# Community Lab v0 — staging product-shaped runtime path

Internal route: `/community-lab/`

This route is intentionally not linked from the public Dreamwish Wand shell. It exists on the Community development branch to exercise the production-shaped browser path without changing the current public GitHub Pages deployment.

## Security boundary

- Browser configuration uses only the Supabase project URL and a **publishable** key.
- User identity comes from a Supabase Auth password session JWT.
- Access/refresh tokens and the publishable key are stored in `sessionStorage`, not persistent `localStorage`.
- Password-recovery PKCE state is short-lived and separate from session tokens.
- Authenticated Community requests enforce the Wand-side session cutoff in addition to provider JWT validation.
- `ensureAccountCreator` is the only first-time bootstrap exception: it uses a dedicated authorizer that permits genuinely new subjects but rejects retired, deletion-pending and open-recovery-reserved provider subjects; existing active identities still use normal session cutoff.
- High-risk recent-auth is session-bound: verified JWT `session_id` is matched to `auth.sessions.created_at`; refreshing an old JWT/session does not reset the recent-auth window.
- Admin support/dead-letter operations live in the separate hidden `/community-ops/` route and are not part of the normal Community command bus.
- No service-role/secret key is present in browser source.
- The browser never supplies `actorAccountId`; the Edge adapter resolves the actor from verified `userClaims.id`.
- Canonical Community tables remain non-enumerable/non-writable from the browser Data API.

## Product-shaped path v0

1. Configure the isolated staging URL and publishable key.
2. Sign in with a staging Supabase Auth user.
   - Local sign-out affects the current session.
   - All-session revocation combines provider-global logout with the Wand session cutoff.
   - Password recovery returns through the internal PKCE recovery route.
   - Signed-in password change can use provider reauthentication.
3. **Stable identity + CreatorProfile edit**:
   - call `community-command.ensureAccountCreator`; first-time subjects use the safe bootstrap authorizer while existing subjects retain normal session-cutoff enforcement;
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
7. **A readback + public discovery**:
   - query the published work through `community-query.work`;
   - confirm the same stable `workId`, published lifecycle, visibility and revision;
   - when the work is PUBLIC, run the no-user-JWT SearchDocument discovery probe and require the same `workId` to appear;
   - when the work is UNLISTED, the same discovery probe must not enumerate it;
   - retain only the target `workId`, A's `creatorProfileId`, current `rowVersion`, stored parent `commentId` and later moderation `caseId` in tab-scoped `sessionStorage`;
   - sign out A.
8. **User B interaction path**:
   - sign in as B and run Stable identity for B;
   - query A's target work;
   - Save, Follow A, Like, Comment and Report through the same JWT-authenticated Community Edge command boundary;
   - retain B's new top-level Comment ID as the parent-comment target;
   - query B's SavedItems and Notifications;
   - run the negative-authorization probe and require B's `changeVisibility`, `unpublishWork` and `deleteWork` commands against A's work to all fail.
9. **Reply notification path**:
   - sign back in as A (or another non-parent-author actor) and run Stable identity;
   - reply to B's stored parent Comment ID through the same `addComment` command using `parentCommentId`;
   - after outbox/cron processing, sign in as B and require the reply delivery to appear in Notifications.
10. **Moderator path**:
   - sign in as a staging moderator;
   - apply `restrict` to the Report-created moderation case with a mandatory reason;
   - query the target after restriction;
   - apply `restore` and query again;
   - normal-user invocation of `moderateWork` remains expected to fail because role authorization is enforced inside the server RPC.
11. **Owner privacy / unpublish / tombstone**:
   - sign back in as A and refresh the target to get the latest `rowVersion`;
   - exercise PUBLIC / UNLISTED / PRIVATE changes as needed and re-run public discovery;
   - unpublish and confirm non-owner direct access is revoked;
   - soft delete and confirm public discovery remains absent while immutable history is preserved by backend contract.
12. **Stale SavedItem + notification convergence**:
   - sign back in as B;
   - query SavedItems after A's privacy/unpublish/delete change and require the reference to remain without becoming an access grant (`accessible=false` where applicable);
   - query Notifications for relevant actors after the cron interval;
   - confirm expected deliveries without treating Notification presence as authorization proof.
13. **Self-service Wand Account deletion acceptance**:
   - use a disposable staging Auth user on the hidden `/community-lab/account/` route;
   - verify a stale provider session returns `RECENT_AUTH_REQUIRED`;
   - sign out and sign in again to create a fresh provider session;
   - type exact `DELETE` confirmation and invoke `community-account`;
   - confirm immediate Wand tombstone/de-identification and local/global sign-out;
   - confirm a private provider-cleanup job is queued;
   - later verify the Vault-worker-token provider cleanup Cron deletes the actual Auth user and completes/anonymizes the cleanup job.

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
- PUBLIC target appears in SearchDocument discovery and UNLISTED target does not;
- B target read PASS;
- B Save/Follow/Reaction/Comment/Report PASS;
- B top-level Comment ID captured;
- A/non-parent actor reply PASS;
- B SavedItem query contains the target;
- B owner-mutation negative probe: all three commands rejected;
- Report `caseId` captured;
- normal-user moderation attempt rejected when exercised;
- moderator restrict PASS and target/discovery behavior converges;
- moderator restore PASS;
- A owner visibility/unpublish/soft-delete path PASS;
- B stale SavedItem remains a reference but not an access grant;
- relevant Notification queries after cron processing, including reply delivery to the parent author;
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

The Lab is an implementation checkpoint, not acceptance proof by itself. The A -> B -> moderator path plus PKCE recovery/re-auth/all-session-revocation UX is implemented and CI-validated. VS-02/VS-12 are CONFIRMED PASS at the backend/network boundary and VS-13 is CONFIRMED PASS through true multi-backend concurrency. Safe first-time identity bootstrap is CONFIRMED 10/10 at the DB boundary and deployed through `community-command`. Recent-auth is bound to provider session creation time rather than JWT refresh time. The separate hidden Community Ops console is implemented for admin recovery, dead-letter and Operations Alert handling. The hidden self-service account-deletion route is implemented; Wand tombstone is CONFIRMED 8/8 and scheduled deletion of an actually existing disposable Supabase Auth user is also CONFIRMED using normal password sign-in after admin fixture creation. Real browser execution remains pending, and normal public signup is still a separate VS-01 item because the staging email provider rate limit prevented treating the deletion E2E fixture as signup acceptance. VS-01 remains PARTIAL until the normal provider/browser identity/recovery path and real admin Ops path are executed.

The WEP workstream continues to own Preset payload semantics, compatibility preflight and apply behavior. Community owns the publication envelope, exact revision link, permissions and SavedItem/Library reuse.
