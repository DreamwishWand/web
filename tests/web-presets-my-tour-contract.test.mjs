import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {
 PRESETS_MY_WAND_TOUR,TYPED_TOUR_SCHEMA,isPresetPilotPath,
 findUniqueVisibleTourTarget,allPresetPilotTargetsVisible
} from '../src/lib/tour/typed-tour-contract.mjs';
import {PRESETS_MY_TOUR_LOCALES,presetsMyTourCopy} from '../src/lib/tour/presets-my-tour-copy.mjs';
const source=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const header=source('../src/lib/SiteHeader.svelte');
const overlay=source('../src/lib/tour/SpotlightTour.svelte');
const icon=source('../src/lib/ui/Icon.svelte');
const route=source('../src/routes/presets/+page.svelte');
const root=source('../src/lib/ui/product-shell-navigation.mjs');
const help=source('../src/routes/help/+page.svelte');
test('typed registry exact Owner-approved page/version/manual-only static DOM four anchors',()=>{
 const t=PRESETS_MY_WAND_TOUR;
 assert.equal(t.schema,TYPED_TOUR_SCHEMA);
 assert.equal(t.schema,'wand.typed-tour@1');
 assert.equal(t.tourId,'presets.my-wand-local-scenes');
 assert.equal(t.version,1);
 assert.equal(t.pageId,'presets');
 assert.equal(t.requiredView,'my/wand');
 assert.equal(t.firstVisitAuto,false);
 assert.deepEqual([...t.autoLaunchAllowlist],[]);
 assert.equal(t.completionPersistence,'none');
 assert.deepEqual(t.steps.map(s=>s.id),['wand','views','scenes','reopen']);
 assert.deepEqual(t.steps.map(s=>s.target),[
  'button[data-my-domain="wand"]',
  'nav[data-my-wand-views]',
  'section[data-my-local-scenes]',
  'button[data-device-scenes-reopen]'
 ]);
 assert.ok(isPresetPilotPath('/presets/'));
 assert.ok(isPresetPilotPath('/web/presets/'));
 for(const path of ['/', '/help/', '/editor/world/','/web/editor/world/','/web/presets-old/']){
  assert.equal(isPresetPilotPath(path),false,path);
 }
 for(const token of ['data-my-domain={domain}','data-my-wand-views','data-my-local-scenes',
     'data-device-scenes-reopen']){
  assert.ok(route.includes(token),token);
 }
 assert.equal(root.includes("id: 'my', href: '/help/my/'"),true);
 assert.equal(root.includes("id: 'tips', href: '/help/tips/'"),true);
 assert.match(help,/disabled/);
});
test('strict real-element anchor resolution denies hidden, duplicate, disabled, detached',()=>{
 const fake=(count,settings={})=>({
  querySelectorAll:()=>Array.from({length:count},()=>({
   isConnected:settings.connected??true,
   closest:()=>settings.hidden?'[hidden]':null,
   matches:()=>!!settings.disabled,
   getClientRects:()=>settings.noRects?[]:[{width:20,height:20}]
  }))
 });
 assert.equal(findUniqueVisibleTourTarget(fake(0),'button[x]'),null);
 assert.equal(findUniqueVisibleTourTarget(fake(2),'button[x]'),null);
 assert.equal(findUniqueVisibleTourTarget(fake(1,{connected:false}),'button[x]'),null);
 assert.equal(findUniqueVisibleTourTarget(fake(1,{hidden:true}),'button[x]'),null);
 assert.equal(findUniqueVisibleTourTarget(fake(1,{disabled:true}),'button[x]'),null);
 assert.equal(findUniqueVisibleTourTarget(fake(1,{noRects:true}),'button[x]'),null);
 assert.equal(allPresetPilotTargetsVisible({querySelector:()=>null}),false);
 const target=fake(1);
 assert.ok(findUniqueVisibleTourTarget(target,'button[x]'));
 const view={...target,querySelector:()=>({})};
 assert.equal(allPresetPilotTargetsVisible(view),true);
});
test('8 locales readable full four-step feature guides with no unsupported authority',()=>{
 assert.deepEqual([...PRESETS_MY_TOUR_LOCALES],[
  'en','fr','it','de','es-ES','ja','zh-CN','pt-BR'
 ]);
 for(const l of PRESETS_MY_TOUR_LOCALES){
  const c=presetsMyTourCopy(l);
  assert.ok(c.help.length>=4,l);
  assert.ok(c.unavailable.length>=8,l);
  assert.ok(c.blocked.length>=8,l);
  for(const a of ['next','back','skip','finish','close','progress','title']){
   assert.ok(c[a]?.length,l+' '+a);
  }
  assert.equal(c.steps.length,4,l);
  for(const s of c.steps) {
   assert.ok(s.title.length>=2&&s.body.length>=18,l);
  }
 }
 const ja=presetsMyTourCopy('ja').steps.map(s=>s.body).join(' ');
 assert.match(ja,/Cloud/);
 assert.match(ja,/ブラウザ/);
 assert.match(ja,/Backup/);
 assert.match(ja,/DDV Save/);
 assert.match(ja,/自動読込せず/);
 assert.deepEqual(presetsMyTourCopy('unknown'),presetsMyTourCopy('en'));
});
test('global header SVG ? visible in desktop/mobile/immersive; overlay never activates controls',()=>{
 assert.equal(header.match(/<svg viewBox="0 0 24 24"/g)?.length,3);
 assert.match(header,/stroke="currentColor"/);
 for(const position of ['desktop','mobile','immersive']){
  assert.match(header,new RegExp('data-tour-launch="'+position+'"'));
 }
 assert.match(header,/import SpotlightTour/);
 assert.match(header,/on:click=\{startTour\}/);
 assert.match(header,/allPresetPilotTargetsVisible/);
 assert.match(header,/if\(!isPresetPilotPath/);
 assert.match(header,/aria-live="polite"/);
 assert.match(header,/tourOpen=false/);
 assert.match(overlay,/data-typed-tour-open/);
 assert.match(overlay,/data-tour-auto="off"/);
 assert.match(overlay,/data-tour-persistence="none"/);
 assert.match(overlay,/role="dialog" aria-modal="true"/);
 assert.match(overlay,/data-tour-next/);
 assert.match(overlay,/data-tour-back/);
 assert.match(overlay,/data-tour-skip/);
 assert.match(overlay,/data-tour-finish/);
 assert.match(overlay,/event.key==='Escape'/);
 assert.match(overlay,/dialog\?\.focus\(\)/);
 assert.match(overlay,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(overlay,/background:var\(--surface-raised\)/);
 assert.match(overlay,/color:var\(--ink\)/);
 const tourMethods=header.split('function startTour(event:MouseEvent):void{')[1].split('  afterNavigate(')[0];
 assert.doesNotMatch(tourMethods+overlay,/saveLocalScene\(|stageLocalSceneRouteIntent\(|indexedDB\.|fetch\(|localStorage\.(?:setItem|removeItem)|sessionStorage\.(?:setItem|removeItem)/);
});
test('real installed Chrome: new-only pilot 4 anchors, no passive launch or persistence', {timeout:120000},()=>{
 if(process.env.CI!=='true'&&process.env.WEB_TOUR_CHROME!=='1')return;
 const p=spawnSync(process.execPath,['scripts/web-presets-my-tour-chrome.mjs'],
  {cwd:process.cwd(),env:process.env,encoding:'utf8',timeout:115000,maxBuffer:2_000_000});
 if(p.stdout)process.stdout.write(p.stdout);
 if(p.stderr)process.stderr.write(p.stderr);
 assert.equal(p.error,undefined,p.error?.message);
 assert.equal(p.status,0,'real Chrome pilot '+String(p.signal));
 assert.match(p.stdout||'',/WEB_TOUR_INSTALLED_CHROME_FINAL_PASS/);
});
