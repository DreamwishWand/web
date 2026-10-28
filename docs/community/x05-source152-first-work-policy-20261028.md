# Source152 — First Work / registered Media bootstrap & candidate consent artifact

Status: **DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY / PUBLIC_DISABLED**. Frozen accepted Source151 Owner PR253 \`9c96de3e1f003c160beffc0395dfbe35314dff3d\`, independent 04 QR PR255 \`755ef1800bc8e129af13d458ed1fb68d55144791\`. No Source141–151 migration or accepted Writer/Media/Identity model modification.

## Reuse inventory (not duplicate)

- Verified Media: existing \`community-media\` authenticated prepare+upload+finalize Edge and \`community_register_validated_media\` RPC; that Edge downloads actual blob, validates MIME/image dimensions and SHA256, then registers existing \`public.media_assets\` READY. Source152 does **not** upload, download, validate actual Storage payload, claim existing media proof beyond DB state, create Media, or call Provider. **This requires separately authorized real Storage/Provider acceptance**.
- Existing typed Work registration \`public.community_register_dreamsnap_work_v1\`, native snapshot creator \`private.dreamsnap_create_revision\`, competition Entry writer \`public.community_dreamsnap_join_event_v1\`, \`public.community_work_revisions\`, \`public.dreamsnap_work_revisions\`, \`public.work_revision_media\`, Work, Creator, Media, Challenge and \`idempotency_keys\`. Source152 references them and adds no duplicate table/model.
- Source148 private \`dreamsnap_post_event_staged_v1\` and its accepted immutable readiness/liveness validator; Source151 authenticated \`pregrant\`, Source150 authenticated owner action grant CAS(0,0) and post-grant Owner Read are unchanged.
- Existing generic \`community-command\`/Media flows are not retroactively accepted as secure public DreamSnaps publish; Source152 only adds its own narrow verified-user route.

## Exact backend contract

\`POST /functions/v1/community-dreamsnap-owner\` action:

\`\`\`json
{"operation":"register","kind":"PostEventCreation","challengeId":"<UUID>",
 "photoMediaId":"<existing validated READY Media UUID>","caption":"<optional>",
 "idempotencyKey":"<16-120 ASCII [A-Za-z0-9:_-]>",
 "explicitWandCompetitionEntry":false}
\`\`\`

For Original, \`kind:"OriginalCompetition",explicitWandCompetitionEntry:true\` (the latter is an **independent explicit Wand participation request**, NOT the separate image licensing \`grant\`). No \`AccountID\`, \`SubjectID\`, \`CreatorProfileID\`, \`WorkID\`, \`PhotoRevisionID\`, \`EntryID\`, \`StorageKey\` from HTTP. The response gives the **server-created** WorkID, new PhotoRevisionID, existing MediaID, optional *real Wand-native* EntryID (Original only), ChallengeID, \`publicActivationAllowed:false,officialChallengePhaseVerified:false,storageValidatedBySource152:false,requiresPolicyGrant:true,nextOperation:"pregrant"\`. No automatic consent, no publish/Media Signer.

Caller is accepted Source150 Auth User JWT Edge with verified claims and current Session; PostgREST unprivileged bearer \`authenticated\` role. SQL \`public.community_dreamsnap_x05_register_initial_work_v1\` is a new narrow \`SECURITY DEFINER\` wrapper binding \`auth.uid()\` and \`private.dreamsnap_x05_verified_db_subject_v1\` to active Account/Identity/Privacy; internally derives the one owned live Creator and checks Media processing READY+owned+not purged+unmoderated, locally known non-synthetic Challenge. Legacy community-media metadata registration is **not** a source-backed rightsholder licence or actual Provider storage attestation in this test.

Original: allow only locally \`submission_open\` Challenge and affirmative separate Wand Entry request; call existing Work registration and \`community_dreamsnap_join_event_v1\` atomically. The EntryID is an actual **Wand DB Entry**, never a fabricated official DDV competition entry; actual official submission/phase/OnlineId issuer NOT VERIFIED. Work remains private. No disclosure to public Work Detail, search, vote or media signer. If initial Work creation succeeds but Entry is invalid, transaction rolls back both. Source151 PreGrant checks actual frozen Entry/Photo Media before explicit initial Source150 image Grant.

PostEvent: allow only local \`results|closed\` nonsynthetic Challenge; create Work and Revision by existing models/helper, use Source148 existing PRIVATE STAGED table with immutable PhotoRevision/Media/Concept initial pointer. No EntryID, no publication; all official/Wand voting and rights state remain \`unknown\` (the DB stage validator rejects fabricated positive). This transaction writes existing Work/Outbox/Origin/Revision without creating Media or a second Creator. Source151 PreGrant checks STAGED and frozen references; Source150 grant remains separate after consent artifact.

Two-level idempotency: account+media+challenge+kind transaction advisory lock prevents concurrent same image duplicate Work even with differing keys; account+request key lock, persistent \`public.idempotency_keys\` request digest and response ensure identical retry gives exact original response; changed payload or duplicate photo under new key fails. Existing Source150 Work+consent CAS(0,0) unchanged; withdrawal and deletion remain exactly accepted Source149/150 paths. No Provider Work registration success claim.

## Canonical Versioned policy artifact (candidate, unapproved)

- Raw exact UTF-8 LF text: \`docs/community/policy/dreamsnap-image-grant-v1.candidate.txt\`
- Manifest: \`docs/community/policy/dreamsnap-image-grant-v1.candidate.json\`
- Version: \`v1\` (Source150 registry strict \`^v[1-9][0-9]{0,6}$\`).
- UTF-8 text SHA256: \`2c4e78e46345a3d230a304d74086aa49b66700396acca91bf6280cd6f938d0cb\`; Node \`crypto.createHash('sha256')\` tests exact file bytes and expected hex, including LF and trailing newline.
- Status: **CANDIDATE_POLICY_ARTIFACT, NOT OWNER APPROVED**; existing Source151 Policy Registry and immutable receipt tables **remain EMPTY** in shipped source. P01–P03 were design-approved; this newly composed verbatim Japanese display text was not independently Owner-approved. No fake \`approvalReference\`, DB receipt or automatic activation; human Owner can approve actual canonical UTF-8 text/version/hash directly without new external Disney/Gameloft licence/lawyer paperwork.
- P01 unofficial; P02 non-title-transfer, per WorkID+MediaID+PhotoRevisionID scope, non-exclusive revocable consent to private storage and *separately authorized* display/thumbnail/CDN/moderation/search/share preview; P03 immediate new public access revocation and queued physical deletion with Provider verification and legal hold/previously issued bearer/cache limits explicitly disclosed. No automatic public publishing, official DDV submission or result opt-in; user screenshot eligibility self-attestation is **not** licensor rights proof.
- Future actual source approval creates immutable \`private.dreamsnap_x05_policy_receipt_v1\` record with approved precise text, digest, active version; Source151 enforces sha256 matching receipt before registry activation. Without approval, PreGrant state \`NEED_POLICY_ARTIFACT\`, no grant.
- User's explicit grant must remain \`expectedRowVersion:0,expectedAuthorizationEpoch:0,photoRevisionId,photoMediaId,policyVersionText,policyDigest,selfCaptureDeclared:true,explicitGrantAccepted:true\`; consent revision is grant event version, not mutable Work CAS version.

## 08 WEB252/254 projection and 09 INT authority crosswalk

Source152 registration never returns an OwnerAccountID, raw Storage key, signer URL, ImageGrant validity or physical deletion completion. It certifies authenticated subject and current owner/Creator and ready Media **from the database**; Source151 PreGrant certifies DB exact WorkPhotoMedia relation after registration, but only for a live owner and frozen eligible material. PreGrant \`workPhotoBindingVerified:true\`, \`mediaOwnershipVerified:true\`, \`authenticatedAccountBound:true\` are accurate **DB** predicates; do not infer official phase/licensor permission. Source150 postgrant \`imageGrant\` returns \`policyVersionText\`, grant \`consentRevision\`, Work \`rowVersion\`, \`authorizationEpoch\` separately. No all-scope Provider/Cloud/CDN physical deletion claim, and \`ownerAccountId\` remains deliberately absent from read (issuer identity never browser-supplied). WEB252 \`NEED_BACKEND_PROJECTION\` for additional account/scope/physical provider proof is still a real gap. No fabricated fields to force Browser adapter acceptance. Previous WEB254 is source-only PreGrant mock, not live HTTP.

## Remaining external dependencies

Actual provider Media upload and blob content readback, server-issued signed actor A/B/Moderator and remote Stage HTTP/PostgREST, initial real Creator identity account, real DDV submission/Challenge per-event authority, Owner approval of exact CANDIDATE policy, WEB252/254 combined binding, 09 INT cross-product reader/stored/cached invalidation, Provider+CDN physical purge remain pending. Operator A HUMAN NO-GO, B HOLD, C not authorized. No public route, Stage/Storage/Provider/CDN, Native Writer/Apply, Merge/Deploy. Source-only synthetic fixture uses pre-registered READY media rows not actual Storage provider validation; **never call that real upload complete**.
