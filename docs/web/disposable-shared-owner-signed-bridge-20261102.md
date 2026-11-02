# 08 WEB — Disposable Genuine-Signed Shared Owner Browser Bridge (Phase A)
2026-11-02: DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY; six Owner flags remain OFF.

## Fixed ancestry and scope
Accepted PR299 parent HEAD 6bfa01b3d11bdf50678fa90e54f4771cea5104fa and accepted PR297 HEAD 4743a0b46f88a3797432cd5738da499221f8e055 remain untouched. Historical signed PR290/291, repaired Auth PR294, real Owner PR295/297/299, Source153 and strict WEB267 are reused, not rewritten. Exactly SIX test-only paths: a newly isolated DEV-only Svelte route OUTSIDE protected /dreamsnaps/my/, Chrome runner, Python disposable fixture, source test, workflow, and this contract. No production Owner route, Community Auth, Edge, DB, decoder, PR291, native Writer or managed transport changes.

The new /disposable-owner-signed-bridge/ is guarded by import.meta.env.DEV, two explicit local-disposable environment switches AND the six literal Owner/Source feature flags being OFF. Its production output is Unavailable, never an active Owner screen, and it cannot grant rights. Actual /dreamsnaps/my/manage/ remains unchanged/OFF.

## Reused actual components
Svelte disposable route calls createCommunityBrowserClient (the existing shared Community Session), signInWithPassword/signOut, createOwnerSharedAuthConsumer tokenless subscription with generation/Abort fencing and Work ID validation, createOwnerReadRevalidation with strict PR291 CAS state, and readIsolatedSource153Owner -> existing classifySource153OwnerHttpFixture (WEB267) -> safeSource153OwnerView. Only Kind, Entry, Grant, Public Disabled source-shaped fields can appear in DOM; never Owner authorization, JWT, media, Account ID, storage key or raw DTO.

Accepted E2 signed bootstrap and real GoTrue ES256 issuer/Edge/PostgREST/DB disposable FULL153 are reused. Test-only Python controls signed server withdrawal, never UI action. No Stage116, real user, Provider, CDN or Save Writer.

## Critical transport distinction
The production Shared Auth candidate requires an HTTPS-formatted Supabase URL. The test runner sets an HTTPS-formatted *virtual* test origin, https://wand-disposable-e2.invalid. The Chrome-only Playwright addInitScript maps that exact URL to the already accepted Vite loopback HTTP proxy to disposable GoTrue. Responses are real GoTrue-signed, not mocked, but the test origin rewrite is NOT actual TLS, not a deployed BFF, not managed HTTPS/CORS nor CDN/cache proof. Production source and product transport behavior remain unchanged.

## New-only Phase A acceptance matrix
- Actual A signed GoTrue password login via shared client, actual server-authorized Owner Source153 read, no local claim of Owner rights.
- Invalid Work and B vs A Work denial, separate signed identity and no previously bound projection.
- Actual signed CAS1 -> signed server-side withdrawal -> stale CAS HTTP403 -> sticky neutral recovery and zero automatic resume requests -> explicit Fresh (CAS omitted) -> withdrawn Source-only response.
- Four actual browser-visible Cache-Control, CDN-Cache-Control, Surrogate-Control, Vary and fail-closed negative when CDN-Cache-Control removed in a test-only proxy response.
- Late signed Owner response after local Logout must not restore prior projection.
- DOM has no JWT, email, media identifiers, storage keys or signed URL; all rights/UI actions OFF; test output omits secrets.
- CI guards accepted PR299 ancestry, Source153, WEB267, PR291, shared Auth blobs and all six literal OFF flags with exactly six new test-only paths.

## Evidence classification and release gates
SOURCE_UNIT = static/Node until new CI. SIGNED_LOCAL_SERVER = genuine local GoTrue/Edge only if actual disposable ES256 run passes. BROWSER_LOCAL_PROXY = actual Chrome via HTTP loopback, not production Managed TLS. REAL_GOTRUE_REMOTE_REVOCATION = UNKNOWN until 03 COMM N05-N07 and independent 04 QR. MANAGED_INGRESS I01-I14 / CORS / BFF / CDN = BLOCKED separate operator gate.

Lost cross-tab logout notices, old live clients, pre-expiry JWT revocation and offline authorized read remain unproven; they must fail closed. No Phase B product bridge implementation until 03 COMM actual signed findings, 04 QR new-only audit and operator-authorized isolated managed HTTPS. Never enable product flags or non-idempotent Writer401 replay. Public release NO-GO, no merge or deploy.
