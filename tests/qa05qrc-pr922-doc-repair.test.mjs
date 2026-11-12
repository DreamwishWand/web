import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'});
const old='761524b78a8eb6407b793b64d60d48c99837cf70';
const source='497b3aae429942d5bc73ac9f592e0adf640fd292';
const parent='02c5a5d92d8dcdb7ee92e46a64b2a69a36853bcb';
const red='384bbff7f89a4e3e0ae24d6fdca52ed3c93a4aef';
const main='216871502d67734dca97aa9b1d40cab08da41228';
const qa='2fe8f66804420481ef63146b9fda7978e0209c6c';
const doc='docs/core/01c-roadfence-operation-native-closure-20261112.md';
const p='src/lib/ddv/core/roadfence/';
const paths=[
 [p+'native-operation-closure-v125.js','e1987d9c9c86544b7a09ea0cbe93792ff253355d'],
 ['tests/ddv-roadfence-native-operation-closure-v125.test.mjs','94f0e49810f47adf9abdaa6d71bdc363e721a2e3'],
 [p+'operation-intent-v125.js','590962406839ecc6a5d504816e4cd589784f205c'],
 ['tests/ddv-roadfence-operation-intent-v125.test.mjs','f1e714b427450cb5fe1a7e6ae719e4cf24c62482']
];
const blob=(r,p)=>git('rev-parse',r+':'+p).trim();
const oldDoc=git('show',old+':'+doc),newDoc=git('show',source+':'+doc);
const originalAssertion=d=>{
 assert.ok(d.includes(parent),'provenance must pin repaired PR919 Source');
 assert.ok(!/fixed[^\n]*384bbff7f89a4e3e0ae24d6fdca52ed3c93a4aef/i.test(d),'historical TRUE_RED HEAD must not be called fixed parent');
};
test('QAC922 exact historical document failure and repaired assertion',()=>{
 assert.equal(blob(old,doc),'1c1f4b1e06f475d7c3d2d60a28f4dacbc53eb968');
 assert.equal(blob(qa,doc),blob(old,doc));
 assert.equal(blob(source,doc),'88320938087860df5eb92dc25b3f52a1ec61469f');
 assert.throws(()=>originalAssertion(oldDoc),/provenance must pin repaired PR919 Source/);
 originalAssertion(newDoc);
 assert.throws(()=>originalAssertion(newDoc+'\nfixed '+red),/historical TRUE_RED HEAD/);
});
test('QAC922 both exact parent pins and historical error are correctly attributed',()=>{
 const lines=newDoc.split('\n');
 const fixed=lines.filter(x=>/fixed/i.test(x)&&x.includes(parent));
 assert.equal(fixed.length,2);
 const historical=lines.filter(x=>x.includes(red));
 assert.equal(historical.length,1);
 assert.match(historical[0],/historical.*TRUE_RED in QA928.*RECOMPILE topology fingerprint collision/);
 assert.doesNotMatch(historical[0],/\bfixed\b/i);
 assert.match(newDoc,/QA946 and selectively integrated via PR947/);
 assert.match(newDoc,/05 QR-C.*reuses accepted PR #919 original2/);
 assert.match(newDoc,/09 INT.*original2 already accepted and integrated by PR947.*child original3/);
 assert.match(newDoc,/Rollback.*child three ADD files only/);
 assert.match(newDoc,/Writer\/Apply\/EditedCopy\/Cloud\/Public flags remain OFF/);
 assert.match(newDoc,/Switch v1\.25\.0 BID .52BD625D9B4E0053. schema624/);
});
test('QAC922 old runtime evidence reuse exact four code/test blobs and main ancestor',()=>{
 for(const [path,sha] of paths){
  for(const r of [old,source,qa,'HEAD'])assert.equal(blob(r,path),sha,path+' '+r);
 }
 for(const [path,sha] of paths.slice(2)){
  assert.equal(blob(parent,path),sha);
  assert.equal(blob(main,path),sha);
 }
 assert.equal(git('merge-base','1b0d43a878b8768a762d20ea1e6dd28b680efc94',main).trim(),'1b0d43a878b8768a762d20ea1e6dd28b680efc94');
 assert.equal(git('diff','--name-only',old,source).trim(),doc);
 assert.deepEqual(git('diff','--name-status',parent,source).trim().split('\n').sort(),['A\t'+doc,'A\t'+paths[0][0],'A\t'+paths[1][0]].sort());
 assert.equal(blob('HEAD',doc),blob(source,doc));
});
