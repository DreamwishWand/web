// Independent actual Chrome CDP startup audit. No product changes or deploy.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawn,spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {parseDevToolsActivePort,parseDevToolsStderr,localBrowserEndpoint,startupDiagnostic,waitForBrowserEndpoint} from '../scripts/web-tour-cdp-startup.mjs';
const S='e7f2e8629c5a949c0dc3f2a3f941ccfac57fe45b',M='a6dbe1c3e26445ba2a71fc9359de8bc4249b8fed';
const files={'.github/workflows/08web-tour-cdp-startup.yml':'0f69efe8b63db1a620c7740dce42c584c9a60cf9','scripts/web-presets-my-tour-chrome.mjs':'cb04706b1a187717a19e185dd3f5a9fb29ab7c33','scripts/web-tour-cdp-startup.mjs':'67aa14ffe3315c1c34b265c6bee17709400f07e9','tests/web-presets-my-tour-contract.test.mjs':'1d7fc1b236a26faf34947bbe53d942e9cdaf8738'};
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const path='/devtools/browser/12345678-1234-1234-1234-123456789abc',endpoint='ws://127.0.0.1:49152'+path;
const cleanChild=()=>({exitCode:null,signalCode:null});
async function workspace(fn){const w=await mkdtemp(join(tmpdir(),'qrw971-'));try{return await fn(w)}finally{await rm(w,{recursive:true,force:true});await assert.rejects(access(w))}}
test('fixed original4 and retained old Tour UI assertions, no deploy/product code change',()=>{
 assert.equal(git('merge-base',S,'HEAD'),S);assert.equal(git('merge-base',M,S),M);
 assert.deepEqual(git('diff','--name-status',M,S).split('\n').sort(),['A\t.github/workflows/08web-tour-cdp-startup.yml','M\tscripts/web-presets-my-tour-chrome.mjs','A\tscripts/web-tour-cdp-startup.mjs','M\ttests/web-presets-my-tour-contract.test.mjs'].sort());
 for(const [p,h] of Object.entries(files))assert.equal(git('rev-parse',S+':'+p),h);
 assert.ok(git('diff','--name-status',S,'HEAD').split('\n').every(x=>x.startsWith('A\t')&&x.includes('04qr-w-pr971')));
 const old=git('show',M+':scripts/web-presets-my-tour-chrome.mjs'),fresh=git('show',S+':scripts/web-presets-my-tour-chrome.mjs');
 const marker=" const target=await send('Target.createTarget'";
 assert.equal(fresh.slice(fresh.indexOf(marker),fresh.indexOf('}finally{')),old.slice(old.indexOf(marker),old.indexOf('}finally{')),'all actual UI assertions unchanged byte-for-byte');
 const oldTests=git('show',M+':tests/web-presets-my-tour-contract.test.mjs');
 const newTests=git('show',S+':tests/web-presets-my-tour-contract.test.mjs');
 const cut="test('real installed Chrome:";
 assert.equal(newTests.slice(0,newTests.indexOf(cut)),oldTests.slice(0,oldTests.indexOf(cut)));
});
test('endpoint grammar, local only, no token/path in diagnostics',()=>{
 assert.equal(parseDevToolsActivePort('49152\r\n'+path+'\r\n'),endpoint);
 assert.equal(parseDevToolsStderr('noise\nDevTools listening on '+endpoint+'\n'),endpoint);
 for(const s of ['0\n'+path,'65536\n'+path,'1e3\n'+path,'49152\n'+path+'?x','49152\n/devtools/page/x','49152\n'+path+'\nextra','49152\n'+path+'#x','49152\nhttps://bad.invalid'])assert.equal(parseDevToolsActivePort(s),null,s);
 for(const host of ['localhost','127.0.0.2','evil.invalid','[::1]','127.0.0.1.evil.invalid'])assert.equal(parseDevToolsStderr('DevTools listening on ws://'+host+':49152'+path),null);
 for(const p of [0,65536,NaN,1.5,'49152'])assert.equal(localBrowserEndpoint(p,path),null);
 assert.equal(startupDiagnostic('ERROR FATAL /private/path secret=abc https://host.invalid/'), 'ERROR,FATAL');
});
test('file preferred over noisy stderr; version exact match and local redirect policy',()=>workspace(async w=>{
 const child=cleanChild();await writeFile(join(w,'DevToolsActivePort'),'49152\n'+path+'\n');
 let called=0;
 const opts={workspace:w,child,getStderr:()=> 'DevTools listening on ws://127.0.0.1:49153'+path,getSpawnError:()=>null,timeoutMs:450,fetcher:async(url,o)=>{called++;assert.equal(url,'http://127.0.0.1:49152/json/version');assert.equal(o.redirect,'error');assert.ok(o.signal instanceof AbortSignal);return{ok:true,json:async()=>({webSocketDebuggerUrl:endpoint})}}};
 assert.deepEqual(await waitForBrowserEndpoint(opts),{endpoint,discovery:'active-port-file'});assert.equal(called,1);
 for(const x of ['ws://evil.invalid:49152'+path,'ws://127.0.0.1:49153'+path,endpoint+'?x',endpoint.replace('12345678','87654321')]){
  await assert.rejects(waitForBrowserEndpoint({...opts,timeoutMs:180,fetcher:async()=>({ok:true,json:async()=>({webSocketDebuggerUrl:x})})}),/CHROME_CDP_STARTUP_TIMEOUT/);
 }
 await assert.rejects(waitForBrowserEndpoint({...opts,timeoutMs:180,fetcher:async()=>({ok:false})}),/CHROME_CDP_STARTUP_TIMEOUT/);
}));
test('partial file then complete, stderr fallback, child exit during version verification',()=>workspace(async w=>{
 const f=join(w,'DevToolsActivePort'),child=cleanChild();await writeFile(f,'49152\n');
 const opts={workspace:w,child,getStderr:()=>'',getSpawnError:()=>null,timeoutMs:1200,fetcher:async()=>({ok:true,json:async()=>({webSocketDebuggerUrl:endpoint})})};
 const pending=waitForBrowserEndpoint(opts);await sleep(125);await writeFile(f,'49152\n'+path+'\n');
 assert.equal((await pending).discovery,'active-port-file');
 await rm(f);assert.equal((await waitForBrowserEndpoint({...opts,getStderr:()=> 'DevTools listening on '+endpoint})).discovery,'stderr');
 await writeFile(f,'49152\n'+path+'\n');
 await assert.rejects(waitForBrowserEndpoint({...opts,fetcher:async()=>({ok:true,json:async()=>{child.exitCode=3;return{webSocketDebuggerUrl:endpoint}}})}),/CHROME_CDP_STARTUP_EARLY_EXIT/);
 await assert.rejects(waitForBrowserEndpoint({...opts,child:cleanChild(),getSpawnError:()=>Error('/private/secret')}),e=>/SPAWN_ERROR/.test(e.message)&&!e.message.includes('/private/secret'));
}));
const chrome=process.env.CHROME_BIN||['google-chrome-stable','google-chrome','chromium','chromium-browser'].map(x=>spawnSync('which',[x],{encoding:'utf8'}).stdout?.trim()).find(Boolean);
async function launch(w){
 const c=spawn(chrome,['--headless=new','--disable-gpu','--no-sandbox','--disable-dev-shm-usage','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--no-first-run','--no-default-browser-check','--user-data-dir='+w,'about:blank'],{stdio:['ignore','ignore','pipe']});
 let stderr='',err=null;c.stderr.on('data',b=>{stderr=(stderr+String(b)).slice(-8192)});c.on('error',e=>err=e);
 const ended=new Promise(r=>c.once('close',r));
 return{c,ended,opts:{workspace:w,child:c,getStderr:()=>'',getSpawnError:()=>err,timeoutMs:20000},stderr:()=>stderr};
}
async function stop(x){if(x.c.exitCode===null&&x.c.signalCode===null)x.c.kill('SIGKILL');await Promise.race([x.ended,sleep(5000).then(()=>{throw Error('Chrome process cleanup timeout')})])}
async function version(ws){
 const s=new WebSocket(ws);try{
  await new Promise((r,j)=>{const t=setTimeout(()=>j(Error('WS timeout')),5000);s.addEventListener('open',()=>{clearTimeout(t);r()},{once:true});s.addEventListener('error',()=>{clearTimeout(t);j(Error('WS error'))},{once:true})});
  const v=await new Promise((r,j)=>{const t=setTimeout(()=>j(Error('CDP timeout')),5000);s.addEventListener('message',e=>{const a=JSON.parse(e.data);if(a.id===1){clearTimeout(t);a.error?j(Error('CDP error')):r(a.result)} });s.send(JSON.stringify({id:1,method:'Browser.getVersion'}))});assert.match(v.product,/Chrome|Chromium/);assert.ok(v.protocolVersion);return v;
 }finally{s.close()}
}
test('ACTUAL two concurrent installed Chrome processes, independent ephemeral ports/profiles, file-only discovery, CDP Browser.getVersion', {timeout:60000},()=>workspace(async a=>workspace(async b=>{
 assert.ok(chrome,'installed Chrome required');
 const [x,y]=await Promise.all([launch(a),launch(b)]);
 try{
  const [one,two]=await Promise.all([waitForBrowserEndpoint(x.opts),waitForBrowserEndpoint(y.opts)]);
  assert.equal(one.discovery,'active-port-file');assert.equal(two.discovery,'active-port-file');assert.notEqual(one.endpoint,two.endpoint);
  assert.notEqual(new URL(one.endpoint).port,new URL(two.endpoint).port);
  assert.equal(parseDevToolsActivePort(await readFile(join(a,'DevToolsActivePort'),'utf8')),one.endpoint);
  assert.equal(parseDevToolsActivePort(await readFile(join(b,'DevToolsActivePort'),'utf8')),two.endpoint);
  await Promise.all([version(one.endpoint),version(two.endpoint)]);
  // A foreign browser path on the actual live port cannot satisfy /json/version.
  const wrong=new URL(one.endpoint);wrong.pathname=new URL(two.endpoint).pathname;
  await writeFile(join(a,'DevToolsActivePort'),wrong.port+'\n'+wrong.pathname+'\n');
  await assert.rejects(waitForBrowserEndpoint({...x.opts,timeoutMs:500}),/CHROME_CDP_STARTUP_TIMEOUT/);
  await stop(x);await assert.rejects(waitForBrowserEndpoint(x.opts),/EARLY_EXIT/);
  await version(two.endpoint);
  console.log('QRW971_REAL_CHROME_TWO_PROFILE_CDP_PORTFILE_MISMATCH_EXIT_PASS');
 }finally{await Promise.all([stop(x),stop(y)])}
})));
test('actual nonexistent executable fails early, bounded local diagnostics, profile cleanup',()=>workspace(async w=>{
 const c=spawn(join(w,'missing-chrome'),[],{stdio:'ignore'});let err=null;c.on('error',e=>err=e);
 await assert.rejects(waitForBrowserEndpoint({workspace:w,child:c,getStderr:()=>'',getSpawnError:()=>err,timeoutMs:1000}),e=>/SPAWN_ERROR/.test(e.message)&&!e.message.includes(w));
}));
