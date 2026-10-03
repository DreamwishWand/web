import { CommunityClient } from './staging-http-client';

export interface CommunityBrowserConfig {
  supabaseUrl: string;
  publishableKey: string;
}

function normalizeUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

export function getCommunityBrowserConfig(): CommunityBrowserConfig | null {
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim();
  const publishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
  if (!supabaseUrl || !publishableKey) return null;
  return { supabaseUrl: normalizeUrl(supabaseUrl), publishableKey };
}

export function createCommunityBrowserClient(): CommunityClient | null {
  const config = getCommunityBrowserConfig();
  return config ? new CommunityClient(config) : null;
}

export async function callPublicCommunityRpc<T>(
  rpc: string,
  payload: Record<string, unknown> = {}
): Promise<T> {
  const config = getCommunityBrowserConfig();
  if (!config) throw new Error('COMMUNITY_BROWSER_CONFIG_UNAVAILABLE');

  const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/${rpc}`, {
    method: 'POST',
    headers: {
      apikey: config.publishableKey,
      accept: 'application/json',
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'message' in body
        ? String((body as { message?: unknown }).message ?? response.statusText)
        : response.statusText;
    throw new Error(message || `Community public RPC failed (${response.status})`);
  }

  return body as T;
}


export async function getPublicCommunityMedia(mediaId: string): Promise<{
  signedUrl: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
}> {
  const config = getCommunityBrowserConfig();
  if (!config) throw new Error('COMMUNITY_BROWSER_CONFIG_UNAVAILABLE');

  const response = await fetch(`${config.supabaseUrl}/functions/v1/community-public-media`, {
    method: 'POST',
    headers: {
      apikey: config.publishableKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ mediaId })
  });
  const body = await response.json();
  if (!response.ok || body?.ok !== true || !body?.media?.signedUrl) {
    throw new Error(String(body?.error ?? 'PUBLIC_MEDIA_READ_FAILED'));
  }
  return {
    signedUrl: String(body.media.signedUrl),
    mimeType: body.media.mimeType ? String(body.media.mimeType) : null,
    width: Number.isFinite(Number(body.media.width)) ? Number(body.media.width) : null,
    height: Number.isFinite(Number(body.media.height)) ? Number(body.media.height) : null
  };
}
