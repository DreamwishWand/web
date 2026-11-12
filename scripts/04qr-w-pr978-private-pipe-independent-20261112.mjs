// Independent QA-only. Real installed Chrome for browser assertions; separate
// deterministic child protocol fault injection tests are NOT browser evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync,execFileSync} from 'node:child_process';
import {mkdtemp,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createChromePipeTransport} from './web-tour-cdp-startup.mjs';
const S='260879f8183b88c5298ef5fc416d170f412361de',B='cc65e61704b2c16ca894f9447d3d03a59ba7496b';
const files={
 'scripts/web-presets-my-tour-chrome.mjs':'447ed5d7e16522dc306459d41ca5e92ca4454a47',
 'scripts/web-tour-cdp-startup.mjs':'2eb1de6a3cd04067a9781f6b66c848e057ffb670',
 'tests/web-presets-my-tour-contract.test.mjs':'8166654e2557941e804039b41ced050bb652eaa7'};
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
test('exact original3, QA-only2 ADD, no network fallback and all prior Tour assertion labels retained',()=>{
 assert.equal(git('merge-base',S,'HEAD'),S);
 assert.deepEqual(git('diff','--name-status',B,S).split('\n').sort(),Object.keys(files).map(p=>'M\t'+p).sort());
 for(const [p,h] of Object.entries(files)){assert.equal(git('rev-parse',S+':'+p),h);assert.equal(git('rev-parse','HEAD:'+p),h)}
 assert.deepEqual(git('diff','--name-status',S,'HEAD').split('\n').sort(),['A\t.github/workflows/04qr-w-pr978-private-pipe-20261112.yml','A\tscripts/04qr-w-pr978-private-pipe-independent-20261112.mjs'].sort());
 const old=git('show',B+':scripts/web-presets-my-tour-chrome.mjs'),now=git('show',S+':scripts/web-presets-my-tour-chrome.mjs');
 assert.match(now,/--remote-debugging-pipe/);assert.doesNotMatch(now,/--remote-debugging-port|new WebSocket|waitForBrowserEndpoint|\/json\/version|DevToolsActivePort/);
 for(const marker of old.match(/WEB_TOUR_[A-Z0-9_]+_PASS/g)||[])assert.ok(now.includes(marker),marker);
 assert.match(now,/transport\.verifyBrowser/);
 assert.match(now,/transport\.close\(/);
});
const chrome=process.env.CHROME_BIN||['google-chrome-stable','google-chrome','chromium','chromium-browser'].map(x=>spawnSync('which',[x],{encoding:'utf8'}).stdout?.trim()).find(Boolean);
async function launch(){
 assert.ok(chrome,'real installed Chrome required');
 const dir=await mkdtemp(join(tmpdir(),'qrw978-pipe-'));
 const child=spawn(chrome,['--headless=new','--disable-gpu','--no-sandbox','--disable-dev-shm-usage','--remote-debugging-pipe','--no-first-run','--no-default-browser-check','--user-data-dir='+dir,'about:blank'],{stdio:['ignore','pipe','pipe','pipe','pipe']});
 let stderr='';child.stdout.resume();child.stderr.on('data',x=>stderr=(stderr+String(x)).slice(-8192));
 const events=[];const transport=createChromePipeTransport(child,{getStderr:()=>stderr,onEvent:e=>{if(events.length<1000)events.push(e)}});
 return {dir,child,transport,events};
}
async function cleanup(x){
 x.transport.close();
 if(x.child.exitCode===null&&x.child.signalCode===null){const done=once(x.child,'exit');x.child.kill('SIGKILL');await done}
 await rm(x.dir,{recursive:true,force:true,maxRetries:12,retryDelay:125});
 await assert.rejects(access(x.dir));
}
async function target(x){
 const t=await x.transport.send('Target.createTarget',{url:'about:blank'});
 return (await x.transport.send('Target.attachToTarget',{targetId:t.targetId,flatten:true})).sessionId;
}
test('real Chrome two private pipes, same-child concurrent sessions, actual pending deadline and surviving peer', {timeout:60000},async()=>{
 const a=await launch(),b=await launch();
 try{
  await Promise.all([a.transport.verifyBrowser(),b.transport.verifyBrowser()]);
  await Promise.all([a,b].map(x=>assert.rejects(access(join(x.dir,'DevToolsActivePort')),e=>e.code==='ENOENT')));
  const [s1,s2,s3]=await Promise.all([target(a),target(a),target(b)]);
  assert.equal(new Set([s1,s2,s3]).size,3);
  const jobs=[{x:a,s:s1,v:'A1'},{x:a,s:s2,v:'A2'},{x:b,s:s3,v:'B1'}];
  await Promise.all(jobs.map(async({x,s,v})=>{
   await x.transport.send('Runtime.enable',{},s);
   const r=await x.transport.send('Runtime.evaluate',{expression:JSON.stringify(v),returnByValue:true},s);assert.equal(r.result.value,v);
  }));
  // Real Chrome never resolves this promise; timeout must revoke all pending
  // commands on A but leave unrelated B and its private channel live.
  const stuck=a.transport.send('Runtime.evaluate',{expression:'new Promise(()=>{})',awaitPromise:true},s1,500);
  const other=a.transport.send('Runtime.evaluate',{expression:'new Promise(()=>{})',awaitPromise:true},s2,4000);
  const outcomes=await Promise.allSettled([stuck,other]);
  for(const o of outcomes){assert.equal(o.status,'rejected');assert.match(o.reason.message,/COMMAND_DEADLINE_Runtime.evaluate/)}
  await assert.rejects(a.transport.verifyBrowser(),/NOT_LIVE/);
  const live=await b.transport.send('Runtime.evaluate',{expression:'6*7',returnByValue:true},s3);assert.equal(live.result.value,42);
  console.log('QRW978_REAL_CHROME_CONCURRENT_SESSION_DEADLINE_PEER_SURVIVES_PASS');
 }finally{await Promise.all([cleanup(a),cleanup(b)])}
});
const childCode=String.raw`
const fs=require('node:fs');
const input=fs.createReadStream(null,{fd:3,autoClose:false});
const out=fs.createWriteStream(null,{fd:4,autoClose:false});
const mode=process.argv[1];let buffer='',requests=[];
const write=x=>out.write(x);
input.on('data',b=>{buffer+=b.toString('utf8');let n;
 while((n=buffer.indexOf('\0'))>=0){const m=JSON.parse(buffer.slice(0,n));buffer=buffer.slice(n+1);requests.push(m);
  if(mode==='split'){const response=JSON.stringify({id:m.id,result:{value:7}})+'\0';write(response.slice(0,5));setTimeout(()=>write(response.slice(5)),30)}
  if(mode==='coalesced'&&requests.length===2){const [a,b]=requests;write(JSON.stringify({method:'QA.event',params:{}})+'\0'+JSON.stringify({id:b.id,sessionId:b.sessionId,result:{value:2}})+'\0'+JSON.stringify({id:a.id,sessionId:a.sessionId,result:{value:1}})+'\0')}
  if(mode==='wrong-session')write(JSON.stringify({id:m.id,sessionId:'other',result:{}})+'\0');
  if(mode==='unknown-id')write(JSON.stringify({id:m.id+99,result:{}})+'\0');
  if(mode==='bad-json')write('{not-json}\0');
  if(mode==='bad-message')write('[]\0');
  if(mode==='bad-response')write(JSON.stringify({id:m.id,result:42})+'\0');
  if(mode==='oversize')write(Buffer.alloc(8*1024*1024+1,65));
  if(mode==='eof')process.exit(0);
  if(mode==='wrong-browser')write(JSON.stringify({id:m.id,result:{product:'NotChrome/1',protocolVersion:'1.3'}})+'\0');
 }
});setInterval(()=>{},1000);
`;
async function protocol(mode,fn){
 const child=spawn(process.execPath,['-e',childCode,mode],{stdio:['ignore','ignore','ignore','pipe','pipe']});
 const events=[];const t=createChromePipeTransport(child,{onEvent:e=>events.push(e)});
 try{await fn(t,events)}finally{t.close();if(child.exitCode===null&&child.signalCode===null){const done=once(child,'exit');child.kill('SIGKILL');await done}}
}
test('actual child pipe fault fixture: fragmented/coalesced NUL frames, out-of-order responses and event',async()=>{
 await protocol('split',async t=>assert.deepEqual(await t.send('QA.one',{},null,2000),{value:7}));
 await protocol('coalesced',async(t,e)=>{const [a,b]=await Promise.all([t.send('QA.one',{},'one',2000),t.send('QA.two',{},'two',2000)]);assert.deepEqual([a,b],[{value:1},{value:2}]);assert.equal(e[0].method,'QA.event')});
});
for(const [mode,code] of Object.entries({'wrong-session':'SESSION_MISMATCH','unknown-id':'UNEXPECTED_RESPONSE','bad-json':'INVALID_FRAME','bad-message':'INVALID_MESSAGE','bad-response':'INVALID_RESPONSE','oversize':'FRAME_LIMIT','eof':'EARLY_EXIT|EOF|CLOSED','wrong-browser':'BROWSER_IDENTITY'})){
 test('actual child pipe fault fixture: '+mode+' revokes channel', {timeout:10000},()=>protocol(mode,async t=>{
  const p=mode==='wrong-browser'?t.verifyBrowser():t.send('QA.one',{},mode==='wrong-session'?'expected':null,5000);
  await assert.rejects(p,new RegExp(code));await assert.rejects(t.send('QA.again'),/NOT_LIVE/);
 }));
}
