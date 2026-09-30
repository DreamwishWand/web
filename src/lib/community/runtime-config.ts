export interface CommunityBrowserConfig {
  supabaseUrl: string;
  publishableKey: string;
  source: 'environment' | 'staging-lab';
}

const LAB_CONFIG_KEY = 'dreamwishwand-community-lab-config-v1';

function normalizeUrl(value: unknown): string {
  return String(value ?? '').trim().replace(/\/+$/, '');
}

function normalizeKey(value: unknown): string {
  return String(value ?? '').trim();
}

function valid(url: string, key: string): boolean {
  return url.startsWith('https://') && key.startsWith('sb_publishable_');
}

export function readCommunityBrowserConfig(
  options: {
    env?: Record<string, unknown>;
    storage?: Pick<Storage, 'getItem'> | null;
  } = {}
): CommunityBrowserConfig | null {
  const env =
    options.env ??
    ((import.meta as ImportMeta & { env?: Record<string, unknown> }).env ?? {});
  const envUrl = normalizeUrl(
    env.VITE_DREAMWISH_SUPABASE_URL ?? env.VITE_SUPABASE_URL
  );
  const envKey = normalizeKey(
    env.VITE_DREAMWISH_SUPABASE_PUBLISHABLE_KEY ??
      env.VITE_SUPABASE_PUBLISHABLE_KEY
  );

  if (valid(envUrl, envKey)) {
    return {
      supabaseUrl: envUrl,
      publishableKey: envKey,
      source: 'environment'
    };
  }

  const storage =
    options.storage ??
    (typeof sessionStorage === 'undefined' ? null : sessionStorage);
  const raw = storage?.getItem(LAB_CONFIG_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const supabaseUrl = normalizeUrl(parsed.supabaseUrl);
    const publishableKey = normalizeKey(parsed.publishableKey);
    if (!valid(supabaseUrl, publishableKey)) return null;
    return {
      supabaseUrl,
      publishableKey,
      source: 'staging-lab'
    };
  } catch {
    return null;
  }
}
