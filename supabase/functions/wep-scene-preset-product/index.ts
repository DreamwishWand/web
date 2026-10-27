import { withSupabase } from 'npm:@supabase/server';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

function reply(body: unknown, status: number) {
  return Response.json(body, { status, headers: { ...corsHeaders, 'Cache-Control': 'private, no-store' } });
}

const authenticatedFetch = withSupabase({ auth: 'user' }, async (req, ctx) => {
  if (req.method !== 'POST') return reply({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  const subject = ctx.userClaims?.id;
  const issuedAt = Number(ctx.jwtClaims?.iat ?? 0);
  if (!subject || !Number.isInteger(issuedAt) || issuedAt <= 0) {
    return reply({ok:false,error:'SESSION_REVOKED_OR_INVALID'},401);
  }
  const {data: session, error: sessionError} = await ctx.supabaseAdmin.rpc('community_authorize_session', {
    p_auth_subject: subject,
    p_issued_at_epoch: issuedAt,
    p_max_age_seconds: null
  });
  if (sessionError || !session?.accountId) {
    return reply({ok:false,error:'SESSION_REVOKED_OR_INVALID'},401);
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return reply({ok:false,error:'INVALID_REQUEST'},400);
  }
  const action = typeof body.action === 'string' ? body.action : '';
  const physical = action === 'discard' || action === 'compensate' || action === 'cleanup';
  return reply({
    ok:false,
    action,
    error:physical
      ? 'R18_SCENE_PRODUCT_STORAGE_CLEANUP_NOT_AUTHORIZED'
      : 'R18_SCENE_PRODUCT_WRITER_NOT_ENROLLED',
    publicationAuthorized:false,
    retirementAuthorized:false,
    cleanupAuthorized:false,
    providerCopyAuthorized:false,
    verificationAttested:false,
    operatorRolloutRequired:true
  },409);
});

export default {
  fetch(req: Request) {
    if (req.method === 'OPTIONS') return new Response('ok', {headers: corsHeaders});
    return authenticatedFetch(req);
  }
};
