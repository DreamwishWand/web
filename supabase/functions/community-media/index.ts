import { withSupabase } from 'npm:@supabase/server';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const KNOWN_STAGING_PROJECT_REF = 'ptpdoxhrqopvczpclcij';

function resolveMediaBucket(): string {
  const explicit = Deno.env.get('COMMUNITY_MEDIA_BUCKET')?.trim();
  if (explicit) return explicit;

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  if (supabaseUrl.includes(KNOWN_STAGING_PROJECT_REF)) {
    return 'community-media-staging';
  }

  throw new Error('COMMUNITY_MEDIA_BUCKET is required outside the known staging project.');
}

const BUCKET = resolveMediaBucket();
const MAX_BYTES = 25 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

function reply(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { ...corsHeaders, 'Cache-Control': 'private, no-store' }
  });
}

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

function is(bytes: Uint8Array, offset: number, values: number[]) {
  return values.every((value, index) => bytes[offset + index] === value);
}

function detectImage(bytes: Uint8Array): { mimeType: string; width: number; height: number } {
  if (bytes.length >= 24 && is(bytes, 0, [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = view.getUint32(16, false);
    const height = view.getUint32(20, false);
    if (width > 0 && height > 0) return { mimeType: 'image/png', width, height };
  }

  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    const sof = new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      offset += 2;
      if (marker === 0xd8 || marker === 0xd9) continue;
      if (offset + 2 > bytes.length) break;
      const length = (bytes[offset] << 8) | bytes[offset + 1];
      if (length < 2 || offset + length > bytes.length) break;
      if (sof.has(marker) && length >= 7) {
        const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
        const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
        if (width > 0 && height > 0) return { mimeType: 'image/jpeg', width, height };
      }
      offset += length;
    }
  }

  if (
    bytes.length >= 30 &&
    is(bytes, 0, [0x52,0x49,0x46,0x46]) &&
    is(bytes, 8, [0x57,0x45,0x42,0x50])
  ) {
    const chunk = String.fromCharCode(bytes[12],bytes[13],bytes[14],bytes[15]);
    if (chunk === 'VP8X' && bytes.length >= 30) {
      const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
      const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
      return { mimeType: 'image/webp', width, height };
    }
    if (chunk === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2f) {
      const width = 1 + bytes[21] + ((bytes[22] & 0x3f) << 8);
      const height = 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10);
      return { mimeType: 'image/webp', width, height };
    }
    if (
      chunk === 'VP8 ' &&
      bytes.length >= 30 &&
      bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a
    ) {
      const width = (bytes[26] | (bytes[27] << 8)) & 0x3fff;
      const height = (bytes[28] | (bytes[29] << 8)) & 0x3fff;
      if (width > 0 && height > 0) return { mimeType: 'image/webp', width, height };
    }
  }

  throw new Error('Unsupported or malformed image');
}

const authenticatedFetch = withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return reply({ ok: false, error: 'POST required' }, 405);

    const subject = ctx.userClaims?.id;
    if (!subject) return reply({ ok: false, error: 'Authenticated subject missing' }, 401);

    const issuedAt = Number(ctx.jwtClaims?.iat ?? 0);
    if (!Number.isInteger(issuedAt) || issuedAt <= 0) {
      return reply({ ok: false, error: 'JWT issued-at claim missing' }, 401);
    }

    const { error: sessionError } = await ctx.supabaseAdmin.rpc(
      'community_authorize_session',
      {
        p_auth_subject: subject,
        p_issued_at_epoch: issuedAt,
        p_max_age_seconds: null
      }
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

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return reply({ ok: false, error: 'Invalid JSON body' }, 400);
    }

    const action = body.action;

    if (action === 'prepare') {
      const mimeType = String(body.mimeType ?? '');
      const byteSize = Number(body.byteSize ?? 0);
      const ext = EXTENSIONS[mimeType];
      if (!ext) return reply({ ok: false, error: 'Unsupported MIME type' }, 400);
      if (!Number.isFinite(byteSize) || byteSize <= 0 || byteSize > MAX_BYTES) {
        return reply({ ok: false, error: 'Invalid image size' }, 400);
      }

      const { data: rate, error: rateError } = await ctx.supabaseAdmin.rpc(
        'community_consume_action_rate_limit',
        {
          p_auth_subject: subject,
          p_bucket: 'media_prepare'
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

      const storageKey = `${subject}/${crypto.randomUUID()}.${ext}`;
      const { data, error } = await ctx.supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUploadUrl(storageKey);

      if (error || !data) {
        return reply({ ok: false, error: 'UPLOAD_PREPARE_FAILED', message: error?.message }, 400);
      }

      return reply({
        ok: true,
        action,
        storageKey,
        maxBytes: MAX_BYTES,
        signedUpload: data
      });
    }

    if (action === 'finalize') {
      const storageKey = String(body.storageKey ?? '');
      if (!storageKey.startsWith(`${subject}/`) || storageKey.includes('..')) {
        return reply({ ok: false, error: 'Invalid storage key' }, 403);
      }

      const { data: blob, error: downloadError } = await ctx.supabaseAdmin.storage
        .from(BUCKET)
        .download(storageKey);

      if (downloadError || !blob) {
        return reply({ ok: false, error: 'UPLOAD_NOT_FOUND', message: downloadError?.message }, 404);
      }

      if (blob.size <= 0 || blob.size > MAX_BYTES) {
        await ctx.supabaseAdmin.storage.from(BUCKET).remove([storageKey]);
        return reply({ ok: false, error: 'INVALID_FILE_SIZE' }, 400);
      }

      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let detected: { mimeType: string; width: number; height: number };
      try {
        detected = detectImage(bytes);
      } catch (error) {
        await ctx.supabaseAdmin.storage.from(BUCKET).remove([storageKey]);
        return reply({
          ok: false,
          error: 'INVALID_IMAGE',
          message: error instanceof Error ? error.message : 'Invalid image'
        }, 400);
      }

      const digest = await crypto.subtle.digest('SHA-256', buffer);
      const checksum = hex(digest);

      const { data, error } = await ctx.supabaseAdmin.rpc('community_register_validated_media', {
        p_auth_subject: subject,
        p_storage_key: storageKey,
        p_mime_type: detected.mimeType,
        p_byte_size: blob.size,
        p_width: detected.width,
        p_height: detected.height,
        p_checksum_sha256: checksum
      });

      if (error) {
        return reply({ ok: false, error: 'MEDIA_REGISTER_FAILED', message: error.message }, 400);
      }

      return reply({
        ok: true,
        action,
        data: {
          ...data,
          mimeType: detected.mimeType,
          byteSize: blob.size,
          width: detected.width,
          height: detected.height,
          checksumSha256: checksum
        }
      });
    }

    if (action === 'read') {
      const mediaId = String(body.mediaId ?? '');
      const { data: media, error: mediaError } = await ctx.supabaseAdmin.rpc(
        'community_get_media_storage_key',
        { p_auth_subject: subject, p_media_id: mediaId }
      );

      if (mediaError || !media) {
        return reply({ ok: false, error: 'MEDIA_FORBIDDEN', message: mediaError?.message }, 403);
      }

      const { data: signed, error: signError } = await ctx.supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(media.storageKey, 300);

      if (signError || !signed) {
        return reply({ ok: false, error: 'MEDIA_SIGN_FAILED', message: signError?.message }, 400);
      }

      return reply({
        ok: true,
        action,
        media: {
          mediaId: media.mediaId,
          mimeType: media.mimeType,
          byteSize: media.byteSize,
          width: media.width,
          height: media.height,
          checksumSha256: media.checksumSha256,
          signedUrl: signed.signedUrl,
          expiresIn: 300
        }
      });
    }

    return reply({ ok: false, error: 'Unsupported action' }, 400);
});

export default {
  fetch(req: Request) {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
    return authenticatedFetch(req);
  }
};
