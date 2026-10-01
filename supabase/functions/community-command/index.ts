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
  moderateWork: 'community_moderate_work_v2',
  retryDeadLetter: 'community_retry_dead_letter_outbox',
  revokeSessions: 'community_revoke_wand_sessions',
  linkDdvProfile: 'community_link_ddv_profile_v1'
} as const;

type CommandName = keyof typeof commandToRpc;

const commandToRateBucket: Partial<Record<CommandName, string>> = {
  updateCreatorProfile: 'profile_write',
  createGalleryDraft: 'gallery_write',
  publishGallery: 'gallery_write',
  saveEntity: 'save',
  unsaveEntity: 'save',
  followCreator: 'follow',
  unfollowCreator: 'follow',
  addReaction: 'reaction',
  removeReaction: 'reaction',
  addComment: 'comment',
  reportEntity: 'report',
  changeVisibility: 'gallery_write',
  unpublishWork: 'gallery_write',
  deleteWork: 'gallery_write',
  moderateWork: 'moderation_write',
  linkDdvProfile: 'ddv_profile_link'
};

const textEncoder = new TextEncoder();

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, '0')).join('');
}

async function deriveDdvProfileBindingDigest(playerId: string): Promise<string> {
  const linkMode = Deno.env.get('COMMUNITY_DDV_PROFILE_LINK_MODE')?.trim() ?? 'disabled';
  if (linkMode !== 'local-player-id') {
    throw new Error('DDV_PROFILE_LINK_DISABLED');
  }

  const secret = Deno.env.get('COMMUNITY_DDV_PROFILE_BINDING_KEY_V1') ?? '';
  if (secret.length < 32) {
    throw new Error('DDV_PROFILE_BINDING_KEY_UNAVAILABLE');
  }

  if (
    playerId.length < 4 ||
    playerId.length > 128 ||
    playerId !== playerId.trim() ||
    !/^[\\x21-\\x7E]+$/.test(playerId)
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
  const input = textEncoder.encode(`dreamwishwand/ddv-player-id/v1\\0${playerId}`);
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
      case 'linkDdvProfile': {
        if (!sessionId) {
          return reply({ ok: false, error: 'JWT session-id claim missing' }, 401);
        }

        const playerId = typeof payload.playerId === 'string' ? payload.playerId : '';
        let bindingDigest: string;
        try {
          bindingDigest = await deriveDdvProfileBindingDigest(playerId);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'DDV_PROFILE_LINK_FAILED';
          if (message === 'DDV_PROFILE_LINK_DISABLED') {
            return reply({ ok: false, error: message }, 503);
          }
          if (message === 'DDV_PROFILE_BINDING_KEY_UNAVAILABLE') {
            return reply({ ok: false, error: message }, 500);
          }
          return reply({ ok: false, error: 'INVALID_DDV_PLAYER_ID' }, 400);
        }

        params.p_session_id = sessionId;
        params.p_issued_at_epoch = issuedAt;
        params.p_binding_key_hash = bindingDigest;
        params.p_relationship_kind = payload.relationshipKind ?? 'self';
        break;
      }
      case 'revokeSessions':
        break;
    }

    const { data, error } = await ctx.supabaseAdmin.rpc(rpc, params);
    if (error) {
      const conflict =
        error.message.includes('Row version conflict') ||
        error.message.includes('Idempotency key reused') ||
        error.message.includes('DDV_PROFILE_ALREADY_LINKED') ||
        error.message.includes('DDV_PROFILE_COOLDOWN_ACTIVE') ||
        error.message.includes('A Wand Account may link at most three DDV Profiles');
      const recentAuth = error.message.includes('Recent authentication required');
      const forbidden =
        recentAuth ||
        error.message.includes('does not own') ||
        error.message.includes('not accessible') ||
        error.message.includes('not active') ||
        error.message.includes('role required');

      return reply(
        {
          ok: false,
          error: recentAuth
            ? 'RECENT_AUTH_REQUIRED'
            : conflict
              ? 'CONFLICT'
              : forbidden
                ? 'FORBIDDEN'
                : 'COMMAND_FAILED',
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
