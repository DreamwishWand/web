# Source151 — private pre-grant Work & canonical policy receipt

Draft, **Source-only; no public activation, Stage/Storage/CDN, Provider or real signed actor**. Direct base: independently accepted Source150 Owner PR249 HEAD \`4117d98666a3c3c2ae5891c043e9a83756f92fdc\`, QR250 \`f83bad74701241a54bf1a8a2e41dac3af7304722\` unchanged. Source141–150 migration blobs unchanged.

## Authenticated pre-grant contract

New **read-only** typed RPC \`public.community_dreamsnap_x05_pregrant_read_v1(p_work_id uuid)\` is callable *only* by authenticated user JWT through the already-existing \`community-dreamsnap-owner\` Edge. Edge adds a single \`operation: "pregrant"\` request type:

\`\`\`json
{"operation":"pregrant","workId":"<WorkID UUID>"}
\`\`\`

Response wrapper remains \`{ok:true,operation:"pregrant",contractVersion:"wand.dreamsnaps.owner-management-service@1",data:{...}}\`; the nested pregrant \`data.contractVersion="wand.dreamsnaps.pregrant-service@1"\` is distinct from both Source150 post-grant Owner Service and WEB248 Consumer. \`data.state="NEED_POLICY_ARTIFACT"|"PREGRANT_READY"\`; \`grantRecorded:false\`; \`expectedRowVersion:0, expectedAuthorizationEpoch:0\` and \`publicActivationAllowed:false\`; subtype OriginalCompetition has the real EntryID and FrozenEntryRevisionID; PostEventCreation omits both, must have Source148 PRIVATE/STAGED Work and no Entry. ChallengeID is an existing local DB association, **not** official per-Challenge external issuer/phase proof; \`officialChallengePhaseVerified:false\`. Read rechecks current verified JWT Subject→Account→Identity/Privacy via the exact accepted Source150 private verification helper, Work owner, live Creator, moderation, under-13, photo Revision eligible + self-attestation flags, Media READY and owned, immutable snapshot, and negative absence of Source149 control/consent events/purge. Owner-only \`photoMediaId\` is needed to post explicit grant and is **never** a signer/storage URL. No caller-supplied AccountID or SubjectID.

Pre-grant read **never** inserts a control row, consent event, outbox, media, or policy. If the Control already exists (including withdrawn/deleted), the pre-grant path fails closed; use Source150 post-grant Owner Read for already-granted Work.

## Owner-approved immutable policy artifact / grant flow

Policy Registry \`private.dreamsnap_x05_owner_policy_v1\` (Source150) stays unseeded in shipped Source151. New \`private.dreamsnap_x05_policy_receipt_v1\` stores canonical exact text (not synthesized P01–P03 summary), scoped purpose identifier, operator Owner approval reference and approval timestamp; records cannot be updated/deleted by ordinary RPC. A new trigger refuses \`is_active=true\` unless an existing receipt’s canonical UTF-8 SHA256 equals registry \`policy_digest\` and has approval metadata. **Schema and metadata checks do not prove an individual actually approved a policy; authoritative Owner evidence must be obtained first.** DO NOT insert a fake reference outside local synthetic fixture, and do not silently seed a policy for deployment. There is no new Disney/Gameloft per-image approval gate.

With an empty registry, eligible owner can inspect only their Work and receives \`NEED_POLICY_ARTIFACT, grantAvailable:false\`. After separately verified and operator-provisioned canonical policy text+version+digest and active receipt, pregrant returns \`PREGRANT_READY\` and the *actual* exact text/version/digest for affirmative consent.

First grant (existing Source150 **unchanged**):
\`\`\`json
{"operation":"action","action":"grant","workId":"<WorkID UUID>",
 "expectedRowVersion":0,"expectedAuthorizationEpoch":0,
 "photoRevisionId":"<pregrant photoRevisionId>",
 "photoMediaId":"<pregrant photoMediaId>",
 "policyVersionText":"<active exact policyVersion>",
 "policyDigest":"<receipt SHA256>",
 "selfCaptureDeclared":true,"explicitGrantAccepted":true}
\`\`\`

Existing Source150 narrow JWT wrapper verifies issuer/Identity + lock Work row, Source149 records control rowVersion1/authEpoch1 and append-only grant event; second concurrent grant same (0,0) or replay fails without duplicate consent. Existing post-grant \`operation: "read"\` becomes available, with \`imageGrant.consentRevision\` from last GRANT event, never Work CAS rowVersion. No Source151 Publisher, Signer, Storage or physical purge.

## Owner/media/consent/deletion projection scope

Pregrant \`ownerAuthorized=true\`, \`authenticatedAccountBound=true\`, \`workPhotoBindingVerified=true\`, \`mediaOwnershipVerified=true\` are current DB identity/provenance assertions only: self-capture remains user declaration, QR/READY not independent official DDV or licensor proof. WorkID/ChallengeID/CreatorProfileID/PhotoRevisionID/MediaID come from one private owner read, not URL-provided independent identifiers. \`entryId\` and \`frozenEntryRevisionId\` only Original, PostEvent absent. \`grantRecorded:false\`; \`erasure:{state:"NOT_REQUESTED",physicalPurgeVerified:false,publicDisabled:<actual Work visibility>}\`. No Provider verification, deletion scope complete, legal hold fields fabricated in pregrant; those remain per Source150 existing post-grant projection/Source149 retention status.

**Unclosed:** verified real canonical policy text/version/digest & Owner-approved provenance \`NEED_POLICY_ARTIFACT\`; real linked work/photo registration before pregrant & signed actor runtime \`NEED_RUNTIME\`; WEB248 Service@1↔Consumer@1 adapter and signed session, Provider physical purge and cross-product Search/Saved/Share/Comments/Signer/old CDN bearer; official Challenge ID/phase external authority. No independent new-only QR acceptance until test verdict.

## Tests

NEW-ONLY: local 151 migrations, strict ACL, anon/service/wrong owner/retired/privacy/media rejection, Original Entry/Frozen versus Entry-free PostEvent, zero control/consent/outbox on pregrant, unseeded registry NEED_POLICY_ARTIFACT, synthetic policy refusal without receipt, immutable sample text/SHA256 matching, one winner for 2PG CAS(0,0) concurrent grant and exactly one consent event, after-grant Owner Read, old pregrant denial and replay refusal. Local fixture is disposable and is **not** real approved policy, source of rights or signed JWT issuer. Old Source141–150 independent QA not rerun.
