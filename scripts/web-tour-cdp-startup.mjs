// Real Chrome CDP startup only. Never use remote endpoints or synthetic PASS.
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';

const browserPath=/^\/devtools\/browser\/[a-f0-9-]{36}$/i;
export function localBrowserEndpoint(port,path){
 if(!Number.isInteger(port)||port<1||port>65535||!browserPath.test(path))return null;
 return 'ws://127.0.0.1:'+port+path;
}
export function parseDevToolsActivePort(text){
 const lines=String(text).trim().split(/\r?\n/);
 if(lines.length!==2||!/^\d{1,5}$/.test(lines[0]))return null;
 return localBrowserEndpoint(Number(lines[0]),lines[1]);
}
export function parseDevToolsStderr(text){
 const matches=[...String(text).matchAll(/DevTools listening on (ws:\/\/127\.0\.0\.1:(\d{1,5})(\/devtools\/browser\/[a-f0-9-]{36}))(?=\s|$)/gi)];
 const m=matches.at(-1);
 return m?localBrowserEndpoint(Number(m[2]),m[3]):null;
}
// Keep bounded diagnostics; no raw profile paths, command args, URLs or logs.
export function startupDiagnostic(text){
 const s=String(text);
 const flags=['DevTools listening','ERROR','FATAL','Permission denied','Address already in use',
  'No usable sandbox','Failed to create','SingletonLock','zygote','crashpad','DBus'];
 return flags.filter(x=>s.toLowerCase().includes(x.toLowerCase())).join(',')||'none';
}
// One bounded HTTP observation. A received identity mismatch is not a timeout;
// a response that never completes must never be classified as an identity match.
// This legacy diagnostic is not a fallback for the private CDP pipe.
export async function probeBrowserEndpoint(endpoint,{signal=AbortSignal.timeout(500),fetcher=fetch}={}){
 const m=/^ws:\/\/127\.0\.0\.1:(\d{1,5})(\/devtools\/browser\/[a-f0-9-]{36})$/i.exec(endpoint);
 if(!m||localBrowserEndpoint(Number(m[1]),m[2])!==endpoint)return 'ENDPOINT_INVALID';
 if(signal.aborted)return 'PROBE_DEADLINE';
 try{
  const response=await fetcher('http://127.0.0.1:'+m[1]+'/json/version',{redirect:'error',signal});
  if(signal.aborted)return 'PROBE_DEADLINE';
  if(response.status>=300&&response.status<400)return 'HTTP_REDIRECT';
  if(!response.ok)return 'HTTP_STATUS_'+String(response.status||0);
  let info;
  try{info=await response.json()}
  catch(e){return signal.aborted||e?.name==='AbortError'||e?.name==='TimeoutError'?'PROBE_DEADLINE':
    e instanceof SyntaxError?'JSON_INVALID':probeFailure(e)}
  if(signal.aborted)return 'PROBE_DEADLINE';
  return info?.webSocketDebuggerUrl===endpoint?'MATCH':'ENDPOINT_IDENTITY_MISMATCH';
 }catch(e){return signal.aborted?'PROBE_DEADLINE':probeFailure(e)}
}
export async function waitForBrowserEndpoint({workspace,child,getStderr,getSpawnError,
 timeoutMs=15000,fetcher=fetch}){
 const end=performance.now()+timeoutMs;
 let last='no local DevTools endpoint';
 let candidate='none';
 const fail=reason=>Error('CHROME_CDP_STARTUP_'+reason+
  ' exit='+String(child.exitCode)+' signal='+String(child.signalCode)+
  ' candidate='+candidate+' stderrMarkers='+startupDiagnostic(getStderr()));
 while(performance.now()<end){
  if(getSpawnError())throw fail('SPAWN_ERROR');
  if(child.exitCode!==null||child.signalCode!==null)throw fail('EARLY_EXIT');
  let file=null;
  try{file=parseDevToolsActivePort(await readFile(join(workspace,'DevToolsActivePort'),'utf8'))}
  catch(e){if(e?.code!=='ENOENT')last='port file unavailable'}
  const endpoint=file||parseDevToolsStderr(getStderr());
  candidate=file?'active-port-file':endpoint?'stderr':'none';
  if(endpoint){
   const remaining=end-performance.now();
   if(remaining<=0){last='PROBE_DEADLINE';break}
   const signal=AbortSignal.timeout(Math.max(1,Math.min(500,Math.floor(remaining))));
   last=await probeBrowserEndpoint(endpoint,{signal,fetcher});
   if(getSpawnError()||child.exitCode!==null||child.signalCode!==null)throw fail('EARLY_EXIT');
   if(last==='MATCH'){
    if(performance.now()>=end){last='PROBE_DEADLINE';break}
    return {endpoint,discovery:candidate};
   }
  }
  await sleep(Math.min(100,Math.max(0,end-performance.now())));
 }
 throw fail('TIMEOUT '+last);
}

function probeFailure(error){
 // Only fixed categories; never include remote URLs, raw response or secrets.
 const cause=error?.cause?.code||error?.code;
 if(error?.name==='TimeoutError'||error?.name==='AbortError')return 'PROBE_DEADLINE';
 if(cause==='ECONNREFUSED')return 'TCP_REFUSED';
 if(cause==='ECONNRESET'||cause==='EPIPE')return 'TCP_RESET';
 if(cause==='ETIMEDOUT'||cause==='UND_ERR_CONNECT_TIMEOUT')return 'TCP_DEADLINE';
 if(cause==='UND_ERR_SOCKET')return 'TCP_SOCKET';
 if(error?.cause?.message==='unexpected redirect')return 'HTTP_REDIRECT';
 return 'HTTP_OR_TRANSPORT_ERROR';
}

// Chromium's inherited fd3/fd4 NUL-framed CDP protocol. This is a private
// channel to the child WE spawned, not a localhost port or caller endpoint.
// No fallback to a network debugger; any protocol/process failure is fatal.
export function createChromePipeTransport(child,{getStderr=()=>'',onEvent=()=>{}}={}){
 const input=child.stdio?.[3],output=child.stdio?.[4];
 if(!input?.writable||!output?.readable)throw Error('CHROME_CDP_PIPE_MISSING_FDS');
 const pending=new Map();let serial=0,closed=false,buffer=Buffer.alloc(0);
 const limit=8*1024*1024;
 const failure=kind=>Error('CHROME_CDP_PIPE_'+kind+
  ' exit='+String(child.exitCode)+' signal='+String(child.signalCode)+
  ' stderrMarkers='+startupDiagnostic(getStderr()));
 function stop(kind){
  if(closed)return;closed=true;buffer=Buffer.alloc(0);
  for(const p of pending.values()){clearTimeout(p.timer);p.reject(failure(kind))}
  pending.clear();
  input.destroy();output.destroy();
 }
 child.on('error',()=>stop('SPAWN_ERROR'));
 child.on('exit',()=>stop('EARLY_EXIT'));
 input.on('error',()=>stop('WRITE_ERROR'));
 output.on('error',()=>stop('READ_ERROR'));
 output.on('end',()=>stop('EOF'));
 output.on('close',()=>stop('CLOSED'));
 output.on('data',chunk=>{
  if(closed)return;
  // A single message may span many chunks, and chunks may contain many
  // messages. Bound each unfinished frame; no unbounded raw log retention.
  let offset=0;
  while(offset<chunk.length&&!closed){
   const nul=chunk.indexOf(0,offset),end=nul<0?chunk.length:nul;
   if(buffer.length+end-offset>limit){stop('FRAME_LIMIT');return}
   buffer=Buffer.concat([buffer,chunk.subarray(offset,end)]);
   if(nul<0)return;
   let message;
   try{message=JSON.parse(buffer.toString('utf8'))}
   catch{stop('INVALID_FRAME');return}
   buffer=Buffer.alloc(0);offset=end+1;
   if(!message||typeof message!=='object'||Array.isArray(message)){stop('INVALID_MESSAGE');return}
   if(Number.isSafeInteger(message.id)){
    const p=pending.get(message.id);
    if(!p){stop('UNEXPECTED_RESPONSE');return}
    pending.delete(message.id);clearTimeout(p.timer);
    if((message.sessionId||null)!==p.session){p.reject(failure('SESSION_MISMATCH'));stop('SESSION_MISMATCH');return}
    if(message.error)p.reject(Error('CHROME_CDP_COMMAND_ERROR '+p.method+' code='+String(message.error.code)));
    else if(message.result&&typeof message.result==='object')p.resolve(message.result);
    else{p.reject(failure('INVALID_RESPONSE'));stop('INVALID_RESPONSE');return}
   }else if(typeof message.method==='string'){
    try{onEvent(message)}catch{stop('EVENT_HANDLER_ERROR')}
   }else{stop('INVALID_MESSAGE');return}
  }
 });
 function send(method,params={},session=null,timeoutMs=15000){
  if(closed||child.exitCode!==null||child.signalCode!==null)
   return Promise.reject(failure('NOT_LIVE'));
  const id=++serial;
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>stop('COMMAND_DEADLINE_'+method),timeoutMs);
   pending.set(id,{resolve,reject,timer,session,method});
   try{input.write(JSON.stringify({id,method,params,...(session?{sessionId:session}:{})})+'\0',
    error=>{if(error)stop('WRITE_ERROR')})}
   catch{stop('WRITE_ERROR')}
  });
 }
 async function verifyBrowser(timeoutMs=15000){
  const v=await send('Browser.getVersion',{},null,timeoutMs);
  if(typeof v.product!=='string'||!/^(?:HeadlessChrome|Chrome|Chromium)\//.test(v.product)||
   typeof v.protocolVersion!=='string'||!/^\d+\.\d+$/.test(v.protocolVersion)){
   stop('BROWSER_IDENTITY');throw failure('BROWSER_IDENTITY');
  }
  return v;
 }
 return {send,verifyBrowser,close:()=>stop('CLEANUP')};
}

// Only a pre-UI Browser.getVersion deadline may get ONE fresh attempt.
// The transport never retries any command; protocol/identity/exit failures
// remain terminal. No target, session, navigation or user action is replayed.
export async function startVerifiedChrome({chrome,onEvent=()=>{},log=()=>{},
 spawnChild=spawn,startupTimeoutMs=15000}={}){
 for(let attempt=1;attempt<=2;attempt++){
  const started=performance.now();
  const workspace=await mkdtemp(join(tmpdir(),'wand-tour-chrome-'));
  let child=null,transport=null,stderr='',cleanup=null;
  const live=()=>child&&child.pid&&child.exitCode===null&&child.signalCode===null;
  const dispose=()=>cleanup??=(async()=>{
   transport?.close();
   if(live()){
    await new Promise((resolve,reject)=>{
     const timer=setTimeout(()=>{done();reject(Error('CHROME_CDP_COLDSTART_CLEANUP_DEADLINE'))},3000);
     const done=()=>{clearTimeout(timer);child.removeListener('exit',exited);child.removeListener('close',exited)};
     const exited=()=>{done();resolve()};
     child.once('exit',exited);child.once('close',exited);
     if(!live()){exited();return}
     try{child.kill('SIGKILL')}catch{done();reject(Error('CHROME_CDP_COLDSTART_CLEANUP_KILL'))}
    });
   }
   await rm(workspace,{recursive:true,force:true,maxRetries:12,retryDelay:125});
  })();
  try{
   child=spawnChild(chrome,['--headless=new','--disable-gpu','--no-sandbox',
    '--disable-dev-shm-usage','--remote-debugging-pipe','--no-first-run',
    '--no-default-browser-check','--user-data-dir='+workspace,'about:blank'],
    {stdio:['ignore','pipe','pipe','pipe','pipe']});
   child.stdout?.resume();child.stderr?.on('data',b=>stderr=(stderr+String(b)).slice(-8192));
   // Install error/exit handlers synchronously before the first write.
   transport=createChromePipeTransport(child,{getStderr:()=>stderr,onEvent});
   log('WEB_TOUR_CDP_COLDSTART_BEGIN attempt='+attempt);
   await transport.verifyBrowser(startupTimeoutMs);
   if(!live())throw Error('CHROME_CDP_COLDSTART_CHILD_NOT_LIVE');
   log('WEB_TOUR_CDP_COLDSTART_VERIFIED attempt='+attempt+' elapsedMs='+Math.round(performance.now()-started));
   return {child,transport,workspace,attempt,dispose};
  }catch(error){
   const retry=attempt===1&&String(error?.message).startsWith('CHROME_CDP_PIPE_COMMAND_DEADLINE_Browser.getVersion ');
   log('WEB_TOUR_CDP_COLDSTART_FAILED attempt='+attempt+' elapsedMs='+Math.round(performance.now()-started)+
    ' retry='+retry+' kind='+(retry?'VERSION_DEADLINE':'TERMINAL')+' stderrMarkers='+startupDiagnostic(stderr));
   await dispose();
   if(!retry)throw error;
   log('WEB_TOUR_CDP_COLDSTART_FRESH_RETRY');
  }
 }
 throw Error('CHROME_CDP_COLDSTART_EXHAUSTED');
}
