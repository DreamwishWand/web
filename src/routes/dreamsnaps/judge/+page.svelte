<script lang="ts">
  import { onMount } from 'svelte';
  import { locale, ct as t } from '$lib/i18n/community.js';
  import { createCommunityBrowserClient, callPublicCommunityRpc } from '$lib/community/browser-client';
  import DreamsnapsTabs from '$lib/community/DreamsnapsTabs.svelte';

  const client = createCommunityBrowserClient();
  let challenge: any = null;
  let judge: any = null;
  let email = '', password = '';
  let busy = false, error = '', status = '';
  let mediaUrls: Record<string,string> = {};

  onMount(() => { void init(); });

  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    busy = true; error = ''; status = '';
    try { return await fn(); }
    catch (cause) { error = cause instanceof Error ? cause.message : String(cause); return null; }
    finally { busy = false; }
  }

  async function init() {
    challenge = await run(() => callPublicCommunityRpc('community_get_current_dreamsnap_challenge_public_v1')) ?? null;
    if (client?.session && challenge?.challengeId) await loadJudge();
  }

  async function signIn() {
    if (!client) return;
    const session = await run(() => client.signInWithPassword(email.trim(), password));
    if (!session) return;
    password = '';
    await loadJudge();
  }

  async function loadJudge() {
    if (!client?.session || !challenge?.challengeId) return;
    const result: any = await run(() => client.query('dreamsnapJudge', {
      challengeId: challenge.challengeId, limit: 12
    }));
    judge = result?.data ?? null;
    mediaUrls = {};
    for (const candidate of judge?.candidates ?? []) {
      const signed: any = await run(() => client.media('dreamsnapJudgeRead', { entryId: candidate.entryId }));
      const url = String(signed?.media?.signedUrl ?? '');
      if (url) mediaUrls[String(candidate.entryId)] = url;
    }
  }

  async function vote(entryId: string) {
    if (!client?.session) return;
    const ok = await run(() => client.command('castDreamsnapVote', {
      challengeId: challenge.challengeId, entryId
    }));
    if (ok) { status = t('dreamsnaps.judge.voteRecorded', {}, $locale); await loadJudge(); }
  }

  async function react(entryId: string) {
    if (!client?.session) return;
    const ok = await run(() => client.command('addDreamsnapBrowseReaction', {
      challengeId: challenge.challengeId, entryId, reactionKind: 'like'
    }));
    if (ok) status = t('dreamsnaps.judge.reactionRecorded', {}, $locale);
  }

  async function special(entryId: string) {
    if (!client?.session) return;
    const ok = await run(() => client.command('addDreamsnapSpecialPick', {
      challengeId: challenge.challengeId, entryId
    }));
    if (ok) { status = t('dreamsnaps.judge.specialRecorded', {}, $locale); await loadJudge(); }
  }
</script>

<svelte:head><title>{t('dreamsnaps.tab.judge', {}, $locale)} | Dreamwish Wand</title></svelte:head>

<section class="inside-page container">
  <p class="eyebrow">{t('dreamsnaps.eyebrow', {}, $locale)}</p>
  <h1>{t('dreamsnaps.tab.judge', {}, $locale)}</h1>
  <DreamsnapsTabs />

  {#if challenge}<h2>{challenge.title}</h2>{/if}

  {#if !client}
    <div class="notice">{t('community.configUnavailable', {}, $locale)}</div>
  {:else if !client.session}
    <div class="panel auth">
      <label>{t('community.auth.email', {}, $locale)}<input type="email" bind:value={email} autocomplete="email" /></label>
      <label>{t('community.auth.password', {}, $locale)}<input type="password" bind:value={password} autocomplete="current-password" /></label>
      <button type="button" disabled={busy || !email || !password} on:click={signIn}>{t('community.auth.signIn', {}, $locale)}</button>
    </div>
  {:else if judge}
    <section class="summary" aria-live="polite">
      <strong>{judge.mode === 'formal' ? t('dreamsnaps.judge.formal', {}, $locale) : judge.mode === 'browse' ? t('dreamsnaps.judge.browse', {}, $locale) : t('dreamsnaps.judge.complete', {}, $locale)}</strong>
      <span>{t('dreamsnaps.judge.remaining', { count: judge.formalVotesRemaining ?? 0 }, $locale)}</span>
    </section>

    <div class="grid">
      {#each judge.candidates ?? [] as candidate}
        <article class="entry">
          {#if mediaUrls[candidate.entryId]}
            <img src={mediaUrls[candidate.entryId]} alt={t('dreamsnaps.judge.entryAlt', {}, $locale)} />
          {:else}
            <div class="placeholder" aria-label={t('dreamsnaps.judge.entryAlt', {}, $locale)}></div>
          {/if}
          <div class="actions">
            {#if judge.mode === 'formal'}
              <button type="button" disabled={busy} on:click={() => vote(String(candidate.entryId))}>{t('dreamsnaps.judge.vote', {}, $locale)}</button>
            {:else if judge.mode === 'browse'}
              <button type="button" disabled={busy} on:click={() => react(String(candidate.entryId))}>{t('dreamsnaps.judge.react', {}, $locale)}</button>
              {#if judge.allowSpecialPicks && (judge.specialPicksRemaining ?? 0) > 0}
                <button type="button" disabled={busy} on:click={() => special(String(candidate.entryId))}>{t('dreamsnaps.judge.special', {}, $locale)}</button>
              {/if}
            {/if}
          </div>
        </article>
      {:else}
        <p>{t('dreamsnaps.judge.empty', {}, $locale)}</p>
      {/each}
    </div>
  {/if}

  {#if status}<p class="notice" role="status">{status}</p>{/if}
  {#if error}<p class="error" role="alert">{t('shared.form.error', { message: error }, $locale)}</p>{/if}
</section>

<style>
  .panel,.summary{display:grid;gap:12px;margin-top:20px;padding:18px;border:1px solid var(--border);border-radius:18px;background:var(--surface)}.auth{grid-template-columns:1fr 1fr auto;align-items:end}.summary{grid-template-columns:1fr auto}
  label{display:grid;gap:6px}input{min-height:42px;border:1px solid var(--border);border-radius:11px;background:var(--surface-raised);color:var(--ink);padding:9px 11px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-top:22px}.entry{overflow:hidden;border:1px solid var(--border);border-radius:18px;background:var(--surface)}.entry img,.placeholder{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:var(--surface-raised)}.actions{display:flex;gap:8px;flex-wrap:wrap;padding:12px}
  button{min-height:40px;border:1px solid var(--border);border-radius:999px;background:var(--surface-raised);color:var(--ink);padding:7px 12px}button:focus-visible,input:focus-visible{outline:3px solid var(--gold);outline-offset:3px}.error{color:#ffb6b6}
  @media(max-width:680px){.auth,.summary{grid-template-columns:1fr}}
</style>
