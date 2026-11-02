/**
 * Actual local Chromium / actual tab-local Web Storage + native StorageEvent.
 *
 * Source under test is the exact checked-out src/lib/community/staging-http-client.ts,
 * compiled to browser ESM with TypeScript. Browser/Storage/Event Loop: REAL.
 * Authentication HTTP responses: SYNTHETIC fake window.fetch. NOT local GoTrue,
 * NOT managed HTTPS, NOT genuine JWT validation, NOT independent QA.
 *
 * Execute on an isolated branch:
 *   npm ci
 *   npm install --no-save --ignore-scripts playwright-core@1.56.1
 *   node tests/community-auth-real-chromium-local.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import http from 'node:http';
import ts from 'typescript';
import { chromium } from 'playwright-core';

const frozenSource = readFileSync(new URL('../src/lib/community/staging-http-client.ts',import.meta.url),'utf8');
assert.match(frozenSource,/function loadSession\(_config: CommunityLabConfig, _scope: string\): CommunitySession \| null/);
const clientJavascript=ts.transpileModule(frozenSource,{
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
}).outputText;
const chromePath = process.env.CHROMIUM_PATH ||
  ['/usr/bin/google-chrome','/usr/bin/chromium','/opt/google/chrome/chrome']
    .find(p=>existsSync(p));
assert.ok(chromePath,'Actual Chromium binary unavailable: do not claim REAL_BROWSER evidence.');

const server=http.createServer((req,res)=>{
  if(req.url?.split('?')[0]==='/client.js'){
    res.writeHead(200,{'content-type':'application/javascript','cache-control':'no-store'});
    res.end(clientJavascript);
  }else{
    res.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});
    res.end('<!doctype html><html><head><meta charset="utf-8"></head><body>Local synthetic Auth / real Chromium test</body></html>');
  }
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;

function initBrowserHarness(){
  // Keep this script isolated from the compiled production module.
  const oldSet=Storage.prototype.setItem,oldRemove=Storage.prototype.removeItem;
  const blockedAtLoad=new URL(location.href).searchParams.get('blocked')==='1';
  const harness={
    blockWrites:blockedAtLoad,blockNotice:false, ttl:3600,refreshHold:false,
    queryHold:false,calls:[],refreshCount:0,releaseRefresh:null,releaseQuery:null,
    nativeEvents:[]
  };
  window.__testHarness=harness;
  window.addEventListener('storage',event=>{
    harness.nativeEvents.push({key:event.key,notice:event.key==='dreamwishwand-community-logout-notice-v2'
      ?event.newValue:null});
  });
  Storage.prototype.setItem=function(k,v){
    if(harness.blockWrites||(harness.blockNotice&&String(k).includes('logout-notice')))
      throw new DOMException('Synthetic storage permission denial','SecurityError');
    return oldSet.call(this,k,v);
  };
  Storage.prototype.removeItem=function(k){
    if(harness.blockWrites)throw new DOMException('Synthetic storage permission denial','SecurityError');
    return oldRemove.call(this,k);
  };
  const nativeFetch=window.fetch.bind(window);
  const fake=(status,body)=>new Response(JSON.stringify(body),{
    status,headers:{'content-type':'application/json'}
  });
  window.fetch=async (input,options={})=>{
    const url=new URL(String(input),location.href);
    if(!url.hostname.endsWith('.invalid'))return nativeFetch(input,options);
    const grant=url.searchParams.get('grant_type');
    const body=options.body ? JSON.parse(options.body):{};
    const event={path:url.pathname,grant,account:body.email||null,authorized:Boolean(options.headers?.authorization)};
    harness.calls.push(event); // only metadata, never JWT or refresh token
    if(grant==='password'){
      const user=String(body.email||'A');
      return fake(200,{access_token:'LOCAL_'+user+'_ACCESS',
        refresh_token:'LOCAL_'+user+'_REFRESH',expires_in:harness.ttl,
        user:{id:user,email:user+'@example.invalid'}});
    }
    if(grant==='refresh_token'){
      harness.refreshCount++;
      const account=body.refresh_token?.includes('_B_')?'B':'A';
      const answer=fake(200,{access_token:'LOCAL_'+account+'_ROTATED',
        refresh_token:'LOCAL_'+account+'_ROTATED_REFRESH',expires_in:3600,
        user:{id:account,email:account+'@example.invalid'}});
      if(harness.refreshHold)return new Promise(resolve=>{
        harness.releaseRefresh=()=>{harness.releaseRefresh=null;resolve(answer);};
      });
      return answer;
    }
    if(url.pathname.includes('community-query')){
      const answer=fake(200,{ok:true});
      if(harness.queryHold)return new Promise(resolve=>{
        harness.releaseQuery=()=>{harness.releaseQuery=null;resolve(answer);};
      });
      return answer;
    }
    if(url.pathname.includes('community-command')){
      return fake(401,{error:'unauthorized'});
    }
    if(url.pathname.includes('/auth/v1/logout'))return fake(200,{ok:true});
    return fake(200,{ok:true});
  };
}
const browser=await chromium.launch({
  executablePath:chromePath,headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage']
});
let passed=0;
const names=[];
async function scenario(name,fn){
  const context=await browser.newContext();
  await context.addInitScript(initBrowserHarness);
  try{
    await fn(context);
    passed++;names.push(name);console.log('PASS REAL_CHROMIUM_SYNTHETIC_HTTP '+name);
  }finally{await context.close();}
}
async function open(context,pathname='/'){
  const page=await context.newPage();
  await page.goto(base+pathname);
  await moduleLoad(page);
  return page;
}
async function moduleLoad(page){
  await page.evaluate(async()=>{
    window.Client=(await import('/client.js')).CommunityLabClient;
    window.cfg={supabaseUrl:'https://isolated-auth.invalid',publishableKey:'sb_publishable_local_chromium'};
    window.client=new window.Client(window.cfg);
  });
}
try{
  await scenario('cold new tab and reload require fresh interactive login',async ctx=>{
    const a=await open(ctx);
    await a.evaluate(async()=>await window.client.signInWithPassword('A','synthetic'));
    assert.equal(await a.evaluate(()=>window.client.session?.userId),'A');
    const b=await open(ctx);
    assert.equal(await b.evaluate(()=>window.client.session),null);
    const outbound=await b.evaluate(()=>window.__testHarness.calls.length);
    await assert.equal(await b.evaluate(async()=>{
      try{await window.client.query('read');return 'unexpected';}
      catch(e){return e.message;}
    }), 'Sign in before calling Community APIs.');
    assert.equal(await b.evaluate(()=>window.__testHarness.calls.length),outbound);
    await a.reload();await moduleLoad(a);
    assert.equal(await a.evaluate(()=>window.client.session),null);
    await a.evaluate(async()=>await window.client.signInWithPassword('B','synthetic'));
    assert.equal(await a.evaluate(()=>window.client.session?.userId),'B');
  });

  await scenario('same-tab shared sign-in and single-flight held Refresh',async ctx=>{
    const a=await open(ctx);
    const v=await a.evaluate(async()=>{
      window.peer=new window.Client(window.cfg);
      window.__testHarness.ttl=1;
      await window.client.signInWithPassword('A','synthetic');
      const before=window.peer.session?.userId;
      window.__testHarness.refreshHold=true;
      window.waiting=Promise.all([
        window.client.getValidSignedSession(),
        window.peer.getValidSignedSession()
      ]);
      return before;
    });
    assert.equal(v,'A');
    await a.waitForFunction(()=>window.__testHarness.releaseRefresh!==null);
    assert.equal(await a.evaluate(()=>window.__testHarness.refreshCount),1);
    const result=await a.evaluate(async()=>{
      window.__testHarness.releaseRefresh();
      return (await window.waiting).map(x=>x.userId);
    });
    assert.deepEqual(result,['A','A']);
    assert.equal(await a.evaluate(()=>window.client.session?.accessToken===window.peer.session?.accessToken),true);
  });

  await scenario('native cross-tab tokenless logout notification invalidates signed peer',async ctx=>{
    const a=await open(ctx),b=await open(ctx);
    await a.evaluate(async()=>await window.client.signInWithPassword('A','synthetic'));
    await b.evaluate(async()=>await window.client.signInWithPassword('A','synthetic'));
    assert.equal(await b.evaluate(()=>window.client.session?.userId),'A');
    await a.evaluate(async()=>await window.client.signOut());
    await b.waitForFunction(()=>window.client.session===null);
    const notices=await b.evaluate(()=>window.__testHarness.nativeEvents.filter(e=>e.key==='dreamwishwand-community-logout-notice-v2'));
    assert.ok(notices.length>=1);
    assert.equal(JSON.parse(notices.at(-1).notice).kind,'logout');
    assert.ok(!/ACCESS|REFRESH|sb_publishable_|@example/.test(JSON.stringify(notices)));
    assert.equal(await a.evaluate(()=>window.client.session),null);
  });

  await scenario('denied writes -> recover -> cold A excluded, only interactive B',async ctx=>{
    const a=await open(ctx);
    const state=await a.evaluate(async()=>{
      await window.client.signInWithPassword('A','synthetic');
      const key=Object.keys(sessionStorage).find(k=>k.startsWith('dreamwishwand-community-session-v2:'));
      const prior=sessionStorage.getItem(key);
      window.__testHarness.blockWrites=true;
      await window.client.signOut();
      return {key,oldPresent:sessionStorage.getItem(key)===prior,
        current:window.client.session,logoutEpoch:true};
    });
    assert.equal(state.oldPresent,true);assert.equal(state.current,null);
    await a.goto(base+'/?blocked=1');await moduleLoad(a);
    assert.equal(await a.evaluate(()=>window.client.session),null);
    await a.goto(base+'/?blocked=0');await moduleLoad(a);
    assert.equal(await a.evaluate(()=>window.client.session),null);
    assert.equal(await a.evaluate(key=>sessionStorage.getItem(key)?.includes('LOCAL_A_ACCESS'),state.key),true);
    const count=await a.evaluate(()=>window.__testHarness.calls.length);
    const denied=await a.evaluate(async()=>{
      try{await window.client.query('read');return false;}catch{return true;}
    });
    assert.equal(denied,true);
    assert.equal(await a.evaluate(()=>window.__testHarness.calls.length),count);
    const info=await a.evaluate(async()=>{
      await window.client.signInWithPassword('B','synthetic');
      await window.client.query('read');
      return {actor:window.client.session?.userId,accounts:window.__testHarness.calls.map(x=>x.account).filter(Boolean)};
    });
    assert.equal(info.actor,'B');assert.deepEqual(info.accounts,['B']);
    await a.reload();await moduleLoad(a);
    assert.equal(await a.evaluate(()=>window.client.session),null);
  });

  await scenario('delayed query, Account A->B change and old HTTP result fenced',async ctx=>{
    const a=await open(ctx);
    await a.evaluate(async()=>{
      await window.client.signInWithPassword('A','synthetic');
      window.__testHarness.queryHold=true;
      window.pending=window.client.query('read').then(()=>({ok:true}),
        error=>({ok:false,message:error.message}));
    });
    await a.waitForFunction(()=>window.__testHarness.releaseQuery!==null);
    const evidence=await a.evaluate(async()=>{
      window.__testHarness.queryHold=false;
      await window.client.signInWithPassword('B','synthetic');
      window.__testHarness.releaseQuery();
      const old=await window.pending;
      return {old,actor:window.client.session?.userId};
    });
    assert.equal(evidence.old.ok,false);
    assert.match(evidence.old.message,/SESSION_STALE_OR_LOGGED_OUT/);
    assert.equal(evidence.actor,'B');
  });

  await scenario('different config cannot reuse live A, writer 401 single send',async ctx=>{
    const a=await open(ctx);
    const evidence=await a.evaluate(async()=>{
      await window.client.signInWithPassword('A','synthetic');
      const other=new window.Client({
        supabaseUrl:'https://isolated-auth-other.invalid',
        publishableKey:'sb_publishable_distinct'
      });
      const outsider=other.session;
      let denied=false;
      try{await other.query('read');}catch{denied=true;}
      let caught=false;
      try{await window.client.command('write',{});}catch{caught=true;}
      return {outsider,denied,caught,commands:window.__testHarness.calls.filter(x=>x.path.includes('community-command')).length};
    });
    assert.equal(evidence.outsider,null);
    assert.equal(evidence.denied,true);
    assert.equal(evidence.caught,true);
    assert.equal(evidence.commands,1);
  });

  await scenario('late held Refresh after Logout cannot restore old Account A',async ctx=>{
    const a=await open(ctx);
    await a.evaluate(async()=>{
      window.__testHarness.ttl=1;
      await window.client.signInWithPassword('A','synthetic');
      window.__testHarness.refreshHold=true;
      window.late=window.client.getValidSignedSession().then(
        ()=>({ok:true}),error=>({ok:false,message:error.message}));
    });
    await a.waitForFunction(()=>window.__testHarness.releaseRefresh!==null);
    const evidence=await a.evaluate(async()=>{
      await window.client.signOut();
      window.__testHarness.releaseRefresh();
      const result=await window.late;
      return {result,actor:window.client.session,refreshes:window.__testHarness.refreshCount};
    });
    assert.equal(evidence.result.ok,false);
    assert.match(evidence.result.message,/SESSION_STALE_OR_LOGGED_OUT/);
    assert.equal(evidence.actor,null);
    assert.equal(evidence.refreshes,1);
  });

  await scenario('LOST NOTICE: other live tab remains signed until reload (documented limit)',async ctx=>{
    const a=await open(ctx),b=await open(ctx);
    await a.evaluate(async()=>await window.client.signInWithPassword('A','synthetic'));
    await b.evaluate(async()=>await window.client.signInWithPassword('A','synthetic'));
    await a.evaluate(async()=>{
      window.__testHarness.blockNotice=true;
      await window.client.signOut();
    });
    assert.equal(await a.evaluate(()=>window.client.session),null);
    // Browser LocalStorage Broadcast is best effort, not server revocation.
    // No event was delivered, so a separate already-live tab still has A.
    assert.equal(await b.evaluate(()=>window.client.session?.userId),'A');
    assert.equal(await b.evaluate(()=>window.__testHarness.nativeEvents.filter(x=>
      x.key==='dreamwishwand-community-logout-notice-v2').length),0);
    await b.reload();await moduleLoad(b);
    assert.equal(await b.evaluate(()=>window.client.session),null);
    console.log('LIMITATION LOCAL_STORAGE_NOTICE_WRITE_DENIED remote live tab stays A until reload');
  });

  console.log('RESULT REAL_CHROMIUM_SYNTHETIC_HTTP '+passed+'/'+names.length+' PASS');
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
