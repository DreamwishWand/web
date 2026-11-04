/** 04 QR-W independent repair-only QA. PR522 source fixed: fr actual DOM + JA Guide roots.
 * This is NEW source HEAD, old PR524 scoped RED remains historical evidence.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {guideCopy} from '../src/lib/guide/copy.js';
import {validateGuideRuntime,GUIDE_RUNTIME_SCHEMA} from '../src/lib/guide/runtime.js';
const PARENT='342823eb03eff6bb7c5d80f4a804249bb174df10';
const PREVIOUS='e5960184c1cef66c9c39ff84eb6d3a9129e30c62';
const SOURCE='84a2f22af51a475800bd9f32ee88f1dae2a3d0e7';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const source=[
 '.github/workflows/web-stage1-guide-ux.yml',
 'scripts/web-stage1-guide-chrome.mjs',
 'src/lib/guide/copy.js',
 'src/routes/guide/+page.svelte',
 'tests/web-stage1-guide-root.test.mjs'
];
const qa=[
 '.github/workflows/04qr-w-pr522-locale-repair-independent.yml',
 'scripts/04qr-w-pr522-locale-repair-chromium.mjs',
 'tests/04qr-w-pr522-locale-repair-independent.test.mjs'
];
const page=readFileSync('src/routes/guide/+page.svelte','utf8');
test('new fixed Source only 5 Guide paths, preserving immutable Git Source tree and prior QA RED scope',()=>{
 assert.equal(git('merge-base',PARENT,SOURCE),PARENT);
 assert.deepEqual(git('diff','--name-only',PARENT,SOURCE).split('\n').sort(),source);
 assert.deepEqual(git('diff','--name-only',SOURCE,'HEAD').split('\n').sort(),qa);
 for(const path of source)assert.notEqual(git('rev-parse',SOURCE+':'+path),'',path);
 assert.equal(git('rev-parse',SOURCE+':src/routes/guide/+page.svelte'),'349b9d62d28b95fa720fbb321ed9da857cee8834');
 assert.equal(git('rev-parse',SOURCE+':src/lib/guide/copy.js'),'5c4809815c53d14896d5884071841f7871fee400');
 assert.notEqual(git('rev-parse',PREVIOUS+':src/routes/guide/+page.svelte'),
  git('rev-parse',SOURCE+':src/routes/guide/+page.svelte'));
 assert.equal(git('rev-parse',SOURCE+':src/routes/help/+page.svelte'),git('rev-parse',PARENT+':src/routes/help/+page.svelte'));
});
test('previous fr stale label is fixed by tracked reactive copy explicit argument, without a 5th Issues root',()=>{
 assert.match(page,/function sectionLabel\(value:Section, strings:typeof copy\)/);
 assert.match(page,/sectionLabel\(key as Section,copy\)/);
 assert.match(page,/data-stage1-guide-hub/);
 assert.match(page,/\['quests','starPaths','events','systems'\]/);
 assert.doesNotMatch(page,/guideIssueView|runtime\.records\.issues\.map|data-guide-child="issues"/);
 assert.doesNotMatch(page,/fetch\(|file\.arrayBuffer\(|saveEditedCopy\(|publishWork\(/);
 const help=readFileSync('src/routes/help/+page.svelte','utf8');
 assert.match(help,/\/help\/issues\//);
 assert.match(help,/data-help-root="four-children"/);
});
test('new JA human-meaningful Guide root labels and FR replacement; every 8-locale field is nonempty',()=>{
 for(const lang of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  const copy=guideCopy(lang);
  for(const field of ['quests','starPaths','events','systems','community','readOnly','search'])
   assert.ok(typeof copy[field]==='string'&&copy[field].trim().length>0,lang+':'+field);
 }
 assert.equal(guideCopy('fr').quests,'Quêtes');
 assert.equal(guideCopy('ja').quests,'クエスト');
 assert.equal(guideCopy('ja').starPaths,'スターパス');
 assert.equal(guideCopy('ja').events,'イベント');
 assert.equal(guideCopy('ja').systems,'ゲームシステム');
 assert.notEqual(guideCopy('fr').quests,guideCopy('en').quests);
});
test('Guide source is still static 1.25.0, not allowed as same-build schema626 native writer or public article',()=>{
 assert.equal(GUIDE_RUNTIME_SCHEMA,'wand.guide.runtime@1');
 assert.throws(()=>validateGuideRuntime({
  schema:GUIDE_RUNTIME_SCHEMA,
  target:{platform:'Nintendo Switch',gameVersion:'1.25.3',buildID:'9A239D3DB569756D'},
  locales:['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'],
  records:{quests:[],starPaths:[],events:[],systems:[],issues:[]}
 }),/target|supported|build|version/i);
 assert.match(page,/Guide \| Dreamwish Wand/);
 assert.doesNotMatch(page,/authorizedPublicGuide|sourceRevisionCasVerified\s*=\s*true/);
});
