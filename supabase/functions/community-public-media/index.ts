import { withSupabase } from 'npm:@supabase/server';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const KNOWN_STAGING_PROJECT_REF = 'ptpdoxhrqopvczpclcij';

function bucketName(): string {
  const explicit = Deno.env.get('COMMUNITY_MEDIA_BUCKET')?.trim();
  if (explicit) return explicit;
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  if (url.includes(KNOWN_STAGING_PROJECT_REF)) return 'community-media-staging';
  throw new Error('COMMUNITY_MEDIA_BUCKET is required outside the known staging project.');
}

function reply(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=60' }
  });
}

const publicFetch = withSupabase({ auth: 'none' }, async (req, ctx) => {
  if (req.method !== 'POST') return reply({ ok: false, error: 'POST required' }, 405);

  let body: { mediaId?: unknown };
  try {
    body = await req.json();
  } catch {
    return reply({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  const mediaId = typeof body.mediaId === 'string' ? body.mediaId : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(mediaId)) {
    return reply({ ok: false, error: 'Valid mediaId required' }, 400);
  }

  const { data: media, error: mediaError } = await ctx.supabaseAdmin.rpc(
    'community_get_public_media_storage_v2',
    { p_media_id: mediaId }
  );
  if (mediaError || !media) {
    return reply({ ok: false, error: 'MEDIA_NOT_PUBLIC' }, 404);
  }

  const { data: signed, error: signError } = await ctx.supabaseAdmin.storage
    .from(bucketName())
    .createSignedUrl(String(media.storageKey), 300);

  if (signError || !signed?.signedUrl) {
    return reply({ ok: false, error: 'MEDIA_SIGN_FAILED' }, 500);
  }

  return reply({
    ok: true,
    media: {
      mediaId: media.mediaId,
      mimeType: media.mimeType,
      byteSize: media.byteSize,
      width: media.width,
      height: media.height,
      checksumSha256: media.checksumSha256,
      signedUrl: signed.signedUrl,
      expiresInSeconds: 300
    }
  });
});

export default {
  fetch(req: Request) {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    return publicFetch(req);
  }
};
