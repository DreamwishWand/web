# Community Auth session-control and recovery evidence — 2026-09-30

Status: **PARTIAL CLOSURE / BACKEND + IMPLEMENTATION PASS**

Staging: `dreamwish-wand-staging` / `ap-northeast-1`.

## Confirmed staging runtime

### Stable account ownership

Support-assisted recovery is already runtime-confirmed separately in
`docs/community/account-recovery-runtime-20260930.md`.

That path preserves the WandAccount and its Creator/content ownership while retiring the old
AuthIdentity and binding a newly verified identity.

### Wand session cutoff / recent-auth primitive

Migration:
`supabase/migrations/20260930070000_community_core_v0_session_cutoff.sql`.

Real PostgreSQL staging tests PASS:

- a current session issued-at value is accepted;
- a 30-second-old session satisfies a 60-second recent-auth window;
- a 120-second-old session is rejected under that window;
- after advancing the Wand cutoff, a pre-cutoff session is rejected;
- a post-cutoff session is accepted;
- revocation creates an audit event.

The cutoff exists because provider session revocation does not by itself make an already-issued
access token disappear immediately. Wand therefore authorizes both the verified provider identity
and the Wand-side session cutoff.

### Edge authorization

The JWT-required `community-command`, `community-query` and `community-media` adapters:

- use `@supabase/server` user authentication;
- derive actor identity only from verified claims;
- read the verified JWT issued-at claim;
- call the server-only Wand session authorization RPC before Community work;
- reject invalid/revoked sessions at the Community boundary.

## Implemented product-shaped Auth UX

The internal `/community-lab/` path now includes:

- password sign-in;
- current-session sign-out;
- all-session revocation;
- PKCE password-recovery request;
- internal PKCE recovery callback;
- recovery password update followed by all-session revocation;
- signed-in reauthentication request;
- password change with reauthentication proof followed by all-session revocation.

Recovery callback:
`/community-lab/recovery/`.

Auth access/refresh session data remains tab-scoped; recovery PKCE state is kept separately and
expires.

Implementation commits are covered by successful type/component checks, contract tests and static
builds. Latest recovery contract push CI: `36680554003` PASS.

## Evidence boundary

This does **not** close VS-01 completely.

Still pending:

1. execute the normal provider recovery email -> browser callback -> password-update path with a real
   staging user;
2. execute the all-session revocation path with real browser sessions and confirm old-session denial
   through the deployed Community APIs;
3. complete the support-verification/operator console and its access/audit UX;
4. finalize production Auth provider mix and exact recent-auth thresholds for each high-risk action.

No access token, refresh token, password, recovery code, signed URL or API secret is recorded in this
evidence file.
