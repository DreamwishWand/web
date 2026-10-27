import { withSupabase } from 'npm:@supabase/server';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const KNOWN_GALLERY_STAGING_PROJECT_REF = 'ptpdoxhrqopvczpclcij';
function resolveMediaBucketForGallery(): string {
  const explicit = Deno.env.get('COMMUNITY_MEDIA_BUCKET')?.trim();
  if (explicit) return explicit;
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  if (url.includes(KNOWN_GALLERY_STAGING_PROJECT_REF)) return 'community-media-staging';
  throw new Error('COMMUNITY_MEDIA_BUCKET must be configured.');
}

type JsonObject = Record<string, unknown>;

const commandToRpc = {
  ensureAccountCreator: 'community_ensure_account_creator',
  updateCreatorProfile: 'community_update_creator_profile',
  createGalleryDraft: 'community_create_gallery_draft',
  createGalleryWork: 'community_create_gallery_work_v1',
  preflightGalleryGraph: 'community_gallery_graph_preflight_r15',
  publishGallery: 'community_publish_gallery_pinned_r15',
  publishGalleryPhoto: 'community_publish_gallery_photo_v1',
  deleteGalleryPhoto: 'community_delete_gallery_photo_v1',
  registerDreamsnapWork: 'community_register_dreamsnap_work_v1',
  updateDreamsnapWork: 'community_dreamsnap_update_work_revision_v1',
  joinDreamsnapEvent: 'community_dreamsnap_join_event_v1',
  replaceDreamsnapEntryRevision: 'community_dreamsnap_replace_entry_revision_v1',
  castDreamsnapVote: 'community_dreamsnap_cast_formal_vote_v1',
  addDreamsnapBrowseReaction: 'community_dreamsnap_add_browse_reaction_v1',
  addDreamsnapSpecialPick: 'community_dreamsnap_special_pick_v1',
  setDreamsnapOfficialResultPublication: 'community_dreamsnap_set_official_result_publication_v1',
  setDreamsnapOfficialAccountConsent: 'community_dreamsnap_set_account_official_result_consent_r20',
  publishDreamsnapGallery: 'community_dreamsnap_publish_gallery_v1',
  saveEntity: 'community_save_entity',
  unsaveEntity: 'community_unsave_entity',
  followCreator: 'community_follow_creator',
  unfollowCreator: 'community_unfollow_creator',
  addReaction: 'community_add_reaction',
  removeReaction: 'community_remove_reaction',
  addComment: 'community_add_comment_v3',
  setGalleryCommentsEnabled: 'community_set_gallery_comments_enabled_v2',
  setGalleryCommentsAtomicR16: 'community_set_gallery_comments_enabled_atomic_r16',
  removeGalleryComment: 'community_gallery_author_remove_comment_v2',
  askQuestion: 'community_ask_question_v1',
  addAnswer: 'community_add_answer_v1',
  setSameHere: 'community_set_same_here_v1',
  setAnswerUtility: 'community_set_answer_utility_v1',
  resolveQuestion: 'community_resolve_question_v1',
  createTip: 'community_create_tip_v1',
  setQaFreshness: 'community_set_qa_freshness_v1',
  removeOutdatedQa: 'community_remove_outdated_qa_v1',
  withdrawDuplicateQuestion: 'community_withdraw_duplicate_question_v1',
  reportEntity: 'community_report_entity',
  changeVisibility: 'community_change_work_visibility',
  unpublishWork: 'community_unpublish_work',
  deleteWork: 'community_delete_work',
  moderateWork: 'community_moderate_entity_v5',
  retryDeadLetter: 'community_retry_dead_letter_outbox',
  revokeSessions: 'community_revoke_wand_sessions',
  createDdvProfileWorkspace: 'community_create_ddv_profile_workspace_v1',
  updateDdvProfileWorkspace: 'community_update_ddv_profile_workspace_v1',
  deleteDdvProfileWorkspace: 'community_delete_ddv_profile_workspace_v1',
  associateDdvIdentity: 'community_associate_ddv_identity_v1',
  unlinkDdvIdentity: 'community_unlink_ddv_identity_v1'
} as const;

type CommandName = keyof typeof commandToRpc;

const commandToRateBucket: Partial<Record<CommandName, string>> = {
  updateCreatorProfile: 'profile_write',
  createGalleryDraft: 'gallery_write',
  createGalleryWork: 'gallery_write',
  publishGallery: 'gallery_write',
  publishGalleryPhoto: 'gallery_write',
  deleteGalleryPhoto: 'gallery_write',
  registerDreamsnapWork: 'dreamsnap_write',
  updateDreamsnapWork: 'dreamsnap_write',
  joinDreamsnapEvent: 'dreamsnap_write',
  replaceDreamsnapEntryRevision: 'dreamsnap_write',
  castDreamsnapVote: 'dreamsnap_judge',
  addDreamsnapBrowseReaction: 'dreamsnap_signal',
  addDreamsnapSpecialPick: 'dreamsnap_signal',
  setDreamsnapOfficialResultPublication: 'dreamsnap_write',
  setDreamsnapOfficialAccountConsent: 'dreamsnap_write',
  publishDreamsnapGallery: 'dreamsnap_write',
  saveEntity: 'save',
  unsaveEntity: 'save',
  followCreator: 'follow',
  unfollowCreator: 'follow',
  addReaction: 'reaction',
  removeReaction: 'reaction',
  addComment: 'comment',
  setGalleryCommentsEnabled: 'gallery_write',
  setGalleryCommentsAtomicR16: 'gallery_write',
  removeGalleryComment: 'gallery_write',
  askQuestion: 'qa_write',
  addAnswer: 'qa_write',
  setSameHere: 'qa_signal',
  setAnswerUtility: 'qa_signal',
  resolveQuestion: 'qa_write',
  createTip: 'qa_write',
  setQaFreshness: 'qa_write',
  removeOutdatedQa: 'qa_write',
  withdrawDuplicateQuestion: 'qa_write',
  reportEntity: 'report',
  changeVisibility: 'gallery_write',
  unpublishWork: 'gallery_write',
  deleteWork: 'gallery_write',
  moderateWork: 'moderation_write',
  createDdvProfileWorkspace: 'ddv_profile_workspace_write',
  updateDdvProfileWorkspace: 'ddv_profile_workspace_write',
  deleteDdvProfileWorkspace: 'ddv_profile_workspace_write',
  associateDdvIdentity: 'ddv_profile_identity',
  unlinkDdvIdentity: 'ddv_profile_identity'
};

const textEncoder = new TextEncoder();

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, '0')).join('');
}

async function deriveDdvIdentityDigest(playerId: string): Promise<string> {
  const secret = Deno.env.get('COMMUNITY_DDV_PROFILE_BINDING_KEY_V1') ?? '';
  if (secret.length < 32) {
    throw new Error('DDV_PROFILE_BINDING_KEY_UNAVAILABLE');
  }

  if (
    playerId.length < 4 ||
    playerId.length > 128 ||
    playerId !== playerId.trim() ||
    !/^[\x21-\x7E]+$/.test(playerId)
  ) {
    throw new Error('INVALID_DDV_PLAYER_ID');
  }

  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const input = textEncoder.encode(`dreamwishwand/ddv-player-id/v1\0${playerId}`);
  const signature = await crypto.subtle.sign('HMAC', key, input);
  return `hmac-sha256:v1:${bytesToHex(signature)}`;
}

function reply(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { ...corsHeaders, 'Cache-Control': 'private, no-store' }
  });
}

const authenticatedFetch = withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return reply({ ok: false, error: 'POST required' }, 405);

    const subject = ctx.userClaims?.id;
    if (!subject) return reply({ ok: false, error: 'Authenticated subject missing' }, 401);

    const issuedAt = Number(ctx.jwtClaims?.iat ?? 0);
    const sessionId = String(ctx.jwtClaims?.session_id ?? '');
    if (!Number.isInteger(issuedAt) || issuedAt <= 0) {
      return reply({ ok: false, error: 'JWT issued-at claim missing' }, 401);
    }

    let body: { command?: string; payload?: JsonObject };
    try {
      body = await req.json();
    } catch {
      return reply({ ok: false, error: 'Invalid JSON body' }, 400);
    }

    if (!body.command || !(body.command in commandToRpc)) {
      return reply({ ok: false, error: 'Unsupported command' }, 400);
    }

    const command = body.command as CommandName;
    const payload = body.payload ?? {};
    // D06: legacy Entry/field publishing must never be routed even to a
    // service-role DB function. A separate Account-global CAS is the only writer.
    if (command === 'setDreamsnapOfficialResultPublication') {
      return reply({ok:false,error:'D06_LEGACY_PER_ENTRY_OFFICIAL_RESULT_PUBLICATION_DISABLED'},409);
    }
    const rpc = commandToRpc[command];

    const authorizationRpc =
      command === 'ensureAccountCreator'
        ? 'community_authorize_identity_bootstrap'
        : 'community_authorize_session';

    const authorizationParams: JsonObject = {
      p_auth_subject: subject,
      p_issued_at_epoch: issuedAt
    };

    if (command !== 'ensureAccountCreator') {
      authorizationParams.p_max_age_seconds = null;
    }

    const { error: sessionError } = await ctx.supabaseAdmin.rpc(
      authorizationRpc,
      authorizationParams
    );

    if (sessionError) {
      return reply(
        {
          ok: false,
          error: 'SESSION_REVOKED_OR_INVALID',
          message: sessionError.message
        },
        401
      );
    }

    const rateBucket = commandToRateBucket[command];
    if (rateBucket) {
      const { data: rate, error: rateError } = await ctx.supabaseAdmin.rpc(
        'community_consume_action_rate_limit',
        {
          p_auth_subject: subject,
          p_bucket: rateBucket
        }
      );

      if (rateError) {
        return reply(
          {
            ok: false,
            error: 'RATE_LIMIT_CHECK_FAILED',
            message: rateError.message
          },
          400
        );
      }

      if (rate?.allowed === false) {
        return reply(
          {
            ok: false,
            error: 'RATE_LIMITED',
            bucket: rate.bucket,
            retryAfterSeconds: rate.retryAfterSeconds,
            resetAt: rate.resetAt
          },
          429
        );
      }
    }

    const params: JsonObject = { p_auth_subject: subject };

    switch (command) {
      case 'ensureAccountCreator':
        params.p_handle = payload.handle;
        params.p_display_name = payload.displayName;
        break;
      case 'updateCreatorProfile':
        params.p_expected_version = payload.expectedVersion;
        params.p_handle = payload.handle;
        params.p_display_name = payload.displayName;
        params.p_bio = payload.bio ?? null;
        params.p_profile_visibility = payload.profileVisibility;
        params.p_idempotency_key = payload.idempotencyKey;
        break;
      case 'createGalleryDraft':
        params.p_creator_profile_id = payload.creatorProfileId;
        params.p_visibility = payload.visibility;
        params.p_gallery_kind = payload.galleryKind;
        params.p_idempotency_key = payload.idempotencyKey;
        break;
      case 'createGalleryWork':
        params.p_creator_profile_id = payload.creatorProfileId;
        params.p_gallery_kind = payload.galleryKind;
        params.p_idempotency_key = payload.idempotencyKey;
        break;
      case 'preflightGalleryGraph':
        if (typeof payload.workId !== 'string' || !Array.isArray(payload.presetRevisionIds)) {
          return reply({ok:false,error:'R15_PREFLIGHT_REQUEST_INVALID'},400);
        }
        params.p_work_id = payload.workId;
        params.p_preset_revision_ids = payload.presetRevisionIds;
        break;
      case 'publishGallery':
        if (!Array.isArray(payload.mediaIds) || payload.mediaIds.length === 0) {
          return reply({ ok: false, error: 'mediaIds required' }, 400);
        }
        params.p_work_id = payload.workId;
        params.p_expected_version = payload.expectedVersion;
        params.p_title = payload.title;
        params.p_description = payload.description ?? null;
        params.p_media_ids = payload.mediaIds;
        params.p_preset_revision_ids = Array.isArray(payload.presetRevisionIds) ? payload.presetRevisionIds : [];
        params.p_used_item_ids = Array.isArray(payload.usedItemIds) ? payload.usedItemIds : [];
        params.p_featured_item_ids = Array.isArray(payload.featuredItemIds) ? payload.featuredItemIds : [];
        params.p_moodboard_snapshot_ref = payload.moodboardSnapshotRef ?? null;
        params.p_idempotency_key = payload.idempotencyKey;
        // An explicit server-issued R15 preflight pin is mandatory.
        // Never refresh a caller SHA during transient whole-transaction retry.
        const pin = payload.graphPin as Record<string, unknown> | undefined;
        if (!pin || typeof pin !== 'object' || Array.isArray(pin) ||
            pin.registryVersion !== 'gallery-scene-scoped@r15' ||
            typeof pin.expectedGraphSha256 !== 'string' ||
            !/^[0-9a-f]{64}$/.test(pin.expectedGraphSha256)) {
          return reply({ok:false,error:'R15_EXPECTED_GRAPH_PIN_REQUIRED'},409);
        }
        params.p_expected_graph_sha256 = pin.expectedGraphSha256;
        break;
      case 'publishGalleryPhoto':
        if (payload.workId != null && (typeof payload.workId !== 'string' || payload.workId.length===0)) {
          return reply({ok:false,error:'GALLERY_WORK_ID_INVALID'},400);
        }
        if (!Array.isArray(payload.mediaIds) || payload.mediaIds.length<1 || payload.mediaIds.length>10
            || payload.mediaIds.some(x=>typeof x!=='string')) {
          return reply({ok:false,error:'GALLERY_MEDIA_SELECTION_INVALID'},400);
        }
        if (!['outdoor','indoor','tom_furniture','tom_clothing'].includes(String(payload.galleryKind??''))) {
          return reply({ok:false,error:'GALLERY_KIND_UNSUPPORTED'},400);
        }
        if (typeof payload.subjectId!=='string' || typeof payload.creatorProfileId!=='string'
            || typeof payload.coverMediaId!=='string' || typeof payload.title!=='string'
            || typeof payload.idempotencyKey!=='string') {
          return reply({ok:false,error:'GALLERY_REQUEST_INVALID'},400);
        }
        params.p_creator_profile_id=payload.creatorProfileId;
        params.p_work_id=payload.workId ?? null;
        params.p_expected_version=payload.expectedVersion ?? null;
        params.p_gallery_kind=payload.galleryKind;
        params.p_subject_id=payload.subjectId;
        params.p_title=payload.title;
        params.p_description=payload.description ?? null;
        params.p_media_ids=payload.mediaIds;
        params.p_cover_media_id=payload.coverMediaId;
        params.p_originality_attested=payload.originalityAttested === true;
        params.p_idempotency_key=payload.idempotencyKey;
        break;
      case 'deleteGalleryPhoto':
        params.p_work_id=payload.workId;
        params.p_expected_version=payload.expectedVersion;
        params.p_idempotency_key=payload.idempotencyKey;
        break;
      case 'registerDreamsnapWork':
        params.p_creator_profile_id = payload.creatorProfileId;
        params.p_challenge_id = payload.challengeId;
        params.p_workspace_id = payload.workspaceId ?? null;
        params.p_media_id = payload.mediaId;
        params.p_caption = payload.caption ?? null;
        params.p_game_screenshot_attested = payload.gameScreenshotAttested === true;
        params.p_no_external_edits_attested = payload.noExternalEditsAttested === true;
        params.p_idempotency_key = payload.idempotencyKey;
        break;
      case 'updateDreamsnapWork':
        params.p_work_id = payload.workId;
        params.p_expected_version = payload.expectedVersion;
        params.p_media_id = payload.mediaId;
        params.p_caption = payload.caption ?? null;
        params.p_game_screenshot_attested = payload.gameScreenshotAttested === true;
        params.p_no_external_edits_attested = payload.noExternalEditsAttested === true;
        params.p_idempotency_key = payload.idempotencyKey;
        break;
      case 'joinDreamsnapEvent':
        params.p_work_id = payload.workId;
        params.p_idempotency_key = payload.idempotencyKey;
        break;
      case 'replaceDreamsnapEntryRevision':
        params.p_entry_id = payload.entryId;
        params.p_revision_id = payload.revisionId;
        break;
      case 'castDreamsnapVote':
        params.p_challenge_id = payload.challengeId;
        params.p_entry_id = payload.entryId;
        break;
      case 'addDreamsnapBrowseReaction':
        params.p_challenge_id = payload.challengeId;
        params.p_entry_id = payload.entryId;
        params.p_reaction_kind = payload.reactionKind;
        break;
      case 'addDreamsnapSpecialPick':
        params.p_challenge_id = payload.challengeId;
        params.p_entry_id = payload.entryId;
        break;
      case 'setDreamsnapOfficialAccountConsent': {
        if (typeof payload.enabled !== 'boolean' ||
            !Number.isSafeInteger(payload.expectedVersion) ||
            Number(payload.expectedVersion)<0 ||
            (payload.enabled === true && payload.acknowledgedScope !== true)) {
          return reply({ok:false,error:'D06_ACCOUNT_CONSENT_REQUEST_INVALID'},400);
        }
        params.p_enabled = payload.enabled;
        params.p_expected_version = payload.expectedVersion;
        params.p_acknowledged_scope = payload.acknowledgedScope === true;
        params.p_issued_at_epoch = issuedAt;
        // SQL checks the actual session record rather than JWT age on ON.
        params.p_session_id = /^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(sessionId) ? sessionId : null;
        if (payload.enabled === true && !params.p_session_id) {
          return reply({ok:false,error:'D06_RECENT_SESSION_REQUIRED'},401);
        }
        break;
      }
      case 'publishDreamsnapGallery':
        params.p_entry_id = payload.entryId;
        params.p_comments_enabled = payload.commentsEnabled !== false;
        break;
      case 'saveEntity':
      case 'unsaveEntity':
        params.p_target_entity_id = payload.targetEntityId;
        break;
      case 'followCreator':
      case 'unfollowCreator':
        params.p_creator_profile_id = payload.creatorProfileId;
        break;
      case 'addReaction':
      case 'removeReaction':
        params.p_target_entity_id = payload.targetEntityId;
        params.p_reaction_kind = payload.reactionKind;
        break;
      case 'addComment':
        params.p_creator_profile_id = payload.creatorProfileId;
        params.p_target_entity_id = payload.targetEntityId;
        params.p_parent_comment_id = payload.parentCommentId ?? null;
        params.p_body = payload.body;
        params.p_idempotency_key = payload.idempotencyKey;
        break;
      case 'setGalleryCommentsEnabled':
        params.p_work_id = payload.workId;
        params.p_enabled = payload.enabled;
        break;
      case 'setGalleryCommentsAtomicR16':
        if (typeof payload.workId !== 'string' || !Number.isSafeInteger(payload.expectedVersion) ||
            typeof payload.expectedCurrentRevisionId !== 'string' ||
            typeof payload.enabled !== 'boolean' ||
            typeof payload.idempotencyKey !== 'string' || payload.idempotencyKey.length===0) {
          return reply({ok:false,error:'R16_METADATA_PIN_REQUIRED'},409);
        }
        params.p_work_id = payload.workId;
        params.p_expected_version = payload.expectedVersion;
        params.p_expected_current_revision_id = payload.expectedCurrentRevisionId;
        params.p_enabled = payload.enabled;
        params.p_idempotency_key = payload.idempotencyKey;
        break;
      case 'removeGalleryComment':
        params.p_work_id = payload.workId;
        params.p_comment_id = payload.commentId;
        params.p_reason = payload.reason;
        break;
      case 'askQuestion':
        params.p_creator_profile_id = payload.creatorProfileId;
        params.p_title = payload.title;
        params.p_body = payload.body;
        params.p_context_tags = payload.contextTags;
        params.p_platform = payload.platform ?? null;
        params.p_game_version = payload.gameVersion ?? null;
        params.p_idempotency_key = payload.idempotencyKey;
        break;
      case 'addAnswer':
        params.p_creator_profile_id = payload.creatorProfileId;
        params.p_question_id = payload.questionId;
        params.p_body = payload.body;
        params.p_idempotency_key = payload.idempotencyKey;
        break;
      case 'setSameHere':
        params.p_question_id = payload.questionId;
        params.p_active = payload.active === true;
        break;
      case 'setAnswerUtility':
        params.p_answer_id = payload.answerId;
        params.p_utility_kind = payload.utility ?? null;
        break;
      case 'resolveQuestion':
        params.p_question_id = payload.questionId;
        params.p_accepted_answer_id = payload.acceptedAnswerId ?? null;
        params.p_solution_note = payload.solutionNote ?? null;
        break;
      case 'createTip':
        params.p_creator_profile_id = payload.creatorProfileId;
        params.p_title = payload.title;
        params.p_body = payload.body;
        params.p_context_tags = Array.isArray(payload.contextTags) ? payload.contextTags : null;
        params.p_platform = payload.platform ?? null;
        params.p_game_version = payload.gameVersion ?? null;
        params.p_source_question_id = payload.sourceQuestionId ?? null;
        params.p_source_answer_id = payload.sourceAnswerId ?? null;
        params.p_idempotency_key = payload.idempotencyKey;
        break;
      case 'setQaFreshness':
        params.p_target_entity_id = payload.targetEntityId;
        params.p_freshness = payload.freshness;
        break;
      case 'removeOutdatedQa':
        params.p_target_entity_id = payload.targetEntityId;
        break;
      case 'withdrawDuplicateQuestion':
        params.p_question_id = payload.questionId;
        params.p_target_question_id = payload.targetQuestionId;
        break;
      case 'reportEntity':
        params.p_target_entity_id = payload.targetEntityId;
        params.p_reason_code = payload.reasonCode;
        params.p_detail = payload.detail ?? null;
        params.p_idempotency_key = payload.idempotencyKey;
        break;
      case 'changeVisibility':
        params.p_work_id = payload.workId;
        params.p_expected_version = payload.expectedVersion;
        params.p_visibility = payload.visibility;
        params.p_idempotency_key = payload.idempotencyKey;
        break;
      case 'unpublishWork':
      case 'deleteWork':
        params.p_work_id = payload.workId;
        params.p_expected_version = payload.expectedVersion;
        params.p_idempotency_key = payload.idempotencyKey;
        break;
      case 'moderateWork':
        if (!sessionId) {
          return reply({ ok: false, error: 'JWT session-id claim missing' }, 401);
        }
        params.p_session_id = sessionId;
        params.p_issued_at_epoch = issuedAt;
        params.p_case_id = payload.caseId;
        params.p_action = payload.action;
        params.p_reason = payload.reason;
        break;
      case 'retryDeadLetter':
        params.p_outbox_id = payload.outboxId;
        params.p_reason = payload.reason;
        break;
      case 'createDdvProfileWorkspace':
        params.p_relationship_kind = payload.relationshipKind ?? 'self';
        break;
      case 'updateDdvProfileWorkspace':
        if (typeof payload.workspaceId !== 'string' || payload.workspaceId.length === 0) {
          return reply({ ok: false, error: 'workspaceId required' }, 400);
        }
        if (payload.lifecycleState !== 'active' && payload.lifecycleState !== 'archived') {
          return reply({ ok: false, error: 'lifecycleState must be active or archived' }, 400);
        }
        if (
          payload.displayName !== null &&
          payload.displayName !== undefined &&
          typeof payload.displayName !== 'string'
        ) {
          return reply({ ok: false, error: 'displayName must be a string or null' }, 400);
        }
        params.p_workspace_id = payload.workspaceId;
        params.p_display_name = payload.displayName ?? null;
        params.p_lifecycle_state = payload.lifecycleState;
        break;
      case 'deleteDdvProfileWorkspace':
        if (!sessionId) {
          return reply({ ok: false, error: 'JWT session-id claim missing' }, 401);
        }
        if (typeof payload.workspaceId !== 'string' || payload.workspaceId.length === 0) {
          return reply({ ok: false, error: 'workspaceId required' }, 400);
        }
        if (payload.confirmation !== 'DELETE') {
          return reply({ ok: false, error: 'DELETE confirmation required' }, 400);
        }
        params.p_session_id = sessionId;
        params.p_issued_at_epoch = issuedAt;
        params.p_workspace_id = payload.workspaceId;
        params.p_confirmation = payload.confirmation;
        break;
      case 'associateDdvIdentity': {
        if (typeof payload.workspaceId !== 'string' || payload.workspaceId.length === 0) {
          return reply({ ok: false, error: 'workspaceId required' }, 400);
        }
        const playerId = typeof payload.playerId === 'string' ? payload.playerId : '';
        let bindingDigest: string;
        try {
          bindingDigest = await deriveDdvIdentityDigest(playerId);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'DDV_IDENTITY_ASSOCIATION_FAILED';
          if (message === 'DDV_PROFILE_BINDING_KEY_UNAVAILABLE') {
            return reply({ ok: false, error: message }, 500);
          }
          return reply({ ok: false, error: 'INVALID_DDV_PLAYER_ID' }, 400);
        }
        params.p_workspace_id = payload.workspaceId;
        params.p_binding_key_hash = bindingDigest;
        break;
      }
      case 'unlinkDdvIdentity':
        if (typeof payload.workspaceId !== 'string' || payload.workspaceId.length === 0) {
          return reply({ ok: false, error: 'workspaceId required' }, 400);
        }
        params.p_workspace_id = payload.workspaceId;
        break;
      case 'revokeSessions':
        break;
    }

    if (command === 'publishGalleryPhoto') {
      // This supplements (NEVER replaces) the canonical atomic SQL checks.
      // The DB owns owner/READY/CLEAR and actual Work revision mutation.
      const { data: manifest, error: manifestError } = await ctx.supabaseAdmin.rpc(
        'community_gallery_photo_owned_media_manifest_v1', {
          p_auth_subject: subject, p_media_ids: params.p_media_ids
        }
      );
      if (manifestError || !manifest || !Array.isArray(manifest.items) ||
          manifest.items.length !== (params.p_media_ids as string[]).length) {
        return reply({ ok:false, error:'GALLERY_MEDIA_NOT_READY_OR_NOT_OWNED' },403);
      }
      // READY alone is insufficient: reject orphan MediaAsset rows whose
      // Storage object has already disappeared or differs in actual size.
      for (const item of manifest.items) {
        const { data: object, error: objectError } = await ctx.supabaseAdmin.storage
          .from(resolveMediaBucketForGallery()).info(String(item.storageKey));
        if (objectError || !object || Number(object.size) !== Number(item.byteSize)) {
          return reply({ok:false,error:'GALLERY_MEDIA_STORAGE_OBJECT_UNAVAILABLE'},409);
        }
      }
    }

    // R14 SOURCE-SCOPED actual Gallery v4 writer only. Every separate RPC is
    // a NEW PostgreSQL transaction, never a statement/savepoint replay.
    // Reauthorization checks the real JWT subject, current Identity, session
    // cutoff and Privacy barrier before EVERY attempt; semantic stale
    // owner/version/idempotency errors are terminal, not retryable.
    const maxAttempts = (command === 'publishGallery' || command === 'setGalleryCommentsAtomicR16') ? 3 : 1;
    const retryStartedAt = Date.now();
    let data: unknown = null;
    let error: {code?: string; message: string} | null = null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        const {error: reauthError} = await ctx.supabaseAdmin.rpc(
          'community_authorize_session',authorizationParams
        );
        if (reauthError) return reply({ok:false,error:'SESSION_REVOKED_OR_PRIVACY_SUPPRESSED'},401);
      }
      const outcome = await ctx.supabaseAdmin.rpc(rpc,params);
      data=outcome.data;
      error=outcome.error;
      if (!error) break;
      const transient =
        ['40P01','55P03','40001'].includes(String(error.code ?? '')) ||
        error.message.includes('R14_GRAPH_CHANGED_RETRY_WHOLE_TRANSACTION') ||
        error.message.includes('R14_ARTIFACT_ROSTER_CHANGED_RETRY_WHOLE_TRANSACTION');
      if (!transient || attempt+1>=maxAttempts ||
          Date.now()-retryStartedAt>1700) break;
      // Bounded jitter is safe only because the DB mutation RPC itself
      // rolls back ALL revisions/Search/Outbox/idempotency on an error.
      await new Promise(resolve => setTimeout(resolve,30+Math.floor(Math.random()*65)));
    }
    if (error) {
      const unenrolledGraphWriter =
        error.message.includes('R17_LEGACY_GALLERY_COMMENTS_PIN_REQUIRED') ||
        error.message.includes('R17_PHOTO_DEPENDENCY_NOT_ENROLLED');
      const staleGraph = error.message.includes('R15_STALE_GRAPH_TERMINAL') ||
        error.message.includes('R15_PINNED_GRAPH_REQUIRED') ||
        error.message.includes('R15_IDEMPOTENCY_REQUEST_CONFLICT') ||
        error.message.includes('R16_STALE_WORK_TERMINAL') ||
        error.message.includes('R16_IDEMPOTENCY_CONFLICT') ||
        error.message.includes('D06_STALE_ACCOUNT_CONSENT');
      const conflict =
        error.message.includes('Row version conflict') ||
        error.message.includes('GALLERY_ROW_VERSION_CONFLICT') ||
        error.message.includes('GALLERY_IDEMPOTENCY_CONFLICT') ||
        error.message.includes('Idempotency key reused') ||
        error.message.includes('DDV_PROFILE_WORKSPACE_LIMIT_REACHED') ||
        error.message.includes('DDV_IDENTITY_ASSOCIATION_EXISTS') ||
        error.message.includes('DDV_IDENTITY_ALREADY_ASSOCIATED_IN_ACCOUNT') ||
        error.message.includes('already used its DreamSnaps entry right') ||
        error.message.includes('allowance is exhausted') ||
        error.message.includes('already judged') ||
        error.message.includes('already has this Wand Account Special Pick') ||
        error.message.includes('entry revision is frozen');
      const recentAuth = error.message.includes('Recent authentication required');
      const forbidden =
        recentAuth ||
        error.message.includes('DDV Profile Workspace not found') ||
        error.message.includes('does not own') ||
        error.message.includes('GALLERY_WORK_FORBIDDEN') ||
        error.message.includes('GALLERY_CREATOR_FORBIDDEN') ||
        error.message.includes('not accessible') ||
        error.message.includes('not active') ||
        error.message.includes('role required') ||
        error.message.includes('Self-judging') ||
        error.message.includes('Self Special Pick') ||
        error.message.includes('DREAMSNAP_REAL_ENTRY_FLOOR_NOT_MET') ||
        error.message.includes('D06_ACCOUNT_UNAVAILABLE') ||
        error.message.includes('Recent authentication required') ||
        error.message.includes('Session-bound recent authentication required');

      const galleryErrorCode =
        (command === 'publishGalleryPhoto' || command === 'deleteGalleryPhoto')
          ? /^GALLERY_[A-Z0-9_]+/.exec(error.message)?.[0] ?? null
          : null;

      return reply(
        {
          ok: false,
          error: unenrolledGraphWriter ? 'UNENROLLED_GRAPH_WRITER' : staleGraph ? 'STALE_GRAPH' : galleryErrorCode ?? (recentAuth
            ? 'RECENT_AUTH_REQUIRED'
            : conflict
              ? 'CONFLICT'
              : forbidden
                ? 'FORBIDDEN'
                : 'COMMAND_FAILED'),
          message: error.message
        },
        (unenrolledGraphWriter || staleGraph || conflict) ? 409 : forbidden ? 403 : 400
      );
    }

    return reply({ ok: true, command, data });
});

export default {
  fetch(req: Request) {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
    return authenticatedFetch(req);
  }
};
