// 04 QR-W independent changed-only QA on 08 WEB PR739 repaired scroll HEAD581aa.
// Reuses accepted ancestor PR740 QA for mobile drawer. No Save, Writer, public or Provider authority.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const BASE='5500746797b89a9b83605327982ad2d3a011c87b';
const OLD='92c449271998828bf3694f27a4aa55bc3056ea47';
const SOURCE='581aa3a63e5c0daf952d70e2f9705934abc7507d';
const pins=new Map([
 ['.github/workflows/web-stage1-collection-ux.yml','eed324002f81e04cec515e5c40280617bbe75852'],
 ['scripts/web-stage1-collection-chrome.mjs','115d6f64697cc7f1c3b5182e612165fc1bf55620'],
 ['src/routes/collection/+page.svelte','10c93fd2f7d77dee18b4732f68d1945a2df4b319'],
 ['tests/web-stage1-collection-root.test.mjs','da156db7f69b1482b54331a093ac50866b054390']
]);
const changed=[
 'scripts/web-stage1-collection-chrome.mjs',
 'src/routes/collection/+page.svelte',
 'tests/web-stage1-collection-root.test.mjs'
].sort();
const qa=[
 '.github/workflows/04qr-w-pr739-repaired-scroll-independent.yml',
 'scripts/04qr-w-pr739-repaired-scroll-chrome.mjs',
 'tests/04qr-w-pr739-repaired-scroll-independent.test.mjs'
].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const files=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
const route=readFileSync('src/routes/collection/+page.svelte','utf8');
const ownerChrome=readFileSync('scripts/web-stage1-collection-chrome.mjs','utf8');
const ownerTests=readFileSync('tests/web-stage1-collection-root.test.mjs','utf8');

test('Q739R-01 fixed new Source4 immutable, exactly 3 changed since accepted QA740 ancestor, QA-only 3 added',()=>{
 assert.equal(git('rev-parse',SOURCE),SOURCE);
 assert.equal(git('merge-base',OLD,SOURCE),OLD);
 assert.deepEqual(files(OLD,SOURCE),changed);
 for(const [path,sha] of pins){
  assert.equal(git('rev-parse',SOURCE+':'+path),sha,path);
  assert.equal(git('hash-object',path),sha,'QA must not touch Source: '+path);
 }
 assert.equal(git('rev-parse',SOURCE+':.github/workflows/web-stage1-collection-ux.yml'),
              git('rev-parse',OLD+':.github/workflows/web-stage1-collection-ux.yml'));
 assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
 assert.deepEqual(files(SOURCE,'HEAD'),qa);
 assert.notEqual(BASE,OLD);
});

test('Q739R-02 ONLY route code difference since previous accepted Source is instant scroll and explanatory comment',()=>{
 const old=git('show',OLD+':src/routes/collection/+page.svelte');
 const fresh='    // Global html uses smooth scrolling; this restoration must be synchronous.\n' +
             "    window.scrollTo({left:origin.x,top:origin.y,behavior:'instant'});";
 assert.equal(route.split(fresh).length-1,1,'new changed guard must be exact');
 assert.equal(route.replace(fresh,'    window.scrollTo(origin.x,origin.y);').trimEnd(),old);
 assert.doesNotMatch(route,/window\.scrollTo\(origin\.x,origin\.y\)/,'CSS smooth numeric legacy restore forbidden');
 assert.match(route,/origin\.trigger\.focus\(\{preventScroll:true\}\);\s*\/\/ Global html uses smooth scrolling; this restoration must be synchronous\.\s*window\.scrollTo\(\{left:origin\.x,top:origin\.y,behavior:'instant'\}\)/);
 const close=route.slice(route.indexOf('async function closeInfo()'),route.indexOf('const inertProgress='));
 assert.ok(close.indexOf('await tick()')<close.indexOf('origin.trigger.focus'),'guard after re-render');
 for(const re of [
  /selected!==origin\.itemId/,/infoId!==null\|\|infoReturn!==null/,
  /origin\.context!==infoContext\(\)/,/!origin\.trigger\.isConnected/,
  /origin\.trigger\.dataset\.stage1ItemId!==String\(origin\.itemId\)/,
  /!scoped\.some\(\(item:any\)=>item\.itemId===origin\.itemId\)/
 ])assert.match(close,re);
});

test('Q739R-03 Owner changed Chrome checks click-time delta rather than old pre-focus scroll, never widens tolerance',()=>{
 for(const re of [
  /const focusedScroll=await page\.evaluate\(\(\)=>window\.scrollY\)/,
  /window\.scrollTo\(window\.scrollX,y\+14\)/,
  /beforeEnterScroll-focusedScroll>=10/,
  /addEventListener\('click'/,
  /window\.__collectionClickTimeScroll=\{y:window\.scrollY/,
  /clickTime\.y-focusedScroll>=10/,
  /Math\.abs\(returnedScroll-clickTime\.y\)<=4/
 ])assert.match(ownerChrome,re);
 assert.doesNotMatch(ownerChrome,/Math\.abs\(returnedScroll-beforeScroll\)/);
 assert.doesNotMatch(ownerChrome,/Math\.abs\(returnedScroll-clickTime\.y\)<=1[0-9]/);
 assert.match(ownerTests,/behavior:'instant'/);
 assert.match(ownerTests,/CSS html smooth scroll cannot delay focus restoration/);
});

test('Q739R-04 new fix neither expands permissions nor changes previously accepted mobile & personal UI',()=>{
 const old=git('show',OLD+':src/routes/collection/+page.svelte');
 assert.match(old,/data-personal-progress="unknown" data-writer="off" data-media-rights="unverified"/);
 assert.match(route,/data-personal-progress="unknown" data-writer="off" data-media-rights="unverified"/);
 assert.match(route,/role=\{mobileFilter \? 'dialog' : undefined\}/);
 assert.match(route,/aria-modal=\{mobileFilter \? 'true' : undefined\}/);
 assert.match(route,/on:keydown=\{onFilterKeydown\}/);
 assert.match(route,/window\.matchMedia\('\(max-width: 820px\)'\)/);
 assert.match(route,/selectedWorlds=selectedWorlds\.includes\(id\)/);
 assert.match(route,/selectedUniverses=selectedUniverses\.includes\(id\)/);
 assert.match(route,/disabled title=\{ui\.unknown\}/);
 for(const x of ['saveEditedCopy','createPublicWork','uploadPersonalSave','setDreamsnapOfficialResultPublication'])
  assert.equal(route.includes(x),false,x);
 assert.equal(files(OLD,SOURCE).some(p=>p.startsWith('src/lib/')||p.startsWith('static/')||p.startsWith('supabase/')),false);
});