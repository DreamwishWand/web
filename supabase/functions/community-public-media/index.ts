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
    headers: { ...corsHeaders, 'Cache-Control': 'private, no-store', 'Pragma': 'no-cache', 'Vary': 'Origin' }
  });
}

const MEDIA_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTENT_MIMES = new Set(['image/jpeg','image/png','image/webp']);

const publicFetch = withSupabase({ auth: 'none' }, async (req, ctx) => {
  const requestUrl = new URL(req.url);
  if (req.method !== 'POST' && req.method !== 'GET') {
    return reply({ok:false,error:'GET or POST required'},405);
  }
  let mediaId = '';
  if (req.method === 'GET') {
    mediaId = requestUrl.searchParams.get('mediaId') ?? '';
  } else {
    let body:{mediaId?:unknown};
    try { body = await req.json(); }
    catch { return reply({ok:false,error:'Invalid JSON body'},400); }
    mediaId = typeof body.mediaId === 'string' ? body.mediaId : '';
  }
  if (!MEDIA_ID_RE.test(mediaId)) return reply({ok:false,error:'Valid mediaId required'},400);

  // The existing public issuer must consult the Gallery *historical* revision
  // boundary BEFORE its legacy Dreamsnap signed-URL fallback. Any Gallery photo
  // (current or historical) can never receive another raw Storage token here.
  const {data:gallery,error:galleryError}=await ctx.supabaseAdmin.rpc(
    'community_gallery_media_gateway_v1',{p_media_id:mediaId}
  );
  if (galleryError || !gallery || typeof gallery.galleryManaged!=='boolean') {
    return reply({ok:false,error:'GALLERY_MEDIA_AUTHORITY_UNAVAILABLE'},503);
  }
  if (gallery.galleryManaged === true) {
    if (gallery.publiclyAccessible !== true) {
      return reply({ok:false,error:'MEDIA_NOT_PUBLIC'},404);
    }
    const mimeType=String(gallery.mimeType??'');
    if (!CONTENT_MIMES.has(mimeType) ||
      !Number.isInteger(Number(gallery.byteSize)) ||
      Number(gallery.byteSize)<1 || Number(gallery.byteSize)>20971520) {
      return reply({ok:false,error:'GALLERY_MEDIA_INVALID'},404);
    }
    if (req.method === 'POST') {
      const streamUrl=`${requestUrl.origin}${requestUrl.pathname}?mediaId=${encodeURIComponent(mediaId)}`;
      return reply({
        ok:true,media:{
          mediaId,transport:'edge_proxy',
          streamUrl,rawStorageSignedUrlIssued:false,
          mimeType,byteSize:gallery.byteSize,width:gallery.width,
          height:gallery.height,checksumSha256:gallery.checksumSha256
        }
      });
    }
    // Every GET reauthorizes the current public Gallery revision. Neither
    // browser nor CDN gets a public Storage signed URL. In-flight requests or
    // bytes already copied before retirement cannot be retroactively revoked.
    const {data:blob,error:downloadError}=await ctx.supabaseAdmin.storage
      .from(bucketName()).download(String(gallery.storageKey));
    if (downloadError || !blob) return reply({ok:false,error:'GALLERY_MEDIA_STORAGE_UNAVAILABLE'},404);
    if (blob.size !== Number(gallery.byteSize)) return reply({ok:false,error:'GALLERY_MEDIA_STORAGE_SIZE_MISMATCH'},409);
    return new Response(blob.stream(),{
      status:200,
      headers:{
        ...corsHeaders,
        'Content-Type':mimeType,
        'Content-Length':String(gallery.byteSize),
        'Cache-Control':'private, no-store, max-age=0',
        'CDN-Cache-Control':'no-store',
        'Surrogate-Control':'no-store',
        'Pragma':'no-cache',
        'Vary':'Origin',
        'X-Content-Type-Options':'nosniff'
      }
    });
  }

  // Existing DreamSnaps and other non-Gallery consumers retain the established
  // behavior; this change must NOT suppress official DreamSnaps media.
  if (req.method === 'GET') return reply({ok:false,error:'MEDIA_NOT_GALLERY'},404);
  const { data: media, error: mediaError } = await ctx.supabaseAdmin.rpc(
    'community_get_public_media_storage_v2',
    { p_media_id: mediaId }
  );
  if (mediaError || !media) return reply({ok:false,error:'MEDIA_NOT_PUBLIC'},404);
  const { data: signed, error: signError } = await ctx.supabaseAdmin.storage
    .from(bucketName()).createSignedUrl(String(media.storageKey),300);
  if (signError || !signed?.signedUrl) {
    return reply({ok:false,error:'MEDIA_SIGN_FAILED'},500);
  }
  return reply({
    ok:true,
    media:{
      mediaId:media.mediaId,mimeType:media.mimeType,
      byteSize:media.byteSize,width:media.width,height:media.height,
      checksumSha256:media.checksumSha256,
      signedUrl:signed.signedUrl,
      expiresInSeconds:300
    }
  });
});

export default {
  fetch(req: Request) {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    return publicFetch(req);
  }
};
