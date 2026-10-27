<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { locale, ct as t } from '$lib/i18n/community.js';
  import { createCommunityBrowserClient, callPublicCommunityRpc } from '$lib/community/browser-client';
  import QaBrowse from '$lib/community/QaBrowse.svelte';
  import QaAnswerList from '$lib/community/QaAnswerList.svelte';
  import { parseTypedWorkQuery } from '$lib/community/typed-work-route.js';
  import { dreamsnapPrivacyCopy } from '$lib/dreamsnaps/privacy-copy.js';

  const client = createCommunityBrowserClient();
  let mode: 'questions' | 'tips' = 'questions';
  let query = '';
  let rows: any[] = [];
  let selected: any = null;
  let selectedKind: 'question' | 'tip' | null = null;
  let busy = false;
  let error = '', invalidDetailUrl = false;

  onMount(() => { const params = new URLSearchParams(window.location.search);
    if (params.getAll('type').length <= 1 && ['questions','tips'].includes(params.get('type') ?? 'questions')) {
      mode = params.get('type') === 'tips' ? 'tips' : 'questions';
    }
    const typedParam = params.has('question') && !params.has('tip') ? 'question' :
      params.has('tip') && !params.has('question') ? 'tip' : null;
    if (params.has('question') || params.has('tip')) {
      const parsed = typedParam ? parseTypedWorkQuery(params,typedParam) : {status:'invalid',workId:null};
      if (parsed.status !== 'valid') {invalidDetailUrl=true; selected=null; rows=[]; return;}
      void search(); void open(parsed.workId!,typedParam as 'question'|'tip'); return;
    }
    if ([...params.keys()].some(key=>key!=='type') || params.getAll('type').length>1 ||
        (params.has('type') && !['questions','tips'].includes(params.get('type')??''))) {
      invalidDetailUrl=true; selected=null; rows=[]; return;
    }
    void search();
  });

  async function search() {
    if (!client) return;
    busy = true; error = '';
    try {
      if (mode === 'questions') {
        rows = await callPublicCommunityRpc<any[]>('community_search_questions_v1', {
          p_query: query.trim() || null,
          p_context_tags: null,
          p_unanswered_only: false, // All only until server resolution/answer-count contract accepted
          p_limit: 30
        });
      } else {
        rows = await client.searchPublicWorks({
          query: query.trim() || null,
          workType: 'tip',
          limit: 30
        });
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally { busy = false; }
  }

  async function open(id: string, kind: 'question' | 'tip') {
    busy = true; error = ''; selectedKind = kind;
    try {
      if (kind === 'question') {
        selected = client?.session
          ? (await client.query<any>('question', { questionId: id })).data
          : await callPublicCommunityRpc('community_get_question_public_v1', { p_question_id: id });
      } else {
        selected = await callPublicCommunityRpc('community_get_tip_public_v1', { p_tip_id: id });
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
      selected = null;
    } finally { busy = false; }
  }
</script>

<svelte:head><title>{t('qa.title', {}, $locale)} | Dreamwish Wand</title></svelte:head>
<section class="inside-page container">
  <p class="eyebrow">{t('qa.eyebrow', {}, $locale)}</p>
  <h1>{t('qa.title', {}, $locale)}</h1>
  <p class="page-intro">{t('qa.intro', {}, $locale)}</p>
  <p class="links">
    <a class="inline-link" href={`${base}/qa/ask/`}>{t('community.action.ask', {}, $locale)}</a>
    <a class="inline-link" href={`${base}/qa/my/`}>{t('qa.tab.activity', {}, $locale)}</a>
  </p>

  {#if !client}
    <div class="notice">{t('community.configUnavailable', {}, $locale)}</div>
  {:else}
    {#if error}<p class="error" role="alert">{t('shared.form.error', { message: error }, $locale)}</p>{/if}
    {#if invalidDetailUrl}
      <p role="alert" class="notice" data-qa-state="invalid-work-url">{dreamsnapPrivacyCopy($locale).legacyUnavailable}</p>
    {:else}
    <QaBrowse bind:mode bind:query {rows} {busy} onSearch={search} onSelect={open} />

    {#if selected && selectedKind === 'question'}
      <article class="detail">
        <div class="chips">{#each selected.contextTags ?? [] as tag}<span>{tag}</span>{/each}</div>
        <h2>{selected.title}</h2>
        <p class="meta">{selected.platform ?? ''} {selected.gameVersion ?? ''} · {selected.freshness}</p>
        <p>{selected.body}</p>
        {#if selected.solutionNote}<blockquote>{selected.solutionNote}</blockquote>{/if}
        <QaAnswerList answers={selected.answers ?? []} acceptedAnswerId={selected.acceptedAnswerId ?? null} />
        {#if client.session}
          <a class="inline-link" href={`${base}/qa/participate/?question=${selected.questionId}`}>
            {t('community.action.answer', {}, $locale)}
          </a>
        {/if}
      </article>
    {:else if selected && selectedKind === 'tip'}
      <article class="detail">
        <div class="chips">{#each selected.contextTags ?? [] as tag}<span>{tag}</span>{/each}</div>
        <h2>{selected.title}</h2>
        <p class="meta">{selected.platform ?? ''} {selected.gameVersion ?? ''} · {selected.freshness}</p>
        <p>{selected.body}</p>
      </article>
    {/if}
    {/if}
  {/if}
</section>

<style>
  .links,.chips{display:flex;gap:10px;flex-wrap:wrap}.links{margin:20px 0}.detail{margin-top:24px;padding:22px;border:1px solid var(--border);border-radius:20px;background:var(--surface)}.chips span{padding:5px 9px;border:1px solid var(--border);border-radius:999px;font-size:11px}.meta{color:var(--ink-muted);font-size:12px}.error{color:#ffb6b6}
</style>
