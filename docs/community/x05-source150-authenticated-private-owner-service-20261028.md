# X05 Source150 authenticated private Owner management service

Status **DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY / PUBLIC_DISABLED**. Frozen accepted Source149 Owner PR244 HEAD 2abbb2b14dfe0f876cef92e8c3b9e18d8d9e50cd / 04 QR PR246 HEAD eabf08c6821818374c7a17b9ffbfee62dfafbd50. Old Source141–149 SQL/Edge/Work/Media models unchanged.

## Trust contract

Edge function: \`community-dreamsnap-owner\`, \`POST\` only, \`withSupabase({auth:'user'})\`, platform JWT \`verify_jwt=true\`; subject obtained from verified \`ctx.userClaims.id\`, \`iat\` and signed session ID checked, then current Wand session cutoff verified through existing \`community_authorize_session\`. The Edge sends the ORIGINAL bearer to PostgREST and a **non-admin** anon/publishable API key. The PostgREST verified JWT sets \`auth.uid()\` and \`auth.jwt()\` for the narrow authenticated-only SQL wrapper. No AccountID/SubjectID/request-header subject may be passed in the public JSON. The new wrappers must not be invoked with an admin-key connection. SQL independently checks claims role=authenticated, non-anonymous, valid UUID sub/session, epoch iat, auth.uid() equality, active nonretired Identity, WandAccount active and Privacy not suppressed, plus session cutoff; stale/revoked identity fails closed.

**Security note:** the two intentionally exposed PostgREST public wrapper signatures have EXECUTE only for \`authenticated\`, never anon, PUBLIC or service_role. They are \`SECURITY DEFINER\` over rigorously bound signed JWT and exact row ownership. Existing Source149 private writer functions and new private verification helper/policy table remain REVOKE ALL for anon, authenticated and service_role. This relies on Supabase PostgREST JWT verification as a trusted issuer; local GUC-set JWT fixtures are synthetic negative/contract tests, not verified production signed sessions. Explicit signed Actor/Issuer runtime remains unaccepted.

## Endpoint contract

\`POST /functions/v1/community-dreamsnap-owner\`

Read:
\`\`\`json
{"operation":"read","workId":"<WorkID uuid>"}
\`\`\`
The response is \`{ok:true,operation:"read",contractVersion:"wand.dreamsnaps.owner-management-service@1",data:{...}}\`. **No Public Work Detail, direct media URL, Storage path, account ID, user claims, or provider signing.** Every HTTP path has private, no-store, max-age=0, CDN-Cache-Control and Surrogate-Control no-store.

Action:
\`\`\`json
{"operation":"action","action":"withdraw","workId":"<WorkID uuid>","expectedRowVersion":1,"expectedAuthorizationEpoch":1}
\`\`\`
Supported action enum \`grant|preflight|concept|withdraw|delete\`. Grant requires exact \`photoRevisionId\`, \`photoMediaId\`, \`policyVersionText\`, \`policyDigest\`, affirmative \`selfCaptureDeclared:true\`, \`explicitGrantAccepted:true\`; concept requires \`conceptRevisionId\`. ALL unknown/mixed/AccountID/SubjectID/EntryID fields rejected before SQL. Strict bounded safe integers for CAS; zero only on initial grant. SQL reconfirms expected rowVersion **and** authorizationEpoch under same Work lock before calling existing Source149 private CAS transition. Stale/replayed requests must fail without outbox duplication. Action returns current authenticated Owner snapshot atomically in same transaction; \`publicActivationAllowed:false\`.

Policy: private \`dreamsnap_x05_owner_policy_v1\` registry starts **EMPTY**, and only explicitly registered \`is_active=true\` canonical policyVersion/digest pairs allow a grant. No mere user-supplied policy digest can authorize itself. \`grant_policy_version TEXT\` remains canonical as \`imageGrant.policyVersionText\`. Only strictly formatted \`v1\`, \`v2\` ... \`v9999999\` maps to integer \`policyVersionOrdinal\`; no implicit \`Number(text)\` for arbitrary strings such as \`owner-v1\`. \`imageGrant.consentRevision\` is a **different** integer (last event_version from Source149 \`private.dreamsnap_x05_consent_events_v1\` WHERE action=grant; NOT mutable X05 \`row_version\`, which also advances on withdrawal/Concept); \`authorizationEpoch\` separate. Old 08 WEB PR245 decoder \`wand.dreamsnaps.owner-management@1\` expects an integer and ownerAccountId, so **must not** consume Source150 directly. WEB must implement explicit service@1 adapter and verified session-context binding, retain disabled current UI until independent QR+signed real actor acceptance. This service does NOT silently retype old WEB contract.

Projection \`data\`: contractVersion, sourceContractVersion, workId, kind \`OriginalCompetition|PostEventCreation\`, ChallengeID/CreatorProfileID, photoRevisionId/photoMediaId, conceptRevisionId, concept, rowVersion, authorizationEpoch, \`ownerAuthorized:true\`, \`accountState:active\`, \`identityState:active\`, \`privacySuppressed:false\`, \`moderationAllowed:true\`, \`imageGrant:{policyVersionText,policyVersionOrdinal|null,policyDigest,consentRevision,workId,state}\`, \`erasure:{state,revision,publicDisabled,physicalPurgeVerified,providerStatus}\`, capabilities. The private Owner snapshot does not provide AccountID, storage key or signed asset URL. For Original only, \`entryId\` + \`frozenEntryRevisionId\` match the actual Entry/photo; for PostEvent **both keys absent**, no Entry/rank. Frozen Photo/Media/Challenge never rewritten by this service; separate Concept pointer is draft-only.

Erasure state mapping is truthful: \`PUBLIC_DISABLED\` when Work private/withdrawn; \`MEDIA_PURGE_PENDING\` for a pending Source149 purge row; \`LEGAL_HOLD\` only when actual active \`private.account_retention_holds\` legal account hold exists; \`MEDIA_PURGED\` only when Source149 purge \`verified\` receipt/time and \`media_assets.purged_at\` true, no legal hold and public disabled. No Source150 function can set provider verified, delete storage, complete retention, or grant public media. Actual previous bearer/CDN cache/source provider purge not proven. A pending request is not a purge completion.

## Remaining boundaries

No user credentials or real images were touched. Edge service is **code-only**, not deployed. First-party auth issuer and session-cutoff code source-reused, but no independent signed Actor A/B/M, PostgREST deployed relay, Stage/Provider/CDN/Storage, or actual Work/Photo authorizations accepted; those require separate operator authorizations. Original frozen and PostEvent strictly staged PRIVATE; Source149 publicActivation flag remains FALSE. Search/Saved/Share/Comments and issued signed URLs need 09 INT/04 QR new-only cross-system runtime before any positive public enablement. 08 WEB PR245/QR247 remain distinct source-only disabled UI; combine only on a later approved Owner integration. No duplicate Disney/Gameloft approval search.

## Tests / owner acceptance

Source150 NEW-only: ordinary CI, Node source security test and dedicated disposable full150 PostgreSQL two backend isolation (synthetic JWT GUC) with anon/service ACL, subject/role/session/retired/privacy, wrong owner, consent policy registry mismatch and opt-ins, Original vs PostEvent subtype and frozen image, row/epoch stale/replay, two-backend competition, rollback/outbox, actual legal hold and truthful media pending. A local synthetic JWT claim fixture is NOT proof the issuer verified a real signed token. Independent 04 QR must review only new changed files and verify signed conditions as NEED_SIGNED_RUNTIME. Existing Source149/148 independent QA remains intact, not rerun. HTTP response must be no-store across every status branch and fail neutral on unknown SQL issues.
