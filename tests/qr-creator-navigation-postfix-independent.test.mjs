import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveTypedWorkRoute,parseTypedWorkQuery} from '../src/lib/community/typed-work-route.js';
const src = p => readFileSync(p,'utf8');
const id='33333333-3333-4333-8333-333333333333';
test('QR A 99ed Owner route-change reparsing replaces historical QR223 onMount-only RED',()=>{
 const s=src('src/routes/qa/+page.svelte');
 assert.match(s,/afterNavigate\s*\(/);
 assert.match(s,/parseTypedWorkQuery\(params,\s*kind\)/);
 assert.match(s,/selected\s*=\s*null/);
 assert.match(s,/selectedKind\s*=\s*null/);
 assert.match(s,/invalidDetailUrl\s*=\s*true/);
 assert.match(s,/routeGeneration/);
 assert.match(s,/searchGeneration/);
 assert.match(s,/detailGeneration/);
 assert.match(s,/expectedRoute === routeGeneration/);
 assert.match(s,/generation === detailGeneration/);
 assert.match(s,/generation === searchGeneration/);
});
test('QR A exhaustive public Work type and canonical IDs / no DreamSnaps Tip fallback',()=>{
 for(const [t,path] of [['gallery','/gallery/?work='+id],['question','/qa/?question='+id],['tip','/qa/?tip='+id],['dreamsnap','/dreamsnaps/']]){
   const r=resolveTypedWorkRoute('',t,id,{visibility:'public',lifecycle_state:'published'});
   assert.equal(r.href,path);
   if(t==='dreamsnap')assert.equal(r.status,'gated');else assert.equal(r.status,'ready');
 }
 for(const type of ['unknown','DREAMSNAP','preset','__proto__'])
   assert.equal(resolveTypedWorkRoute('',type,id).href,null);
 for(const source of [{visibility:'private'},{deleted:true},{retired:true},{accessible:false},{privacySuppressed:true}])
   assert.equal(resolveTypedWorkRoute('','tip',id,source).href,null);
 for(const q of ['?tip='+id+'&tip='+id,'?tip='+id+'&work='+id,'?tip=invalid','?tip=00000000-0000-0000-0000-000000000000'])
   assert.equal(parseTypedWorkQuery(q,'tip').status,'invalid');
});
test('QR A QA and Creator/legacy guards preserve no-ID DreamSnaps Public Detail boundary',()=>{
 const s=src('src/routes/qa/+page.svelte'),creator=src('src/routes/creator/+page.svelte'),
  dreamsnap=src('src/routes/dreamsnaps/community/+page.svelte');
 assert.match(s,/community_get_question_public_v1/);
 assert.match(s,/community_get_tip_public_v1/);
 assert.match(s,/query\('question'/);
 assert.match(creator,/dreamsnap-gated/);
 assert.match(creator,/resolveTypedWorkRoute/);
 assert.match(dreamsnap,/authority-pending/);
 assert.doesNotMatch(dreamsnap,/getPublicCommunityMedia|community_get_gallery_dreamsnap_public_v1/);
});
