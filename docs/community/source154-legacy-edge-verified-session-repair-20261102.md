# Source154 legacy Edge authorization — isolated incremental repair

Date: 2026-11-02. P0a source repair child of PR314 exact red test head `e1dfb27ab0cdf1e9673880308d19c107c1df6ac1`.
DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY. Stage116, managed ingress, real users, external providers, and six owner flags unchanged. PUBLIC NO-GO.

## Reproduced real signed RED before patch
PR314 genuine local GoTrue ES256 FULL154 run 41445562411 (test branch): after signed A1 Local terminal revoke, legacy `community-query/me`, `community-query/myDreamsnaps`, and `community-command/createDdvProfileWorkspace` independently returned HTTP200 while live A2 also returned200. This proves old Edge paths lacked the Source154 per-session tombstone check. The first harness stopped at media header assertion; final full legacy matrix is run separately. Initial direct SQL coverage and all downstream side effects were not yet proven at that cut.

## Code delta and security contract
Existing Source154 `community_authorize_signed_session_v2` checks GoTrue-owned `auth.sessions`, active Account/Identity and the immutable session tombstone. Add an explicit trusted-JWT-claims service-role RPC preflight on six existing Edge paths:
`community-query`, `community-command`, `community-media`, `community-admin`, `wep-preset-artifact`, and `wep-scene-preset-product`. Only `ctx.userClaims.id`, `ctx.jwtClaims.iat` and `ctx.jwtClaims.session_id` are forwarded. Never accept identity/session parameters from request body. Old Account/global authorization and existing command schemas remain as a second gate, not an alternative to signed-session verification.

Signed tombstone failure always maps to HTTP401 without passing internal SQL error text. The Source154 SQL, X05 verifier, all historical migrations, Shared Auth, WEB267, and feature flags remain byte-identical. This patch does not enable physical uploads, publisher grants, Native Apply, or unreviewed Admin operators.

## Explicit limitations
- The existing bootstrap command `ensureAccountCreator` previously allowed identity bootstrap before a Wand Account existed. Source154 `community_authorize_signed_session_v2` requires an active Wand identity; this conservative repair therefore **fails closed for genuinely unbootstrapped accounts**, and a dedicated bootstrap-safe verified-session contract is required before activating enrollment. This is a release blocker, not a finished user journey.
- A service-role Edge preflight and later downstream service-role RPC are not a single atomic transaction. Writer in-flight/revoke interleavings beyond the separately audited Source150 X05 private verifier remain UNKNOWN. Late private response caching and double-check, and direct authenticated PostgREST legacy RPCs need independent per-route acceptance. No blanket all-Writer/Media issuer revocation claim.
- GoTrue `auth.sessions` remains provider-private schema with future upgrade and migration/restore compatibility UNKNOWN; Managed HTTPS/BFF/CORS/CDN I01–I14, old browsers and logout sequencing unaccepted.
- QR must assess new signed rerun vs the exact RED and classify every path by actually completed authenticated privilege. A 409 from disabled Scene product or 403 from unrelated preset validation is not a proven privilege refusal.

The patch is a confined fail-closed security candidate, not public release acceptance.
