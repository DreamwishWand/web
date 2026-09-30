export interface CommunityLabConfig {
  supabaseUrl: string;
  publishableKey: string;
}

export interface CommunitySession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
  email: string | null;
}

export interface EdgeResult<T = unknown> {
  ok: boolean;
  data?: T;
  [key: string]: unknown;
}

const SESSION_KEY = 'dreamwishwand-community-lab-session-v1';

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function assertConfig(config: CommunityLabConfig): CommunityLabConfig {
  const supabaseUrl = normalizeUrl(config.supabaseUrl);
  const publishableKey = config.publishableKey.trim();

  if (!supabaseUrl.startsWith('https://')) {
    throw new Error('Supabase URL must use https://');
  }
  if (!publishableKey.startsWith('sb_publishable_')) {
    throw new Error('A Supabase publishable key is required.');
  }

  return { supabaseUrl, publishableKey };
}

async function parseResponse(response: Response): Promise<any> {
  const text = await response.text();
  let body: any = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const message =
      typeof body === 'object' && body
        ? body.message ?? body.error_description ?? body.error ?? JSON.stringify(body)
        : String(body ?? response.statusText);
    throw new Error(`${response.status} ${message}`);
  }

  return body;
}

function toSession(body: any): CommunitySession {
  const accessToken = String(body?.access_token ?? '');
  const refreshToken = String(body?.refresh_token ?? '');
  const userId = String(body?.user?.id ?? '');
  const expiresIn = Number(body?.expires_in ?? 0);

  if (!accessToken || !refreshToken || !userId || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Error('Supabase Auth response did not contain a complete session.');
  }

  return {
    accessToken,
    refreshToken,
    userId,
    email: body?.user?.email ? String(body.user.email) : null,
    expiresAt: Date.now() + expiresIn * 1000
  };
}

function saveSession(session: CommunitySession | null): void {
  if (typeof sessionStorage === 'undefined') return;

  if (session) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

function loadSession(): CommunitySession | null {
  if (typeof sessionStorage === 'undefined') return null;

  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as CommunitySession;
    if (
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.refreshToken !== 'string' ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.expiresAt !== 'number'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export class CommunityLabClient {
  readonly config: CommunityLabConfig;
  #session: CommunitySession | null;

  constructor(config: CommunityLabConfig) {
    this.config = assertConfig(config);
    this.#session = loadSession();
  }

  get session(): CommunitySession | null {
    return this.#session ? { ...this.#session } : null;
  }

  async signInWithPassword(email: string, password: string): Promise<CommunitySession> {
    const response = await fetch(
      `${this.config.supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        method: 'POST',
        headers: {
          apikey: this.config.publishableKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      }
    );

    this.#session = toSession(await parseResponse(response));
    saveSession(this.#session);
    return this.session!;
  }

  async signOut(): Promise<void> {
    const current = this.#session;

    try {
      if (current) {
        await fetch(`${this.config.supabaseUrl}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            apikey: this.config.publishableKey,
            authorization: `Bearer ${current.accessToken}`
          }
        });
      }
    } finally {
      this.#session = null;
      saveSession(null);
    }
  }

  async command<T = unknown>(
    command: string,
    payload: Record<string, unknown>
  ): Promise<EdgeResult<T>> {
    return this.#edge<EdgeResult<T>>('community-command', { command, payload });
  }

  async query<T = unknown>(
    query: string,
    payload: Record<string, unknown> = {}
  ): Promise<EdgeResult<T>> {
    return this.#edge<EdgeResult<T>>('community-query', { query, payload });
  }

  async media<T = unknown>(
    action: string,
    payload: Record<string, unknown> = {}
  ): Promise<EdgeResult<T>> {
    return this.#edge<EdgeResult<T>>('community-media', { action, ...payload });
  }

  async uploadAndFinalizeImage(file: File): Promise<{
    mediaId: string;
    finalize: EdgeResult<any>;
    read: EdgeResult<any>;
  }> {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new Error('Community staging accepts JPEG, PNG, or WebP images.');
    }

    const prepared = await this.media('prepare', {
      mimeType: file.type,
      byteSize: file.size
    });

    const storageKey = String((prepared as any).storageKey ?? '');
    const signedUrl = String((prepared as any).signedUpload?.signedUrl ?? '');

    if (!storageKey || !signedUrl) {
      throw new Error('Signed upload preparation did not return storageKey/signedUrl.');
    }

    const form = new FormData();
    form.append('cacheControl', '3600');
    form.append('', file);

    const uploadResponse = await fetch(signedUrl, {
      method: 'PUT',
      headers: { 'x-upsert': 'false' },
      body: form
    });

    await parseResponse(uploadResponse);

    const finalize = await this.media('finalize', { storageKey });
    const mediaId = String((finalize as any).data?.mediaId ?? '');

    if (!mediaId) {
      throw new Error('Media finalize did not return mediaId.');
    }

    const read = await this.media('read', { mediaId });
    return { mediaId, finalize, read };
  }

  async #refresh(): Promise<CommunitySession> {
    if (!this.#session?.refreshToken) {
      throw new Error('No refresh token is available. Sign in again.');
    }

    const response = await fetch(
      `${this.config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
      {
        method: 'POST',
        headers: {
          apikey: this.config.publishableKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ refresh_token: this.#session.refreshToken })
      }
    );

    this.#session = toSession(await parseResponse(response));
    saveSession(this.#session);
    return this.#session;
  }

  async #validSession(): Promise<CommunitySession> {
    if (!this.#session) {
      throw new Error('Sign in before calling Community APIs.');
    }

    if (this.#session.expiresAt - Date.now() < 60_000) {
      return this.#refresh();
    }

    return this.#session;
  }

  async #edge<T>(slug: string, body: unknown, retry = true): Promise<T> {
    const session = await this.#validSession();

    const response = await fetch(`${this.config.supabaseUrl}/functions/v1/${slug}`, {
      method: 'POST',
      headers: {
        apikey: this.config.publishableKey,
        authorization: `Bearer ${session.accessToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (response.status === 401 && retry) {
      await this.#refresh();
      return this.#edge<T>(slug, body, false);
    }

    return parseResponse(response) as Promise<T>;
  }
}
