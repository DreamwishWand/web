// 04 QR-W independent NEW-only owner-review-candidate PR590 private/rights gate robots repair.
// Exact 5 Svelte routes, no Source publication/Writer/Provider change; parent main79e.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const MAIN='79e1393db5179cbc0fc8e1f6c5261d87ef47e95c';
const SOURCE='32b65c5a22f9da4161041014112c720980321e33';
const routes=[
 'src/routes/dreamsnaps/judge/+page.svelte',
 'src/routes/dreamsnaps/my/+page.svelte',
 'src/routes/dreamsnaps/results/+page.svelte',
 'src/routes/dreamsnaps/submit/+page.svelte',
 'src/routes/gallery/my/+page.svelte'
].sort();
const qaPaths=[
 '.github/workflows/04qr-w-pr590-private-robots5-independent.yml',
 'scripts/04qr-w-pr590-private-robots5-chrome.mjs',
 'tests/04qr-w-pr590-private-robots5-independent.test.mjs'
].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const parents=git('rev-list','--parents','-n','1','HEAD').split(/\s+/).slice(1);
const qaHead=parents.length>1?parents[1]:'HEAD'; // normal CI synthetic merge vs dedicated exact-head checkout
test('source fixed on protected main79e exactly five routes; QA three-only despite synthetic merge ref',()=>{
 assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
 assert.deepEqual(git('diff','--name-only',MAIN,SOURCE).trim().split('\n').sort(),routes);
 assert.equal(git('merge-base',SOURCE,qaHead),SOURCE);
 assert.deepEqual(git('diff','--name-only',SOURCE,qaHead).trim().split('\n').sort(),qaPaths);
 assert.equal(git('diff','--name-only',MAIN,SOURCE,'--','src/lib/','src/routes/+page.svelte',
  'src/routes/gallery/+page.svelte','src/routes/dreamsnaps/+page.svelte',
  'src/routes/dreamsnaps/community/+page.svelte','supabase/','static/','.github/workflows/pages.yml'),'');
});
test('all five repaired Svelte files are EXACTLY one static robots meta before head close and nothing else',()=>{
 const tag='<meta name="robots" content="noindex,nofollow" />';
 const pins={
  'src/routes/gallery/my/+page.svelte':'2d78bb9e8259bf9985170f2d30977e397dfc8670',
  'src/routes/dreamsnaps/submit/+page.svelte':'707a89fcdafa9d54e1639372cd698006d56cf55a',
  'src/routes/dreamsnaps/judge/+page.svelte':'33739b1747758653227e006cd6001681a802efe6',
  'src/routes/dreamsnaps/results/+page.svelte':'168c09e05f912d1b0196b885ba95bf1db8304be7',
  'src/routes/dreamsnaps/my/+page.svelte':'4bc551930a145c61406eea5197d4dfd4030dcb48'
 };
 for(const path of routes){
  const old=git('show',MAIN+':'+path),now=readFileSync(path,'utf8');
  assert.equal(git('rev-parse',SOURCE+':'+path),pins[path],path+' immutable approved change');
  assert.equal((old.match(/<\/svelte:head>/g)||[]).length,1,path+' original head exists once');
  assert.equal((now.match(/<meta name="robots" content="noindex,nofollow" \/>/g)||[]).length,1,path+' one noindex');
  assert.equal(now,old.replace('</svelte:head>',tag+'</svelte:head>'),path+' ONLY ONE meta inserted');
  assert.match(now,/<svelte:head>[\s\S]*<meta name="robots" content="noindex,nofollow" \/>[\s\S]*<\/svelte:head>/);
 }
});
test('deny false-positive robots signal outside head, duplicates, permission-like tokens',()=>{
 const tag='<meta name="robots" content="noindex,nofollow" />';
 const accepts=s=>{
  const h=s.match(/<svelte:head>([\s\S]*?)<\/svelte:head>/)?.[1]||'';
  return (h.split(tag).length-1)===1&&(s.split(tag).length-1)===1;
 };
 assert.equal(accepts('<svelte:head><title>Private</title>'+tag+'</svelte:head>'),true);
 for(const s of [
  '<svelte:head><title>Private</title></svelte:head>'+tag,
  '<svelte:head>'+tag+tag+'</svelte:head>',
  '<svelte:head><meta name="robots" content="index,follow"/></svelte:head>',
  '<svelte:head><meta name="robots" content="noindex"/></svelte:head>',
  '<svelte:head></svelte:head>'
 ])assert.equal(accepts(s),false);
 for(const path of routes){
  const s=readFileSync(path,'utf8');
  assert.doesNotMatch(s,/\b(uploadAndFinalizeImage|publishWork|autoUpload|writeSave)\s*\(/,path);
 }
});
test('no Source change to accepted Home / Gallery / DreamSnaps roots or real public Publisher',()=>{
 for(const file of ['src/routes/+page.svelte','src/routes/gallery/+page.svelte',
  'src/routes/dreamsnaps/+page.svelte','src/routes/dreamsnaps/community/+page.svelte']){
  assert.equal(git('rev-parse',MAIN+':'+file),git('rev-parse',SOURCE+':'+file),file);
 }
 const y=readFileSync('.github/workflows/04qr-w-pr590-private-robots5-independent.yml','utf8');
 assert.match(y,/ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
 assert.match(y,/playwright-core@1\.55\.0/);
 assert.doesNotMatch(y,/secrets\.|deploy-pages|workflow_dispatch|write-all|pull_request_target|git push/);
});
