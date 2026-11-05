// Independent 04 QR-W fixed-mainc48 + PR541 source overlay contract (synthetic-only).
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const MAIN='c48e392e3bc9dc7e5844a6912b8ff2c4daf997fd';
const PREV='90d21b1b45c8743b2c4359c29d37115fd0bc355c';
const SRC='dfee4f0e2b11f49f53e8ffd15a11899eee2b5626';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const owner=[
 'src/lib/wep/world-save-source.ts',
 'tests/wep-schema626-area-record-unknown.test.mjs'
].sort();
const shell=[
 'docs/wep/world-editor-localization-inventory-20261002.json',
 'src/lib/SiteHeader.svelte',
 'src/lib/ui/product-shell-navigation.mjs',
 'tests/web-stage1-product-shell-navigation.test.mjs',
 'tests/wep-world-editor-localization-inventory.test.mjs'
].sort();
const qa=[
 '.github/workflows/04qr-w-pr541-mainc48-shell-areas-compose.yml',
 'scripts/04qr-w-pr541-mainc48-shell-areas-chrome.mjs',
 'tests/04qr-w-pr541-mainc48-shell-areas-compose.test.mjs'
].sort();
test('Mainc48 accepted shell five, PR541 exact two WEP Source, QA three and no Source committed',()=>{
 assert.equal(git('merge-base',MAIN,SRC),PREV,'PR541 is on previous main, no current-main Source claim');
 assert.deepEqual(git('diff','--name-only',PREV,MAIN).split('\n').sort(),shell);
 assert.deepEqual(git('diff','--name-only',PREV,SRC).split('\n').sort(),owner);
 assert.deepEqual(git('diff','--name-only',MAIN,'HEAD').split('\n').sort(),qa);
 assert.equal(git('rev-parse',SRC+':src/lib/wep/world-save-source.ts'),'2287fc98306bffe8c28f52ac48509ea2e63f54ac');
 assert.equal(git('rev-parse',SRC+':tests/wep-schema626-area-record-unknown.test.mjs'),'791f8216c0e98876a1b48b81e0c2506c3bd7219c');
 assert.equal(git('rev-parse',MAIN+':src/lib/SiteHeader.svelte'),'6cede86476ca6dbd3427115671367c9a1f4a433f');
 assert.equal(git('rev-parse',MAIN+':src/lib/ui/product-shell-navigation.mjs'),'8b72b0cae1c061ada4c96f9aeca5f0a0c861dc5d');
 assert.equal(git('diff','--name-only',PREV,SRC,'--','src/routes/','src/lib/community/','src/lib/ddv/','supabase/','static/'),'');
});
test('ephemeral runtime overlay must equal the exact frozen PR541 blobs, not a new source commit',()=>{
 for(const path of owner) assert.equal(git('hash-object',path),git('rev-parse',SRC+':'+path),path);
 const s=readFileSync(owner[0],'utf8');
 assert.match(s,/Absence of any Village Areas map is UNKNOWN, not a proven zero/);
 assert.match(s,/if \(!areas \|\| areaRecordCount === null\)/);
 assert.match(s,/Number\.isSafeInteger\(count\)/);
});
test('latest mainc48 inert Shell, original World read-only and no Writer/public scope change',()=>{
 const h=readFileSync('src/lib/SiteHeader.svelte','utf8');
 assert.match(h,/data-product-local-navigation/);
 assert.match(h,/data-immersive-recovery/);
 assert.match(h,/data-mobile-product-sections/);
 assert.match(h,/data-shell-control="save" type="button" disabled/);
 assert.match(h,/data-shell-control="account" type="button" disabled/);
 const world=readFileSync('src/routes/editor/world/+page.svelte','utf8');
 assert.match(world,/data-wep-626-readonly/);
 assert.match(world,/\{#if worldSource\.compatibility\.readOnly\}/);
 assert.equal(git('diff','--name-only',MAIN,'HEAD','--','src/','supabase/','static/','docs/'),'');
});
test('focused workflow checks exact Source overlay, no private P1G, no deployment',()=>{
 const w=readFileSync('.github/workflows/04qr-w-pr541-mainc48-shell-areas-compose.yml','utf8');
 assert.match(w,/ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
 assert.match(w,/git fetch --no-tags origin refs\/pull\/541\/head/);
 assert.match(w,/playwright-core@1\.55\.0/);
 assert.match(w,/node --test tests\/04qr-w-pr541-mainc48-shell-areas-compose.test.mjs/);
 assert.doesNotMatch(w,/secrets\.|pull_request_target|deploy-pages|workflow_dispatch|git push|write-all/);
});