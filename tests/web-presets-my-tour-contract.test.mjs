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
 for(const origin of ['desktop','mobile','immersive']){
  assert.ok(header.includes("on:click={()=>startTour('"+origin+"')}"),origin);
 }
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
 const tourMethods=header.split('function startTour(origin:TourEntry):void{')[1].split('  afterNavigate(')[0];
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
 assert.match(p.stdout||'',/WEB_TOUR_CDP_PRIVATE_PIPE_VERIFIED/);
 assert.match(p.stdout||'',/WEB_TOUR_VITE_READY_MS \d+[\s\S]*WEB_TOUR_CDP_COLDSTART_BEGIN[\s\S]*WEB_TOUR_CDP_COLDSTART_READY attempt=[12]/);
 assert.match(p.stdout||'',/WEB_TOUR_INSTALLED_CHROME_FINAL_PASS/);
});

test('CDP startup validates exact loopback browser endpoint; rejects incomplete and remote inputs',async()=>{
 const {parseDevToolsActivePort,parseDevToolsStderr,startupDiagnostic}=await import('../scripts/web-tour-cdp-startup.mjs');
 const id='/devtools/browser/12345678-1234-1234-1234-123456789abc';
 const endpoint='ws://127.0.0.1:49152'+id;
 assert.equal(parseDevToolsActivePort('49152\n'+id+'\n'),endpoint);
 assert.equal(parseDevToolsStderr('noise\nDevTools listening on '+endpoint+'\n'),endpoint);
 for(const bad of ['49152\n','0\n'+id,'65536\n'+id,'49152\n/devtools/page/abc','49152\n'+id+'?x=1','49152\n'+id+'\nextra'])assert.equal(parseDevToolsActivePort(bad),null);
 assert.equal(parseDevToolsStderr('DevTools listening on ws://evil.invalid:49152'+id),null);
 assert.equal(startupDiagnostic('ERROR /private/path token=secret'), 'ERROR');
});
test('CDP startup uses actual port file without stderr; validates /json/version and fails early',async()=>{
 const {waitForBrowserEndpoint}=await import('../scripts/web-tour-cdp-startup.mjs');
 const {mkdtemp,writeFile,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const workspace=await mkdtemp(join(tmpdir(),'wand-cdp-contract-'));
 const path='/devtools/browser/12345678-1234-1234-1234-123456789abc';
 const endpoint='ws://127.0.0.1:49152'+path;
 const child={exitCode:null,signalCode:null};
 const opts={workspace,child,getStderr:()=>'',getSpawnError:()=>null,timeoutMs:250,
  fetcher:async(url,options)=>{assert.equal(url,'http://127.0.0.1:49152/json/version');assert.equal(options.redirect,'error');return {ok:true,json:async()=>({webSocketDebuggerUrl:endpoint})}}};
 try{
  await writeFile(join(workspace,'DevToolsActivePort'),'49152\n'+path+'\n');
  assert.deepEqual(await waitForBrowserEndpoint(opts),{endpoint,discovery:'active-port-file'});
  await assert.rejects(waitForBrowserEndpoint({...opts,fetcher:async()=>({ok:true,json:async()=>({webSocketDebuggerUrl:'ws://evil.invalid:49152'+path})})}),/CHROME_CDP_STARTUP_TIMEOUT/);
  await assert.rejects(waitForBrowserEndpoint({...opts,child:{exitCode:1,signalCode:null}}),/EARLY_EXIT/);
  await assert.rejects(waitForBrowserEndpoint({...opts,getSpawnError:()=>Error('private path')}),/SPAWN_ERROR/);
  await rm(join(workspace,'DevToolsActivePort'));
  assert.deepEqual(await waitForBrowserEndpoint({...opts,getStderr:()=> 'DevTools listening on '+endpoint+'\n'}),{endpoint,discovery:'stderr'});
 }finally{await rm(workspace,{recursive:true,force:true})}
});

test('actual localhost probe diagnoses refused, delayed, malformed, redirect and foreign/replaced identity',async()=>{
 const {waitForBrowserEndpoint}=await import('../scripts/web-tour-cdp-startup.mjs');
 const {createServer}=await import('node:http');
 const {mkdtemp,writeFile,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const workspace=await mkdtemp(join(tmpdir(),'wand-cdp-http-'));
 const path='/devtools/browser/12345678-1234-1234-1234-123456789abc';
 const foreign='/devtools/browser/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
 let mode='foreign',port,requests=0;
 const server=createServer((req,res)=>{
  requests++;
  if(mode==='redirect'){res.writeHead(302,{location:'/foreign'});res.end();return}
  if(mode==='bad-json'){res.end('not-json');return}
  if(mode==='delayed'&&requests<3){res.writeHead(503);res.end();return}
  res.setHeader('content-type','application/json');
  res.end(JSON.stringify({webSocketDebuggerUrl:'ws://127.0.0.1:'+port+(mode==='foreign'?foreign:path)}));
 });
 const opts={workspace,child:{exitCode:null,signalCode:null},getStderr:()=>'',getSpawnError:()=>null,timeoutMs:350};
 try{
  await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok)});
  port=server.address().port;
  await writeFile(join(workspace,'DevToolsActivePort'),port+'\n'+path+'\n');
  await assert.rejects(waitForBrowserEndpoint(opts),/ENDPOINT_IDENTITY_MISMATCH.*candidate=active-port-file/);
  mode='bad-json';await assert.rejects(waitForBrowserEndpoint(opts),/JSON_INVALID/);
  mode='redirect';await assert.rejects(waitForBrowserEndpoint(opts),/HTTP_REDIRECT/);
  mode='delayed';requests=0;
  assert.equal((await waitForBrowserEndpoint({...opts,timeoutMs:2000})).endpoint,'ws://127.0.0.1:'+port+path);
  mode='foreign';await assert.rejects(waitForBrowserEndpoint(opts),/ENDPOINT_IDENTITY_MISMATCH/);
  await new Promise(ok=>server.close(ok));
  await assert.rejects(waitForBrowserEndpoint(opts),/TCP_REFUSED|TCP_RESET|TCP_SOCKET/);
 }finally{server.closeAllConnections();if(server.listening)await new Promise(ok=>server.close(ok));await rm(workspace,{recursive:true,force:true})}
});
test('real concurrent Chrome private pipes, isolated targets, killed child fails closed', {timeout:45000},async()=>{
 if(process.env.CI!=='true'&&process.env.WEB_TOUR_CHROME!=='1')return;
 const {startVerifiedChrome}=await import('../scripts/web-tour-cdp-startup.mjs');
 const {access}=await import('node:fs/promises');
 const {join}=await import('node:path');
 const {once}=await import('node:events');
 const chrome=process.env.CHROME_BIN||['google-chrome-stable','google-chrome','chromium','chromium-browser']
  .map(x=>spawnSync('which',[x],{encoding:'utf8'}).stdout?.trim()).find(Boolean);
 assert.ok(chrome,'actual installed Chrome required');
 const instances=[];
 try{
  const outcomes=await Promise.allSettled([0,1].map(async()=>{
   const x=await startVerifiedChrome({chrome,log:console.log});
   instances.push({...x,dir:x.workspace});
  }));
  for(const x of outcomes)if(x.status==='rejected')throw x.reason;
 const results=await Promise.all(instances.map(async(x,i)=>{
   await assert.rejects(access(join(x.dir,'DevToolsActivePort')),e=>e.code==='ENOENT');
   const t=await x.transport.send('Target.createTarget',{url:'about:blank'});
   const a=await x.transport.send('Target.attachToTarget',{targetId:t.targetId,flatten:true});
   const v=await x.transport.send('Runtime.evaluate',{expression:JSON.stringify('private-pipe-'+i),returnByValue:true},a.sessionId);
   assert.equal(v.result.value,'private-pipe-'+i);
   return {target:t.targetId,session:a.sessionId};
  }));
  assert.notEqual(results[0].target,results[1].target);
  assert.notEqual(results[0].session,results[1].session);
  await assert.rejects(instances[0].transport.send('Runtime.evaluate',{expression:'1'},results[1].session),/CHROME_CDP_COMMAND_ERROR|CHROME_CDP_PIPE_SESSION_MISMATCH/);
  const dead=instances[0],exited=once(dead.child,'exit');
  dead.child.kill('SIGKILL');await exited;
  await assert.rejects(dead.transport.send('Browser.getVersion'),/CHROME_CDP_PIPE_NOT_LIVE/);
  await instances[1].transport.verifyBrowser();
  console.log('WEB_TOUR_REAL_CONCURRENT_PRIVATE_CDP_PIPES_ISOLATION_PASS');
 }finally{
  await Promise.all(instances.map(x=>x.dispose()));
 }
});

test('cold-start lifecycle retries only first version deadline with fresh child/profile, never identity/exit', {timeout:20000},async()=>{
 const {startVerifiedChrome}=await import('../scripts/web-tour-cdp-startup.mjs');
 const {spawn}=await import('node:child_process');
 const {access}=await import('node:fs/promises');
 const {join}=await import('node:path');
 // Synthetic child protocol fixtures only: actual Chrome is required in the
 // separate Tour and concurrent tests above. No fixture can satisfy them.
 const childSource=`const fs=require('node:fs');let b='';const mode=process.argv[1];
 const r=fs.createReadStream(null,{fd:3});r.on('data',c=>{b+=c;
 if(!b.includes('\\0'))return;const m=JSON.parse(b.split('\\0')[0]);
 if(mode==='dead'){process.exit(3)}
 if(mode==='hang')return;
 const send=()=>{try{fs.writeSync(4,JSON.stringify({id:m.id,result:{product:mode==='wrong'?'Foreign/1':'Chrome/1',protocolVersion:'1.3'}})+'\\0')}catch{}};
 if(mode==='late')setTimeout(send,3000);else send();
 });setInterval(()=>{},1000);`;
 const run=async(modes,timeout=1000)=>{
  const seen=[],logs=[];
  const spawnChild=(_binary,args,opts)=>{
   const profile=args.find(x=>x.startsWith('--user-data-dir=')).slice('--user-data-dir='.length);
   const mode=modes[seen.length];
   assert.ok(mode,'unexpected extra startup attempt');
   const child=spawn(process.execPath,['-e',childSource,mode],opts);
   seen.push({profile,child});return child;
  };
  const promise=startVerifiedChrome({chrome:'fixture-only',spawnChild,startupTimeoutMs:timeout,log:x=>logs.push(x)});
  return {seen,logs,promise};
 };
 const cleaned=async x=>{assert.ok(x.child.exitCode!==null||x.child.signalCode!==null);await assert.rejects(access(x.profile),e=>e.code==='ENOENT')};
 const good=await run(['late','ok']);const instance=await good.promise;
 try{
  assert.equal(instance.attempt,2);assert.equal(good.seen.length,2);
  assert.notEqual(good.seen[0].profile,good.seen[1].profile);
  assert.notEqual(good.seen[0].child.pid,good.seen[1].child.pid);
  await cleaned(good.seen[0]);
  assert.ok(good.logs.includes('WEB_TOUR_CDP_COLDSTART_FRESH_RETRY'));
  assert.equal(instance.child.exitCode,null);
 }finally{await instance.dispose()}
 await cleaned(good.seen[1]);
 for(const [modes,pattern] of [
  [['hang','hang'],/COMMAND_DEADLINE_Browser.getVersion/],
  [['wrong'],/BROWSER_IDENTITY/],
  [['dead'],/EARLY_EXIT|EOF|CLOSED/]
 ]){
  const x=await run(modes);
  await assert.rejects(x.promise,pattern);
  assert.equal(x.seen.length,modes.length);
  for(const item of x.seen)await cleaned(item);
 }
});
