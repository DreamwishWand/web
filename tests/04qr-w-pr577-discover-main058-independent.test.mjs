// 04 QR-W independent PR577 Discover NEW-ONLY CI base policy. Prior QA554 real 8-locale Chrome reused.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const MAIN='058ac652b06fdc62ff85559186375c5b7a1e62a4';
const SOURCE='faef18373bd8e84312eedeff39cecd13007bff30';
const OLD='65a14b91061f8d413b4e549a55b64cb15be0456a';
const workflow='.github/workflows/web-stage1-discover-orientation.yml';
const sourcePaths=[workflow,'scripts/web-stage1-discover-orientation-chrome.mjs',
 'src/lib/product-home/orientation-stage1-copy.mjs','src/routes/discover/+page.svelte',
 'tests/web-stage1-discover-orientation.test.mjs'].sort();
const qaPaths=['.github/workflows/04qr-w-pr577-discover-main058-independent.yml',
 'tests/04qr-w-pr577-discover-main058-independent.test.mjs'].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const original=git('show',OLD+':'+workflow);
const current=readFileSync(workflow,'utf8').trim();
const oldLine='BASE=87f656833491b87712eee031f51ca135bda26b30';
const newLine='BASE="'+'$'+"{{ github.event.pull_request.base.sha || '"+MAIN+"' }}"+'"';

test('exact current protected-main source five only, QA two only, accepted original four product Git blobs unchanged',()=>{
 assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
 assert.deepEqual(git('diff','--name-only',MAIN,SOURCE).split('\n').sort(),sourcePaths);
 assert.deepEqual(git('diff','--name-only',SOURCE,'HEAD').split('\n').sort(),qaPaths);
 for(const [path,sha] of Object.entries({
  'src/routes/discover/+page.svelte':'c909b5d957bda1b5fba5727877417baf03362a6d',
  'src/lib/product-home/orientation-stage1-copy.mjs':'c2ec4e6ce2c80e97aa7e117bda5234155b72649f',
  'tests/web-stage1-discover-orientation.test.mjs':'cc5f0584f981cfc8a9b46124d756a54c18118091',
  'scripts/web-stage1-discover-orientation-chrome.mjs':'cde9a44be11f05257bad377080634a9d16cae408'
 })){
  assert.equal(git('rev-parse',SOURCE+':'+path),sha);
  assert.equal(git('rev-parse',OLD+':'+path),sha,'reused 04 QR-W QA554 accepted source, not new product delta');
 }
 assert.equal(git('rev-parse',SOURCE+':'+workflow),'c7649071109ead8d8191d9282672f177d8e11e6e');
 assert.equal(git('rev-parse',OLD+':'+workflow),'c31de27914940f218b9436c9581a5181bc7b7d21');
});
test('only one trusted PR event main-base selector line changed vs already-accepted Source CI',()=>{
 assert.ok(original.includes(oldLine));
 assert.ok(current.includes(newLine));
 assert.equal(current.replace(newLine,oldLine),original,'workflow every other byte identical');
 assert.equal(current.split(newLine).length,2);
 assert.match(current,/test "\$\(git merge-base "\$BASE" HEAD\)" = "\$BASE"/);
 assert.match(current,/test "\$\(wc -l <\/tmp\/stage1-discover\)" -eq 5/);
 assert.match(current,/contents: read/);
 assert.doesNotMatch(current,/secrets\.|deploy-pages|workflow_dispatch|continue-on-error|permissions:\s*write-all/);
});
test('Discover five-file event filter and guard strictly rejects unrelated Home/Guide/Help, Native/SQL, QA and extra path',()=>{
 for(const path of sourcePaths)assert.ok(current.includes("'"+path+"'"),path);
 const set=new Set(sourcePaths);
 const admits=paths=>paths.length===5&&new Set(paths).size===5&&paths.every(x=>set.has(x));
 const triggers=paths=>paths.some(x=>set.has(x));
 assert.ok(admits(sourcePaths));
 for(const p of ['src/routes/+page.svelte','src/lib/product-home/copy.js',
  'src/routes/help/+page.svelte','src/routes/guide/+page.svelte','src/routes/gallery/+page.svelte',
  'src/lib/community/browser-client.ts','src/lib/ddv/native-save-writer.ts',
  'src/lib/wep/world-save-source.ts','supabase/migrations/unsafe.sql','static/ddv/unsafe-rights.json',
  'tests/04qr-w-pr577-discover-main058-independent.test.mjs']){
  assert.equal(triggers([p]),false,'irrelevant PR should skip this source-only workflow: '+p);
  assert.equal(admits([...sourcePaths,p]),false,'sixth Source must fail strict-five: '+p);
  assert.equal(admits([...sourcePaths.slice(0,4),p]),false,'unauthorized forged fifth Source '+p);
 }
 assert.equal(admits(sourcePaths.slice(0,4)),false);
 assert.equal(admits([sourcePaths[0],sourcePaths[0],sourcePaths[2],sourcePaths[3],sourcePaths[4]]),false);
 for(const p of ['src/routes/+page.svelte','src/lib/product-home/copy.js','src/lib/SiteHeader.svelte',
  'src/routes/help/','src/routes/guide/','src/lib/community/','src/lib/ddv/','src/lib/wep/',
  'supabase/','static/','.github/workflows/pages.yml'])assert.ok(current.includes(p),'protected scope '+p);
});
test('seven product orientation and optional Save/Account are not permissions or public Writer activation',async()=>{
 const {orientationCopy,ORIENTATION_DESTINATIONS}=await import('../src/lib/product-home/orientation-stage1-copy.mjs');
 assert.deepEqual(orientationCopy('en').products.map(p=>p.id),
  ['decorate','collection','guide','presets','gallery','dreamsnaps','help']);
 assert.deepEqual(ORIENTATION_DESTINATIONS,['/decorate/','/collection/','/guide/','/presets/',
  '/gallery/','/dreamsnaps/','/help/']);
 for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  const c=orientationCopy(locale);
  assert.equal(c.products.length,7);
  assert.match(c.save,/save|セーブ|sauvegarde|salvataggio|Spielstand|guardad|存档|salvament/i);
  assert.ok(c.account.trim().length>20);
  assert.ok(c.products.every(p=>p.purpose&&p.step),'each product has safe first step');
 }
 const source=readFileSync('src/routes/discover/+page.svelte','utf8');
 assert.match(source,/data-discover-stage1="orientation-not-dashboard"/);
 assert.match(source,/data-discover-seven-products/);
 assert.doesNotMatch(source,/uploadAndFinalizeImage|createPublicWork|publishWork|writeSave|autoUpload/);
 const q=readFileSync('.github/workflows/04qr-w-pr577-discover-main058-independent.yml','utf8');
 assert.match(q,/ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
 assert.doesNotMatch(q,/secrets\.|deploy-pages|workflow_dispatch|write-all/);
 assert.equal(git('diff','--name-only',SOURCE,'HEAD','--','src/','static/','supabase/'),'');
});
