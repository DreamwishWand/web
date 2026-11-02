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

const SESSION_KEY = 'dreamwishwand-community-session-v1';
const RECOVERY_KEY = 'dreamwishwand-community-recovery-pkce-v1';
const RECOVERY_MAX_AGE_MS = 60 * 60 * 1000;
export const COMMUNITY_PASSWORD_MIN_LENGTH = 15;

function assertPasswordPolicy(password: string, label = 'Password'): void {
  if (Array.from(password).length < COMMUNITY_PASSWORD_MIN_LENGTH) {
    throw new Error(`${label} must be at least ${COMMUNITY_PASSWORD_MIN_LENGTH} characters.`);
  }
}

interface RecoveryState {
  supabaseUrl: string;
  publishableKey: string;
  verifier: string;
  createdAt: number;
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function createPkceVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function createPkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  );
  return base64Url(new Uint8Array(digest));
}

function loadRecoveryState(): RecoveryState | null {
  if (typeof localStorage === 'undefined') return null;

  const raw = localStorage.getItem(RECOVERY_KEY);
  if (!raw) return null;

  try {
    const state = JSON.parse(raw) as RecoveryState;
    if (
      !state.supabaseUrl ||
      !state.publishableKey ||
      !state.verifier ||
      !Number.isFinite(state.createdAt) ||
      Date.now() - state.createdAt > RECOVERY_MAX_AGE_MS
    ) {
      localStorage.removeItem(RECOVERY_KEY);
      return null;
    }
    return state;
  } catch {
    localStorage.removeItem(RECOVERY_KEY);
    return null;
  }
}

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

export class CommunityHttpError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly retryAfterSeconds: number | null;
  readonly resetAt: string | null;

  constructor(args: {
    status: number;
    code?: string | null;
    message: string;
    retryAfterSeconds?: number | null;
    resetAt?: string | null;
  }) {
    super(args.message);
    this.name = 'CommunityHttpError';
    this.status = args.status;
    this.code = args.code ?? null;
    this.retryAfterSeconds = args.retryAfterSeconds ?? null;
    this.resetAt = args.resetAt ?? null;
  }
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
    const code =
      typeof body === 'object' && body && typeof body.error === 'string'
        ? body.error
        : null;
    const retryAfterSeconds =
      typeof body === 'object' && body && Number.isFinite(Number(body.retryAfterSeconds))
        ? Math.max(0, Math.trunc(Number(body.retryAfterSeconds)))
        : null;
    const resetAt =
      typeof body === 'object' && body && typeof body.resetAt === 'string'
        ? body.resetAt
        : null;

    const rawMessage =
      typeof body === 'object' && body
        ? body.message ?? body.error_description ?? body.error ?? JSON.stringify(body)
        : String(body ?? response.statusText);

    const message =
      response.status === 429 && code === 'RATE_LIMITED'
        ? `429 RATE_LIMITED: Too many actions in ${String(body?.bucket ?? 'this action')}. ` +
          (retryAfterSeconds && retryAfterSeconds > 0
            ? `Retry in about ${retryAfterSeconds} seconds.`
            : 'Retry after the current rate-limit window resets.')
        : `${response.status} ${rawMessage}`;

    throw new CommunityHttpError({
      status: response.status,
      code,
      message,
      retryAfterSeconds,
      resetAt
    });
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


export type CommunitySessionEvent = Readonly<{
  kind: 'signed-in'|'refreshed'|'account-changed'|'logged-out'|'session-invalidated';
  generation: number;
  logoutEpoch: number;
}>;
type SessionListener = (event: CommunitySessionEvent) => void;
interface SharedAuth {
  scope: string;
  session: CommunitySession | null;
  generation: number;
  logoutEpoch: number;
  refreshFlight: Promise<CommunitySession> | null;
  listeners: Set<SessionListener>;
}
const AUTH_NOTICE_KEY='dreamwishwand-community-logout-notice-v1';
const authByConfig=new Map<string,SharedAuth>();
let storageListenerRegistered=false;
function announce(s:SharedAuth,kind:CommunitySessionEvent['kind']):void{
  const event=Object.freeze({kind,generation:s.generation,logoutEpoch:s.logoutEpoch});
  for(const cb of [...s.listeners]){try{cb(event);}catch{/* Auth observers cannot break state. */}}
}
function invalidateOtherTabs(scope:string):void{
  if(typeof localStorage==='undefined')return;
  try{
    // No token, AccountID, email, password, session or refresh secret here.
    localStorage.setItem(AUTH_NOTICE_KEY,JSON.stringify({
      kind:'logout',scope,nonce:crypto.randomUUID()
    }));
  }catch{/* A browser may disallow localStorage; this tab still fails closed. */}
}
function commitSession(s:SharedAuth,next:CommunitySession|null,
 kind:CommunitySessionEvent['kind'],broadcast=false):void{
  s.generation++;
  if(!next)s.logoutEpoch++;
  s.session=next?{...next}:null;
  saveSession(s.session);
  announce(s,kind);
  if(broadcast)invalidateOtherTabs(s.scope);
}
function sharedAuth(config:CommunityLabConfig):SharedAuth{
  const key=JSON.stringify([config.supabaseUrl,config.publishableKey]);
  let s=authByConfig.get(key);
  if(!s){
    s={scope:config.supabaseUrl,session:loadSession(),
      generation:0,logoutEpoch:0,refreshFlight:null,listeners:new Set()};
    authByConfig.set(key,s);
  }
  if(!storageListenerRegistered && typeof window!=='undefined'){
    storageListenerRegistered=true;
    window.addEventListener('storage',(event:StorageEvent)=>{
      if(event.key!==AUTH_NOTICE_KEY||!event.newValue)return;
      let message:any;
      try{message=JSON.parse(event.newValue);}catch{return;}
      if(message?.kind!=='logout'||typeof message.scope!=='string')return;
      for(const state of authByConfig.values())
        if(state.scope===message.scope)
          commitSession(state,null,'session-invalidated');
    });
  }
  return s;
}
function assertUnchanged(s:SharedAuth,generation:number,epoch:number):void{
  if(s.generation!==generation||s.logoutEpoch!==epoch||!s.session)
    throw new Error('SESSION_STALE_OR_LOGGED_OUT');
}
async function waitWithAbort<T>(promise:Promise<T>,signal?:AbortSignal):Promise<T>{
  if(!signal)return promise;
  if(signal.aborted)throw new Error('SESSION_REQUEST_ABORTED');
  return new Promise<T>((resolve,reject)=>{
    const cancel=()=>{cleanup();reject(new Error('SESSION_REQUEST_ABORTED'));};
    const cleanup=()=>signal.removeEventListener('abort',cancel);
    signal.addEventListener('abort',cancel,{once:true});
    promise.then(v=>{cleanup();resolve(v);},e=>{cleanup();reject(e);});
  });
}

export class CommunityLabClient {
  readonly config: CommunityLabConfig;

  static pendingRecoveryConfig(): CommunityLabConfig | null {
    const state = loadRecoveryState();
    if (!state) return null;
    return {
      supabaseUrl: state.supabaseUrl,
      publishableKey: state.publishableKey
    };
  }
  #auth: SharedAuth;

  constructor(config: CommunityLabConfig) {
    this.config = assertConfig(config);
    this.#auth = sharedAuth(this.config);
  }

  get session(): CommunitySession | null {
    return this.#auth.session ? { ...this.#auth.session } : null;
  }

  /** Tokenless same-tab events; remote tabs receive invalidation only. */
  subscribeSession(callback:SessionListener):()=>void{
    this.#auth.listeners.add(callback);
    return ()=>{this.#auth.listeners.delete(callback);};
  }

  /** Credential candidate, never server-side Owner authorization proof. */
  async getValidSignedSession({signal}:{signal?:AbortSignal}={}):Promise<CommunitySession>{
    const shared=this.#auth;
    if(signal?.aborted)throw new Error('SESSION_REQUEST_ABORTED');
    if(!shared.session)throw new Error('Sign in before calling Community APIs.');
    const epoch=shared.logoutEpoch;
    const session=shared.session.expiresAt-Date.now()<60000
      ? await waitWithAbort(this.#refresh(),signal)
      : {...shared.session};
    if(shared.logoutEpoch!==epoch||!shared.session||
       shared.session.accessToken!==session.accessToken)
      throw new Error('SESSION_STALE_OR_LOGGED_OUT');
    if(signal?.aborted)throw new Error('SESSION_REQUEST_ABORTED');
    return {...session};
  }

  #startLogin():{generation:number;epoch:number;previous:string|null}{
    const previous=this.#auth.session?.userId??null;
    commitSession(this.#auth,null,'session-invalidated',Boolean(previous));
    return {generation:this.#auth.generation,epoch:this.#auth.logoutEpoch,previous};
  }
  #acceptLogin(session:CommunitySession,intent:{
    generation:number;epoch:number;previous:string|null
  }):CommunitySession{
    if(this.#auth.generation!==intent.generation||
       this.#auth.logoutEpoch!==intent.epoch)
      throw new Error('SESSION_STALE_OR_LOGGED_OUT');
    commitSession(this.#auth,session,intent.previous&&intent.previous!==session.userId
      ?'account-changed':'signed-in');
    return {...session};
  }


  async requestPasswordRecovery(email: string, redirectTo: string): Promise<void> {
    const verifier = createPkceVerifier();
    const challenge = await createPkceChallenge(verifier);
    const redirect = new URL(redirectTo);

    if (!['https:', 'http:'].includes(redirect.protocol)) {
      throw new Error('Password recovery redirect must use HTTP(S).');
    }

    if (typeof localStorage === 'undefined') {
      throw new Error('Password recovery requires browser storage.');
    }

    localStorage.setItem(
      RECOVERY_KEY,
      JSON.stringify({
        supabaseUrl: this.config.supabaseUrl,
        publishableKey: this.config.publishableKey,
        verifier,
        createdAt: Date.now()
      } satisfies RecoveryState)
    );

    const url = new URL(`${this.config.supabaseUrl}/auth/v1/recover`);
    url.searchParams.set('redirect_to', redirect.toString());

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: this.config.publishableKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        email,
        code_challenge: challenge,
        code_challenge_method: 's256'
      })
    });

    try {
      await parseResponse(response);
    } catch (error) {
      localStorage.removeItem(RECOVERY_KEY);
      throw error;
    }
  }

  async exchangePasswordRecoveryCode(authCode: string): Promise<CommunitySession> {
    const state = loadRecoveryState();
    if (!state) throw new Error('No valid password-recovery PKCE flow is pending.');

    if (
      normalizeUrl(state.supabaseUrl) !== this.config.supabaseUrl ||
      state.publishableKey !== this.config.publishableKey
    ) {
      throw new Error('Password-recovery flow belongs to a different Auth configuration.');
    }

    const intent=this.#startLogin();
    const response = await fetch(
      `${this.config.supabaseUrl}/auth/v1/token?grant_type=pkce`,
      {
        method: 'POST',
        headers: {
          apikey: this.config.publishableKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          auth_code: authCode,
          code_verifier: state.verifier
        })
      }
    );

    try {
      return this.#acceptLogin(toSession(await parseResponse(response)),intent);
    } finally {
      localStorage.removeItem(RECOVERY_KEY);
    }
  }

  async completePasswordRecovery(newPassword: string): Promise<EdgeResult> {
    assertPasswordPolicy(newPassword, 'New password');

    const current = await this.#validSession();
    const response = await fetch(`${this.config.supabaseUrl}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        apikey: this.config.publishableKey,
        authorization: `Bearer ${current.accessToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ password: newPassword })
    });

    await parseResponse(response);
    return this.revokeAllSessions();
  }

  async requestReauthentication(): Promise<void> {
    const current = await this.#validSession();
    const response = await fetch(`${this.config.supabaseUrl}/auth/v1/reauthenticate`, {
      method: 'GET',
      headers: {
        apikey: this.config.publishableKey,
        authorization: `Bearer ${current.accessToken}`
      }
    });
    await parseResponse(response);
  }

  async changePasswordAfterReauthentication(
    newPassword: string,
    nonce: string
  ): Promise<EdgeResult> {
    assertPasswordPolicy(newPassword, 'New password');
    if (!nonce.trim()) {
      throw new Error('Reauthentication nonce is required.');
    }

    const current = await this.#validSession();
    const response = await fetch(`${this.config.supabaseUrl}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        apikey: this.config.publishableKey,
        authorization: `Bearer ${current.accessToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        password: newPassword,
        nonce: nonce.trim()
      })
    });

    await parseResponse(response);
    return this.revokeAllSessions();
  }

  async signUpWithPassword(
    email: string,
    password: string
  ): Promise<{ userId: string | null; requiresEmailConfirmation: boolean }> {
    if (!email.trim()) throw new Error('Email is required.');
    assertPasswordPolicy(password);

    const response = await fetch(`${this.config.supabaseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        apikey: this.config.publishableKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ email: email.trim(), password })
    });

    const body = (await parseResponse(response)) as {
      access_token?: unknown;
      user?: { id?: unknown } | null;
    };

    return {
      userId:
        body.user && typeof body.user.id === 'string'
          ? body.user.id
          : null,
      requiresEmailConfirmation: typeof body.access_token !== 'string'
    };
  }

  async signInWithPassword(email: string, password: string): Promise<CommunitySession> {
    const intent=this.#startLogin();
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

    return this.#acceptLogin(toSession(await parseResponse(response)),intent);
  }

  async signOut(): Promise<void> {
    const current=this.session;
    commitSession(this.#auth,null,'logged-out',true);
    if(current)await fetch(this.config.supabaseUrl+'/auth/v1/logout?scope=local',{
      method:'POST',headers:{apikey:this.config.publishableKey,
        authorization:'Bearer '+current.accessToken}
    });
  }

  async revokeAllSessions(): Promise<EdgeResult> {
    const current=await this.#validSession();
    // Invalidate every in-tab caller BEFORE any remote cutoff or logout awaits.
    commitSession(this.#auth,null,'logged-out',true);
    // Wand cutoff needs a still-valid captured signed access JWT, so request
    // it BEFORE the provider's global logout can invalidate that credential.
    // Attempt global logout even when Wand cutoff fails; do not restore login.
    let cutoff:Response|null=null;
    let cutoffFailure:unknown=null;
    try{
      cutoff=await fetch(this.config.supabaseUrl+'/functions/v1/community-command',{
        method:'POST',headers:{apikey:this.config.publishableKey,
          authorization:'Bearer '+current.accessToken,'content-type':'application/json'},
        body:JSON.stringify({command:'revokeSessions',payload:{}})
      });
    }catch(error){cutoffFailure=error;}
    const global=await fetch(this.config.supabaseUrl+'/auth/v1/logout?scope=global',{
      method:'POST',headers:{apikey:this.config.publishableKey,
        authorization:'Bearer '+current.accessToken}
    });
    await parseResponse(global);
    if(cutoffFailure)throw cutoffFailure;
    if(!cutoff)throw new Error('WAND_SESSION_CUTOFF_UNAVAILABLE');
    return parseResponse(cutoff) as Promise<EdgeResult>;
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
    return this.#edge<EdgeResult<T>>('community-query', { query, payload }, true);
  }

  async media<T = unknown>(
    action: string,
    payload: Record<string, unknown> = {}
  ): Promise<EdgeResult<T>> {
    return this.#edge<EdgeResult<T>>('community-media', { action, ...payload });
  }

  /**
   * WEP-owned Preset artifact transport. This restores the accepted WEP
   * browser bridge on top of the current Community client without changing
   * Community command/query/auth semantics.
   */
  async preset<T = unknown>(
    action: string,
    payload: Record<string, unknown> = {}
  ): Promise<EdgeResult<T>> {
    return this.#edge<EdgeResult<T>>('wep-preset-artifact', { action, ...payload });
  }

  async admin<T = unknown>(
    operation: string,
    payload: Record<string, unknown> = {}
  ): Promise<EdgeResult<T>> {
    return this.#edge<EdgeResult<T>>('community-admin', { operation, payload });
  }

  async deleteWandAccount(confirmation: string): Promise<EdgeResult> {
    const current = await this.#validSession();

    const result = await this.#edge<EdgeResult>(
      'community-account',
      { action: 'deleteAccount', confirmation },
      false
    );

    // Denied or indeterminate privacy requests must keep the signed session
    // available for fresh recent-auth retry. A success means PUBLIC SUPPRESSION
    // is committed, not that physical/provider account erasure is complete.
    if (!result.ok || result.stage !== 'privacy_suppressed_cleanup_pending' ||
        result.fullDeletionComplete !== false) {
      return result;
    }

    commitSession(this.#auth,null,'logged-out',true);
    try {
      await fetch(`${this.config.supabaseUrl}/auth/v1/logout?scope=global`, {
        method: 'POST',
        headers: {
          apikey: this.config.publishableKey,
          authorization: `Bearer ${current.accessToken}`
        }
      });
    } finally {
      // State was invalidated before the network could resolve.
    }

    return result;
  }

  async searchPublicWorks(options: {
    query?: string | null;
    workType?: string | null;
    creatorProfileId?: string | null;
    tags?: string[] | null;
    limit?: number;
    beforePublishedAt?: string | null;
    beforeWorkId?: string | null;
  } = {}): Promise<Array<Record<string, unknown>>> {
    const safeLimit = Math.max(1, Math.min(50, Math.trunc(options.limit ?? 20)));
    const response = await fetch(
      `${this.config.supabaseUrl}/rest/v1/rpc/community_search_public`,
      {
        method: 'POST',
        headers: {
          apikey: this.config.publishableKey,
          accept: 'application/json',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          p_query: options.query ?? null,
          p_work_type: options.workType ?? null,
          p_creator_profile_id: options.creatorProfileId ?? null,
          p_tags: options.tags ?? null,
          p_limit: safeLimit,
          p_before_published_at: options.beforePublishedAt ?? null,
          p_before_work_id: options.beforeWorkId ?? null
        })
      }
    );

    const body = await parseResponse(response);
    if (!Array.isArray(body)) {
      throw new Error('Public search did not return an array.');
    }
    return body as Array<Record<string, unknown>>;
  }

  async discoverPublicWorks(limit = 20): Promise<Array<Record<string, unknown>>> {
    return this.searchPublicWorks({ limit });
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

  async #refresh():Promise<CommunitySession>{
    const shared=this.#auth;
    if(shared.refreshFlight)return shared.refreshFlight;
    const old=shared.session;
    if(!old?.refreshToken)throw new Error('No refresh token is available. Sign in again.');
    const generation=shared.generation,epoch=shared.logoutEpoch;
    const flight=(async()=>{
      try{
        const response=await fetch(this.config.supabaseUrl+'/auth/v1/token?grant_type=refresh_token',{
          method:'POST',headers:{apikey:this.config.publishableKey,'content-type':'application/json'},
          body:JSON.stringify({refresh_token:old.refreshToken})
        });
        const updated=toSession(await parseResponse(response));
        assertUnchanged(shared,generation,epoch);
        if(updated.userId!==old.userId)throw new Error('SESSION_REFRESH_SUBJECT_CHANGED');
        commitSession(shared,updated,'refreshed');
        return {...updated};
      }catch(error){
        if(shared.generation===generation&&shared.logoutEpoch===epoch)
          commitSession(shared,null,'session-invalidated',true);
        throw error;
      }
    })();
    shared.refreshFlight=flight;
    try{return await flight;}
    finally{if(shared.refreshFlight===flight)shared.refreshFlight=null;}
  }

  async #validSession():Promise<CommunitySession>{
    return this.getValidSignedSession();
  }

  async #edge<T>(slug:string,body:unknown,retry=false):Promise<T>{
    const session=await this.#validSession();
    const shared=this.#auth,generation=shared.generation,epoch=shared.logoutEpoch;
    const response=await fetch(this.config.supabaseUrl+'/functions/v1/'+slug,{
      method:'POST',headers:{apikey:this.config.publishableKey,
        authorization:'Bearer '+session.accessToken,'content-type':'application/json'},
      body:JSON.stringify(body)
    });
    assertUnchanged(shared,generation,epoch);
    // Never blindly replay a possibly committed non-idempotent Writer.
    if(response.status===401&&retry&&slug==='community-query'){
      await this.#refresh();
      return this.#edge<T>(slug,body,false);
    }
    const result=await parseResponse(response) as T;
    assertUnchanged(shared,generation,epoch);
    return result;
  }
}

export { CommunityLabClient as CommunityClient };
export type CommunityClientConfig = CommunityLabConfig;
