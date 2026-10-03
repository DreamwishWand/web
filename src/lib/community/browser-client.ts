import { env } from '$env/dynamic/public';
import { CommunityClient } from './staging-http-client';

export interface CommunityBrowserConfig {
  supabaseUrl: string;
  publishableKey: string;
}

function normalizeUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

export function getCommunityBrowserConfig(): CommunityBrowserConfig | null {
  const supabaseUrl = String(env.PUBLIC_SUPABASE_URL ?? '').trim();
  const publishableKey = String(env.PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
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
