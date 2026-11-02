# DDVRE / 08 WEB — Post-PR301 Owner Runtime Authority Gate (Phase B DESIGN ONLY)

Date: 2026-11-02. Status: PROPOSED_CONTRACT / NONPRODUCTION / DEPENDENCY_BLOCKED.
DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY / PUBLIC NO-GO. This document is not approval for Source/Owner production changes.

## 1. Frozen inputs / evidence classification

- Fixed parent: independently accepted DEV-only PR301 HEAD 9b690eec4a8a391f7ff9f880683b7f718cda2a37, 04 QR Issue #121 comment #6571288241. Real local GoTrue ES256 -> Source153 -> Chrome via test-only HTTP Vite proxy and virtual HTTPS/public-alias translation. This does NOT prove managed TLS, BFF, CORS, CDN, or production publishable key. The PR301 disposable route and product /dreamsnaps/my/manage/ must remain separate.
- Independently reviewed 03 COMM PR304 HEAD 9bff94079b4437683cf92b9c6a198955c605d04d, QR Issue #121 comment #6571260975: genuine local GoTrue local/global Logout returns HTTP204, but the SAME still-unexpired signed Access JWT continues to return Source153 OwnerAuthority HTTP200. Old Refresh returns400. Explicitly advancing local DB auth_identities.sessions_valid_after produces Source153 HTTP401 for that old JWT. CONFIRMED_SIGNED_LOCAL for that exact Actor/Work/session; NOT a production bypass finding or general session revocation guarantee. PR304 AGGREGATE PARTIAL due malformed, unexecuted secondary test workflow (incorrect 3-file guard vs four changed files).
- Existing PR298 real Chrome with synthetic HTTP: denied localStorage logout notice leaves other already-running tab holding A's client candidate until cold reload. BroadcastChannel rescue was harness-only, not production delivery/revocation proof.
- Accepted PR297/299/301 and all six Owner flags stay fixed/OFF. No modification of Shared Auth, PR291, Source153 SQL/Edge, WEB267, Source DTO, auth provider, managed ingress, Writer, Native Apply. This design is independent of 03 COMM's ongoing server contract proposal; no server API names or fields are being imposed.

## 2. Non-negotiable trust model

C = Client credential candidate: current Community session/getValidSignedSession()/expiry; not proof of active server session, ownership, rights, policy or revocation.
N = Best-effort tokenless notification: subscribeSession, localStorage StorageEvent and optional future BroadcastChannel; invalidate-only hint; delivery to sleeping/old/mixed tabs is not guaranteed.
S = Server session authority: on EVERY private Owner read/action verify genuine JWT issuer, sub, session_id, iat and exp AND live per-session revocation/lineage plus account-wide cutoff. session_id claim is read by the current Source153 Edge but a durable per-session revocation model is NOT yet accepted. Account-wide sessions_valid_after alone is NOT a proven local single-session Logout solution.
W = Current Source153 Work authority: Actor Account/Identity/Creator, Work/Photo/Media ownership, revision+CAS, Policy, Privacy, Grant, Consent, moderation and permissible operation; Work ID is a locator, never authorization. A private Owner read does not approve public media.
T = Actual managed transport: approved HTTPS Origin, same-origin BFF or strict managed cross-origin CORS, real publishable key, native private four headers through actual Ingress/CDN, operations/rollback. Local Vite is not T.

Only current SERVER S+W, delivered through separately accepted T, may authorize sensitive Owner results. A client C/N and signed HTTP200 on historical local fixtures alone never implies product rights. Existing WEB267 currently returns SOURCE153_SCHEMA_CANDIDATE_ONLY, snapshot:null, ownerReadVerified:false, actionsEnabled:false, liveBackendEnabled:false. Preserve these literals until distinct server and product acceptance.

## 3. Proposed interface requirements TO 03 COMM (server owns contract)

1. PER-SESSION TERMINAL REVOCATION: bind signed sub and session_id to a durable live session lineage (and token issue time/expiry). A LOCAL Logout terminally revokes ONLY its own lineage; old still-unexpired access JWTs of that lineage must be rejected by every new Source153 private read/action. A sibling session of the same Account remains active if its own session/Work permissions allow.
2. GLOBAL REVOKE: terminally invalidate all Account session lineages including old-client tokens and concurrent refresh/issued access tokens. Do not infer this solely from GoTrue Logout204 or Refresh400. A monotonic global revocation epoch or existing cutoff may be part of a proposed model, subject to signed proof.
3. ORDERING: persist session tombstone/cutoff before or atomically with the provider/logout acknowledgment; define crash, idempotency, duplicate requests, refresh race, sign-in during global revoke, rollback and audit semantics. The client must distinguish SERVER_COMMITTED from SERVER_UNKNOWN; failed request, offline caller or merely provider204 is not a server cutoff receipt.
4. CURRENT PER-REQUEST AUTHORITY: every Owner read/action rechecks S+W, never prior browser or CDN result. Current Source153 Edge uses jwtClaims.session_id and current community_authorize_session; precise schema/identity changes belong to 03 COMM and require new real signed QA.
5. PROTOCOL & DENIAL: 401 means no currently accepted signed server session/auth; 403/404 means denial/ambiguous permission; recognized 409/412 means revision/CAS conflict. Current WEB267 deliberately treats most non200 including 403 as BACKEND_UNAVAILABLE, never automatically as CAS. A new typed denial model is NOT yet approved; do not invent a response field or force a WEB267 change without 04 QR.
6. OLD CLIENT: an old tab, old code bundle or suspended page holding an unexpired old JWT must fail the next server OwnerAuthority read/action following terminal revocation, regardless of ignored/missed browser notifications. Browser cannot retroactively erase all private DOM on unreachable tabs; server prevents subsequent reads/actions, and managed no-store prevents shared cache replay.
7. REFRESH: clarify whether session_id survives token rotation, what happens to old Access JWTs after refresh/terminal revoke, and how the provider reconciles session lineage. The existing Shared Auth coordinator remains sole refresh owner. No WEB token storage/refresh/revocation implementation duplicates it.
8. PRIVACY/ROLLBACK: signed test receipts only categorical status and opaque run/HEAD; no JWT, email, account/media/Work private IDs, password, raw DTO or PEM. Schema rollout and old-version compatibility must fail closed before product exposure.

**OPEN 03 COMM QUESTIONS:** Where/when is authoritative per-session record created/retired? Which actual signed server operation commits LOCAL vs GLOBAL revoke? How is it atomic with GoTrue and remote failures? Which typed denial contract is safe for 401/403/CAS? What is the compatibility/rollback for old JWT session_id, refreshed sessions and previous Source versions? How are identity, work and consent denials independently attested? None is answered or approved by this WEB design document.

## 4. Existing Consumer integration boundary; NO product wiring performed

Preserve single graph:
createCommunityBrowserClient -> createOwnerSharedAuthConsumer -> createOwnerReadRevalidation (PR291 CAS/manual Fresh) -> createOwnerProductReadOnlyAdapter (literal OFF) -> future approved managed HTTPS Source153 -> strict WEB267 -> sanitized source projection.

Existing components remain exactly reused, not reimplemented. Shared Auth owns single-flight refresh and tokenless events; Consumer owns binding Work/session generation, aborting in-flight and comparing actual shared signed candidate before/after response; PR291 owns sticky same-Work rowVersion/authorizationEpoch and manual Fresh; WEB267 owns Source153 DTO shape and four private headers. PR301 disposable endpoint is NEVER a product endpoint.

### Consumer state transitions

| Trigger | Synchronous UI treatment | Permissible later behavior | Forbidden |
| --- | --- | --- | --- |
| Cold load, no in-memory Session | AUTH_REQUIRED, zero sensitive projection; no Owner request | Explicit interactive login then signed server check | Restore old v2 Storage candidate; treat persisted JWT as auth proof |
| Login, refresh, account changes | Candidate remains UNVERIFIED; clear old view if Actor or token epoch changes | Explicit Inspect against current S+W once gate accepted | Local Owner role grant, automatic old CAS reset |
| Same Work/session Inspect | PR291 keeps rowVersion/authEpoch CAS and one shared Auth lease; HTTP request current S+W | Strict sanitized candidate only until product acceptance | replaceSession on every Inspect; cached raw DTO |
| Server HTTP401, invalid refresh, known revoked lineage | Immediately clear view, abort/fence response, disable every Owner action, REAUTH_REQUIRED in future approved UX | New interactive sign-in and server Work recheck | Auto replay old bearer, automatically reissue any Writer, call 401 transient success |
| HTTP403/404 ambiguous authorization/actor/Work/CAS | Clear view, keep neutral BACKEND_UNAVAILABLE; existing PR291 may sticky-block after previously accepted CAS | Manual Fresh only if explicit user action and eligible shared candidate; fresh read still checks S+W | Assume 403=CAS; silently treat retry as authorized |
| HTTP409/412 recognized conflict | REFRESH_REQUIRED sticky, view null, no hidden automatic requests | Keyboard-accessible explicit Fresh omits old CAS after user intent | Auto-allow Focus/Online/PageShow refresh or silent CAS clearing |
| HTTP200 but missing/duplicated Cache-Control, CDN-Cache-Control, Surrogate-Control or Vary; bad body or changed generation | UNSAFE_CACHE_POLICY, SOURCE_CONTRACT_REJECTED or STALE_RESPONSE; clear old view | New explicit read only after conditions safe | Synthesize private headers or show raw response |
| Logout starts, even if notification write/GoTrue HTTP fails | Immediately invalidate own candidate/view, generation++, AbortController, disable rights | Separate SERVER_COMMITTED / SERVER_UNKNOWN receipt ONLY after approved server contract | Claim other tabs logged out or old signed Access JWT was revoked |
| Work/Actor changed; delayed HTTP returns | Drop old Work/session view and CAS; reject stale generation even when response is HTTP200 | Fresh signed server read for new Work/session | Show Account A/Work1 data on Account B/Work2 |
| Blur/hidden/offline/pagehide, BFCache resume, focus/visible/online | Conceal current private projection and treat current authority stale; offline never shows verified owner rights | Approved explicit signed check (not implied by navigator.onLine), respecting sticky CAS | Treat local event or missing event as server revalidation |

A positive Source153 response in the current code is only a source-shaped candidate and still has all Owner action flags false. The UI must not promote it to OWNER_VERIFIED merely because a valid JWT or a signed provider response exists. Any future typed terminal-401 handling is a new separate agreement; current WEB267 maps non200 through its established strict decoder. No non-idempotent Writer401 retry.

### Missed notice and late HTTP scenario

Tab A logs out and its localStorage notice fails; running old Tab B may retain a client candidate indefinitely. Source153 MUST deny B's new private read/action on its old JWT after server revocation. Tab A's UI hides immediately, regardless of network outcome. Delayed HTTP from A, Work1 or previous session never restores DOM after generation change. If server cutoff is unavailable/unknown, tabs retaining JWT may still be able to read under current Source153, therefore production feature stays OFF; do not claim a notification-only fix.

## 5. Strict four-header and managed ingress gate (I01–I14 remains external)

WEB267 current positive read requires native:
Cache-Control = private, no-store, max-age=0;
CDN-Cache-Control = no-store;
Surrogate-Control = no-store;
Vary includes Authorization and Origin.
Malformed, omitted, duplicate/hidden or CDN-rewritten headers fail closed. Request cache mode no-store, explicit Bearer candidate and publishable API key; no redirects, cookies or cross-Origin trust expansion. 401/403 including early server errors must also not leak/carry cacheable private content.

Before a product bridge can be evaluated, Operator and 04 QR must independently accept real managed HTTPS certificate/Origin, allowlisted CORS/preflight+Expose-Headers OR same-origin BFF, actual deployed publishable key (not PR301's virtual alias), genuine A/B/old-session JWT through managed endpoint, four browser-visible native headers across proxy/CDN, cross-actor Work private cache negatives, rollback/monitoring, old-client/legacy endpoints and exact I01–I14 matrix. Never infer that the local Vite relay fulfilled these gates.

## 6. Future negative-first evidence plan (NOT executed by this doc-only PR)

| Case | Real stimulus | Expected security proof and owner |
| --- | --- | --- |
| P01 | Signed A Owner, signed B/Moderator on A Work | A current eligible read; B/M denied no private DTO; COMM/QR |
| P02 | Local session Logout204; replay EXACT pre-expiry old Access JWT against Source153 | Must deny AFTER actual per-session server commit; existing PR304 returned 200, so this is BLOCKED; COMM signed/QR |
| P03 | A logs out of Session1 but Session2 separately alive | Session1 old JWT deny, Session2 allow if current W eligible; no account-wide accidental local cutoff; COMM/QR |
| P04 | Global revoke concurrent with Refresh/new token and old-client JWT | All old lineage denied on current Source153; no terminal revoke resurrection; COMM/QR |
| P05 | Lost StorageEvent, suspended old Tab, failed/offline server cutoff | Sender view immediately hidden; server cutoff remains UNKNOWN if uncommitted; no false success; WEB+COMM |
| P06 | Actor/Creator/account retirement, ownership change, Grant/Consent/Policy/Privacy change | Current server W denial or limited source-only candidate as applicable, no stale projection; COMM/QR |
| P07 | Work/Account navigation, late HTTP200 after Logout, near-expiry Refresh | Stale results rejected, no A/Work1 to B/Work2 projection; WEB real Chrome |
| P08 | Real HTTP403 ambiguous CAS, typed409, explicit Fresh, resumed PageShow | Sticky refusal, no automatic source requests, one user Fresh signed recheck; WEB/QR |
| P09 | Server401/Refresh401, old JWT, Writer401 | Reauth required, old data cleared, zero Writer replay; WEB/COMM |
| P10 | Strip each of four native cache headers, break Vary, proxy/CORS hide headers, cache A for B | WEB267 denies every unsafe response; WEB+Operator managed |
| P11 | Old-version bundle with stale JWT/session id | Independent server deny for revoked session, no reliance on client notify; COMM/QR |
| P12 | Actual HTTPS/BFF/CORS, real publishable key, CDN, I01–I14 | Full independently authorized operational acceptance; Operator/QR |
| P13 | Denial/logs/DOM/telemetry/body/header scan | No credentials, Account, Work/Media private IDs, raw DTO or signed URLs; QR |
| P14 | Feature flags OFF and Source/version drift | 0 product Owner HTTP/rights/actions, no auto-enable, Native Apply/Writer OFF; WEB/QR |

Each future test must separate SIGNED_DISPOSABLE_LOCAL, REAL_BROWSER_LOCAL, MANAGED_RUNTIME and SOURCE_ONLY; provide exact immutable HEAD, CI run/job, status-only HTTP and current Session/CAS witness, no secret-bearing logs.

## 7. Execution gates and decisions

GATE A: 04 QR PR301 DEV-only acceptance = CLOSED. Do not redo it.
GATE B: 03 COMM standalone VERSIONED PER-SESSION+GLOBAL SERVER REVOCATION contract, source+actual GoTrue ES256 signed old-JWT/Work negative tests, no new Source/SDK until independent 04 QR exact HEAD acceptance. PR304 aggregate currently PARTIAL due ancillary workflow; its per-session model NOT IMPLEMENTED/NOT ACCEPTED. Account-wide sessions_valid_after cutoff401 is NOT a proper single-session solution.
GATE C: Operator-managed non-Stage116 HTTPS/BFF/CORS/CDN/publishable-key I01–I14 real browser signed acceptance, explicit authorization+rollback and 04 QR. Currently BLOCKED.
GATE D: ONLY after B+C, decide whether separate minimal product Consumer adapter/401 handling is necessary. New isolated PR, type/UX/8 locale/privacy QA, signed managed CI and independent 04 QR before any feature flag decision. Do not migrate PR301 DEV test relay.
GATE E: Conditional 09 INT X05/X09/X12 integration only if newly accepted shared authority contract; release remains R17 Product Tree30 PASS0/PARTIAL12/BLOCKED18 plus seven shared launch gates.

**NOW:** B=UNKNOWN/NOT_ACCEPTED; C=OPERATOR_BLOCKED; D=NOT_STARTED; X05 OWNER_CONSUMER_PENDING; six Owner flags FALSE; Stage116/Cloud/Provider/Signer/Native Save Writer/Apply OFF. Public release NO-GO, Draft DO_NOT_MERGE DO_NOT_DEPLOY.

## 8. Requested 03 COMM responses (independent design coordination)

- Specify one-session vs all-session terminal revoke, session_id lineage creation/retirement, atomic commit order and typed server receipt; demonstrate old JWT denial before exp.
- Prove no sibling revocation from local logout, no concurrent refresh/token resurrection after global terminal state, old client denial without notifications.
- State current Source153 per-request session+Actor+Work+Policy/Privacy/Consent validation and whether account-wide sessions_valid_after is sufficient for any cases.
- Propose non-leaking 401/403/409/412 or versioned negative denial semantics without weakening WEB267/PR291; explicit 403 is NOT proof of CAS.
- Supply signed A/B/Moderator, old/new browser and failed-network revocation tests and operator-managed preconditions. Return exact contract version/HEAD/CI/independent QR when available.

No undocumented server RPC name, schema field, security guarantee or authorized production action is inferred from this design.
