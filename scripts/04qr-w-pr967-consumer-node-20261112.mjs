import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
const source='30d5da61aa45dbba52b3f280bc1344787c3cdd9a',base='3776c886dd57a0e1c998c839ef3c43a1c933914c';
const worker='src/lib/wep/steam-saved-diffgrids.consumer.worker.ts';
const text=readFileSync(worker,'utf8');
const body=text.replace(/import\s+[^;]+;/g,'');
const receipt=()=>({contract:'wand.r22.protected-readonly-loader-receipt@1',releaseId:'a'.repeat(64),sourceHead:'b'.repeat(40),attestationVerifiedAtBuild:true,runtimeSignatureVerified:false,checkedBothJsAndWasm:true,sameOriginFetchOnly:true,qaCandidate:false,productConsumerEnabled:false,writerAuthorized:false,nativeV3Verified:false,applyAuthorized:false,WorkerWasmSource:class{}});
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const src={
 'src/lib/wep/steam-saved-diffgrids.consumer.worker.ts':'8b013ee2fb5d6781eef33bb96d9f67b3a04ce4c3',
 '.github/workflows/08web-steam-saved-diffgrids-real-chrome.yml':'5ed97de163b660633b86f57e4a684d2f419422b5',
 'tests/web-steam-saved-diffgrids-real-chrome.mjs':'1783398322963f72852c20f5ec96bff4c04065e7'};
const run=async({enabled=true,result=receipt(),reject=false,install=true}={})=>{
 const messages=[],calls=[],installations=[];
 let finish;
 const done=new Promise(r=>finish=r);
 const ctx={self:{postMessage:m=>{messages.push(m);finish()}},loadProtectedReadonlyRustWasm:async(...a)=>{calls.push(a);if(reject)throw Error('private');return result;},validateOwnerLocalSteamAttestation:()=>{},installLocalSteamP1gSavedDiffGridsWorker:o=>{installations.push(o);return install?{}:null}};
 vm.runInNewContext(enabled?body.replace('const PRODUCT_READONLY_CONSUMER_OWNER_ENABLED=false;','const PRODUCT_READONLY_CONSUMER_OWNER_ENABLED=true;'):body,ctx);
 await done;
 return{messages,calls,installations};
};
const unavailable=async options=>{const r=await run(options);assert.equal(JSON.stringify(r.messages),JSON.stringify([{kind:'DIFFGRIDS_RUNTIME_READY',ready:false,writerAuthorized:false}]));assert.equal(r.installations.length,0);return r;};
test('fixed Source original3, unchanged accepted Loader/facade and product flag OFF',()=>{
 assert.equal(git('merge-base',source,'HEAD'),source);
 assert.deepEqual(git('diff','--name-status',base,source).split('\n').sort(),Object.keys(src).map(p=>'M\t'+p).sort());
 for(const [p,h] of Object.entries(src)){assert.equal(git('rev-parse',source+':'+p),h);assert.equal(git('rev-parse','HEAD:'+p),h);}
 const qa=git('diff','--name-status',source,'HEAD').split('\n').sort();
 assert.deepEqual(qa,['A\t.github/workflows/04qr-w-pr967-consumer-20261112.yml','A\tscripts/04qr-w-pr967-consumer-chrome-20261112.mjs','A\tscripts/04qr-w-pr967-consumer-node-20261112.mjs'].sort());
 assert.match(text,/const PRODUCT_READONLY_CONSUMER_OWNER_ENABLED=false;/);
 assert.match(text,/await loadProtectedReadonlyRustWasm\(\)/);
 assert.doesNotMatch(text,/loadSourcePinnedRustWasmCandidate|trustedPins|qaCandidate:true/);
});
test('committed OFF never invokes loader or installs facade',async()=>{const r=await unavailable({enabled:false});assert.equal(r.calls.length,0);});
test('enabled test-only exact receipt invokes no-arg loader and single facade, no extra authority',async()=>{
 const v=receipt(),r=await run({result:v});assert.equal(r.calls.length,1);assert.equal(r.calls[0].length,0);assert.equal(r.installations.length,1);
 const o=r.installations[0];assert.equal(o.allowSyntheticFixture,false);
 const mod=await o.wasmFactory();assert.deepEqual(Object.keys(mod),['WorkerWasmSource']);assert.equal(mod.WorkerWasmSource,v.WorkerWasmSource);
 assert.equal(JSON.stringify(r.messages),JSON.stringify([{kind:'DIFFGRIDS_RUNTIME_READY',ready:true,writerAuthorized:false}]));
});
test('each receipt field wrong/missing denies before facade; loader rejection generic',async()=>{
 await unavailable({result:null});await unavailable({reject:true});
 for(const k of Object.keys(receipt())){const r=receipt();delete r[k];await unavailable({result:r});}
 for(const [k,v] of Object.entries({contract:'old-qa',releaseId:'f'.repeat(63),sourceHead:'f'.repeat(41),attestationVerifiedAtBuild:false,runtimeSignatureVerified:true,checkedBothJsAndWasm:false,sameOriginFetchOnly:false,qaCandidate:true,productConsumerEnabled:true,writerAuthorized:true,nativeV3Verified:true,applyAuthorized:true,WorkerWasmSource:{}}))await unavailable({result:{...receipt(),[k]:v}});
 const r=await run({install:false});assert.equal(r.messages[0].ready,false);assert.equal(r.installations.length,1);
});
