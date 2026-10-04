<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { locale, formatDate, formatNumber } from '$lib/i18n/runtime.js';
  import { guideCopy } from '$lib/guide/copy.js';
  import { filterGuideViews, guideEventView, guideIssueView, guideQuestView, guideStarPathView, guideSystemView, loadGuideRuntime, cleanGuideText } from '$lib/guide/runtime.js';

  type Section='quests'|'starPaths'|'events'|'systems'|'issues';
  let runtime:any=null, loading=true, error='', section:Section='quests', query='', selectedKey:string|null=null;
  const LIMIT=160;
  $: copy=guideCopy($locale);
  $: views=runtime ? section==='quests' ? runtime.records.quests.map((x:any)=>guideQuestView(x,$locale))
    : section==='starPaths' ? runtime.records.starPaths.map((x:any)=>guideStarPathView(x,$locale))
    : section==='events' ? runtime.records.events.map((x:any)=>guideEventView(x,$locale))
    : section==='systems' ? runtime.records.systems.map((x:any)=>guideSystemView(x,$locale))
    : runtime.records.issues.map((x:any)=>guideIssueView(x,$locale)) : [];
  $: filtered=filterGuideViews(views,query);
  $: visible=filtered.slice(0,LIMIT);
  $: selected=views.find((x:any)=>x.key===selectedKey) ?? visible[0] ?? null;

  onMount(async()=>{try{runtime=await loadGuideRuntime(base);}catch(cause){error=cause instanceof Error?cause.message:String(cause);}finally{loading=false;}});
  function chooseSection(next:Section){section=next;query='';selectedKey=null;}
  function sectionLabel(value:Section){return value==='quests'?copy.quests:value==='starPaths'?copy.starPaths:value==='events'?copy.events:value==='systems'?copy.systems:copy.issues;}
  function safeDate(value:any){if(!value)return '';try{return formatDate(value,{year:'numeric',month:'short',day:'numeric'},$locale);}catch{return '';}}
  function dutyLabel(duty:any){const label=cleanGuideText(duty?.label);return label && !/^Liveops\./.test(label) ? label : '';}
</script>
<svelte:head><title>Guide | Dreamwish Wand</title><meta name="description" content="Curated Disney Dreamlight Valley quests, Star Paths, events, systems and issues." /></svelte:head>

<section class="guide-page container">
  <header class="guide-heading">
    <div><p class="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p class="page-intro">{copy.intro}</p></div>
    <div class="source-badge"><strong>{copy.source}</strong><span>{copy.readOnly}</span></div>
  </header>
  <div class="boundary"><strong>{copy.community}</strong></div>

  {#if loading}<div class="status" role="status">{copy.loading}</div>
  {:else if error}<div class="status error" role="alert"><strong>{copy.failed}</strong><code>{error}</code></div>
  {:else}
    <nav class="guide-tabs" aria-label="Guide sections">
      {#each ['quests','starPaths','events','systems','issues'] as key}
        <button type="button" class:active={section===key} on:click={()=>chooseSection(key as Section)}>{sectionLabel(key as Section)}</button>
      {/each}
    </nav>
    <label class="search"><span>{copy.search}</span><input type="search" bind:value={query} /></label>
    <div class="summary"><strong>{formatNumber(filtered.length,{},$locale)} {copy.results}</strong><span>{sectionLabel(section)}</span></div>

    <div class="guide-workspace">
      <div class="result-list">
        {#each visible as item}
          <button class:active={selected?.key===item.key} type="button" on:click={()=>selectedKey=item.key}>
            <strong>{item.title}</strong>
            <span>
              {#if section==='quests'}{item.status} · {item.objectives} {copy.objectives}
              {:else if section==='starPaths'}{item.status}
              {:else if section==='events'}{item.accessibility}
              {:else if section==='systems'}{item.priority}
              {:else}{item.section}
              {/if}
            </span>
          </button>
        {/each}
        {#if !visible.length}<div class="empty"><strong>{copy.empty}</strong></div>{/if}
      </div>

      <article class="detail">
        {#if selected}
          <header><p class="eyebrow">{sectionLabel(section)}</p><h2>{selected.title}</h2>
            {#if selected.localeFallback}<div class="fallback" role="note">{copy.fallback}</div>{/if}
          </header>
          {#if section==='quests'}
            <dl><div><dt>{copy.available}</dt><dd>{selected.status}</dd></div><div><dt>{copy.steps}</dt><dd>{selected.steps}</dd></div><div><dt>{copy.objectives}</dt><dd>{selected.objectives}</dd></div></dl>
            <p class="detail-note">{copy.official}. {selected.guidanceStatus==='REVIEW_REQUIRED' ? copy.fallback : copy.reviewed}</p>
          {:else if section==='starPaths'}
            <dl><div><dt>{copy.available}</dt><dd>{selected.status}</dd></div>{#if selected.expiresAt}<div><dt>{copy.expires}</dt><dd>{safeDate(selected.expiresAt)}</dd></div>{/if}<div><dt>{copy.duties}</dt><dd>{selected.duties.length}</dd></div></dl>
            <div class="stack">{#each selected.duties.slice(0,80) as duty}{#if dutyLabel(duty)}<div class="row"><span>{dutyLabel(duty)}</span>{#if duty.reward}<strong>{duty.reward}</strong>{/if}</div>{/if}{/each}</div>
          {:else if section==='events'}
            {#if selected.guidance}<p class="body-copy">{selected.guidance}</p>{/if}
            <h3>{copy.occurrences}</h3><div class="stack">{#each selected.occurrences as occurrence}<div class="row"><span>{safeDate(occurrence.start)} → {safeDate(occurrence.end)}</span><strong>{occurrence.accessibility}</strong></div>{/each}</div>
            {#if selected.historicalGap}<p class="detail-note">{copy.historical}: {cleanGuideText(selected.historicalGap)}</p>{/if}
          {:else if section==='systems'}
            <p class="body-copy">{selected.summary}</p>{#if selected.availability}<p class="detail-note">{selected.availability}</p>{/if}
            {#if selected.actions.length}<h3>{copy.actions}</h3><ul>{#each selected.actions as line}<li>{line}</li>{/each}</ul>{/if}
            {#if selected.mechanics.length}<h3>{copy.mechanics}</h3><ul>{#each selected.mechanics as line}<li>{line}</li>{/each}</ul>{/if}
            {#if selected.warnings.length}<h3>{copy.warnings}</h3><ul>{#each selected.warnings as line}<li>{line}</li>{/each}</ul>{/if}
          {:else}
            <dl><div><dt>{copy.confidence}</dt><dd>{selected.confidence}</dd></div><div><dt>{copy.details}</dt><dd>{selected.section}</dd></div></dl>
          {/if}
        {:else}<div class="empty large"><strong>{copy.select}</strong></div>{/if}
      </article>
    </div>
  {/if}
</section>

<style>
.guide-page{padding-block:64px 96px;min-height:72vh}.guide-heading{display:flex;justify-content:space-between;align-items:end;gap:28px}.guide-heading h1{font-family:Georgia,serif;font-size:clamp(42px,6vw,68px);font-weight:500;letter-spacing:-.055em;margin:12px 0}.source-badge,.boundary,.status,.result-list,.detail{border:1px solid var(--border);background:var(--surface);border-radius:18px}.source-badge{max-width:360px;padding:15px;display:grid;gap:6px}.source-badge strong{color:var(--gold);font-size:11px}.source-badge span,.boundary{font-size:10px;line-height:1.6;color:var(--ink-muted)}.boundary{padding:12px 14px;margin:24px 0 16px}.status{padding:18px}.status.error{color:var(--decor-accent)}.status code{display:block;margin-top:8px;color:var(--ink-muted);font-size:9px}.guide-tabs{display:flex;gap:6px;overflow:auto;padding:5px;border:1px solid var(--border);border-radius:13px;background:var(--surface);width:max-content;max-width:100%}.guide-tabs button{border:1px solid transparent;background:transparent;color:var(--ink-soft);border-radius:9px;padding:9px 12px;font-weight:800;white-space:nowrap}.guide-tabs button.active{background:var(--surface-raised);border-color:var(--border);color:var(--gold)}.search{display:grid;gap:6px;margin:14px 0;font-size:9px;font-weight:800;color:var(--ink-muted)}.search input{box-sizing:border-box;width:100%;padding:11px 13px;border:1px solid var(--border);border-radius:11px;background:var(--surface-raised);color:var(--ink)}.summary{display:flex;justify-content:space-between;margin:10px 2px;font-size:10px;color:var(--ink-muted)}.guide-workspace{display:grid;grid-template-columns:minmax(260px,360px) minmax(0,1fr);gap:14px;align-items:start}.result-list{max-height:720px;overflow:auto;padding:7px}.result-list button{width:100%;display:grid;gap:4px;text-align:left;border:1px solid transparent;background:transparent;color:var(--ink);border-radius:11px;padding:11px}.result-list button.active{background:var(--surface-raised);border-color:var(--border)}.result-list strong{font-family:Georgia,serif;font-size:15px;font-weight:500}.result-list span{font-size:9px;color:var(--ink-muted)}.detail{padding:24px;min-height:520px}.detail h2{font-family:Georgia,serif;font-size:32px;font-weight:500;margin:6px 0 16px}.detail h3{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--gold);margin:24px 0 8px}.fallback,.detail-note{border:1px solid var(--border);border-radius:10px;background:var(--page-2);padding:10px 12px;color:var(--ink-muted);font-size:10px;line-height:1.6}.body-copy,.detail li{color:var(--ink-soft);line-height:1.75;font-size:12px;white-space:pre-line}.detail ul{padding-left:18px}.detail dl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.detail dl>div{padding:11px;border-radius:10px;background:var(--surface-raised)}.detail dt{font-size:8px;text-transform:uppercase;color:var(--ink-muted)}.detail dd{margin:5px 0 0;font-size:11px}.stack{display:grid;gap:6px}.row{display:flex;justify-content:space-between;gap:14px;padding:9px 10px;border:1px solid var(--border);border-radius:9px;font-size:10px}.row span{color:var(--ink-soft)}.row strong{color:var(--gold);white-space:nowrap}.empty{padding:30px;text-align:center;color:var(--ink-muted)}.empty.large{min-height:440px;display:grid;place-items:center}@media(max-width:820px){.guide-heading{align-items:flex-start;flex-direction:column}.source-badge{max-width:none}.guide-workspace{grid-template-columns:1fr}.result-list{max-height:360px}.detail dl{grid-template-columns:1fr}}@media(max-width:520px){.guide-page{padding-block:44px 70px}.detail{padding:16px}}
</style>
