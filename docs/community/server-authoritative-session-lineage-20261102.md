# 03 COMM — Session lineage / local versus global revocation contract (TEST ONLY)

2026-11-02. Independent disposable ES256 test fixture; PR288 fixed ancestor 1755d2f37f08bb93604d1839245f8565cf603916. No Source153/WEB267/SharedAuth/Owner product modification. All affected work remains Draft, no merge/deploy.

## Evidence boundary

QR Issue121 #6571260975 confirmed genuine local GoTrue Local and Global Logout HTTP204 while the exact same unexpired access JWT still yields Source153 HTTP200. Refresh fails HTTP400. A separately advanced existing database auth_identities.sessions_valid_after cutoff changes Source153 old-JWT result to HTTP401. This is not evidence of global provider session revocation and is not a privilege bypass of current DB policy.

## Intended server-authoritative contract, NOT implemented

The server must bind a verified, genuinely signed JWT subject and session_id to its current Wand Account and Work permissions on every private read and write. The session_id must originate in trusted verifier claims, never client JSON, unverified local JWT parsing, BroadcastChannel or storage. Account-wide sessions_valid_after must NOT be reused for a local-scope logout.

LOCAL A1: terminally mark exactly the verified (subject A, session_id A1) revoked. A1 and any later refreshed JWT carrying the revoked session_id are denied. Independent A2 and B/M sessions remain available subject to their own Work permissions. A late refresh or response cannot undo terminal revocation. Unknown/unregistered sessions fail closed, with server-controlled enrollment only.

GLOBAL A: atomically revoke every existing A session including unknown historic Access JWTs, via a trusted Account-wide epoch/cutoff plus explicit session lineage where required. B/M unaffected. A3 minted after cutoff may be newly registered and recognized, but must not inherit old A session rights. Because GoTrue-issued iat has one-second precision, epoch/cutoff ordering needs server-proven issuance boundaries; a naive future cutoff can reject legitimately new logins in the same second.

Partial fail / offline: Client can clear only its own memory. If DB terminal revocation is unconfirmed, never claim remote access token invalidated. If GoTrue Logout204 but Wand DB cutoff fails, still-unexpired access JWT may be accepted by current Source153. Do not enable private Owner UI or mutation. Use an authenticated idempotent terminal logout request, not a replay of a non-idempotent Writer401. Pending requests must recheck rights before a sensitive commit; an earlier positive read does not confer durable authority. Preserve PR291 manual Fresh/403 CAS, current policy/consent/privacy/identity checks, and private no-store cache headers with Authorization and Origin Vary.

IMPORTANT: current Source153 calls community_authorize_session with verified subject and JWT iat, but this existing function has no per-session session_id input. A future guarded Source153 request needs a separately reviewed signed subject+session identity contract. The proof TEMP table described below does not create it.

## Disposable execution plan and acceptance labels

The new test runs immutable PR288 E2 fixture with only an in-memory insertion and a PostgreSQL TEMP session table scoped to that one local connection. It uses actual GoTrue ES256 A1/A2/B/M sessions and actual unchanged Source153 HTTP. It demonstrates L01 active signed independent sessions, L02 missing/mismatched session denies at the TEMP gate, L03 A1 local revoke without touching account-wide cutoff while A2/B/M remain active, L04 continued Source153 A1 HTTP200 because test gate is NOT connected to Source153, L05 terminal session denial survives logical refresh, L06 global A local-model revoke preserving B/M, L07 continued Source153 A2 HTTP200 until separate DB global cutoff, L08 explicit existing database cutoff yields old A HTTP401 pre-expiry, L09 new A3 minted after cutoff can read Source153 yet must be explicitly enrolled before TEMP gate trusts it.

TEMP gate evidence is MODEL-ONLY; its simulated allow/deny is NOT a real HTTP status and no token signature is verified by the temporary table itself. Source153 real HTTP receipts remain separate. Work/Policy/Privacy/Consent inherited PR288 tests are not reaccepted as new. Suspended old-code browser tabs, managed HTTPS ingress/CORS/CDN, and actual production source per-session gating remain UNKNOWN/RUNTIME_REQUIRED. Additional source schema/API/Auth changes require their own isolated contract and signed QA gate, not automatic enablement.

Test files must emit only case labels and HTTP codes; no JWT, Refresh Token, UUID, user email or signer bytes. Local ephemeral signer and FULL153 stack destroyed with supabase stop --no-backup and runner disposal, with cleanup described only as attempted. Stage116, external Provider, managed ingress, real user data, Native Writer and all Product Flags remain untouched. Draft / DO_NOT_MERGE / DO_NOT_DEPLOY; Public NO-GO.
