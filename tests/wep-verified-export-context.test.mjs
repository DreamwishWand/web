import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sameVerifiedExportContext} from '../src/lib/wep/verified-export-context.mjs';
const context=()=>({epoch:4,source:{},bytes:new Uint8Array([1,2]),baseline:{},draft:{},buildConfirmed:true,sourceName:'original.p1g',platform:'switch',buildId:'BID'});
test('verified export result identity is scoped to the actual selected source and draft',()=>{
 const a=context();assert.equal(sameVerifiedExportContext(a,{...a}),true);
 for(const [k,v] of [['epoch',5],['source',{}],['bytes',a.bytes.slice()],['baseline',{}],['draft',{}],['buildConfirmed',false],['sourceName','other.p1g'],['platform','steam'],['buildId','other']])
  assert.equal(sameVerifiedExportContext(a,{...a,[k]:v}),false,k);
 assert.equal(sameVerifiedExportContext(null,a),false);
 for(const key of ['source','bytes','baseline','draft'])assert.equal(sameVerifiedExportContext({...a,[key]:null},{...a,[key]:null}),false,key);
});
test('late review and edited-copy completion cannot publish to a replaced context',async()=>{
 const a=context();let current=a,published=[];let release;
 const pending=new Promise(resolve=>{release=resolve;});
 const finish=(async()=>{const result=await pending;if(sameVerifiedExportContext(a,current))published.push(result);})();
 current={...a,epoch:5,bytes:a.bytes.slice()};release('old-copy');await finish;assert.deepEqual(published,[]);
 const now=current;await Promise.resolve().then(()=>{if(sameVerifiedExportContext(now,current))published.push('current-copy');});assert.deepEqual(published,['current-copy']);
});
test('world route fences review and result publication, errors, and download against current context',()=>{
 const s=readFileSync('src/routes/editor/world/+page.svelte','utf8');
 assert.match(s,/const context = currentVerifiedExportContext\(\);[\s\S]*if \(!sameVerifiedExportContext\(context, currentVerifiedExportContext\(\)\)\) return;[\s\S]*verifiedExportReview = review;\s*verifiedExportReviewContext = context;/);
 assert.match(s,/const context = verifiedExportReviewContext;[\s\S]*const result =[\s\S]*if \(!sameVerifiedExportContext\(context, currentVerifiedExportContext\(\)\)\) return;\s*verifiedExportResult = result;/);
 assert.match(s,/function downloadVerifiedArtifact\(artifact: any\) \{\s*if \(!sameVerifiedExportContext/);
 assert.match(s,/disabled=\{!verifiedExportConfirmed \|\| !verifiedExportBuildConfirmed \|\| verifiedExportLoading\}/);
 assert.equal((s.match(/if \(!sameVerifiedExportContext\(context, currentVerifiedExportContext\(\)\)\) return;/g)||[]).length,4);
});
