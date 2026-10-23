<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { locale, ct as t } from '$lib/i18n/community.js';
  import { callPublicCommunityRpc, getCommunityBrowserConfig } from '$lib/community/browser-client';
  import {
    VERIFIED_SUBJECT_RPC, SUBJECT_TYPES, parseVerifiedSubjectLookup, isSelectableSubject,
    subjectDisplayIdentity, filterVerifiedSubjects, resolveCurrentSubject, sameVerifiedSubjectAuthority
  } from '$lib/gallery/verified-subjects.js';
  import type { VerifiedGallerySubject, GalleryKind, SubjectType } from '$lib/gallery/verified-subjects.js';

  export let kind: GalleryKind;
  export let subjectType: SubjectType;
  export let selected: VerifiedGallerySubject|null;
  export let onChoose: (item:VerifiedGallerySubject|null)=>void;
  export let onReady: (ready:boolean)=>void;

  let records: VerifiedGallerySubject[]=[];
  let query='';
  let error='';
  // SSR must not render "zero verified subjects" before the first lookup.
  // The empty state is meaningful only after a successful authoritative response.
  let loading=true;
  let catalogState:'initializing'|'loading'|'ready'|'error'|'unconfigured'='initializing';
  let mounted=false;
  let requestNumber=0;
  let loadedKind: GalleryKind|null=null;
  const configured=Boolean(getCommunityBrowserConfig());
  $: shown=filterVerifiedSubjects(records,subjectType,query);
  $: selectable=shown.filter(s=>isSelectableSubject(s,kind,subjectType));
  $: if(mounted && loadedKind!==kind) { void reload(); }

  onMount(()=>{ mounted=true; void reload(); });
  onDestroy(()=>{ requestNumber++; });

  async function reload(){
    const requestedKind=kind;
    const request=++requestNumber;
    loadedKind=requestedKind;
    error='';
    loading=true;
    catalogState='loading';
    onReady(false);
    if(!configured) {
      error='COMMUNITY_BROWSER_CONFIG_UNAVAILABLE';
      catalogState='unconfigured';
      loading=false;
      onChoose(null);
      return;
    }
    try{
      const response=await callPublicCommunityRpc<unknown>(VERIFIED_SUBJECT_RPC,{
        p_gallery_kind:requestedKind,p_limit:100
      });
      if(request!==requestNumber || kind!==requestedKind)return;
      records=parseVerifiedSubjectLookup(response,requestedKind);
      // Preserve only selections that are still in the current authoritative registry.
      if(selected){
        const current=resolveCurrentSubject(records,selected.subjectId,kind,subjectType);
        if(!current || !sameVerifiedSubjectAuthority(current,selected))onChoose(null);
        else onChoose(current);
      }
      catalogState='ready';
      onReady(true);
    }catch(cause){
      if(request!==requestNumber || kind!==requestedKind)return;
      records=[];
      onChoose(null);
      error=cause instanceof Error?cause.message:String(cause);
      catalogState='error';
    }finally{
      if(request===requestNumber)loading=false;
    }
  }
  function choose(subjectId:string){
    const match=resolveCurrentSubject(records,subjectId,kind,subjectType);
    onChoose(match);
  }
  function subjectTypeLabel(type:SubjectType){
    const key=type==='biome'?'galleryv1.biome':
      type==='floating_island'?'galleryv1.floatingIsland':
      type==='room'?'galleryv1.room':
      type==='tom_furniture'?'galleryv1.furniture':'galleryv1.clothing';
    return t(key,{},$locale);
  }
</script>

<div class="subject-picker" data-catalog-state={catalogState} data-subject-type={subjectType}>
  <div class="subject-heading">
    <h3>{t('galleryv1.verifiedSubject',{},$locale)}</h3>
    <button type="button" on:click={reload} disabled={loading} aria-label={t('galleryv1.retrySubjects',{},$locale)}>
      {t('galleryv1.retry',{},$locale)}
    </button>
  </div>
  <label>{t('galleryv1.findSubject',{},$locale)}
    <input type="search" bind:value={query} maxlength="120" disabled={loading || !!error}
      placeholder={t('galleryv1.searchSubjectHint',{},$locale)} />
  </label>
  {#if loading}
    <p role="status" aria-live="polite">{t('galleryv1.loading',{},$locale)}</p>
  {:else if error}
    <p role="alert">{t('galleryv1.subjectLookupError',{},$locale)} <code>{error}</code></p>
  {:else if !shown.length}
    <p role="status">{t('galleryv1.noVerifiedSubject',{},$locale)}</p>
  {:else}
    <div class="subject-options" role="group" aria-label={t('galleryv1.verifiedSubject',{},$locale)}>
      {#each shown as subject (subject.subjectId)}
        <button type="button" class:selected={selected?.subjectId===subject.subjectId}
          aria-pressed={selected?.subjectId===subject.subjectId}
          disabled={!isSelectableSubject(subject,kind,subjectType)}
          on:click={()=>choose(subject.subjectId)}>
          <strong>{subjectDisplayIdentity(subject)}</strong>
          <small>{subjectTypeLabel(subject.subjectType)} · {subject.platform} {subject.gameVersion} · {subject.buildId} · schema {subject.profileSchema}</small>
          <small>{t('galleryv1.canonicalId',{},$locale)}: {subject.canonicalTargetId}</small>
          {#if !isSelectableSubject(subject,kind,subjectType)}
            <span>{t('galleryv1.subjectUnsupported',{},$locale)}</span>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
  {#if selected}
    <p class="selected-summary" role="status">
      {t('galleryv1.selectedSubject',{},$locale)}: {subjectDisplayIdentity(selected)}
      · {selected.platform} {selected.gameVersion} · {selected.buildId}
    </p>
  {/if}
  <p class="subject-note">{t('galleryv1.subjectSourceNote',{},$locale)}</p>
</div>
<style>
  .subject-picker{display:grid;gap:12px;min-width:0}
  .subject-heading{display:flex;justify-content:space-between;align-items:center;gap:10px}
  .subject-heading h3{font-size:1rem;margin:0}
  .subject-heading button,.subject-options button{min-height:44px;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--surface-raised);color:var(--ink);font:inherit}
  label{display:grid;gap:7px;color:var(--ink-soft);font-size:13px}
  input{width:100%;min-width:0;min-height:44px;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--surface-raised);color:var(--ink);font:inherit}
  .subject-options{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:8px;max-height:360px;overflow-y:auto;overscroll-behavior:contain}
  .subject-options button{text-align:start;display:grid;gap:5px;overflow-wrap:anywhere}
  .subject-options button.selected{border:2px solid var(--gold)}
  .subject-options button:disabled{opacity:.62;cursor:not-allowed}
  .subject-options button small{font-size:11px;color:var(--ink-muted)}
  .selected-summary,.subject-note{overflow-wrap:anywhere;color:var(--ink-soft)}
  .subject-note{font-size:12px}
  @media(max-width:400px){.subject-options{grid-template-columns:minmax(0,1fr)}}
</style>
