import { withSupabase } from 'npm:@supabase/server';

type JsonObject = Record<string, unknown>;

const commandToRpc = {
  ensureAccountCreator: 'community_ensure_account_creator',
  createGalleryDraft: 'community_create_gallery_draft',
  publishGallery: 'community_publish_gallery',
  saveEntity: 'community_save_entity',
  followCreator: 'community_follow_creator',
  addReaction: 'community_add_reaction',
  addComment: 'community_add_comment',
  reportEntity: 'community_report_entity'
} as const;

type CommandName = keyof typeof commandToRpc;

function badRequest(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return badRequest('POST required', 405);

    const subject = ctx.userClaims?.sub;
    if (!subject) return badRequest('Authenticated subject missing', 401);

    let body: { command?: string; payload?: JsonObject };
    try {
      body = await req.json();
    } catch {
      return badRequest('Invalid JSON body');
    }

    if (!body.command || !(body.command in commandToRpc)) {
      return badRequest('Unsupported command');
    }

    const command = body.command as CommandName;
    const payload = body.payload ?? {};
    const rpc = commandToRpc[command];

    const params: JsonObject = { p_auth_subject: subject };

    switch (command) {
      case 'ensureAccountCreator':
        params.p_handle = payload.handle;
        params.p_display_name = payload.displayName;
        break;
      case 'createGalleryDraft':
        params.p_creator_profile_id = payload.creatorProfileId;
        params.p_visibility = payload.visibility;
        params.p_gallery_kind = payload.galleryKind;
        params.p_idempotency_key = payload.idempotencyKey;
        break;
      case 'publishGallery':
        params.p_work_id = payload.workId;
        params.p_expected_version = payload.expectedVersion;
        params.p_title = payload.title;
        params.p_description = payload.description ?? null;
        params.p_idempotency_key = payload.idempotencyKey;
        break;
      case 'saveEntity':
        params.p_target_entity_id = payload.targetEntityId;
        break;
      case 'followCreator':
        params.p_creator_profile_id = payload.creatorProfileId;
        break;
      case 'addReaction':
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
    }

    const { data, error } = await ctx.supabaseAdmin.rpc(rpc, params);
    if (error) {
      const conflict =
        error.message.includes('Row version conflict') ||
        error.message.includes('Idempotency key reused');
      const forbidden =
        error.message.includes('does not own') ||
        error.message.includes('not accessible') ||
        error.message.includes('not active');

      return Response.json(
        {
          ok: false,
          error: conflict ? 'CONFLICT' : forbidden ? 'FORBIDDEN' : 'COMMAND_FAILED',
          message: error.message
        },
        { status: conflict ? 409 : forbidden ? 403 : 400 }
      );
    }

    return Response.json(
      { ok: true, command, data },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  })
};
