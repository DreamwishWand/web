# Community shared signed session contract — source-only

Base: independently QR-accepted 08 WEB PR #292 HEAD d32b664efd6473d6a320a789909355b0a8ce1002. All Owner product dual flags and Source153/WEB267 unchanged and OFF.

The common CommunityLabClient retains its existing public method names and session getter. Same-tab clients with the same Supabase URL/publishable configuration share an in-memory session; state is still persisted only in tab sessionStorage. getValidSignedSession({signal?}) returns a defensive copy of a token-bearing credential candidate, NOT server-authorized Owner scope. A single refresh is in flight per shared lineage; rotating refresh tokens are not sent to event listeners. Aborting one waiter does not cancel another's refresh.

subscribeSession(handler) returns an unsubscribe and emits tokenless {kind,generation,logoutEpoch}. Logout is synchronous in memory and storage before awaiting network, and protects against delayed refresh or login completion and stale HTTP response. Other tabs get a localStorage storage event with only {kind:'logout',scope,nonce}; they clear their own session but never receive a login or bearer. No managed server push revocation claim.

Only Community query's read-oriented API retries a 401 one time after a successful same-lineage single-flight refresh. Community command/admin/media/finalize/preset/account writers never automatically replay. Existing password recovery PKCE, sign-up, password change and browser factory signatures stay stable. Local auth state is a candidate until verified by backend; never enable PR #292 or Source153 Owner actions without separate managed ingress and operator acceptance.

QA is deterministic synthetic held HTTP (refresh, login, logout, rotation, 401, multiple Client objects, cross-tab tokenless event), not a real managed GoTrue/Provider/Stage116 acceptance. Independent 04 QR new-only is required. DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY.
