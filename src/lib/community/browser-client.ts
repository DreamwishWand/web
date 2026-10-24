import { requireGalleryEdgeMedia, requireNonGalleryLegacyMedia, PUBLIC_MEDIA_UUID } from './public-media.js';
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

  const response = await fetch(`${config.supabaseUrl}/functions/v1/community-public-query`, {
    method: 'POST',
    headers: {
      apikey: config.publishableKey,
      accept: 'application/json',
      'content-type': 'application/json'
    },
    body: JSON.stringify({ rpc, payload })
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


/**
 * Explicit media kind: Gallery MUST use an authorized per-GET Edge stream.
 * Legacy is exclusively for DreamSnaps/other non-Gallery callers.
 */
export async function getPublicCommunityMedia(
  mediaId: string, kind: 'gallery'|'legacy'='legacy'
): Promise<any> {
  const config=getCommunityBrowserConfig();
  if(!config)throw new Error('COMMUNITY_BROWSER_CONFIG_UNAVAILABLE');
  if(!PUBLIC_MEDIA_UUID.test(mediaId))throw new Error('PUBLIC_MEDIA_ID_INVALID');
  const response=await fetch(`${config.supabaseUrl}/functions/v1/community-public-media`,{
    method:'POST',
    headers:{apikey:config.publishableKey,accept:'application/json','content-type':'application/json'},
    body:JSON.stringify({mediaId}),
    cache:'no-store'
  });
  const body=await response.json().catch(()=>null);
  if(!response.ok||body?.ok!==true||!body.media){
    const error=new Error(String(body?.error??'PUBLIC_MEDIA_READ_FAILED')) as Error & {status:number};
    error.status=response.status;
    throw error;
  }
  return kind==='gallery'
    ? requireGalleryEdgeMedia(body.media,mediaId,config.supabaseUrl)
    : requireNonGalleryLegacyMedia(body.media,mediaId);
}
export async function getGalleryPublicMedia(mediaId:string){
  return getPublicCommunityMedia(mediaId,'gallery');
}
