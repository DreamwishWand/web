import { withSupabase } from 'npm:@supabase/server';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

type JsonObject = Record<string, unknown>;

const ALLOWED = new Set([
  'community_get_creator_public_v1',
  'community_get_gallery_public_v1',
  'community_get_question_public_v1',
  'community_get_question_redirect_public_v1',
  'community_get_tip_public_v1',
  'community_search_questions_v1'
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function reply(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=30' }
  });
}

function singleUuidPayload(rpc: string, payload: JsonObject): JsonObject | null {
  const key =
    rpc === 'community_get_creator_public_v1' ? 'p_creator_profile_id' :
    rpc === 'community_get_gallery_public_v1' ? 'p_work_id' :
    rpc === 'community_get_question_public_v1' || rpc === 'community_get_question_redirect_public_v1'
      ? 'p_question_id' :
    rpc === 'community_get_tip_public_v1' ? 'p_tip_id' :
    null;

  if (!key) return null;
  const value = payload[key];
  if (typeof value !== 'string' || !UUID_RE.test(value)) return null;
  return { [key]: value };
}

function sanitizeSearchQuestions(payload: JsonObject): JsonObject | null {
  const rawQuery = payload.p_query;
  const query =
    rawQuery == null ? null :
    typeof rawQuery === 'string' && rawQuery.length <= 500 ? rawQuery :
    undefined;
  if (query === undefined) return null;

  const rawTags = payload.p_context_tags;
  let tags: string[] | null = null;
  if (rawTags != null) {
    if (!Array.isArray(rawTags) || rawTags.length > 16) return null;
    tags = [];
    for (const tag of rawTags) {
      if (typeof tag !== 'string' || tag.length < 1 || tag.length > 120) return null;
      tags.push(tag);
    }
  }

  const unanswered = payload.p_unanswered_only;
  if (unanswered != null && typeof unanswered !== 'boolean') return null;

  const rawLimit = payload.p_limit;
  const limit =
    rawLimit == null ? 30 :
    Number.isInteger(rawLimit) ? Math.max(1, Math.min(50, Number(rawLimit))) :
    NaN;
  if (!Number.isFinite(limit)) return null;

  return {
    p_query: query,
    p_context_tags: tags,
    p_unanswered_only: unanswered ?? false,
    p_limit: limit
  };
}

const publicFetch = withSupabase({ auth: 'none' }, async (req, ctx) => {
  if (req.method !== 'POST') return reply({ error: 'POST required' }, 405);

  let body: JsonObject;
  try {
    body = await req.json();
  } catch {
    return reply({ error: 'Invalid JSON body' }, 400);
  }

  const rpc = typeof body.rpc === 'string' ? body.rpc : '';
  const payload =
    body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)
      ? body.payload as JsonObject
      : {};

  if (!ALLOWED.has(rpc)) return reply({ error: 'Unsupported public query' }, 400);

  const params =
    rpc === 'community_search_questions_v1'
      ? sanitizeSearchQuestions(payload)
      : singleUuidPayload(rpc, payload);

  if (!params) return reply({ error: 'Invalid public query parameters' }, 400);

  const { data, error } = await ctx.supabaseAdmin.rpc(rpc, params);
  if (error) {
    const notFound =
      error.message.includes('not found') ||
      error.message.includes('not accessible');
    return reply({ error: notFound ? 'NOT_FOUND' : 'PUBLIC_QUERY_FAILED' }, notFound ? 404 : 400);
  }

  return reply(data);
});

export default {
  fetch(req: Request) {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    return publicFetch(req);
  }
};
