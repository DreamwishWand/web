# 08 WEB / Owner Read-Only Candidate Revalidation & Invalidation Contract @1
2026-11-02 — 08 WEB isolated Draft, new-only based on accepted PR290
HEAD `1123bcca3e04c24e7dbd42a4c7de125881e92aca`.

## Status / authority model

Owner private management @1 remains inert and its mock actorAccountId/numeric
policyVersion is NEVER used to authorize @2. Source153 OwnerAuthority is the
exclusive server authority for signed GoTrue subject → Account → Identity →
Creator → Work → PhotoRevision → Media → Policy → Control. PR290 localhost-only
GoTrue ES256 adapter supplies the actual HTTP response to the EXACT unchanged
WEB267 decoder. The decoder's validated result still represents ONLY
`SOURCE153_SCHEMA_CANDIDATE_ONLY`: `snapshot:null`,
`ownerReadVerified:false`, `actionsEnabled:false`,
`liveBackendEnabled:false`. This module additionally whitelists only
`kind`, frozen Entry/no Entry, grant state, **policy source-claim**, public
disabled and rowVersion/authorizationEpoch (held internally for CAS). It never
renders or exposes a JWT, AccountID, MediaID, PhotoID, StorageKey or signed URL.
A Work UUID in an existing typed route is a **locator**, never actor authority.

The sole caller-visible state is: `status`, a strictly limited
source-only `view` (or null), `canInspect`, `working`, and immutable
false authority flags. The JWT/anonKey/Work locator, request generation and
AbortController live in the controller closure, not the returned state.
The only production code addition is an inert controller with hardcoded
`OWNER_REVALIDATION_PRODUCTION_ENABLED=false`; the existing nested PR290
local-only route opts in only when both Vite DEV and the exact disposable
environment are active. Existing production Owner management stays OFF.

## Transition table / UI behavior

| Event | Synchronous browser action | Next read | Status / UX |
|---|---|---|---|
| Initial valid Work route | No existing candidate; no token assumed | Only after local signed login | AUTH_REQUIRED |
| Work locator, Account, Session switch, logout | Abort; increment generation; clear source, CAS and prior session | Requires fresh server-signed session | AUTH_REQUIRED / INVALID_WORK |
| Page hidden, blur, pagehide, offline | Abort; increment generation; remove candidate immediately, retain only same-Work CAS | Never while hidden/offline/unfocused | REVALIDATION_REQUIRED, alert explanatory read-needed text |
| Visible, focused, pageshow, online again | Clear any candidate; re-read if session+Work+visibility+connectivity+focus all valid | Fresh real Source153 HTTP with last same-Work CAS | READING_SOURCE → source-only candidate or failure |
| Local signed withdrawal or known Policy change | Clear immediately on signal; retain same-Work CAS | New read only; never use old permission | REVALIDATION_REQUIRED |
| CAS divergence (server refusal) | Clear immediately; no automatic request replay | Only explicit user 'Start a fresh read' discards previous CAS | REFRESH_REQUIRED |
| HTTP 401/403/404, malformed DTO/cache, cancellation | Clear and fail closed | No optimistic reappearance/auto-grant | BACKEND_UNAVAILABLE / SOURCE_CONTRACT_REJECTED / UNSAFE_CACHE_POLICY |
| Delayed HTTP response after any invalidation | Generation and AbortController prevent state commit | Future explicit/eligible read only | No stale candidate resurrection |
| Accepted Source candidate | Show only sanitized labels (no raw issuer/DTO) | A future lifecycle event or user recheck | SOURCE153_SCHEMA_CANDIDATE_ONLY, all actions disabled |

Revalidation retains **last displayed same-Work CAS** so a remotely changed Work
is rejected by Source153 when the user resumes. CAS mismatch remains terminal
until an explicit fresh request; that fresh request still requires signed
server authorization and strict WEB267 decoding. No automatic bypass or
retry storm. If a new session is established, old CAS and candidate are
discarded. In any failure, no previously displayed candidate remains.

In the local harness, **Clear test session** has a keyboard-operable
button; status updates use `role=status` with `aria-live=polite`,
and visible revalidation guidance is localized across 8 existing locales.
The DOM has no privilege actions or authenticated image preview; focus is
not forcibly stolen by asynchronous updates. The original PR245 Owner UI
remains disabled and unchanged; this is not the production UI acceptance.

## Four independent distinctions

1. **Server-side revocation:** actual database/Auth/Policy/Control may deny
   subsequent signed requests. Prior PR288/PR290 independently proved bounded
   synthetic local cases; do not replay those suites.
2. **In-flight stale HTTP:** controller aborts and generation-fences the
   pending response, independently of whether the server had returned HTTP200.
3. **Already rendered source candidate:** the client clears on a *locally
   observable* event (route/session/logout/visibility/focus/offline etc.).
   Without an event or periodic signed re-read, it can remain visible even if
   the server changed state. **No immediate remote revocation SLA.**
4. **New signed read:** only the server-confirmed actor and latest Work policy
   are authoritative; the UI never interprets client ActorID, CAS, policy
   source-claim or a browser login as an Owner permission.

## Network / evidence boundaries

Strict original WEB267 Cache-Control private/no-store/max-age=0,
CDN-Cache-Control no-store, Surrogate-Control no-store and Vary
Authorization+Origin validation are untouched. The existing Vite
127.0.0.1:4175 → 127.0.0.1:54321 relay is a disposable same-origin
test harness preserving real HTTP headers, **not** production CORS,
Ingress/Gateway or CDN/header-exposure acceptance. Cross-origin production
needs a separately approved header-exposure design and independent hostile
cache/caller verification; do not loosen WEB267 checks.

No subscription, push revocation, policy event feed, deployed issuer, actual
approved P02/Consent, genuine provider image bytes, CDN/Cloud/old issued
bearer convergence, public Media Signer, Stage116 writes, official DDV
DreamSnaps/competition eligibility or Native Save Writer has been tested.
The device platform/game version is irrelevant to this browser-only contract.
All rights/publishing/Signer/Apply/Owner operations OFF.
DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY / PUBLIC RELEASE NO-GO.

## New-only acceptance

Freeze upstream accepted PR290 exact SHA and compare only this child.
Test state-machine pure transitions (no accepted PR288 signed E2 or
PR290 old 9+11 tests re-run intentionally), production check/build,
strict protected-source Blob parity and, where runnable, **new-only**
browser event acceptance (visibility/offline/focus/revalidation) against
the existing local signed adapter. Browser tests are NOT proof of push
revoke or production availability. Classify unavailable browser cases
PARTIAL. 04 QR independently reviews only the child delta; 09 INT
changes shared integration only if new accepted evidence requires it.


## 2026-11-02 QR291 TRUE RED / explicit-Fresh CAS repair (same PR291)

04 QR independently reproduced a new contract failure on Owner HEAD
`3849e5ea2ed1dffe0de8e3bdc958f798431f6eca`: a verified Source candidate
CAS2/2 → `REFRESH_REQUIRED` cleared `lastCas`, and either normal Inspect
or Focus/Visible/Online/PageShow retried without CAS and reprojected a
candidate without the required user Fresh action. This was a **source-only
CAS UX invariant breach**, not a server-authorization bypass.

**Superseding invariant:** `needsExplicitFresh` is a sticky, private
controller latch set both on decoder `REFRESH_REQUIRED` and observed local
`CAS_CONFLICT`. While latched, state must remain
`REFRESH_REQUIRED/view:null/canInspect:false/canFreshRead:ready`, even when
locally hidden, offline, blurred, page-hidden, or subsequently resumed.
Normal Inspect and *all* Focus/Visible/Online/PageShow events must cause
**ZERO new HTTP requests**, with no implicit CAS omission. Last same-Work CAS
is retained in the closure, not silently discarded. Only deliberate user
selection of the separate keyboard-accessible
**Start a fresh read** button calls `revalidate({fresh:true})`; after
checking that Work and signed session are ready, this clears the latch
and previous CAS and performs exactly one new strict Source153 signed
HTTP read. If the server rejects the fresh read, no source candidate
is rendered, capabilities remain OFF. Work navigation, actor/session
replacement and logout discard the old latch, last CAS, bearer and
candidate, never reuse prior actor authority.

New regressions assert independently for each resume trigger: after
CAS2/2 rejection, ordinary Inspect + all four lifecycle resume events
do not read; subsequent explicit Fresh alone sends rowVersion/authEpoch
undefined. Separate tests cover local CAS_CONFLICT, fresh denial, route/
session/logout reset, delayed response cancellation and DEV-only disabled
Inspect vs enabled Fresh CTA.

**Important signed HTTP limitation:** The unchanged WEB267 decoder
classifies source HTTP409/412 and source-DTO CAS mismatch as
`REFRESH_REQUIRED`, but HTTP403 is `BACKEND_UNAVAILABLE`.
The established Source153 Edge may return 403 for stale expected CAS;
there is no server-confirmed error subtype in the unchanged strict
adapter enabling the browser to treat every 403 as a CAS refusal.
Therefore the new sticky-latch proof is **controller-source level**
for `REFRESH_REQUIRED`/`CAS_CONFLICT`, not a claim that every
production/source HTTP403 activates the Fresh UI. Such 403s still
fail-closed and preserve prior same-Work CAS for future reads. Do not
weaken decoder, invent 409, or relabel 403. Genuine signed Chrome in
the dedicated local workflow continues to cover existing **new-only
lifecycle events** and is not a new CAS-to-focus signed rejection proof.

The original Source153 SQL/Edge, strict WEB267 decoder, PR290 genuine
signed adapter, PR245 Owner view, and all production OFF flags remain
immutable. Dedicated Source/Node and normal CI plus local genuine
GoTrue ES256 Chrome must be verified at a fixed final repair SHA.
04 QR must independently inspect only the updated PR291 8-path
child delta and this exact sticky gate, not previously accepted
PR288 E2 or PR290 9+11 suites. Until independent PASS,
Owner Browser remains PARTIAL and NO-GO.
