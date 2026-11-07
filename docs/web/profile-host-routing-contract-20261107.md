# 08 WEB — Host-side canonical profile / private library routing contract

**Status:** SPEC_ONLY / DEV_READY candidate / no production changes. `W-ENTITY-016` + `W-FOUND-020` existing parent Tasks; START_QUEUE row31; R12/R13/R19/R21/R25. Fixed parent protected main `01f45bd20ab98da2b6dc7c807738c20592621f47`; cumulative CI `42356509995`, Pages `42356509996` SUCCESS. This document deliberately does **not** create a public route, authenticate any user, move Pages, turn on Community/Writer/Cloud/Provider, or attest managed HTTPS responses. The machine-checkable acceptance matrix is `docs/web/profile-host-routing-contract-20261107.json`.

## Confirmed current source and what it does *not* prove

- `svelte.config.js`: SvelteKit `@sveltejs/adapter-static` with fallback `404.html`, base path `/web` on Pages.
- `src/routes/+layout.ts`: global `prerender=true`, `trailingSlash='always'`.
- `.github/workflows/pages.yml`: produces static `build/`, `build/404.html`, deploys under existing Pages. A SUCCESS build/deployment says nothing about the direct HTTP status of arbitrary dynamic paths.
- `src/routes/[primary=sharedId]/+page.ts`: `prerender=false`. The dynamic route can support client inspection but is **not** static-host HTTP 200/SEO proof.
- `src/routes/creator/+page.svelte`: existing `/creator/?id=...` query-param consumer. Existing `/gallery/?work=...` is another query-only legacy consumer. Preserve both while migration is unaccepted.
- `/users/{handle}/` and `/library/` do not yet have accepted direct-route implementations; no arbitrary-handle SSR endpoint, redirect/rewrite, CDN invalidation, authenticated library projection, or live managed HTTP response is proven. Web-probe accessibility from this execution environment was unavailable; **actual host GET status = NOT_RUN**, not an inferred 404 PASS.

## Chosen immediate host strategy

**KEEP_EXISTING_PAGES_404_FAILCLOSED_NO_NEW_PUBLIC_ROUTES.** Do not add `src/routes/users/[handle]/+page.svelte` as a substitute for genuine host resolution. A missing route's `404.html` SPA fallback must not be counted as an HTTP 200, canonical sitemap, public profile, indexed Work, or a real redirect. Do not insert fake 301 meta-refresh or client-only navigation.

Two conditional implementation strategies remain viable:

1. **Owner-approved SSR/BFF gateway or rewrite-capable host**, preserving the existing Pages root, with server-side handle resolver, current authenticated actor, alias uniqueness/CAS/rollback, effective Rights/Privacy/Consent/Moderation/version, status and cache policy. Required managed negative and positive HTTPS proof before public ON. New hosting/fees require explicit Owner authorization.
2. **Finite explicit public-profile static snapshot** only for each consented exact identity and reviewed revision, with approved visibility, Rights/Version, revocation/CDN purge, no private data in static artifacts, and actual per-route HTTP tests. Not an unrestricted all-accounts or arbitrary-handle solution.

The current GH Pages configuration alone cannot attest either strategy. Choice and deployed response behavior remain a separate Owner Host/Operator Gate. **Do not disable existing Pages.**

## Canonical identity, URL, and permission boundary

The Owner-closed public profile is `/users/{handle}/`: user-chosen **mutable** handle uniquely mapped server-side to immutable Account/CreatorProfile identity. Display name is not an identifier. `/users/` is a reserved namespace, separate from immutable Typed EntityRef Work/Item/Quest/Creator/Preset and the Owner root detail `/{primary-id}/{secondary-id}/{slug?}` (or `/{primary-id}/{slug?}` when valid). Work permalink must never be derived from mutable handle.

03 COMM PR #747 syntax-only candidate parser is **not** uniqueness, Auth/RLS/CAS, alias ownership, public consent, current-user identity or allowed retrieval. Old handle aliases must never be reassigned and may redirect **temporarily (302/307)** only when server proves both principal continuity and current publication. **No 301/308** without a separately proven irrevocable alias and managed redirect. Reserved/Unicode/prototype/double-encoded/mixed-case adversarial handles are denied or explicitly canonicalized by an accepted server decision, not inferred by UI.

`/library/`, `/library/gallery/`, `/library/presets/` are session-dependent private areas. **Distinguish** (1) anonymous/no JWT (target 401), (2) valid JWT belonging to another Account (target 403), (3) explicitly revoked JWT (target 401), (4) expired JWT (target 401), and (5) logged-out invalidated session (target 401). These are five **separate future acceptance rows**, never an `AUTH_OTHER_OR_REVOKED` union. Deny private bytes, shared CDN/browser caching and stale protected responses in every rejected state; target `Cache-Control: no-store` and enforce independent server current-actor Auth/RLS/ACL. A legitimate login/refresh must separately reauthenticate; a revoked/expired/logout token cannot silently gain access. All statuses remain `NOT_RUN` until independently proven on a real managed host. `noindex` is a crawler signal, **not** access control. Do not dump private user state into static Pages/CI. Current `/gallery/my/` should not silently become a permanent redirect.

## Managed acceptance (currently NOT_RUN)

The JSON file enumerates required positive/negative HTTP states: approved profile 200, unknown/private 404, safe verified old handle 302 (and perhaps 307), anonymous private library 401, **valid other Account** 403, **revoked JWT** 401, **expired JWT** 401, **logged-out session** 401 (all distinct), authenticated own library 200 only after current-actor permission. Exact response numbers are **target acceptance contracts**, not observed server responses. For private-resource disclosure checks, reject any private bytes on all denied results even if a front-end shows a login message. Apply 8 locales/320px/200%/keyboard plus actual `curl -i` direct-path checks, HTTPS canonical, slash policy, and separately verified sitemap/hreflang only once data can lawfully be public.

Work positive remains HOLD pending Typed EntityRef canonical and Rights. DreamSnaps voting-phase submission privacy, minors, private official results, old CDN URL invalidation, signed Auth/RLS and rollback must be negative-tested. Every Writer/CommunityPublic/Cloud/Provider/production Flag stays OFF.

## QA and integration / rollback

This PR's **Node synthetic tests audit this contract against current source**; they are not hosted browser/HTTPS proof or independent 04 QR-W approval. 04 QR-W reviews only this source delta for fail-closed status, contract completeness, and no deceptive public positive; QR-S covers 03 COMM handle syntax independently. 09 INT alone can merge accepted documentation/test files into current main; merge is not equivalent to public route enablement. No new `+page` or Pages workflow modifications authorized here.

If later integration is permitted, rollback is to remove only this spec's added files, preserving previous Pages and Collection. Real host-specific implementation has its own Owner Gate, deployment/reversion, cache purge and monitored 200/301/404 acceptance. Next after documented scope: Owner chooses supported host capability and authorizes managed test location; then 03 COMM server identity/Auth/alias and 08 WEB minimal verified route implementation can be independently scoped.

**Blockers:** Host rewrite/SSR deployment and Owner cost authorization UNKNOWN, managed live direct HTTPS NOT_RUN, genuine profile/alias Auth/Privacy/Consent projection NOT_RUN, 04 QR-W independent fixed-HEAD QA NOT_RUN, 09 INT NOT_MERGED. This spec's acceptance does not unblock publication by itself.
