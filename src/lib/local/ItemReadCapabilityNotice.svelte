<script lang="ts">
 import { base } from '$app/paths';
 import { itemCapabilityCopy } from './item-capability-copy.mjs';
 import { itemPersonalReadState } from './item-personal-read-gate.mjs';
 export let localeCode: string = 'en';
 $: copy=itemCapabilityCopy(localeCode);
 $: state=itemPersonalReadState();
</script>
<section class="local-capability" lang={localeCode} data-item-read-available={state.capabilityAvailable}
 data-owned={state.state.toLowerCase()} data-item-original-backup="off" data-item-edited-copy="off" data-writer="off">
 <h2>{copy.title}</h2>
 <p>{copy.catalog}</p>
 <p role="status" data-item-read-reason={state.reason}>{copy.session}</p>
 <dl>
  <div><dt>{copy.owned}</dt><dd>{copy.unknown}</dd></div>
  <div><dt>{copy.discovered}</dt><dd>{copy.unknown}</dd></div>
  <div><dt>{copy.amount}</dt><dd>{copy.unknown}</dd></div>
  <div><dt>{copy.progress}</dt><dd>{copy.unknown}</dd></div>
 </dl>
 <p>{copy.reason}</p><p>{copy.writer}</p><p>{copy.noUpload}</p>
 <nav aria-label={copy.title}>
  <a href={base+'/editor/timing/'}>{copy.w1}</a>
  <a href={base+'/presets/'}>{copy.presets}</a>
 </nav>
</section>
<style>
 .local-capability{border:1px solid var(--border);background:var(--surface);padding:clamp(14px,3vw,22px);border-radius:14px;margin-block:20px;min-width:0}
 h2{font:500 clamp(18px,3vw,23px) Georgia,serif;margin:0 0 12px}
 p{color:var(--ink-soft);font-size:13px;line-height:1.65}
 dl{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-block:16px}
 dl>div{min-width:0;padding:10px;border:1px solid var(--border);border-radius:10px}
 dt{font-size:12px;color:var(--ink-soft)}
 dd{margin:5px 0;font-size:13px;font-weight:650;overflow-wrap:anywhere}
 nav{display:flex;flex-wrap:wrap;gap:12px}
 nav a{border:1px solid var(--border);border-radius:10px;padding:12px;color:var(--gold);min-height:44px;box-sizing:border-box;overflow-wrap:anywhere}
 nav a:focus-visible{outline:3px solid var(--gold);outline-offset:3px}
 @media(max-width:750px){dl{grid-template-columns:repeat(2,minmax(0,1fr))}}
 @media(max-width:400px){dl{grid-template-columns:1fr}}
</style>
