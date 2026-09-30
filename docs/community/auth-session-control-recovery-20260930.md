# Community Auth session-control and recovery evidence — 2026-09-30

Status: **PARTIAL CLOSURE / BACKEND + IMPLEMENTATION PASS**

Staging: `dreamwish-wand-staging` / `ap-northeast-1`.

## Confirmed staging runtime

### Stable account ownership

Support-assisted recovery is runtime-confirmed separately in
`docs/community/account-recovery-runtime-20260930.md`.

That path preserves the WandAccount and its Creator/content ownership while retiring the old
AuthIdentity and binding a newly verified identity.

### Wand session cutoff

Base migration:
`supabase/migrations/20260930070000_community_core_v0_session_cutoff.sql`.

The cutoff exists because provider session revocation does not immediately invalidate every
already-issued access JWT. Wand therefore checks both the verified provider identity and the
Wand-side `sessions_valid_after` cutoff.

Confirmed staging behavior:

- a normal JWT issued after the cutoff is accepted;
- a JWT issued before the cutoff is rejected;
- a later JWT issued after the cutoff is accepted;
- session revocation creates an AuditEvent;
- JWT-required Community Edge adapters reject cutoff-invalid sessions before domain work.

### Session-bound recent authentication

Hardening migration:
`supabase/migrations/20260930075500_community_core_v0_session_bound_recent_auth.sql`.

Recent-auth is **not** derived from JWT `iat`. A refresh token can mint a new JWT without the user
re-entering credentials, so JWT age alone is not a valid step-up proof.

High-risk operations now bind to the verified JWT `session_id` and read
`auth.sessions.created_at` for that exact provider session.

Real PostgreSQL staging tests PASS:

- a two-minute-old provider session satisfies the staging 15-minute recent-auth policy;
- a 30-minute-old provider session is rejected even when the supplied JWT `iat` is current;
- an unknown/mismatched session ID is rejected;
- the legacy `community_authorize_session(..., maxAge)` recent-auth path fails closed with
  `Session-bound recent authentication required`;
- a fresh provider session plus admin role satisfies admin recent-auth;
- the same admin account with a stale provider session is rejected.

This closes the refresh-bypass class: refreshing an old session cannot make it recent again.

Current staging policy keys remain configuration-driven:

- `account_delete_recent_auth_seconds = 900`;
- `support_admin_recent_auth_seconds = 900`.

These are staging defaults, not final production policy commitments.

### Safe first-time identity bootstrap

A real-provider deletion E2E exposed that a genuinely new Supabase Auth user could not reach
`ensureAccountCreator` because normal Wand session authorization correctly required an existing
mapping.

The deployed safe bootstrap contract now distinguishes:

- genuinely new subject -> bootstrap allowed;
- existing active subject -> normal Wand session cutoff required;
- retired subject -> rejected;
- provider-deletion-pending subject -> rejected;
- open-recovery-reserved subject -> rejected.

Real staging DB runtime: **10/10 PASS**.

Detailed evidence:
`docs/community/identity-bootstrap-runtime-20260930.md`.

### Edge authorization

JWT-required `community-command`, `community-query`, `community-media`, and
`community-admin` use `@supabase/server` verified claims.

- actor identity comes only from verified `userClaims.id`;
- normal Community access uses verified JWT `iat` only for Wand cutoff enforcement;
- `community-admin` also forwards verified `jwtClaims.session_id` for high-risk operations;
- admin recovery/provider-cleanup writes are rechecked server-side for admin role + recent provider
  session;
- no client-supplied actor/account field can replace the authenticated actor identity.

Deno Edge Function type checks are now part of CI in addition to the Svelte checks, contract tests,
and static build.

## Implemented product-shaped Auth UX

The internal `/community-lab/` path includes:

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

The internal `/community-ops/` path is also implemented and intentionally absent from public
navigation. It provides:

- admin-only recovery-case listing/open/complete;
- provider-cleanup queue listing and dead-letter requeue;
- outbox dead-letter listing and requeue;
- explicit messaging that high-risk admin writes require a newly created provider session rather
  than a refreshed JWT.

Database runtime for admin operations PASS:

- fresh admin session accepted;
- stale admin session rejected;
- recovery open/list/complete preserves the target WandAccount;
- non-admin operations read rejected;
- recovery listings do not expose requested provider subject;
- provider-cleanup listings do not expose provider subject;
- provider-cleanup dead-letter requeue succeeds and is audited.

## Evidence boundary

This does **not** close VS-01 completely. The first-time identity bootstrap deadlock is closed at the DB/Edge boundary, but public browser/signup/recovery acceptance remains.

Still pending:

1. execute the normal provider recovery email -> browser callback -> password-update path with a real
   staging user;
2. execute all-session revocation with real browser sessions and confirm old-session denial through
   the deployed Community APIs;
3. execute the internal Community Ops route with a real staging admin and capture secret-free
   recovery/dead-letter evidence;
4. finalize support verification procedure and production Auth provider/sign-in policy;
5. finalize production recent-auth thresholds per high-risk action.

No access token, refresh token, password, recovery code, signed URL, provider subject, verification
artifact or API secret is recorded in this evidence file.


## Launch recent-auth defaults

First-launch recent-auth windows are now canonicalized at:

- self-service account deletion: **900 seconds / 15 minutes**;
- support/admin high-risk writes: **900 seconds / 15 minutes**.

These values remain configuration-driven so a future security review can tighten them without
changing RPC contracts. The proof source remains provider session creation time
(`auth.sessions.created_at`), not refreshed JWT age.
