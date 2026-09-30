import { withSupabase } from 'npm:@supabase/server';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

type JsonObject = Record<string, unknown>;

const commandToRpc = {
  ensureAccountCreator: 'community_ensure_account_creator',
  updateCreatorProfile: 'community_update_creator_profile',
  createGalleryDraft: 'community_create_gallery_draft',
  publishGallery: 'community_publish_gallery_v3',
  saveEntity: 'community_save_entity',
  unsaveEntity: 'community_unsave_entity',
  followCreator: 'community_follow_creator',
  unfollowCreator: 'community_unfollow_creator',
  addReaction: 'community_add_reaction',
  removeReaction: 'community_remove_reaction',
  addComment: 'community_add_comment',
  reportEntity: 'community_report_entity',
  changeVisibility: 'community_change_work_visibility',
  unpublishWork: 'community_unpublish_work',
  deleteWork: 'community_delete_work',
  moderateWork: 'community_moderate_work',
  retryDeadLetter: 'community_retry_dead_letter_outbox',
  revokeSessions: 'community_revoke_wand_sessions'
} as const;

type CommandName = keyof typeof commandToRpc;

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
        params.p_idempotency_key = payload.idempotencyKey;
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
        params.p_case_id = payload.caseId;
        params.p_action = payload.action;
        params.p_reason = payload.reason;
        break;
      case 'retryDeadLetter':
        params.p_outbox_id = payload.outboxId;
        params.p_reason = payload.reason;
        break;
      case 'revokeSessions':
        break;
    }

    const { data, error } = await ctx.supabaseAdmin.rpc(rpc, params);
    if (error) {
      const conflict =
        error.message.includes('Row version conflict') ||
        error.message.includes('Idempotency key reused');
      const forbidden =
        error.message.includes('does not own') ||
        error.message.includes('not accessible') ||
        error.message.includes('not active') ||
        error.message.includes('role required');

      return reply(
        {
          ok: false,
          error: conflict ? 'CONFLICT' : forbidden ? 'FORBIDDEN' : 'COMMAND_FAILED',
          message: error.message
        },
        conflict ? 409 : forbidden ? 403 : 400
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
