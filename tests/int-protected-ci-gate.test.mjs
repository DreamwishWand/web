import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectProtectedCi,revalidateProtectedCi,githubPublicJson,createPublicJsonGetter} from '../scripts/int-protected-ci-gate.mjs';
const head='a'.repeat(40),other='b'.repeat(40),root='/repos/DreamwishWand/web';
const input={repository:'DreamwishWand/web',head,workflowBlob:'4dbc0572b70a9a8245695fed5e4a6369ee2f529a'};
const repo={id:1371485649,full_name:'DreamwishWand/web',default_branch:'main',private:false};
const ref={ref:'refs/heads/main',object:{type:'commit',sha:head}};
const run={id:123,workflow_id:370723530,path:'.github/workflows/ci.yml',head_sha:head,head_branch:'main',event:'push',run_attempt:1,status:'completed',conclusion:'success',repository:{id:1371485649},head_repository:{id:1371485649}};
const job={id:456,name:'verify',run_id:123,run_attempt:1,head_sha:head,status:'completed',conclusion:'success'};
function mock(options={}){
 const calls=[];let refs=0,runs=0;
 const get=async p=>{
  calls.push(p);
  if(p===root)return options.repo??repo;
  if(p===root+'/git/ref/heads/main'){refs++;return refs>1&&options.staleAfter?{...ref,object:{...ref.object,sha:other}}:options.ref??ref;}
  if(p.startsWith(root+'/actions/runs?'))return options.list??{total_count:1,workflow_runs:[run]};
  if(p===root+'/actions/runs/123'){runs++;return runs>1&&options.rerun?{...run,run_attempt:2}:options.run??run;}
  if(p===root+'/actions/runs/123/attempts/1/jobs?per_page=100')return options.jobs??{total_count:1,jobs:[job]};
  throw Error('UNEXPECTED_REQUEST:'+p);
 };
 return {get,calls};
}
test('protected main CI exact successful predecessor and latest ref readback',async()=>{
 const m=mock(),result=await inspectProtectedCi(input,m.get);
 assert.deepEqual(result,{status:'PROTECTED_CI_PREDECESSOR_MATCH',repositoryId:1371485649,workflowId:370723530,workflowPath:'.github/workflows/ci.yml',workflowBlob:input.workflowBlob,head,runId:123,attempt:1,jobId:456,mergeAuthorized:false,writerAuthorized:false});
 assert.equal(m.calls.filter(p=>p.endsWith('/git/ref/heads/main')).length,2);
 assert.equal(m.calls.filter(p=>p.endsWith('/actions/runs/123')).length,2);
});
test('deny wrong repository/workflow, stale main, failed or changed CI, incomplete jobs',async()=>{
 for(const [options,re] of [
  [{repo:{...repo,id:1}},/REPOSITORY_IDENTITY_DENIED/],
  [{ref:{...ref,object:{...ref.object,sha:other}}},/PROTECTED_MAIN_STALE/],
  [{staleAfter:true},/PROTECTED_MAIN_STALE/],
  [{list:{total_count:2,workflow_runs:[run]}},/CI_RUN_LIST_INCOMPLETE/],
  [{list:{total_count:2,workflow_runs:[run,run]}},/CI_RUN_AMBIGUOUS/],
  [{run:{...run,head_sha:other}},/CI_RUN_IDENTITY_MISMATCH/],
  [{run:{...run,conclusion:'failure'}},/PROTECTED_CI_NOT_SUCCESS/],
  [{run:{...run,event:'pull_request'}},/CI_RUN_IDENTITY_MISMATCH/],
  [{rerun:true},/RUN_IDENTITY_MISMATCH/],
  [{jobs:{total_count:1,jobs:[{...job,conclusion:'skipped'}]}},/JOB_NOT_SUCCESS/],
  [{jobs:{total_count:0,jobs:[]}},/JOB_SET_INCOMPLETE/]
 ]) await assert.rejects(inspectProtectedCi(input,mock(options).get),re);
 await assert.rejects(inspectProtectedCi({...input,workflowBlob:other},mock().get),/WORKFLOW_DENIED/);
 await assert.rejects(inspectProtectedCi({...input,repository:'other/repo'},mock().get),/WORKFLOW_DENIED/);
 for(const o of [{list:{total_count:0,workflow_runs:[]}},{run:{...run,status:'in_progress',conclusion:null}}])
  assert.equal((await inspectProtectedCi(input,mock(o).get)).status,'WAIT_PROTECTED_CI');
});
test('public transport rejects redirects and errors; no credentials or writes',async()=>{
 const p=root+'/git/ref/heads/main';
 const out=await githubPublicJson(p,async(url,options)=>{
  assert.equal(url.origin,'https://api.github.com');assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
  assert.equal(Object.keys(options.headers).some(k=>k.toLowerCase()==='authorization'),false);
  return new Response(JSON.stringify(ref),{headers:{'content-type':'application/json'}});
 });
 assert.deepEqual(out,ref);
 await assert.rejects(githubPublicJson(p,async()=>new Response('{}',{status:429,headers:{'content-type':'application/json'}})),/GITHUB_API_DENIED/);
 await assert.rejects(githubPublicJson('/repos/DreamwishWand/../bad'),/UNSAFE_API_PATH/);
});
test('existing signed Pages preserves order, permissions and push context',()=>{
 const y=readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
 const order=['actions/attest-build-provenance@v2','gh attestation verify static/worker-wasm/manifest.json','node scripts/int-protected-ci-gate.mjs','actions/upload-pages-artifact@v3','Refuse stale main or CI receipt immediately before Pages deployment','actions/deploy-pages@v4','Verify actual same-origin HTTPS bytes'];
 let i=-1;for(const marker of order){const n=y.indexOf(marker);assert.ok(n>i,marker);i=n;}
 assert.match(y,/on:\s+push:\s+branches: \[main\]\s+workflow_dispatch:/);
 assert.doesNotMatch(y,/workflow_run:/);
 assert.match(y,/permissions:\s+pages: write\s+id-token: write/);
 assert.match(y,/concurrency:\s+group: github-pages\s+cancel-in-progress: false/);
});

test('deploy receipt requires same latest successful CI attempt and exact job',async()=>{
 const receipt=await inspectProtectedCi(input,mock().get);
 assert.deepEqual(await revalidateProtectedCi(input,receipt,mock().get),receipt);
 await assert.rejects(revalidateProtectedCi(input,receipt,mock({run:{...run,run_attempt:2,status:'in_progress',conclusion:null}}).get),/CI_RECEIPT_NO_LONGER_SUCCESS/);
 await assert.rejects(revalidateProtectedCi(input,receipt,mock({run:{...run,conclusion:'failure'}}).get),/PROTECTED_CI_NOT_SUCCESS/);
 const changed=async p=>{
  if(p===root+'/actions/runs/123')return {...run,run_attempt:2};
  if(p===root+'/actions/runs/123/attempts/2/jobs?per_page=100')return {total_count:1,jobs:[{...job,id:789,run_attempt:2}]};
  return mock().get(p);
 };
 await assert.rejects(revalidateProtectedCi(input,receipt,changed),/CI_RECEIPT_CHANGED/);
 for(const bad of [{...receipt,jobId:999},{...receipt,workflowBlob:other},{...receipt,extra:true}])
  await assert.rejects(revalidateProtectedCi(input,bad,mock().get),/CI_RECEIPT_CHANGED/);
 await assert.rejects(githubPublicJson(root+'/git/ref/heads/main',async()=>new Response(JSON.stringify(ref),{status:302,headers:{'content-type':'application/json',location:'https://api.github.com/other'}})),/GITHUB_API_DENIED:302/);
 await assert.rejects(githubPublicJson(root+'/git/ref/heads/main',async()=>new Response(JSON.stringify(ref),{status:201,headers:{'content-type':'application/json'}})),/GITHUB_API_DENIED:201/);
});
test('deploy consumes build receipt and reuses strict gate before deployment',()=>{
 const y=readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
 assert.match(y,/ci_receipt: \$\{\{ steps\.protected_ci\.outputs\.ci_receipt \}\}/);
 assert.match(y,/WAND_CI_RECEIPT: \$\{\{ needs\.build\.outputs\.ci_receipt \}\}/);
 assert.ok(y.indexOf('node scripts/int-protected-ci-gate.mjs deploy')<y.indexOf('actions/deploy-pages@v4'));
 assert.doesNotMatch(y,/curl[^\n]*git\/ref\/heads\/main/);
});

test('403 diagnostics are bounded, numeric only and never authorize an ordinary denial',async()=>{
 const p=root+'/git/ref/heads/main';
 let calls=0;const delays=[];
 const limited=()=>new Response('untrusted body',{status:403,headers:{'retry-after':'2','x-ratelimit-remaining':'0','x-ratelimit-reset':'1234567890'}});
 const success=()=>new Response(JSON.stringify(ref),{headers:{'content-type':'application/json'}});
 const got=await githubPublicJson(p,async(url,o)=>{
   assert.equal(url.href,'https://api.github.com'+p);assert.equal(o.method,'GET');assert.equal(o.redirect,'error');
   assert.equal(Object.keys(o.headers).some(k=>k.toLowerCase()==='authorization'),false);
   return ++calls===1?limited():success();
 },async ms=>delays.push(ms));
 assert.deepEqual(got,ref);assert.equal(calls,2);assert.deepEqual(delays,[2000]);
 for(const headers of [{},{'retry-after':'2'},{'retry-after':'6','x-ratelimit-remaining':'0'},
   {'retry-after':'2','x-ratelimit-remaining':'1'},{'retry-after':'invalid','x-ratelimit-remaining':'0'}]){
   calls=0;await assert.rejects(githubPublicJson(p,async()=>{calls++;return new Response('SECRET_BODY',{status:403,headers});},async()=>assert.fail('unexpected retry')),e=>{
     assert.match(e.message,/GITHUB_API_DENIED:403:endpoint=main-ref/);assert.doesNotMatch(e.message,/SECRET_BODY|invalid/);return true;
   });assert.equal(calls,1);
 }
 calls=0;await assert.rejects(githubPublicJson(p,async()=>{calls++;return limited();},async()=>{}),/GITHUB_API_DENIED:403:endpoint=main-ref/);assert.equal(calls,2);
 calls=0;await assert.rejects(githubPublicJson(p,async()=>++calls===1?limited():new Response('{}',{status:302}),async()=>{}),/GITHUB_API_DENIED:302/);
 calls=0;await assert.rejects(githubPublicJson(p,async()=>++calls===1?limited():new Response('bad',{headers:{'content-type':'text/html'}}),async()=>{}),/GITHUB_API_DENIED:200/);
});

test('reset-only recovery: exact public GET, bounded delay, one reset per phase',async()=>{
 const p=root+'/git/ref/heads/main',now=1794807418000,reset='1794807555';
 const limited=(headers={})=>new Response('untrusted',{status:403,headers:{'x-ratelimit-remaining':'0','x-ratelimit-reset':reset,...headers}});
 const ok=()=>new Response(JSON.stringify(ref),{headers:{'content-type':'application/json'}});
 let calls=0;const delays=[];
 const get=createPublicJsonGetter(async(url,o)=>{
   assert.equal(url.href,'https://api.github.com'+p);assert.equal(o.method,'GET');assert.equal(o.redirect,'error');
   assert.equal(Object.keys(o.headers).some(k=>k.toLowerCase()==='authorization'),false);
   return ++calls===2?ok():limited();
 },async ms=>delays.push(ms),()=>now);
 assert.deepEqual(await get(p),ref);assert.deepEqual(delays,[138000]);assert.equal(calls,2);
 await assert.rejects(get(p),/GITHUB_API_DENIED:403/);assert.equal(calls,3);assert.deepEqual(delays,[138000]);
 for(const headers of [
   {'x-ratelimit-reset':'1794807418'}, {'x-ratelimit-reset':'1794807417'},
   {'x-ratelimit-reset':'1794808004'}, {'x-ratelimit-reset':'bad'},
   {'x-ratelimit-remaining':'1'}, {'retry-after':'invalid'}, {'retry-after':'6'},
   {'retry-after':'0'}, {'retry-after':''}
 ]){
   let n=0;const g=createPublicJsonGetter(async()=>{n++;return limited(headers);},async()=>assert.fail('unexpected retry'),()=>now);
   await assert.rejects(g(p),/GITHUB_API_DENIED:403/);assert.equal(n,1);
 }
 for(const path of ['/repos/DreamwishWand/web-extra/actions/runs/123','/repos/DreamwishWand/web/actions/runs?unexpected=1']){
   let requests=0;
   const g=createPublicJsonGetter(async()=>{requests++;return limited();},async()=>assert.fail('unexpected retry'),()=>now);
   await assert.rejects(g(path),/UNSAFE_API_CATEGORY/);
   assert.equal(requests,0,'non-allowlisted endpoint must be rejected before fetch');
 }
 for(const [seconds,expected] of [[179,180000],[180,0]]){
   let n=0;const sleeps=[];
   const g=createPublicJsonGetter(async()=>++n===1?limited({'x-ratelimit-reset':String(now/1000+seconds)}):ok(),async ms=>sleeps.push(ms),()=>now);
   if(expected){assert.deepEqual(await g(p),ref);assert.deepEqual(sleeps,[expected]);}
   else{await assert.rejects(g(p),/GITHUB_API_DENIED:403/);assert.deepEqual(sleeps,[]);}
 }
 let n=0;const g=createPublicJsonGetter(async()=>{n++;return limited();},async()=>{},()=>now);
 await assert.rejects(g(p),/GITHUB_API_DENIED:403/);assert.equal(n,2);
});
test('phase budget includes short retry and reset; fresh phase independent',async()=>{
 const p=root+'/git/ref/heads/main',now=1794807418000,delays=[];let n=0;
 const limited=h=>new Response('untrusted',{status:403,headers:{'x-ratelimit-remaining':'0',...h}});
 const ok=()=>new Response(JSON.stringify(ref),{headers:{'content-type':'application/json'}});
 const get=createPublicJsonGetter(async()=>++n===1?limited({'retry-after':'2'}):n===2?ok():limited({'x-ratelimit-reset':String(now/1000+178)}),async ms=>delays.push(ms),()=>now);
 assert.deepEqual(await get(p),ref);await assert.rejects(get(p),/GITHUB_API_DENIED:403/);
 assert.equal(n,3);assert.deepEqual(delays,[2000]);
 const fresh=createPublicJsonGetter(async()=>++n===4?limited({'x-ratelimit-reset':String(now/1000+178)}):ok(),async ms=>delays.push(ms),()=>now);
 assert.deepEqual(await fresh(p),ref);assert.deepEqual(delays,[2000,179000]);
});
test('reset recovery cannot grant stale main or changed deploy receipt',async()=>{
 const receipt=await inspectProtectedCi(input,mock().get),now=1794807418000;
 for(const options of [{staleAfter:true},{rerun:true}]){
   const m=mock(options);let first=true;
   const get=createPublicJsonGetter(async url=>{
     if(first){first=false;return new Response('limited',{status:403,headers:{'x-ratelimit-remaining':'0','x-ratelimit-reset':'1794807555'}});}
     return new Response(JSON.stringify(await m.get(url.pathname+url.search)),{headers:{'content-type':'application/json'}});
   },async()=>{},()=>now);
   await assert.rejects(revalidateProtectedCi(input,receipt,get),/PROTECTED_MAIN_STALE|RUN_IDENTITY_MISMATCH/);
 }
});


test('scoped authenticated GitHub transport is exact GET-only and does not leak token',async()=>{
 const token='ghs_'+'A'.repeat(40),p=root+'/git/ref/heads/main';
 const result=await githubPublicJson(p,async(url,o)=>{
   assert.equal(url.href,'https://api.github.com'+p);
   assert.equal(o.method,'GET');assert.equal(o.redirect,'error');
   assert.equal(o.headers.Authorization,'Bearer '+token);
   return new Response(JSON.stringify(ref),{headers:{'content-type':'application/json'}});
 },undefined,undefined,undefined,token);
 assert.deepEqual(result,ref);
 for(const invalid of ['','abc','ghs_BAD_DOLLAR','ghs_bad\nAuthorization:evil']){
   await assert.rejects(githubPublicJson(p,async()=>assert.fail('invalid token must not fetch'),
     undefined,undefined,undefined,invalid),/PROTECTED_CI_READ_TOKEN_DENIED/);
 }
 await assert.rejects(githubPublicJson('/repos/DreamwishWand/../bad',
   async()=>assert.fail('invalid path must not fetch'),undefined,undefined,undefined,token),/UNSAFE_API_PATH/);
 const expired=await githubPublicJson(p,async(_url,o)=>{
   assert.equal(o.headers.Authorization,'Bearer '+token);
   return new Response('SECRET_DO_NOT_LOG',{status:403,headers:{'x-ratelimit-remaining':'0'}});
 },async()=>assert.fail('no retry'),undefined,undefined,token).then(()=>null,e=>e);
 assert.match(expired.message,/GITHUB_API_DENIED:403:endpoint=main-ref/);
 assert.doesNotMatch(expired.message,/SECRET_DO_NOT_LOG|ghs_/);
});

test('every protected Pages Gate invocation has scoped read token and read permission',()=>{
 const y=readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
 const gateSteps=y.split(/\n(?=      - name: )/).filter(s=>s.includes('node scripts/int-protected-ci-gate.mjs'));
 assert.ok(gateSteps.length>=12);
 for(const step of gateSteps)assert.match(step,/^          WAND_GATE_READ_TOKEN: \$\{\{ github\.token \}\}$/m);
 assert.match(y,/permissions:\n  contents: read\n  actions: read\n/);
 assert.match(y,/  deploy:\n[\s\S]*?    permissions:\n      pages: write\n      id-token: write\n      actions: read\n/);
});


test('authenticated protected GET rejects six unlisted or normalized endpoints before bearer fetch',async()=>{
 const token='ghs_'+'Z'.repeat(40);
 const unexpected=[
  '/repos/DreamwishWand/web/issues/1',
  '/repos/DreamwishWand/web/actions/workflows?per_page=100',
  '/repos/DreamwishWand/web/actions/runs/123?secret=1',
  '/repos/DreamwishWand/web/actions/runs?branch=main&event=push&head_sha='+input.head+'&per_page=101',
  '/repos/DreamwishWand/other-repository',
  '/repos/DreamwishWand/web/%2e%2e/other-repository'
 ];
 let requests=0;
 for(const p of unexpected){
  await assert.rejects(githubPublicJson(p,async(_url,opts)=>{
   requests++;
   assert.equal(opts.method,'GET');
   assert.equal(opts.headers.Authorization,'Bearer '+token);
   return new Response('{}',{headers:{'content-type':'application/json'}});
  },undefined,undefined,undefined,token),/UNSAFE_API_(?:CATEGORY|PATH)/);
 }
 assert.equal(requests,0,'unlisted endpoint must be rejected before any bearer request');
});
