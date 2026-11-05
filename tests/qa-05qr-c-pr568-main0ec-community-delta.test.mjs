import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// 05 QR-C independent NEW-ONLY latest main0ec changed-risk applicability.
// Previous exact 01E synthetic runtime negatives were independently accepted
// on QA #572; Guide/Home integration on QA #579 / #581. Do not rerun them.
// Private P1G, Writer, product-native V3 and device are not involved here.
const OLD_MAIN='d8e67925c2417d3fc3505611ac22919bdf354e75';
const PRIOR_MAIN='96b95972be5bcbaecf9e5656d885ce64d64aa13a';
const MAIN='0ec67476e6c358f810c310ed257bc4986128bc79';
const OLD_SOURCE='2b5820844c8efcb286a7ba925baacd92098d00f5';
const SOURCE='fd1948001f93f1796f003ce8fbc3f39bd58767d0';
const HELPER='src/lib/ddv/timing/w1-scene-area-reference-readonly.mjs';
const HELPER_TEST='tests/01e-w1-scene-area-reference-readonly.test.mjs';
const community=[
 '.github/workflows/web-stage1-dreamsnaps-ux.yml',
 '.github/workflows/web-stage1-gallery-ux.yml',
 'scripts/web-stage1-dreamsnaps-chrome.mjs',
 'scripts/web-stage1-gallery-chrome.mjs',
 'src/lib/community/dreamsnaps-stage1-root.mjs',
 'src/lib/community/gallery-stage1-root.mjs',
 'src/routes/dreamsnaps/+page.svelte',
 'src/routes/dreamsnaps/community/+page.svelte',
 'src/routes/gallery/+page.svelte',
 'tests/web-stage1-dreamsnaps-root.test.mjs',
 'tests/web-stage1-gallery-root.test.mjs'
].sort();
const qa=[
 '.github/workflows/qa-05qr-c-pr568-main0ec-community-delta.yml',
 'tests/qa-05qr-c-pr568-main0ec-community-delta.test.mjs'
].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const files=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
const blob=(ref,path)=>git('rev-parse',`${ref}:${path}`);
const read=path=>readFileSync(path,'utf8');

test('new Source HEAD is descendant of accepted 01E composition and exact latest main0ec',()=>{
 assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
 assert.equal(git('merge-base',OLD_SOURCE,SOURCE),OLD_SOURCE);
 assert.equal(git('merge-base',OLD_MAIN,PRIOR_MAIN),OLD_MAIN);
 assert.equal(git('merge-base',PRIOR_MAIN,MAIN),PRIOR_MAIN);
 assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
});

test('DreamSnaps6+Gallery5 are the entire new main/source delta; latest main to Source only 01E2',()=>{
 assert.equal(community.length,11);
 assert.deepEqual(files(OLD_MAIN,MAIN),community);
 assert.deepEqual(files(OLD_SOURCE,SOURCE),community);
 assert.deepEqual(files(MAIN,SOURCE),[HELPER,HELPER_TEST].sort());
});

test('01E helper/test Git blobs and unchanged source contract/denials prove inherited runtime QA applicability',()=>{
 const expected={[HELPER]:'433d743a9e9ac577ffbbb9a933c9c9e0e5c4e8ff',
   [HELPER_TEST]:'b3542754737d5103cacc86ad9deb1d5f07bc6e3b'};
 for(const [path,hash] of Object.entries(expected)){
   assert.equal(blob(SOURCE,path),hash,path);
   assert.equal(blob(OLD_SOURCE,path),hash,path);
 }
 const implementation=read(HELPER);
 assert.match(implementation,/wand\.01e\.w1-scene-area-reference@1/);
 assert.match(implementation,/export function inspectW1SceneAreaReferences\(/);
 assert.match(implementation,/productWriterAuthorized:\s*false/);
 assert.doesNotMatch(implementation,/^\s*import\s/m,'standalone 01E must not acquire Community runtime dependencies');
});

test('the eleven newly composed Community files match protected main bytewise and cannot import 01E',()=>{
 for(const path of community){
   assert.equal(blob(SOURCE,path),blob(MAIN,path),path);
   const contents=read(path);
   assert.doesNotMatch(contents,/^\s*import\s*(?:.*)?['"][^'"]*(?:w1-scene-area-reference-readonly|ddv\/timing)\b/m,path);
   assert.doesNotMatch(contents,/\bimport\s*\(\s*['"][^'"]*(?:w1-scene-area-reference-readonly|ddv\/timing)/m,path);
 }
});

test('DreamSnaps and Gallery added root model gates do not promote Provider/Writer/Media Rights',()=>{
 const ds=read('src/lib/community/dreamsnaps-stage1-root.mjs');
 const gal=read('src/lib/community/gallery-stage1-root.mjs');
 assert.match(ds,/DREAMSNAPS_STAGE1_PUBLIC_PROVIDER_ENABLED\s*=\s*false/);
 assert.match(ds,/DREAMSNAPS_STAGE1_MEDIA_ACCEPTED\s*=\s*false/);
 assert.match(ds,/DREAMSNAPS_STAGE1_WRITER_ENABLED\s*=\s*false/);
 assert.match(gal,/STAGE1_GALLERY_PUBLIC_WRITER_ENABLED\s*=\s*false/);
 assert.match(gal,/STAGE1_GALLERY_MEDIA_RIGHTS_VERIFIED\s*=\s*false/);
 const dsPage=read('src/routes/dreamsnaps/+page.svelte');
 const galPage=read('src/routes/gallery/+page.svelte');
 assert.match(dsPage,/data-public-provider="off"/);
 assert.match(dsPage,/data-writer="off"/);
 assert.match(galPage,/data-writer="off"/);
 assert.match(galPage,/data-public-eligibility="provider-gated"/);
 // Gallery browsing is explicitly gated public RPC, not an assertion of no network.
 assert.match(galPage,/createCommunityBrowserClient/);
});

test('QA branch contains only two independent QA paths, source and community files unchanged',()=>{
 assert.deepEqual(files(SOURCE,'HEAD'),qa);
 for(const path of [HELPER,HELPER_TEST,...community]){
   assert.equal(blob('HEAD',path),blob(SOURCE,path),path);
 }
});
