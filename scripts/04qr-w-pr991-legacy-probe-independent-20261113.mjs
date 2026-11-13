// Independent PR991 actual localhost witness tests; no mock Chrome or product changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {probeBrowserEndpoint,waitForBrowserEndpoint} from './web-tour-cdp-startup.mjs';
const S='157f559f0603be84b7be9622c0b3588d109c73df',M='7b841cab558c47f47552c8f994fd4ea9444650a0';
const H='scripts/web-tour-cdp-startup.mjs',T='tests/web-presets-my-tour-contract.test.mjs',P='scripts/web-presets-my-tour-chrome.mjs';
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
test('fixed original2 pins, unchanged private pipe and coldstart, unchanged real Tour',()=>{
 assert.equal(git('merge-base',S,'HEAD'),S);
 assert.deepEqual(git('diff','--name-status',M,S).split('\n').sort(),['M\t'+H,'M\t'+T].sort());
 for(const [p,old,now] of [[H,'1deb84231b0e0649d4ba1ebc3c0d1901a5363eae','16e864a6b6845001154643892b01e0801b0562f8'],[T,'3eb974de1258654143a8907ff24525774bb7b209','cf36c34beb91e28ef8f0130cdc9dbf864030fdfd'],[P,'dd877c419ea85be7c7ccc231a2130632ca5ad8a6','dd877c419ea85be7c7ccc231a2130632ca5ad8a6']]){
  assert.equal(git('rev-parse',M+':'+p),old);assert.equal(git('rev-parse',S+':'+p),now);
 }
 const a=git('show',M+':'+H),b=git('show',S+':'+H),marker="// Chromium's inherited";
 assert.equal(a.slice(a.indexOf(marker)),b.slice(b.indexOf(marker)));
 assert.match(b,/signal=AbortSignal\.timeout\(500\)/);assert.match(b,/timeoutMs=15000,fetcher=fetch/);
 assert.match(b,/performance\.now\(\)>=end/);assert.match(b,/Math\.min\(500,Math\.floor\(remaining\)\)/);
 assert.ok(git('diff','--name-status',S,'HEAD').split('\n').every(x=>x.startsWith('A\t')&&x.includes('04qr-w-pr991')));
 const tour=git('show',S+':'+P);assert.doesNotMatch(tour,/waitForBrowserEndpoint|probeBrowserEndpoint|remote-debugging-port/);
});
const path='/devtools/browser/12345678-1234-1234-1234-123456789abc';
const other='/devtools/browser/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
async function withHttp(fn){
 const dir=await mkdtemp(join(tmpdir(),'qrw991-http-'));const seen=[];
 let mode='match',port,hook=()=>{};
 const server=createServer((req,res)=>{
  const item={url:req.url,mode,finished:false,closed:false};seen.push(item);
  res.on('finish',()=>item.finished=true);res.on('close',()=>item.closed=true);
  if(req.url!=='/json/version'){res.writeHead(418);res.end();return}
  if(mode==='redirect'){res.writeHead(302,{location:'/must-not-follow'});res.end();return}
  if(mode==='503'){res.writeHead(503);res.end('retry');return}
  if(mode==='malformed'){res.end('{"unterminated":');return}
  if(mode==='partial'){res.writeHead(200,{'content-type':'application/json'});res.write('{"webSocketDebuggerUrl":');hook(item,res);return}
  if(mode==='delayed'&&seen.filter(x=>x.mode==='delayed').length<3){res.writeHead(503);res.end();return}
  res.setHeader('content-type','application/json');
  res.end(JSON.stringify({webSocketDebuggerUrl:'ws://127.0.0.1:'+port+(mode==='foreign'?other:path)}));
  hook(item,res);
 });
 try{
  await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok)});
  port=server.address().port;const endpoint='ws://127.0.0.1:'+port+path;
  await writeFile(join(dir,'DevToolsActivePort'),port+'\n'+path+'\n');
  await fn({endpoint,seen,server,dir,setMode:x=>mode=x,setHook:x=>hook=x});
 }finally{server.closeAllConnections();if(server.listening)await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true})}
}
const watch=()=>AbortSignal.timeout(5000);
test('real completed HTTP responses: exact match, replacement, malformed, redirect no follow, status, remote and canonical invalid', {timeout:30000},()=>withHttp(async x=>{
 for(const [mode,result] of [['match','MATCH'],['foreign','ENDPOINT_IDENTITY_MISMATCH'],['malformed','JSON_INVALID'],['redirect','HTTP_REDIRECT'],['503','HTTP_STATUS_503'],['match','MATCH'],['foreign','ENDPOINT_IDENTITY_MISMATCH']]){
  x.setMode(mode);const n=x.seen.length;
  assert.equal(await probeBrowserEndpoint(x.endpoint,{signal:watch()}),result,mode);
  assert.equal(x.seen.length,n+1);assert.equal(x.seen.at(-1).finished,true);assert.equal(x.seen.at(-1).url,'/json/version');
 }
 const n=x.seen.length;
 for(const invalid of [x.endpoint.replace('127.0.0.1','evil.invalid'),x.endpoint.replace('127.0.0.1','localhost'),x.endpoint+'?query=1',x.endpoint.replace('/browser/','/page/'),'ws://127.0.0.1:0'+path,'ws://127.0.0.1:65536'+path]){
  assert.equal(await probeBrowserEndpoint(invalid,{signal:watch()}),'ENDPOINT_INVALID');
 }
 const a=new AbortController();a.abort();assert.equal(await probeBrowserEndpoint(x.endpoint,{signal:a.signal}),'PROBE_DEADLINE');assert.equal(x.seen.length,n,'invalid or pre-aborted cannot send HTTP');
 console.log('QRW991_REAL_HTTP_COMPLETE_IDENTITY_STATUS_REDIRECT_INVALID_PASS');
}));
test('actual partial HTTP body; observed request then abort; never complete or accept identity', {timeout:15000},()=>withHttp(async x=>{
 const a=new AbortController();let timer;
 x.setMode('partial');x.setHook(()=>{timer=setTimeout(()=>a.abort(new DOMException('deadline','TimeoutError')),60)});
 try{
  const result=await probeBrowserEndpoint(x.endpoint,{signal:AbortSignal.any([a.signal,watch()])});
  assert.equal(result,'PROBE_DEADLINE');assert.equal(a.signal.aborted,true);assert.equal(x.seen.length,1);assert.equal(x.seen[0].finished,false);
 }finally{clearTimeout(timer)}
 // Default 500ms observation also aborts a real partial body, no identity invented.
 x.setHook(()=>{});assert.equal(await probeBrowserEndpoint(x.endpoint),'PROBE_DEADLINE');
 assert.equal(x.seen.length,2);assert.equal(x.seen[1].finished,false);
 console.log('QRW991_REAL_PARTIAL_BODY_REQUEST_WITNESS_DEFAULT_AND_EXPLICIT_DEADLINE_PASS');
}));
test('completed real matching body cannot succeed after signal is aborted; outer polling rejects late match and exited child', {timeout:20000},()=>withHttp(async x=>{
 const a=new AbortController();
 const afterBody=async(url,opts)=>{
  const r=await fetch(url,opts);
  return {status:r.status,ok:r.ok,json:async()=>{const v=await r.json();a.abort();return v}};
 };
 assert.equal(await probeBrowserEndpoint(x.endpoint,{signal:a.signal,fetcher:afterBody}),'PROBE_DEADLINE');
 assert.equal(x.seen.length,1);assert.equal(x.seen[0].finished,true);
 const child={exitCode:null,signalCode:null};
 const opts={workspace:x.dir,child,getStderr:()=>'',getSpawnError:()=>null};
 const exitAfterBody=async(url,o)=>{
  const r=await fetch(url,o);
  return {status:r.status,ok:r.ok,json:async()=>{const v=await r.json();child.exitCode=7;return v}};
 };
 await assert.rejects(waitForBrowserEndpoint({...opts,timeoutMs:5000,fetcher:exitAfterBody}),/EARLY_EXIT exit=7/);
 child.exitCode=null;
 // Deliberately withhold an already completed genuine response until the
 // outer monotonic deadline. This tests the outer guard separately.
 const late=async(url,o)=>{
  const r=await fetch(url,o);const v=await r.json();
  await new Promise(resolve=>setTimeout(resolve,650));
  return {status:r.status,ok:r.ok,json:async()=>v};
 };
 await assert.rejects(waitForBrowserEndpoint({...opts,timeoutMs:500,fetcher:late}),/TIMEOUT PROBE_DEADLINE/);
 assert.ok(x.seen.length>=2&&x.seen.every(y=>y.finished));
 console.log('QRW991_LATE_MATCH_ABORT_CHILD_EXIT_AND_OUTER_DEADLINE_PASS');
}));
test('actual polling waits for observed delayed responses and denies refused endpoint', {timeout:15000},()=>withHttp(async x=>{
 x.setMode('delayed');
 const opts={workspace:x.dir,child:{exitCode:null,signalCode:null},getStderr:()=>'',getSpawnError:()=>null,timeoutMs:5000};
 assert.deepEqual(await waitForBrowserEndpoint(opts),{endpoint:x.endpoint,discovery:'active-port-file'});
 assert.equal(x.seen.length,3);assert.ok(x.seen.every(y=>y.finished));
 x.server.closeAllConnections();await new Promise(r=>x.server.close(r));
 assert.match(await probeBrowserEndpoint(x.endpoint,{signal:watch()}),/^(TCP_REFUSED|TCP_RESET|TCP_SOCKET)$/);
 console.log('QRW991_REAL_DELAYED_POLL_AND_REFUSED_PASS');
}));
