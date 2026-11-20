<script lang="ts">
  import {locale} from '$lib/i18n/runtime.js';
  import {
    reopenLocalScenes,readLocalSceneById,saveLocalScene,verifiedReopenLocalScene
  } from './local-scene-preset-store.mjs';
  import {buildReadonlyLocalSceneReuseDraft} from './local-scene-reuse-readonly';
  import {
    reviewLocalSceneCoordinates,type LocalPosition
  } from './local-scene-coordinate-review';
  import {localSceneCoordinateCopy} from './local-scene-coordinate-copy.js';

  type Entry={id:string;title:string;createdAt:string;artifact:any};
  let entries:Entry[]=[];
  let source:Entry|null=null;
  let revision=0;
  let opened=false;
  let busy=false;
  let selectedId='';
  let movingId='';
  let x=0,y=0;
  let title='';
  let history:LocalPosition[][]=[];
  let cursor=0;
  let review:ReturnType<typeof reviewLocalSceneCoordinates>|null=null;
  let status='';
  let denied=false;
  $: copy=localSceneCoordinateCopy($locale);
  $: canUndo=Boolean(source && cursor>0 && !busy);
  $: canRedo=Boolean(source && cursor<history.length-1 && !busy);
  $: canPreview=Boolean(source && movingId && !busy && title.trim());
  $: canSave=Boolean(source && review && !busy && title.trim()===review.title);

  function resetDraft() {
    source=null; movingId=''; x=0;y=0;title='';history=[];cursor=0;
    review=null;status='';denied=false;
  }
  async function loadScenes() {
    if(busy)return;
    busy=true;resetDraft();
    try {
      const row=await reopenLocalScenes();
      revision=row.revision;
      entries=row.document.entries.map((e:any)=>structuredClone(e));
      opened=true;
      status=entries.length?'':copy.empty;
    }catch {
      entries=[];revision=0;opened=true;denied=true;status=copy.denied;
    }finally{busy=false;}
  }
  function selectScene(id:string) {
    if(busy)return;
    resetDraft();
    selectedId=id;
    const entry=entries.find(e=>e.id===id);
    if(!entry)return;
    try {
      // Strictly display/copy local synthetic two-furniture Scenes only.
      const draft=buildReadonlyLocalSceneReuseDraft({
        sceneId:entry.id,sourceRevision:revision,artifact:entry.artifact
      });
      if(draft.objects.length!==2 ||
         draft.objects.some(o=>o.layer!=='furniture'||o.orientation!==0||
                           o.dependencyIds.length!==0)||
         entry.artifact?.source?.platform!=='synthetic'||
         entry.artifact.source.gameVersion!==null||
         entry.artifact.source.areaKey!==null)
        throw Error('WEP_LOCAL_SCENE_COORD_UNSUPPORTED');
      source=entry;
      title=entry.title+' - copy';
      history=[draft.objects.map(o=>({
        artifactObjectId:o.artifactObjectId,x:o.x,y:o.y
      }))];
      cursor=0;
      setMoving(draft.objects[0].artifactObjectId);
    }catch {
      resetDraft();denied=true;status=copy.denied;
    }
  }
  function setMoving(id:string) {
    movingId=id;
    const p=history[cursor]?.find(o=>o.artifactObjectId===id);
    x=p?.x??0;y=p?.y??0;
  }
  function previewMove() {
    if(!canPreview||!source)return;
    review=null;status='';denied=false;
    try {
      const candidate=history[cursor].map(p=>
        p.artifactObjectId===movingId?{...p,x,y}:{...p}
      );
      const next=reviewLocalSceneCoordinates({
        sceneId:source.id,sourceRevision:revision,
        artifact:source.artifact,positions:candidate,title
      });
      history=[...history.slice(0,cursor+1),candidate].slice(-21);
      cursor=history.length-1;
      review=next;
      status=copy.review;
    }catch {
      denied=true;status=copy.denied;
    }
  }
  function moveHistory(direction:-1|1) {
    if(busy||!source)return;
    const next=cursor+direction;
    if(next<0||next>=history.length)return;
    cursor=next;review=null;status='';denied=false;
    setMoving(movingId);
    if(cursor>0){
      try {
        review=reviewLocalSceneCoordinates({
          sceneId:source.id,sourceRevision:revision,artifact:source.artifact,
          positions:history[cursor],title
        });
        status=copy.review;
      }catch{denied=true;status=copy.denied;}
    }
  }
  async function saveSeparateScene() {
    if(!canSave||!source||!review)return;
    busy=true;status='';denied=false;
    const expected=source,confirmed=review,expectedRevision=revision;
    try {
      // Reopen BEFORE writing. An untrusted UI draft is never a CAS receipt.
      const before=await reopenLocalScenes();
      const fresh=await readLocalSceneById(expected.id);
      if(before.revision!==expectedRevision||fresh.revision!==expectedRevision||
         fresh.entry.id!==expected.id||
         JSON.stringify(fresh.entry)!==JSON.stringify(expected))
        throw Error('WEP_LOCAL_SCENE_COORD_STALE_SOURCE');
      const reviewedAgain=reviewLocalSceneCoordinates({
        sceneId:expected.id,sourceRevision:expectedRevision,
        artifact:fresh.entry.artifact,
        positions:history[cursor],title:confirmed.title
      });
      if(JSON.stringify(reviewedAgain.artifact)!==JSON.stringify(confirmed.artifact))
        throw Error('WEP_LOCAL_SCENE_COORD_STALE_REVIEW');
      const receipt=await saveLocalScene({
        artifact:reviewedAgain.artifact,title:confirmed.title,
        expectedRevision
      });
      const checked=await verifiedReopenLocalScene(receipt);
      if(checked.revision!==expectedRevision+1||
         checked.row.backup!==before.primary||
         JSON.stringify(checked.entry.artifact)!==JSON.stringify(confirmed.artifact)||
         JSON.stringify(checked.row.document.entries.find((e:any)=>e.id===expected.id))!==
           JSON.stringify(expected))
        throw Error('WEP_LOCAL_SCENE_COORD_REOPEN_DENIED');
      resetDraft();
      status=copy.saved;
    }catch {
      denied=true;status=copy.denied;
    }finally{busy=false;}
  }
</script>

<section class="coordinate-studio" data-wep-local-coordinate-studio
  data-save-writer="off" data-native-apply="off" data-cloud="off"
  data-editor-mutation="off" aria-label={copy.title}>
  <h2>{copy.title}</h2>
  <p>{copy.notice}</p>
  <button data-wep-coord-load type="button" on:click={loadScenes} disabled={busy}>{copy.load}</button>
  {#if opened && entries.length}
    <label class="field">
      <span>{copy.selectScene}</span>
      <select data-wep-coord-scene value={selectedId}
        on:change={e=>selectScene(e.currentTarget.value)} disabled={busy}>
        <option value="">—</option>
        {#each entries as entry (entry.id)}
          <option value={entry.id}>{entry.title}</option>
        {/each}
      </select>
    </label>
  {/if}
  {#if source}
    <label class="field">
      <span>{copy.newTitle}</span>
      <input data-wep-coord-title type="text" maxlength="120"
        bind:value={title} on:input={()=>review=null} disabled={busy}/>
    </label>
    <label class="field">
      <span>{copy.selectObject}</span>
      <select data-wep-coord-object value={movingId}
        on:change={e=>setMoving(e.currentTarget.value)} disabled={busy}>
        {#each history[0] as p (p.artifactObjectId)}
          <option value={p.artifactObjectId}>{p.artifactObjectId} ·
            #{source.artifact.objects.find((o:any)=>o.artifactObjectId===p.artifactObjectId)?.itemId}</option>
        {/each}
      </select>
    </label>
    <div class="coords">
      <label class="field">{copy.x}
        <input data-wep-coord-x type="number" min="0" max="63" step="1"
          bind:value={x} on:input={()=>review=null} disabled={busy}/>
      </label>
      <label class="field">{copy.y}
        <input data-wep-coord-y type="number" min="0" max="63" step="1"
          bind:value={y} on:input={()=>review=null} disabled={busy}/>
      </label>
    </div>
    <div class="buttons">
      <button data-wep-coord-preview type="button" on:click={previewMove}
        disabled={!canPreview}>{copy.apply}</button>
      <button data-wep-coord-undo type="button" on:click={()=>moveHistory(-1)}
        disabled={!canUndo}>{copy.undo}</button>
      <button data-wep-coord-redo type="button" on:click={()=>moveHistory(1)}
        disabled={!canRedo}>{copy.redo}</button>
    </div>
    {#if review}
      <div data-wep-coord-review data-apply="off" data-writer="off">
        <strong>{copy.review}</strong>
        <p>{review.diffs.map(d=>`${d.artifactObjectId} (${d.old.x},${d.old.y}) → (${d.next.x},${d.next.y})`).join(' / ')}</p>
        <svg data-wep-coord-map role="img" aria-label={copy.review}
          viewBox={`0 0 ${review.bounds.w*12} ${review.bounds.h*12}`}
          width={review.bounds.w*12} height={review.bounds.h*12}>
          {#each review.artifact.objects as object,i (object.artifactObjectId)}
            {#each object.footprint as cell (`${cell.x},${cell.y}`)}
              <rect x={(object.localX+cell.x)*12}
                y={(object.localY+cell.y)*12} width="12" height="12"
                class:second={i===1}/>
            {/each}
          {/each}
        </svg>
        <code>writeReady=false / applyReady=false</code>
      </div>
    {/if}
    <button data-wep-coord-save-as type="button" on:click={saveSeparateScene}
      disabled={!canSave}>{copy.saveAs}</button>
  {/if}
  {#if status}
    <p data-wep-coord-status role={denied?'alert':'status'}
      aria-live="polite">{status}</p>
  {/if}
</section>

<style>
  .coordinate-studio{border:1px solid var(--border);padding:clamp(12px,2vw,22px);margin:22px 0;min-width:0;display:grid;gap:10px}
  .coordinate-studio h2,.coordinate-studio p{margin:0}
  .field{display:grid;gap:5px;min-width:0}
  .field input,.field select{min-width:0;max-width:520px;width:100%}
  .coords,.buttons{display:flex;flex-wrap:wrap;gap:10px}
  .coords>.field{max-width:140px}
  svg{display:block;max-width:100%;height:auto;min-height:24px;border:1px solid var(--border)}
  rect{fill:#7695b3;stroke:#26374b;stroke-width:.7}
  rect.second{fill:#c9aa76}
  [data-wep-coord-review]{display:grid;gap:7px;overflow-wrap:anywhere}
</style>
