<script lang="ts">
  import {tick,onMount} from 'svelte';
  import {PRESETS_MY_WAND_TOUR,findUniqueVisibleTourTarget} from './typed-tour-contract.mjs';
  export let open=false;
  export let copy:any;
  export let onClose:(reason:'finish'|'skip'|'blocked')=>void=()=>{};
  let stepIndex=0;
  let spot:{x:number;y:number;w:number;h:number}|null=null;
  let tooltip:{x:number;y:number;w:number}|null=null;
  let dialog:HTMLElement|null=null;
  let started=false;
  let closed=false;
  const MAX_CARD=330;
  function target() {
    return typeof document==='undefined'?null:
      findUniqueVisibleTourTarget(document,PRESETS_MY_WAND_TOUR.steps[stepIndex].target);
  }
  function measure():void {
    if(!open || closed)return;
    const element=target();
    if(!element){closed=true;onClose('blocked');return;}
    const b=element.getBoundingClientRect();
    if(!Number.isFinite(b.x)||b.width<=0||b.height<=0){
      closed=true;onClose('blocked');return;
    }
    const margin=10;
    const x=Math.max(4,b.left-4),y=Math.max(4,b.top-4);
    spot={x,y,w:Math.max(12,Math.min(window.innerWidth-x-4,b.width+8)),
      h:Math.max(12,Math.min(window.innerHeight-y-4,b.height+8))};
    const width=Math.max(190,Math.min(MAX_CARD,window.innerWidth-24));
    const left=Math.max(12,Math.min(window.innerWidth-width-12,b.left));
    // A fixed envelope keeps the dialog reachable under small viewport zoom.
    const roomBelow=window.innerHeight-b.bottom;
    const top=roomBelow>=246?b.bottom+margin:
      b.top>=246?Math.max(12,b.top-238):Math.max(12,window.innerHeight-252);
    tooltip={x:left,y:top,w:width};
  }
  async function positionStep(index:number):Promise<void>{
    if(!open||closed)return;
    const selector=PRESETS_MY_WAND_TOUR.steps[index]?.target;
    const element=selector?findUniqueVisibleTourTarget(document,selector):null;
    if(!element){closed=true;onClose('blocked');return;}
    stepIndex=index;
    // Scroll only. Never activate a target, Save, Send, Apply or open IDB.
    element.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'});
    await tick();
    measure();
    await tick();
    dialog?.focus();
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
    const recalc=()=>{if(open&&!closed)measure();};
    const main=document.getElementById('main-content');
    const observer=typeof MutationObserver==='function'?new MutationObserver(recalc):null;
    if(main&&observer)observer.observe(main,{childList:true,subtree:true,attributes:true,
      attributeFilter:['style','class','hidden','disabled','aria-hidden']});
    window.addEventListener('scroll',recalc,true);
    window.addEventListener('resize',recalc);
    return ()=>{
      observer?.disconnect();
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
      style:width={spot.w+'px'} style:height={spot.h+'px'} aria-hidden="true"></div>
    <section class="tour-dialog" data-typed-tour-dialog role="dialog" aria-modal="true"
      aria-label={copy.title} tabindex="-1" bind:this={dialog}
      style:left={tooltip.x+'px'} style:top={tooltip.y+'px'} style:width={tooltip.w+'px'}>
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
  .tour-spotlight{position:fixed;pointer-events:none;z-index:1;
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
