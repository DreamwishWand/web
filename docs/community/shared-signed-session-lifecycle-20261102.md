# Community shared signed session contract — source-only

Base: independently QR-accepted 08 WEB PR #292 HEAD d32b664efd6473d6a320a789909355b0a8ce1002. All Owner product dual flags and Source153/WEB267 unchanged and OFF.

The common CommunityLabClient retains its existing public method names and session getter. Same-tab clients with the same Supabase URL/publishable configuration share an in-memory session; state is still persisted only in tab sessionStorage. getValidSignedSession({signal?}) returns a defensive copy of a token-bearing credential candidate, NOT server-authorized Owner scope. A single refresh is in flight per shared lineage; rotating refresh tokens are not sent to event listeners. Aborting one waiter does not cancel another's refresh.

subscribeSession(handler) returns an unsubscribe and emits tokenless {kind,generation,logoutEpoch}. Logout is synchronous in memory and storage before awaiting network, and protects against delayed refresh or login completion and stale HTTP response. Other tabs get a localStorage storage event with only {kind:'logout',scope,nonce}; they clear their own session but never receive a login or bearer. No managed server push revocation claim.

Only Community query's read-oriented API retries a 401 one time after a successful same-lineage single-flight refresh. Community command/admin/media/finalize/preset/account writers never automatically replay. Existing password recovery PKCE, sign-up, password change and browser factory signatures stay stable. Local auth state is a candidate until verified by backend; never enable PR #292 or Source153 Owner actions without separate managed ingress and operator acceptance.

QA is deterministic synthetic held HTTP (refresh, login, logout, rotation, 401, multiple Client objects, cross-tab tokenless event), not a real managed GoTrue/Provider/Stage116 acceptance. Independent 04 QR new-only is required. DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY.

Global revoke immediately evicts the shared Session before either network operation, then attempts the still-signed Wand session cutoff before GoTrue global logout. A cutoff network error still allows the provider logout attempt; neither operation can restore credentials. The cutoff request never goes through an automatic 401 Writer replay.


## Configuration isolation v2 (2026-11-02, new-only follow-up)

**Accepted baseline:** PR294 `2bd20b4ea07c53f413c5d1aa135b2e84d94962e3`. This section records only the subsequent config-scope change, not a re-acceptance of the old ten tests.

- SharedAuth identity remains the normalized HTTPS Supabase URL **and** full publishable key. A deterministic opaque 128-bit routing digest of that pair selects `dreamwishwand-community-session-v2:cfg2-…` in **tab-scoped sessionStorage**. Neither URL nor raw publishable key is included in the storage key or logout notice. The digest is **not a security/authentication proof**; session import additionally requires an exact URL and publishable-key comparison against the persisted v2 envelope.
- The v2 envelope is `{version:2,config:{supabaseUrl,publishableKey},session}`. Unparseable, malformed, foreign-config, or inaccessible Storage yields **no session**. Invalid own-config records are removed on best effort. A hypothetical digest collision cannot cause a foreign-config token to be imported because envelope comparison fails.
- **Legacy migration decision: do not migrate.** `dreamwishwand-community-session-v1` has no authenticated connection provenance. Delete it on new-client initialization, reject it even if syntactically valid, and require interactive sign-in again; there is no attempt to guess origin from JWT claims or migrate based on current URL.
- Logout notices now use `dreamwishwand-community-logout-notice-v2`, `{kind:'logout',scope:'cfg2-…',nonce}`, and only invalidate matching full-config SharedAuth state. Old URL-scoped v1 notices are not treated as v2, avoiding cross-publishable-key logout. Notifications contain no JWT, refresh secret, account ID, email, publishable key, or password. Existing same-config generation fences and single-flight rotation are retained.
- Deterministic new-only synthetic tests cover different URL, same URL/different publishable key, independent sign-in/logout, legacy rejection, malformed/mismatched v2 records, blocked storage, scoped notifications, same-config in-flight sharing, simultaneous A/B rotation and late A response after A logout. These are local mock HTTP and StorageEvent harness checks—not managed multi-tab browser, real GoTrue, real JWT, ingress, or production authorization acceptance.
- Cross-version compatibility with *already-open pages running v1 code* is not guaranteed; deployments remain disabled. Same-origin JavaScript can read sessionStorage under browser origin rules; this change provides **configuration isolation**, not script-injection defense or a substitute for server-side JWT/Work authorization.

**Release boundary:** Draft / DO_NOT_MERGE / DO_NOT_DEPLOY. Production Feature Flags remain OFF. Source153, WEB267, PR290–292, Stage116, Provider, Cloud, Native Writer untouched. Require 04 QR new-only independent review of the follow-up HEAD.
