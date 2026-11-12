// Real Chrome CDP startup only. Never use remote endpoints or synthetic PASS.
import {readFile} from 'node:fs/promises';
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
export async function waitForBrowserEndpoint({workspace,child,getStderr,getSpawnError,
 timeoutMs=15000,fetcher=fetch}){
 const end=Date.now()+timeoutMs;
 let last='no local DevTools endpoint';
 const fail=reason=>Error('CHROME_CDP_STARTUP_'+reason+
  ' exit='+String(child.exitCode)+' signal='+String(child.signalCode)+
  ' stderrMarkers='+startupDiagnostic(getStderr()));
 while(Date.now()<end){
  if(getSpawnError())throw fail('SPAWN_ERROR');
  if(child.exitCode!==null||child.signalCode!==null)throw fail('EARLY_EXIT');
  let file=null;
  try{file=parseDevToolsActivePort(await readFile(join(workspace,'DevToolsActivePort'),'utf8'))}
  catch(e){if(e?.code!=='ENOENT')last='port file unavailable'}
  const endpoint=file||parseDevToolsStderr(getStderr());
  if(endpoint){
   try{
    const url=new URL(endpoint);
    const response=await fetcher('http://127.0.0.1:'+url.port+'/json/version',{
     redirect:'error',signal:AbortSignal.timeout(Math.max(1,Math.min(500,end-Date.now())))});
    if(response.ok){
     const info=await response.json();
     if(info?.webSocketDebuggerUrl===endpoint){
      if(getSpawnError()||child.exitCode!==null||child.signalCode!==null)throw fail('EARLY_EXIT');
      return {endpoint,discovery:file?'active-port-file':'stderr'};
     }
    }
    last='local browser endpoint mismatch';
   }catch(e){if(String(e?.message).startsWith('CHROME_CDP_STARTUP_'))throw e;last='local browser endpoint not ready'}
  }
  await sleep(Math.min(100,Math.max(0,end-Date.now())));
 }
 throw fail('TIMEOUT '+last);
}
