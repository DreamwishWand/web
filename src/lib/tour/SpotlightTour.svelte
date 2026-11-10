<script lang="ts">
  import {tick,onMount} from 'svelte';
  import {PRESETS_MY_WAND_TOUR,findUniqueVisibleTourTarget} from './typed-tour-contract.mjs';
  export let open=false;
  export let copy:any;
  export let onClose:(reason:'finish'|'skip'|'blocked')=>void=()=>{};
  let stepIndex=0;
  let spot:{x:number;y:number;w:number;h:number}|null=null;
  let tooltip:{x:number;y:number;w:number;h:number}|null=null;
  let dialog:HTMLElement|null=null;
  let spotlightElement:HTMLElement|null=null;
  let layoutFrame=0;
  let started=false;
  let closed=false;
  const MAX_CARD=330;
  function target() {
    return typeof document==='undefined'?null:
      findUniqueVisibleTourTarget(document,PRESETS_MY_WAND_TOUR.steps[stepIndex].target);
  }
  const EDGE=12;
  function visualZoom():number {
    // CSS zoom does not change DOMRect's physical viewport coordinates, but
    // scales every fixed-position offset on the overlay's ancestor chain.
    let scale=1;
    for(let node:Element|null=dialog?.parentElement??document.documentElement;
      node;node=node.parentElement){
      const z=Number.parseFloat(getComputedStyle(node).zoom);
      if(Number.isFinite(z)&&z>0)scale*=z;
    }
    return scale;
  }
  function overlapsViewport(element:Element):boolean {
    const b=element.getBoundingClientRect();
    return b.right>EDGE&&b.left<window.innerWidth-EDGE&&
      b.bottom>EDGE&&b.top<window.innerHeight-EDGE;
  }
  function reveal(element:Element):void {
    if(!overlapsViewport(element)){
      // nearest leaves tall anchors entirely below a zoomed viewport; center
      // the real element without clicking it, opening storage or mutating UI.
      element.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
    }
  }
  function measure():void {
    if(!open||closed)return;
    const element=target();
    if(!element){closed=true;onClose('blocked');return;}
    const b=element.getBoundingClientRect();
    if(!Number.isFinite(b.x)||!Number.isFinite(b.y)||b.width<=0||b.height<=0){
      closed=true;onClose('blocked');return;
    }
    const zoom=visualZoom();
    const vw=window.innerWidth,vh=window.innerHeight,margin=10;
    // All of these values are *physical* DOMRect/viewport pixels. The
    // tooltip/spot CSS offsets are converted only once at the end.
    const leftSpot=Math.max(4,Math.min(vw-16,b.left-4));
    const topSpot=Math.max(4,Math.min(vh-16,b.top-4));
    const widthSpot=Math.max(12,Math.min(vw-leftSpot-4,b.width+8));
    const heightSpot=Math.max(12,Math.min(vh-topSpot-4,b.height+8));
    spot={x:leftSpot/zoom,y:topSpot/zoom,
      w:widthSpot/zoom,h:heightSpot/zoom};
    const width=Math.max(1,Math.min(MAX_CARD*zoom,vw-24));
    const heightCap=Math.max(1,vh-24);
    // An already-mounted dialog provides its real height, including zoom,
    // locale wrapping and the post-scroll/post-resize font metrics.
    const actualHeight=dialog?.getBoundingClientRect().height??246*zoom;
    const height=Math.min(heightCap,Math.max(1,actualHeight));
    const left=Math.max(EDGE,Math.min(vw-width-EDGE,b.left));
    const below=b.bottom+margin;
    const above=b.top-height-margin;
    const preferred=below+height<=vh-EDGE?below:above>=EDGE?above:b.top;
    // Critical: even the "above" candidate must be upper-clamped. The
    // target itself can be enormous/offscreen under root zoom.
    const top=Math.max(EDGE,Math.min(vh-height-EDGE,preferred));
    tooltip={x:left/zoom,y:top/zoom,w:width/zoom,h:heightCap/zoom};
  }
  function correctRenderedRects():void {
    if(!open||closed||!tooltip||!spot||!dialog||!spotlightElement)return;
    const el=target();
    if(!el){closed=true;onClose('blocked');return;}
    const b=el.getBoundingClientRect();
    if(!overlapsViewport(el)){
      // Fail closed rather than highlighting a detached or offscreen target.
      closed=true;onClose('blocked');return;
    }
    const zoom=visualZoom(),vw=window.innerWidth,vh=window.innerHeight;
    const card=dialog.getBoundingClientRect();
    const maxWidth=vw-2*EDGE,maxHeight=vh-2*EDGE;
    let w=tooltip.w,h=tooltip.h;
    if(card.width>maxWidth+1)w*=maxWidth/card.width;
    if(card.height>maxHeight+1)h*=maxHeight/card.height;
    const desiredLeft=Math.max(EDGE,Math.min(vw-card.width-EDGE,card.left));
    const desiredTop=Math.max(EDGE,Math.min(vh-card.height-EDGE,card.top));
    const dx=(desiredLeft-card.left)/zoom,dy=(desiredTop-card.top)/zoom;
    if(Math.abs(dx)>.25||Math.abs(dy)>.25||w!==tooltip.w||h!==tooltip.h)
      tooltip={...tooltip,x:tooltip.x+dx,y:tooltip.y+dy,w,h};
    // Correct zoomed fixed-position containing-block/scroll offsets using
    // the *rendered* box, rather than assuming left/top CSS equals DOMRect.
    const marker=spotlightElement.getBoundingClientRect();
    const x=Math.max(4,Math.min(vw-16,b.left-4));
    const y=Math.max(4,Math.min(vh-16,b.top-4));
    const width=Math.max(12,Math.min(vw-x-4,b.width+8));
    const height=Math.max(12,Math.min(vh-y-4,b.height+8));
    const sw=marker.width>0?spot.w*width/marker.width:width/zoom;
    const sh=marker.height>0?spot.h*height/marker.height:height/zoom;
    const sx=spot.x+(x-marker.left)/zoom,sy=spot.y+(y-marker.top)/zoom;
    if(Math.abs(sx-spot.x)>.25||Math.abs(sy-spot.y)>.25||
       Math.abs(sw-spot.w)>.25||Math.abs(sh-spot.h)>.25)
      spot={x:sx,y:sy,w:sw,h:sh};
  }
  async function settleLayout():Promise<void>{
    await tick();
    if(!open||closed)return;
    // Measuring after the browser's real render avoids stale dimensions from
    // the previous step/zoom. A second pass applies physical DOMRect offsets.
    await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
    if(!open||closed)return;
    measure();
    await tick();
    correctRenderedRects();
    await tick();
    correctRenderedRects();
  }
  async function positionStep(index:number):Promise<void>{
    if(!open||closed)return;
    const selector=PRESETS_MY_WAND_TOUR.steps[index]?.target;
    const element=selector?findUniqueVisibleTourTarget(document,selector):null;
    if(!element){closed=true;onClose('blocked');return;}
    stepIndex=index;
    // Explicit navigation only: scroll the selected real anchor into view.
    element.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
    await tick();
    reveal(element);
    measure();
    await settleLayout();
    if(!closed)dialog?.focus();
  }
  function scheduleLayout():void {
    if(!open||closed||layoutFrame)return;
    layoutFrame=requestAnimationFrame(()=>{
      layoutFrame=0;
      if(!open||closed)return;
      const element=target();
      if(!element){closed=true;onClose('blocked');return;}
      reveal(element);
      measure();
      void settleLayout();
    });
  }
  function stop(reason:'finish'|'skip'|'blocked'):void{
    if(!closed){closed=true;onClose(reason);}
  }
  function move(delta:number):void{
    const next=stepIndex+delta;
    if(next<0||next>=PRESETS_MY_WAND_TOUR.steps.length)return;
    void positionStep(next);
  }
  function keydown(event:KeyboardEvent):void{
    if(!open)return;
    if(event.key==='Escape'){
      event.preventDefault();event.stopPropagation();stop('skip');return;
    }
    if(event.key!=='Tab')return;
    const controls=Array.from(dialog?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')||[]);
    if(!controls.length){event.preventDefault();dialog?.focus();return;}
    const active=document.activeElement;
    const index=controls.findIndex(e=>e===active);
    if(index<0){event.preventDefault();(event.shiftKey?controls.at(-1):controls[0])?.focus();}
    else if(event.shiftKey&&index===0){event.preventDefault();controls.at(-1)?.focus();}
    else if(!event.shiftKey&&index===controls.length-1){event.preventDefault();controls[0]?.focus();}
  }
  $: if(open&&!started){
    started=true;
    closed=false;
    stepIndex=0;
    void tick().then(()=>positionStep(0));
  }
  $: if(!open&&started){
    started=false;
    spot=null;
    tooltip=null;
  }
  onMount(()=>{
    const recalc=()=>scheduleLayout();
    const main=document.getElementById('main-content');
    const observer=typeof MutationObserver==='function'?new MutationObserver(recalc):null;
    if(main&&observer)observer.observe(main,{childList:true,subtree:true,attributes:true,
      attributeFilter:['style','class','hidden','disabled','aria-hidden']});
    window.addEventListener('scroll',recalc,true);
    window.addEventListener('resize',recalc);
    return ()=>{
      observer?.disconnect();
      if(layoutFrame)cancelAnimationFrame(layoutFrame);
      window.removeEventListener('scroll',recalc,true);
      window.removeEventListener('resize',recalc);
    };
  });
</script>

<svelte:window on:keydown={keydown}/>
{#if open&&spot&&tooltip}
  <div class="tour-overlay" data-typed-tour-open={PRESETS_MY_WAND_TOUR.tourId}
       data-tour-auto="off" data-tour-persistence="none">
    <div class="tour-spotlight" data-typed-tour-highlight
      style:left={spot.x+'px'} style:top={spot.y+'px'}
      style:width={spot.w+'px'} style:height={spot.h+'px'} aria-hidden="true"
      bind:this={spotlightElement}></div>
    <section class="tour-dialog" data-typed-tour-dialog role="dialog" aria-modal="true"
      aria-label={copy.title} tabindex="-1" bind:this={dialog}
      style:left={tooltip.x+'px'} style:top={tooltip.y+'px'}
      style:width={tooltip.w+'px'} style:max-height={tooltip.h+'px'}>
      <p class="tour-counter" aria-live="polite">{copy.progress} {stepIndex+1} / {PRESETS_MY_WAND_TOUR.steps.length}</p>
      <h2>{copy.steps[stepIndex].title}</h2>
      <p class="tour-body">{copy.steps[stepIndex].body}</p>
      <div class="tour-actions">
        <button type="button" data-tour-skip on:click={()=>stop('skip')}>{copy.skip}</button>
        <button type="button" data-tour-back on:click={()=>move(-1)}
          disabled={stepIndex===0}>{copy.back}</button>
        {#if stepIndex===PRESETS_MY_WAND_TOUR.steps.length-1}
          <button type="button" class="tour-primary" data-tour-finish on:click={()=>stop('finish')}>{copy.finish}</button>
        {:else}
          <button type="button" class="tour-primary" data-tour-next on:click={()=>move(1)}>{copy.next}</button>
        {/if}
      </div>
    </section>
  </div>
{/if}

<style>
  .tour-overlay{position:fixed;inset:0;z-index:3000;pointer-events:auto;isolation:isolate}
  .tour-spotlight{position:fixed;pointer-events:none;z-index:1;box-sizing:border-box;
    border:3px solid var(--focus-ring);border-radius:12px;
    box-shadow:0 0 0 9999px rgba(5,9,20,.75),0 0 0 6px var(--surface-raised)}
  .tour-dialog{position:fixed;z-index:2;max-width:calc(100vw - 24px);
    box-sizing:border-box;max-height:calc(100vh - 24px);overflow:auto;
    background:var(--surface-raised);color:var(--ink);border:2px solid var(--gold);
    border-radius:16px;padding:18px;box-shadow:0 12px 45px rgba(0,0,0,.32)}
  .tour-counter{margin:0 0 8px;color:var(--ink-soft);font-size:12px;font-weight:700}
  h2{margin:0 0 8px;font-size:18px;color:var(--ink);font-weight:800}
  .tour-body{margin:0;line-height:1.6;font-size:14px;overflow-wrap:anywhere}
  .tour-actions{display:flex;gap:8px;justify-content:flex-end;align-items:center;
    flex-wrap:wrap;margin-top:14px}
  button{font:inherit;font-size:13px;font-weight:700;border:1px solid var(--border);
    border-radius:9px;background:var(--surface);color:var(--ink);min-height:40px;padding:8px 10px}
  button:disabled{opacity:.42}
  button:focus-visible{outline:3px solid var(--focus-ring);outline-offset:2px}
  .tour-primary{background:var(--gold);color:var(--gold-ink);border-color:var(--gold)}
  @media(max-width:359px){.tour-dialog{padding:12px}.tour-actions{gap:5px}button{font-size:12px;padding:7px}}
  @media(prefers-reduced-motion:reduce){.tour-spotlight,.tour-dialog{transition:none;animation:none}}
</style>
