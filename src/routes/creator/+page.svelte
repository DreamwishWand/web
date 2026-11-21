<script lang="ts">
  import { afterNavigate } from '$app/navigation';
  import { base } from '$app/paths';
  import { locale, ct as t } from '$lib/i18n/community.js';
  import { createCommunityBrowserClient, callPublicCommunityRpc } from '$lib/community/browser-client';
  import { parseTypedWorkQuery, resolveTypedWorkRoute } from '$lib/community/typed-work-route.js';
  import { dreamsnapPrivacyCopy } from '$lib/dreamsnaps/privacy-copy.js';

  const client = createCommunityBrowserClient();
  let creatorId = '';
  let profile: any = null;
  let works: any[] = [];
  let error = '', invalidUrl = false;
  let generation = 0;

  afterNavigate(({ to }) => {
    if (!to?.url) return;
    const parsed = parseTypedWorkQuery(to.url.search, 'id');
    creatorId = parsed.workId ?? '';
    invalidUrl = parsed.status !== 'valid';
    profile = null;
    works = [];
    error = '';
    const current = ++generation;
    if (creatorId && client) void load(current,creatorId);
  });

  async function load(current: number, requestedId: string) {
    try {
      const nextProfile: any = await callPublicCommunityRpc('community_get_creator_public_v1', {
        p_creator_profile_id: requestedId
      });
      if (current !== generation || !nextProfile) return;
      // Public search is a discovery candidate, never a Media/phase authority.
      const nextWorks = await client!.searchPublicWorks({ creatorProfileId: requestedId, limit: 50 });
      if (current !== generation) return;
      profile = nextProfile;
      works = nextWorks;
    } catch {
      if (current !== generation) return;
      profile = null; works = []; error = 'PUBLIC_CREATOR_UNAVAILABLE';
    }
  }
  function workRoute(work: any) {
    return resolveTypedWorkRoute(base,work?.work_type ?? work?.workType,work?.work_id ?? work?.workId,work);
  }
</script>

<svelte:head><title>{profile?.displayName ?? 'Creator'} | Dreamwish Wand</title></svelte:head>
<section class="inside-page container">
  <a class="inline-link" href={`${base}/gallery/`}>← {t('gallery.title', {}, $locale)}</a>
  {#if !client}
    <div class="notice">{t('community.configUnavailable', {}, $locale)}</div>
  {:else if invalidUrl}
    <p class="notice" role="alert" data-creator-state="invalid-url">{dreamsnapPrivacyCopy($locale).legacyUnavailable}</p>
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
        {@const route = workRoute(work)}
        {#if route.status === 'ready'}
          <a class="card" data-typed-work-route={route.workType} href={route.href}>
            <small>{route.workType}</small>
            <strong>{work.title}</strong>
            <span>{work.text_content}</span>
          </a>
        {:else if route.status === 'gated'}
          <a class="card" data-typed-work-route="dreamsnap-gated" href={route.href}>
            <strong>{dreamsnapPrivacyCopy($locale).community}</strong>
            <span>{dreamsnapPrivacyCopy($locale).communityUnavailable}</span>
          </a>
        {:else}
          <div class="card" data-typed-work-route="unavailable" role="status">
            <span>{dreamsnapPrivacyCopy($locale).legacyUnavailable}</span>
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</section>

<style>
  .profile{margin:24px 0}.profile h1{font-family:Georgia,serif;font-weight:500}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.card{display:grid;gap:7px;padding:16px;border:1px solid var(--border);border-radius:15px;background:var(--surface);color:var(--ink)}.card small{color:var(--gold);text-transform:uppercase}.card span{color:var(--ink-muted);font-size:12px}.error{color:#ffb6b6}@media(max-width:760px){.grid{grid-template-columns:1fr}}
</style>
