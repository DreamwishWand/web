// 04 QR-W fixed-HEAD independent Shell product-local changed-risk and denial tests.
// No original owner Shell test duplication: verify exact Source5, privacy and 8-locale deep-link invariants.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolveProductShell,normalizeShellPath} from '../src/lib/ui/product-shell-navigation.mjs';
const MAIN='90d21b1b45c8743b2c4359c29d37115fd0bc355c';
const SRC='500eb0eda72b037a6030c3af521ea85be52a8415';
const files=[
 'docs/wep/world-editor-localization-inventory-20261002.json',
 'src/lib/SiteHeader.svelte',
 'src/lib/ui/product-shell-navigation.mjs',
 'tests/web-stage1-product-shell-navigation.test.mjs',
 'tests/wep-world-editor-localization-inventory.test.mjs'
].sort();
const qa=[
 '.github/workflows/04qr-w-pr597-shell-independent.yml',
 'scripts/04qr-w-pr597-shell-live-chrome.mjs',
 'tests/04qr-w-pr597-shell-independent.test.mjs'
].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const pins={
 'docs/wep/world-editor-localization-inventory-20261002.json':'8a3e284934813517ae83427b5cc4760bd05b38d9',
 'src/lib/SiteHeader.svelte':'6cede86476ca6dbd3427115671367c9a1f4a433f',
 'src/lib/ui/product-shell-navigation.mjs':'8b72b0cae1c061ada4c96f9aeca5f0a0c861dc5d',
 'tests/web-stage1-product-shell-navigation.test.mjs':'b6e34667975daaec4182378f9ee88577cd7569b8',
 'tests/wep-world-editor-localization-inventory.test.mjs':'ba7cf09198c92a465f0929f851b998fe0005df3f'
};
test('fixed owner Source exact 5 files on main90d; QA only three files, protected paths untouched',()=>{
 assert.equal(git('merge-base',MAIN,SRC),MAIN);
 assert.deepEqual(git('diff','--name-only',MAIN,SRC).trim().split('\n').sort(),files);
 assert.deepEqual(git('diff','--name-only',SRC,'HEAD').trim().split('\n').sort(),qa);
 for(const [path,blob] of Object.entries(pins))assert.equal(git('rev-parse',SRC+':'+path),blob,path);
 assert.equal(git('diff','--name-only',MAIN,SRC,'--','src/routes/','supabase/','src/lib/wep/',
 'src/lib/community/','src/lib/ddv/','.github/workflows/pages.yml','static/'),'');
});
test('hostile URL, deep links and one Product-only sibling scope; never universal seven switcher',()=>{
 assert.equal(normalizeShellPath('/web/editor/world/?fake=1#foo'),'/editor/world/');
 for(const hostile of ['','not-a-url',null,{},'///'])assert.equal(resolveProductShell(hostile,'en').id,null);
 for(const [path,id,active,immersive] of [
  ['/web/','',null,false],
  ['/web/decorate/','decorate',null,false],
  ['/web/explore/private/','decorate','explore',false],
  ['/web/moodboards/?tab=2','decorate','moodboards',false],
  ['/web/editor/world/','decorate','editor',true],
  ['/web/gallery/my/','gallery','my',false],
  ['/web/dreamsnaps/results/history/','dreamsnaps','results',false],
  ['/web/help/questions/deep/','help','questions',false]
 ]){
  const s=resolveProductShell(path,'ja');
  assert.equal(s.id,id||null,path);
  assert.equal(s.sections.filter(x=>x.current).length,active?1:0,path);
  if(active)assert.equal(s.sections.find(x=>x.current).id,active,path);
  assert.equal(s.presentation,immersive?'immersive':'standard',path);
 }
 assert.equal(resolveProductShell('/web/dreamsnaps/myevil/').sections.filter(x=>x.current).length,0);
 assert.equal(resolveProductShell('/web/gallery/my-claimed/').sections.filter(x=>x.current).length,0);
 for(const locale of ['en','ja','fr','it','de','es-ES','zh-CN','pt-BR']){
  for(const p of ['/web/decorate/','/web/gallery/','/web/dreamsnaps/','/web/help/']){
   const s=resolveProductShell(p,locale);
   assert.ok(s.rootLabel.trim());
   assert.ok(s.sections.every(x=>typeof x.label==='string'&&x.label.trim().length>0));
   assert.equal(s.sections.some(x=>x.href==='/account/'||x.href==='/save/'),false);
  }
 }
});
test('existing five public-test private/gated routes retain noindex and inherited Writer/Provider OFF',()=>{
 const paths=['dreamsnaps/submit','dreamsnaps/judge','dreamsnaps/results','dreamsnaps/my','gallery/my'];
 for(const p of paths){
  const file='src/routes/'+p+'/+page.svelte',body=readFileSync(file,'utf8');
  assert.equal(git('rev-parse',MAIN+':'+file),git('rev-parse',SRC+':'+file));
  assert.match(body,/<meta name="robots" content="noindex,nofollow" \/>/);
 }
 for(const p of ['src/routes/+page.svelte','src/routes/gallery/+page.svelte','src/routes/dreamsnaps/+page.svelte']){
  assert.equal(git('rev-parse',MAIN+':'+p),git('rev-parse',SRC+':'+p),p);
 }
 const header=readFileSync('src/lib/SiteHeader.svelte','utf8');
 assert.match(header,/data-product-local-navigation/);
 assert.match(header,/data-immersive-recovery/);
 assert.match(header,/data-mobile-product-sections/);
 assert.match(header,/afterNavigate\(/);
 assert.match(header,/setShellContextActions\(\[\]\)/);
 assert.match(header,/data-shell-control="save" type="button" disabled/);
 assert.match(header,/data-shell-control="account" type="button" disabled/);
 assert.doesNotMatch(header,/dispatchShellIntent\(/);
 assert.doesNotMatch(header,/data-global-product-switcher|global-tool-rail/);
 const inventory=JSON.parse(readFileSync('docs/wep/world-editor-localization-inventory-20261002.json','utf8'));
 assert.equal(inventory.sourcePins['src/lib/SiteHeader.svelte'],pins['src/lib/SiteHeader.svelte']);
});
test('QA-only workflow cannot mutate Pages or touch private Save and requires actual Chrome',()=>{
 const w=readFileSync('.github/workflows/04qr-w-pr597-shell-independent.yml','utf8');
 assert.match(w,/ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
 assert.match(w,/playwright-core@1\.55\.0/);
 assert.doesNotMatch(w,/secrets\.|pull_request_target|deploy-pages|workflow_dispatch|git push|write-all/);
 assert.equal(git('diff','--name-only',SRC,'HEAD','--','src/','supabase/','static/','docs/'),'');
});
