<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { locale, ct as t } from '$lib/i18n/community.js';
  import { createCommunityBrowserClient } from '$lib/community/browser-client';
  import QaAnswerList from '$lib/community/QaAnswerList.svelte';

  const client = createCommunityBrowserClient();
  let questionId = '';
  let question: any = null;
  let creatorProfileId = '';
  let email = '', password = '', answerBody = '', solutionNote = '';
  let selectedAnswerId = '';
  let busy = false, error = '';

  onMount(() => {
    questionId = new URLSearchParams(window.location.search).get('question') ?? '';
    if (client?.session) void load();
  });

  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    busy = true; error = '';
    try { return await fn(); }
    catch (cause) { error = cause instanceof Error ? cause.message : String(cause); return null; }
    finally { busy = false; }
  }

  async function signIn() {
    if (!client) return;
    const session = await run(() => client.signInWithPassword(email.trim(), password));
    if (!session) return;
    password = ''; await load();
  }

  async function load() {
    if (!client?.session || !questionId) return;
    const me: any = await run(() => client.query('me'));
    creatorProfileId = String(me?.data?.creatorProfileId ?? '');
    const result: any = await run(() => client.query('question', { questionId }));
    question = result?.data ?? null;
    if (!selectedAnswerId && question?.answers?.length) selectedAnswerId = String(question.answers[0].answerId);
  }

  async function command(name: string, payload: Record<string, unknown>) {
    if (!client?.session) return null;
    const result = await run(() => client.command(name, payload));
    if (result) await load();
    return result;
  }

  async function answer() {
    if (!creatorProfileId || !answerBody.trim()) return;
    const ok = await command('addAnswer', {
      creatorProfileId, questionId, body: answerBody.trim(), idempotencyKey: crypto.randomUUID()
    });
    if (ok) answerBody = '';
  }

  async function resolveWithAnswer() {
    if (!selectedAnswerId) return;
    await command('resolveQuestion', {
      questionId, acceptedAnswerId: selectedAnswerId, solutionNote: null
    });
  }

  async function resolveWithNote() {
    if (!solutionNote.trim()) return;
    const ok = await command('resolveQuestion', {
      questionId, acceptedAnswerId: null, solutionNote: solutionNote.trim()
    });
    if (ok) solutionNote = '';
  }

  async function report(targetEntityId: string) {
    await command('reportEntity', {
      targetEntityId, reasonCode: 'community_report', detail: null,
      idempotencyKey: crypto.randomUUID()
    });
  }
</script>

<svelte:head><title>{t('community.action.answer', {}, $locale)} | Dreamwish Wand</title></svelte:head>
<section class="inside-page container">
  <a class="inline-link" href={`${base}/qa/?question=${questionId}`}>← {t('qa.title', {}, $locale)}</a>
  <h1>{t('community.action.answer', {}, $locale)}</h1>

  {#if !client}
    <div class="notice">{t('community.configUnavailable', {}, $locale)}</div>
  {:else if !client.session}
    <div class="panel auth">
      <label>{t('community.auth.email', {}, $locale)}<input type="email" bind:value={email} /></label>
      <label>{t('community.auth.password', {}, $locale)}<input type="password" bind:value={password} /></label>
      <button type="button" disabled={busy || !email || !password} on:click={signIn}>{t('community.auth.signIn', {}, $locale)}</button>
    </div>
  {:else if question}
    <article class="panel">
      <div class="tags">{#each question.contextTags ?? [] as tag}<span>{tag}</span>{/each}</div>
      <h2>{question.title}</h2>
      <p>{question.body}</p>
      <div class="actions">
        {#if question.resolutionState === 'unresolved'}
          <button type="button" aria-pressed={question.viewerSameHere === true}
            on:click={() => command('setSameHere', { questionId, active: question.viewerSameHere !== true })}>
            {t('qa.sameHere', {}, $locale)} · {question.sameHereCount ?? 0}
          </button>
        {/if}
        <button type="button" on:click={() => report(questionId)}>{t('community.action.report', {}, $locale)}</button>
      </div>
    </article>

    <div class="panel">
      <QaAnswerList answers={question.answers ?? []} acceptedAnswerId={question.acceptedAnswerId ?? null} />
      {#if question.answers?.length}
        <label>{t('community.action.answer', {}, $locale)}
          <select bind:value={selectedAnswerId}>
            {#each question.answers as item}<option value={item.answerId}>{item.creatorDisplayName} — {item.body.slice(0, 80)}</option>{/each}
          </select>
        </label>
        <div class="actions">
          <button type="button" on:click={() => command('setAnswerUtility', { answerId: selectedAnswerId, utility: 'helpful' })}>{t('qa.utility.helpful', {}, $locale)}</button>
          <button type="button" on:click={() => command('setAnswerUtility', { answerId: selectedAnswerId, utility: 'worked_for_me' })}>{t('qa.utility.worked', {}, $locale)}</button>
          <button type="button" on:click={() => command('setAnswerUtility', { answerId: selectedAnswerId, utility: 'doesnt_work_for_me' })}>{t('qa.utility.doesnt', {}, $locale)}</button>
          <button type="button" on:click={() => report(selectedAnswerId)}>{t('community.action.report', {}, $locale)}</button>
          {#if question.isOwner === true && question.resolutionState === 'unresolved'}
            <button type="button" on:click={resolveWithAnswer}>{t('qa.accepted', {}, $locale)}</button>
          {/if}
        </div>
      {/if}
    </div>

    {#if creatorProfileId && question.freshness === 'current'}
      <form class="panel" on:submit|preventDefault={answer}>
        <label>{t('qa.answer.placeholder', {}, $locale)}<textarea bind:value={answerBody} maxlength="20000"></textarea></label>
        <button type="submit" disabled={busy || !answerBody.trim()}>{t('community.action.answer', {}, $locale)}</button>
      </form>
    {/if}

    {#if question.viewerOwnedAnswerIds?.length}
      <section class="panel">
        <h2>{t('community.action.createTip', {}, $locale)}</h2>
        {#each question.viewerOwnedAnswerIds as answerId}
          <a class="inline-link" href={`${base}/qa/tip/?question=${questionId}&answer=${answerId}`}>{t('qa.tip.create', {}, $locale)} · {answerId}</a>
        {/each}
      </section>
    {/if}

    {#if question.isOwner === true}
      <form class="panel" on:submit|preventDefault={resolveWithNote}>
        <label>{t('qa.solutionNote', {}, $locale)}<textarea bind:value={solutionNote} maxlength="10000"></textarea></label>
        <div class="actions">
          {#if question.resolutionState === 'unresolved'}<button type="submit" disabled={!solutionNote.trim()}>{t('qa.resolve', {}, $locale)}</button>{/if}
          <button type="button" on:click={() => command('setQaFreshness', { targetEntityId: questionId, freshness: question.freshness === 'current' ? 'needs_recheck' : 'current' })}>
            {question.freshness === 'current' ? t('qa.freshness.needs', {}, $locale) : t('qa.freshness.current', {}, $locale)}
          </button>
        </div>
      </form>
    {/if}
  {/if}

  {#if error}<p class="error" role="alert">{t('shared.form.error', { message: error }, $locale)}</p>{/if}
</section>

<style>
  .panel{display:grid;gap:12px;margin-top:20px;padding:18px;border:1px solid var(--border);border-radius:18px;background:var(--surface)}.auth{grid-template-columns:1fr 1fr auto;align-items:end}label{display:grid;gap:6px}input,textarea,select{min-height:42px;border:1px solid var(--border);border-radius:11px;background:var(--surface-raised);color:var(--ink);padding:9px 11px;font:inherit}textarea{min-height:100px;resize:vertical}.actions,.tags{display:flex;gap:8px;flex-wrap:wrap}.actions button{border:1px solid var(--border);border-radius:999px;background:var(--surface-raised);color:var(--ink);padding:8px 12px}.tags span{border:1px solid var(--border);border-radius:999px;padding:5px 9px;font-size:11px}.error{color:#ffb6b6}@media(max-width:680px){.auth{grid-template-columns:1fr}}
</style>
