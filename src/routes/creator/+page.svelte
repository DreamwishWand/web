<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { locale, ct as t } from '$lib/i18n/community.js';
  import { createCommunityBrowserClient, callPublicCommunityRpc } from '$lib/community/browser-client';

  const client = createCommunityBrowserClient();
  let creatorId = '';
  let profile: any = null;
  let works: any[] = [];
  let error = '';

  onMount(() => {
    creatorId = new URLSearchParams(window.location.search).get('id') ?? '';
    if (creatorId) void load();
  });

  async function load() {
    if (!client || !creatorId) return;
    error = '';
    try {
      profile = await callPublicCommunityRpc('community_get_creator_public_v1', {
        p_creator_profile_id: creatorId
      });
      works = await client.searchPublicWorks({ creatorProfileId: creatorId, limit: 50 });
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }
</script>

<svelte:head><title>{profile?.displayName ?? 'Creator'} | Dreamwish Wand</title></svelte:head>
<section class="inside-page container">
  <a class="inline-link" href={`${base}/gallery/`}>← {t('gallery.title', {}, $locale)}</a>
  {#if !client}
    <div class="notice">{t('community.configUnavailable', {}, $locale)}</div>
  {:else if error}
    <p class="error" role="alert">{t('shared.form.error', { message: error }, $locale)}</p>
  {:else if profile}
    <header class="profile">
      <p class="eyebrow">@{profile.handle}</p>
      <h1>{profile.displayName}</h1>
      {#if profile.bio}<p>{profile.bio}</p>{/if}
    </header>
    <div class="grid">
      {#each works as work}
        <a class="card" href={work.work_type === 'gallery' ? `${base}/gallery/?work=${work.work_id}` : `${base}/qa/?${work.work_type === 'question' ? 'question' : 'tip'}=${work.work_id}`}>
          <small>{work.work_type}</small>
          <strong>{work.title}</strong>
          <span>{work.text_content}</span>
        </a>
      {/each}
    </div>
  {/if}
</section>

<style>
  .profile{margin:24px 0}.profile h1{font-family:Georgia,serif;font-weight:500}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.card{display:grid;gap:7px;padding:16px;border:1px solid var(--border);border-radius:15px;background:var(--surface);color:var(--ink)}.card small{color:var(--gold);text-transform:uppercase}.card span{color:var(--ink-muted);font-size:12px}.error{color:#ffb6b6}@media(max-width:760px){.grid{grid-template-columns:1fr}}
</style>
