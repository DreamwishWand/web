/** Independent 04QR-W Stage1 Guide PR522 exact Source and Help/Guide ownership.
 * New-only integration/negative QA. Owner tests are inherited, NOT replayed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {guideCopy} from '../src/lib/guide/copy.js';
import {validateGuideRuntime,GUIDE_RUNTIME_SCHEMA} from '../src/lib/guide/runtime.js';

const MAIN='342823eb03eff6bb7c5d80f4a804249bb174df10';
const SOURCE='e5960184c1cef66c9c39ff84eb6d3a9129e30c62';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const file=p=>readFileSync(p,'utf8');
const stage1=[
 '.github/workflows/web-stage1-guide-ux.yml',
 'scripts/web-stage1-guide-chrome.mjs',
 'src/routes/guide/+page.svelte',
 'tests/web-stage1-guide-root.test.mjs'
];
const qa=[
 '.github/workflows/04qr-w-pr522-guide-visual-independent.yml',
 'scripts/04qr-w-pr522-guide-visual-chromium.mjs',
 'tests/04qr-w-pr522-guide-visual-independent.test.mjs'
];
test('exact new-only Guide four source files inherited; no Guide runtime/Help/Community source changes',()=>{
 assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
 assert.deepEqual(git('diff','--name-only',MAIN,SOURCE).split('\n').sort(),stage1);
 assert.deepEqual(git('diff','--name-only',SOURCE,'HEAD').split('\n').sort(),qa);
 assert.equal(git('hash-object','src/routes/guide/+page.svelte'),'c9501ab0161a8ae7666f9ad6237825864ec0b209');
 assert.equal(git('hash-object','src/routes/help/+page.svelte'),'02829781dbff2cba282fbbb044703e3e1d347290');
 assert.equal(git('hash-object','src/lib/guide/runtime.js'),'176f9fd747dffb4532b751c495360b5f31b52697');
});
test('Guide root and Help Issues ownership: no fifth tab, no positive publisher or writer',()=>{
 const guide=file('src/routes/guide/+page.svelte'),help=file('src/routes/help/+page.svelte');
 assert.match(guide,/\['quests','starPaths','events','systems'\]/);
 assert.match(guide,/data-stage1-guide-hub/);
 assert.match(guide,/section:Section\|null=null/);
 assert.doesNotMatch(guide,/guideIssueView|runtime\.records\.issues\.map/);
 assert.doesNotMatch(guide,/section='issues'|section==='issues'|data-guide-child="issues"/);
 assert.match(help,/\/help\/issues\//);
 assert.match(help,/data-help-root="four-children"/);
 for(const banned of ['WEP_PRIVATE_P1G_PATH','fetch(', 'file.arrayBuffer(', 'saveEditedCopy(', 'createPublicWork(', 'publishWork(']){
  assert.equal(guide.includes(banned),false,'Guide source forbidden '+banned);
 }
 assert.match(guide,/loadGuideRuntime\(base\)/);
 assert.match(guide,/filterGuideViews\(views,query\)/);
 assert.match(guide,/.guide-hub-card:focus-visible/);
});
test('eight locale Guide card labels are native copy, not fixed English',()=>{
 const values=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 for(const locale of values){
  const c=guideCopy(locale);
  for(const field of ['quests','starPaths','events','systems','readOnly','community','empty','search'])
   assert.ok(typeof c[field]==='string'&&c[field].length>0,locale+'/'+field);
 }
 assert.notEqual(guideCopy('fr').quests,guideCopy('en').quests);
 assert.notEqual(guideCopy('ja').quests,guideCopy('en').quests,'Japanese Guide root must have an actual localized navigation label');
});
test('unverified or wrong Guide source cannot become positive route/article simply because Guide hub renders',()=>{
 assert.equal(GUIDE_RUNTIME_SCHEMA,'wand.guide.runtime@1');
 assert.throws(()=>validateGuideRuntime({schema:GUIDE_RUNTIME_SCHEMA,target:{platform:'Nintendo Switch',gameVersion:'1.25.3',buildID:'9A239D3DB569756D'},locales:Array(8).fill('en'),records:{quests:[],starPaths:[],events:[],systems:[],issues:[]}}),/target|supported|version|build/i);
 assert.throws(()=>validateGuideRuntime({schema:'unknown',target:{},locales:[],records:{}}),/schema/i);
 const guide=file('src/routes/guide/+page.svelte');
 assert.doesNotMatch(guide,/setDreamsnapOfficialResultPublication|saveEditedCopy|createPublicWork/);
});
