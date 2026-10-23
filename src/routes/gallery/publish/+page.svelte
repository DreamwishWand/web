<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { locale, ct as t } from '$lib/i18n/community.js';
  import { createCommunityBrowserClient } from '$lib/community/browser-client';
  import PhotoPreview from '$lib/gallery/PhotoPreview.svelte';
  import VerifiedSubjectPicker from '$lib/gallery/VerifiedSubjectPicker.svelte';
  import { isSelectableSubject, subjectDisplayIdentity } from '$lib/gallery/verified-subjects.js';
  import type { GalleryKind, SubjectType, VerifiedGallerySubject } from '$lib/gallery/verified-subjects.js';
  import { validateGalleryComposition, validateGalleryImages, moveMedia, MAX_IMAGES, assertClassifiedPhotoPublishContract, GALLERY_PUBLICATION_BLOCKER } from '$lib/gallery/stage1.js';

  const client = createCommunityBrowserClient();
  type MediaSelection = { id: string; file: File; url: string };
  let images: MediaSelection[] = [];
  let step = 1;
  let signedIn = false;
  let busy = false;
  let error = '';
  let creatorProfileId = '';
  let creatorLabel = '';
  let email = '', password = '', handle = '', displayName = '';
  let kind: GalleryKind = 'outdoor', targetType: SubjectType = 'biome';
  let selectedSubject: VerifiedGallerySubject|null = null;
  let subjectCatalogReady = false;
  let title = '', description = '';
  let originalityConfirmed = false;
  let publishedWorkId = '';

  onMount(() => {
    const family = new URLSearchParams(location.search).get('type');
    if (family === 'tom') { kind = 'tom_furniture'; targetType = 'tom_furniture'; }
    signedIn = Boolean(client?.session);
    if (signedIn) void loadIdentity();
  });
  onDestroy(() => { for (const item of images) URL.revokeObjectURL(item.url); });

  $: isTom = kind.startsWith('tom_');
  $: targetName = selectedSubject ? subjectDisplayIdentity(selectedSubject) : '';
  $: baseItemId = selectedSubject?.baseItemId == null ? '' : String(selectedSubject.baseItemId);
  $: firstStageValid = subjectCatalogReady && isSelectableSubject(selectedSubject,kind,targetType);
  $: validErrors = [
    ...validateGalleryComposition({ kind, targetType, targetName, baseItemId, title, description, files: images.map(x=>x.file), originalityConfirmed }),
    ...(!firstStageValid ? ['verified_subject'] : [])
  ];
  $: mediaValid = validateGalleryImages(images.map(item=>item.file)) === null && Boolean(title.trim()) && title.trim().length <= 240 && description.length <= 20000;
  $: kindLabel = kind === 'outdoor' ? t('gallery.kind.outdoor',{},$locale) : kind === 'indoor' ? t('gallery.kind.indoor',{},$locale) : kind === 'tom_furniture' ? t('gallery.kind.tomFurniture',{},$locale) : t('gallery.kind.tomClothing',{},$locale);

  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    busy = true; error = '';
    try { return await fn(); }
    catch (cause) { error = cause instanceof Error ? cause.message : String(cause); return null; }
    finally { busy = false; }
  }
  async function signIn() {
    if (!client) return;
    const result = await run(() => client.signInWithPassword(email.trim(), password));
    if (result) { password = ''; signedIn = true; await loadIdentity(); }
  }
  async function loadIdentity() {
    if (!client?.session) return;
    const result: any = await run(() => client.query('me'));
    creatorProfileId = String(result?.data?.creatorProfileId ?? '');
    creatorLabel = String(result?.data?.creatorDisplayName ?? result?.data?.displayName ?? '');
  }
  async function ensureCreator() {
    if (!client?.session || !handle.trim() || !displayName.trim()) return;
    const result: any = await run(() => client.command('ensureAccountCreator', { handle: handle.trim(), displayName: displayName.trim() }));
    if (result?.data?.creatorProfileId) { creatorProfileId = String(result.data.creatorProfileId); creatorLabel = displayName.trim(); }
  }
  function setKind(value: GalleryKind) {
    kind = value;
    targetType = value === 'outdoor' ? 'biome' : value === 'indoor' ? 'room' : value;
    selectedSubject = null;
    subjectCatalogReady = false;
  }
  function chooseFiles(event: Event) {
    const selected = Array.from((event.currentTarget as HTMLInputElement).files ?? []);
    if (!selected.length) return;
    // Validate the entire prospective selection before allocating any blob URL.
    // In particular, reject duplicate files selected together (not only duplicates
    // of files that were already in the composer).
    const issue = validateGalleryImages([...images.map(item=>item.file), ...selected]);
    if (issue) {
      error = issue === 'duplicate' ? t('galleryv1.formInvalid',{},$locale) : t('galleryv1.imagesHelp',{},$locale);
      (event.currentTarget as HTMLInputElement).value = '';
      return;
    }
    images = [...images,...selected.map(file=>({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }))];
    (event.currentTarget as HTMLInputElement).value = '';
    error = '';
  }
  function removeImage(index: number) {
    URL.revokeObjectURL(images[index].url);
    images = images.filter((_,i)=>i!==index);
  }
  function reorder(index: number, direction: number) { images = moveMedia(images,index,direction); }
  function next() {
    error = '';
    if (step === 1 && !firstStageValid) { error = t('galleryv1.formInvalid',{},$locale); return; }
    if (step === 2 && !mediaValid) { error = t('galleryv1.formInvalid',{},$locale); return; }
    step = Math.min(3,step+1);
  }
  async function publish() {
    if (validErrors.length) { error = t('galleryv1.formInvalid',{},$locale); return; }
    if (!client?.session || !creatorProfileId) { error = t('galleryv1.signIn',{},$locale); return; }
    // No network/media upload or draft creation occurs before the owner contract
    // declares classification/subject identity + atomic media publication support.
    // No authorized owner READY/CLEAR upload and cleanup contract proven.
    try { assertClassifiedPhotoPublishContract(null); }
    catch { error = t('galleryv1.uploadNotReady',{},$locale) + ' (' + GALLERY_PUBLICATION_BLOCKER + ')'; }
  }
</script>

<svelte:head><title>{t('galleryv1.publishWork',{},$locale)} | Dreamwish Wand</title></svelte:head>

<section class="gallery-composer responsive-frame">
  <a class="inline-link" href={base + '/gallery/'}>← {t('galleryv1.returnToGallery',{},$locale)}</a>
  <header>
    <h1>{t('galleryv1.publishWork',{},$locale)}</h1>
    <p>{t('galleryv1.publicPolicy',{},$locale)}</p>
  </header>
  <nav aria-label={t('galleryv1.step',{number:step},$locale)} class="steps">
    {#each [1,2,3] as n}
      <button type="button" class:active={step===n} aria-current={step===n?'step':undefined}
        disabled={n>step || (n===3 && (!firstStageValid || !mediaValid))}
        on:click={()=>step=n}>{n}. {n===1?t('galleryv1.content',{},$locale):n===2?t('galleryv1.images',{},$locale):t('galleryv1.preview',{},$locale)}</button>
    {/each}
  </nav>

  {#if step===1}
    <div class="form-panel">
      <h2>{t('galleryv1.content',{},$locale)}</h2>
      <label>{t('galleryv1.kind',{},$locale)}
        <select value={kind} on:change={(e)=>setKind((e.currentTarget as HTMLSelectElement).value as GalleryKind)}>
          <option value="outdoor">{t('gallery.kind.outdoor',{},$locale)}</option>
          <option value="indoor">{t('gallery.kind.indoor',{},$locale)}</option>
          <option value="tom_furniture">{t('gallery.kind.tomFurniture',{},$locale)}</option>
          <option value="tom_clothing">{t('gallery.kind.tomClothing',{},$locale)}</option>
        </select>
      </label>
      {#if !isTom}
        <label>{t('galleryv1.targetType',{},$locale)}
          <select bind:value={targetType} on:change={()=>{ selectedSubject=null; }}>
            {#if kind==='outdoor'}
              <option value="biome">{t('galleryv1.biome',{},$locale)}</option>
              <option value="floating_island">{t('galleryv1.floatingIsland',{},$locale)}</option>
            {:else}<option value="room">{t('galleryv1.room',{},$locale)}</option>{/if}
          </select>
        </label>
      {/if}
      <VerifiedSubjectPicker {kind} subjectType={targetType} selected={selectedSubject}
        onChoose={(subject)=>selectedSubject=subject} onReady={(ready)=>subjectCatalogReady=ready} />
      <p class="helper">{t('galleryv1.photoOnly',{},$locale)} · {t('galleryv1.noPreset',{},$locale)}</p>
    </div>
  {:else if step===2}
    <div class="form-panel">
      <h2>{t('galleryv1.images',{},$locale)}</h2>
      <label>{t('galleryv1.title',{},$locale)}<input bind:value={title} maxlength="240" required /></label>
      <label>{t('galleryv1.description',{},$locale)}<textarea bind:value={description} maxlength="20000"></textarea></label>
      <label>{t('galleryv1.chooseFiles',{},$locale)}
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple on:change={chooseFiles}/>
      </label>
      <p>{t('galleryv1.imagesHelp',{},$locale)} · {t('galleryv1.mediaCount',{count:images.length},$locale)}</p>
      <div class="gallery-media-order">
        {#each images as image,i (image.id)}
          <div class="media-row">
            <img src={image.url} alt={t('galleryv1.imageOrdinal',{number:i+1},$locale)} />
            <div class="media-meta"><strong>{i===0?t('galleryv1.cover',{},$locale):t('galleryv1.imageOrdinal',{number:i+1},$locale)}</strong><span>{image.file.name}</span></div>
            <div class="media-actions">
              <button type="button" disabled={i===0} aria-label={t('galleryv1.moveUp',{},$locale)} on:click={()=>reorder(i,-1)}>↑</button>
              <button type="button" disabled={i===images.length-1} aria-label={t('galleryv1.moveDown',{},$locale)} on:click={()=>reorder(i,1)}>↓</button>
              <button type="button" aria-label={t('galleryv1.remove',{},$locale)} on:click={()=>removeImage(i)}>×</button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <h2>{t('galleryv1.preview',{},$locale)}</h2>
    <PhotoPreview {title} {description} creator={creatorLabel || displayName || t('community.auth.creatorRequired',{},$locale)} category={kindLabel} target={targetName} imageUrls={images.map(x=>x.url)} />
    <div class="form-panel">
      <p>{t('galleryv1.publicPolicy',{},$locale)}</p>
      <label class="agreement"><input type="checkbox" bind:checked={originalityConfirmed} />{t('galleryv1.originalityAgree',{},$locale)}</label>
      {#if !client}<p class="notice" role="status">{t('community.configUnavailable',{},$locale)}</p>
      {:else if !signedIn}
        <h3>{t('galleryv1.signIn',{},$locale)}</h3>
        <label>{t('community.auth.email',{},$locale)}<input type="email" autocomplete="email" bind:value={email} /></label>
        <label>{t('community.auth.password',{},$locale)}<input type="password" autocomplete="current-password" bind:value={password} /></label>
        <button type="button" disabled={busy || !email || !password} on:click={signIn}>{t('community.auth.signIn',{},$locale)}</button>
      {:else if !creatorProfileId}
        <h3>{t('galleryv1.creatorRequired',{},$locale)}</h3>
        <label>{t('community.creator.handle',{},$locale)}<input bind:value={handle} /></label>
        <label>{t('community.creator.displayName',{},$locale)}<input bind:value={displayName} /></label>
        <button type="button" disabled={busy || !handle.trim() || !displayName.trim()} on:click={ensureCreator}>{t('community.creator.create',{},$locale)}</button>
      {/if}
      <p class="notice" role="status">{t('galleryv1.uploadNotReady',{},$locale)} <code>{GALLERY_PUBLICATION_BLOCKER}</code></p>
      <p>{t('galleryv1.technicalBlockDetail',{},$locale)}</p>
      <button type="button" disabled aria-disabled="true" title={t('galleryv1.uploadNotReady',{},$locale)}>{t('galleryv1.publishWork',{},$locale)}</button>
    </div>
  {/if}

  <div class="step-actions">
    {#if step>1}<button type="button" on:click={()=>{error='';step-=1}}>{t('galleryv1.back',{},$locale)}</button>{/if}
    {#if step<3}<button type="button" on:click={next}>{t('galleryv1.next',{},$locale)}</button>{/if}
  </div>
  {#if error}<p role="alert" class="form-error">{error}</p>{/if}
  {#if publishedWorkId}<p role="status">{t('galleryv1.success',{},$locale)} <a href={base+'/gallery/?work='+encodeURIComponent(publishedWorkId)}>{publishedWorkId}</a></p>{/if}
</section>

<style>
  .gallery-composer{width:min(1080px,calc(100% - 32px));margin:0 auto;padding:26px 0 64px;min-width:0}
  header h1{font-family:Georgia,serif;font-size:clamp(30px,5vw,46px);margin:20px 0 8px}header p{color:var(--ink-soft);line-height:1.6}
  .steps,.step-actions{display:flex;flex-wrap:wrap;gap:10px;margin:22px 0}.steps button{flex:1;min-width:min(100%,170px);text-align:center}.steps button.active{border-color:var(--gold)}
  .form-panel{display:grid;gap:16px;border:1px solid var(--border);border-radius:20px;background:var(--surface);padding:clamp(16px,4vw,28px);margin:18px 0;min-width:0}
  .form-panel label{display:grid;gap:7px;color:var(--ink-soft);font-size:13px}
  input:not([type=checkbox]),textarea,select{width:100%;min-width:0;min-height:44px;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--surface-raised);color:var(--ink);font:inherit}
  textarea{min-height:105px}.agreement{display:flex!important;align-items:start;gap:10px;font-size:14px}.agreement input{width:20px;height:20px;flex:none}
  button{min-height:44px;padding:9px 14px;border:1px solid var(--border);background:var(--surface-raised);color:var(--ink);border-radius:12px}
  button:disabled{opacity:.55}.media-row{display:flex;align-items:center;gap:12px;min-width:0;padding:10px;border:1px solid var(--border);border-radius:14px;margin:10px 0}.media-row img{width:112px;max-width:34%;aspect-ratio:16/10;object-fit:cover;border-radius:9px}
  .media-meta{display:grid;gap:5px;flex:1;min-width:0}.media-meta span{overflow-wrap:anywhere;font-size:12px}.media-actions{display:flex;gap:5px}.media-actions button{min-width:42px}
  .notice{padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--surface-raised);overflow-wrap:anywhere}.helper{color:var(--ink-muted)}.form-error{color:var(--ink);font-weight:700}
  @media(max-width:560px){.media-row{flex-wrap:wrap}.media-actions{width:100%;justify-content:flex-end}}
</style>
