// Independent bounded startup lifecycle audit; actual Chrome plus explicit fault injection.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync,execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {access,rm} from 'node:fs/promises';
import {once} from 'node:events';
import {startVerifiedChrome} from './web-tour-cdp-startup.mjs';
const S='db46e0bd08afcc9ad674666255a5d43bd3253df0',M='06bf3fec0d672013d44fda1d107997bb02c5ab5b';
const pins={
 'scripts/web-presets-my-tour-chrome.mjs':['447ed5d7e16522dc306459d41ca5e92ca4454a47','dd877c419ea85be7c7ccc231a2130632ca5ad8a6'],
 'scripts/web-tour-cdp-startup.mjs':['2eb1de6a3cd04067a9781f6b66c848e057ffb670','1deb84231b0e0649d4ba1ebc3c0d1901a5363eae'],
 'tests/web-presets-my-tour-contract.test.mjs':['8166654e2557941e804039b41ced050bb652eaa7','3eb974de1258654143a8907ff24525774bb7b209']
};
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
test('exact original3, retained complete UI assertions, Vite before browser and no UI replay',()=>{
 assert.equal(git('merge-base',S,'HEAD'),S);
 assert.deepEqual(git('diff','--name-status',M,S).split('\n').sort(),Object.keys(pins).map(x=>'M\t'+x).sort());
 for(const [p,[old,now]] of Object.entries(pins)){assert.equal(git('rev-parse',M+':'+p),old);assert.equal(git('rev-parse',S+':'+p),now)}
 assert.ok(git('diff','--name-status',S,'HEAD').split('\n').every(x=>x.startsWith('A\t')&&x.includes('04qr-w-pr985')));
 const a=git('show',M+':scripts/web-presets-my-tour-chrome.mjs'),b=git('show',S+':scripts/web-presets-my-tour-chrome.mjs');
 const cut=s=>s.slice(s.indexOf(" const target=await send('Target.createTarget'"),s.indexOf('}finally{'));
 assert.equal(cut(a),cut(b));assert.equal(cut(b).length,15070);
 assert.ok(b.indexOf('if(!viteReady)throw')<b.indexOf('browserInstance=await startVerifiedChrome'));
 assert.ok(b.indexOf('browserInstance=await startVerifiedChrome')<b.indexOf(" const target=await send('Target.createTarget'"));
 assert.equal(b.match(/browserInstance=await startVerifiedChrome/g).length,1);
 const helper=git('show',S+':scripts/web-tour-cdp-startup.mjs');
 assert.match(helper,/startupTimeoutMs=15000/);assert.match(helper,/attempt<=2/);
 assert.match(helper,/--remote-debugging-pipe/);assert.doesNotMatch(helper,/--remote-debugging-port/);
});
const chrome=process.env.CHROME_BIN||['google-chrome-stable','google-chrome','chromium','chromium-browser'].map(x=>spawnSync('which',[x],{encoding:'utf8'}).stdout?.trim()).find(Boolean);
const profile=args=>args.find(x=>x.startsWith('--user-data-dir=')).slice('--user-data-dir='.length);
const dead=c=>c.exitCode!==null||c.signalCode!==null;
const gone=async x=>{assert.ok(dead(x.child),'child must be terminated');await assert.rejects(access(x.dir),e=>e.code==='ENOENT')};
async function emergency(x){if(!dead(x.child)){const p=once(x.child,'exit');spawnKill(x.child);await p}await rm(x.dir,{recursive:true,force:true,maxRetries:12,retryDelay:125})}
const spawnKill=c=>process.kill(c.pid,'SIGKILL');
test('actual Chrome induced stopped first child, fresh second real Chrome, no stale pipe or UI replay', {timeout:40000},async()=>{
 assert.ok(chrome,'actual installed Chrome required');
 const seen=[],logs=[];let instance;
 try{
  instance=await startVerifiedChrome({chrome,startupTimeoutMs:6000,log:x=>logs.push(x),spawnChild:(binary,args,opts)=>{
   assert.equal(binary,chrome);assert.ok(args.includes('--remote-debugging-pipe'));assert.equal(args.some(x=>x.startsWith('--remote-debugging-port')),false);
   if(seen.length){assert.ok(dead(seen[0].child),'first exit BEFORE second spawn');assert.equal(existsSync(seen[0].dir),false,'first profile removed BEFORE second spawn')}
   const c=spawn(binary,args,opts);seen.push({child:c,dir:profile(args)});
   if(seen.length===1)assert.equal(c.kill('SIGSTOP'),true);
   return c;
  }});
  assert.equal(instance.attempt,2);assert.equal(seen.length,2);assert.notEqual(seen[0].dir,seen[1].dir);assert.notEqual(seen[0].child.pid,seen[1].child.pid);
  await gone(seen[0]);assert.ok(logs.includes('WEB_TOUR_CDP_COLDSTART_FRESH_RETRY'));
  assert.ok(logs.some(x=>x.includes('attempt=1')&&x.includes('retry=true')&&x.includes('VERSION_DEADLINE')));
  const v=await instance.transport.verifyBrowser();assert.match(v.product,/^(HeadlessChrome|Chrome|Chromium)\//);
  const t=await instance.transport.send('Target.createTarget',{url:'about:blank'});
  const a=await instance.transport.send('Target.attachToTarget',{targetId:t.targetId,flatten:true});
  const r=await instance.transport.send('Runtime.evaluate',{expression:'6*7',returnByValue:true},a.sessionId);
  assert.equal(r.result.value,42);
  await assert.rejects(instance.transport.send('Runtime.evaluate',{expression:'new Promise(()=>{})',awaitPromise:true},a.sessionId,250),/COMMAND_DEADLINE_Runtime.evaluate/);
  await assert.rejects(instance.transport.verifyBrowser(),/NOT_LIVE/);assert.equal(seen.length,2,'no post-handshake retry');
  const d=instance.dispose();assert.equal(instance.dispose(),d);await d;await gone(seen[1]);
  console.log('QRW985_ACTUAL_CHROME_INDUCED_FIRST_STOP_FRESH_SECOND_POST_UI_NO_RETRY_PASS');
 }finally{if(instance)await instance.dispose().catch(()=>{});for(const x of seen)await emergency(x)}
});
const fixture=String.raw`const fs=require('node:fs');const mode=process.argv[1];let b='';const r=fs.createReadStream(null,{fd:3});r.on('data',c=>{b+=c;if(!b.includes('\0'))return;const m=JSON.parse(b.split('\0')[0]);if(mode==='hang')return;if(mode==='dead')process.exit(9);if(mode==='frame'){fs.writeSync(4,'not-json\0');return}if(mode==='id'){fs.writeSync(4,JSON.stringify({id:m.id+1,result:{}})+'\0');return}if(mode==='session'){fs.writeSync(4,JSON.stringify({id:m.id,sessionId:'foreign',result:{}})+'\0');return}if(mode==='error'){fs.writeSync(4,JSON.stringify({id:m.id,error:{code:-1}})+'\0');return}fs.writeSync(4,JSON.stringify({id:m.id,result:{product:'Foreign/1',protocolVersion:'1.3'}})+'\0')});setInterval(()=>{},1000);`;
test('actual child fault injection: terminal protocol, identity, exit, command errors NEVER retry', {timeout:30000},async()=>{
 for(const [mode,pattern] of [['frame',/INVALID_FRAME/],['id',/UNEXPECTED_RESPONSE/],['session',/SESSION_MISMATCH/],['error',/COMMAND_ERROR Browser.getVersion/],['wrong',/BROWSER_IDENTITY/],['dead',/EARLY_EXIT|EOF|CLOSED/]]){
  const seen=[],logs=[];
  try{
   await assert.rejects(startVerifiedChrome({chrome:'fixture-only',startupTimeoutMs:2500,log:x=>logs.push(x),spawnChild:(_b,args,opts)=>{const c=spawn(process.execPath,['-e',fixture,mode],opts);seen.push({child:c,dir:profile(args)});return c}}),pattern);
   assert.equal(seen.length,1,mode);await gone(seen[0]);assert.equal(logs.includes('WEB_TOUR_CDP_COLDSTART_FRESH_RETRY'),false);
  }finally{for(const x of seen)await emergency(x)}
 }
 console.log('QRW985_TERMINAL_SIX_CHILD_FAULTS_NO_RETRY_PASS');
});
test('cleanup kill failure refuses any fresh retry; independent emergency cleanup', {timeout:12000},async()=>{
 const seen=[],logs=[];
 try{
  await assert.rejects(startVerifiedChrome({chrome:'fixture-only',startupTimeoutMs:500,log:x=>logs.push(x),spawnChild:(_b,args,opts)=>{
   const c=spawn(process.execPath,['-e',fixture,'hang'],opts);seen.push({child:c,dir:profile(args)});
   c.kill=()=>{throw Error('injected kill failure')};return c;
  }}),/COLDSTART_CLEANUP_KILL/);
  assert.equal(seen.length,1);assert.equal(logs.includes('WEB_TOUR_CDP_COLDSTART_FRESH_RETRY'),false);
 }finally{for(const x of seen)await emergency(x)}
 console.log('QRW985_CLEANUP_FAILURE_NO_RETRY_PASS');
});
