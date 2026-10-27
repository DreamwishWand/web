import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const dir='supabase/migrations/';
function source(filename){return readFileSync(dir+filename,'utf8')}
function gitBlobSha(filename){
 const bytes=readFileSync(dir+filename);
 const hdr=Buffer.from('blob '+bytes.length+String.fromCharCode(0));
 return createHash('sha1').update(hdr).update(bytes).digest('hex');
}
test('pin unchanged historical Source144 and new Source145',()=>{
 assert.equal(gitBlobSha('20261027000020_legacy_dreamsnap_gallery_public_reader_liveness.sql'),'b1fc4990a057f810aeb4b1a12a602a68c9b0330f');
 assert.equal(gitBlobSha('20261027000010_f08_f09_dreamsnap_public_work_liveness.sql'),'64fe31ac0424b0032553c51a9aca7f10d79f6d36');
 assert.equal(gitBlobSha('20261003044500_community_dreamsnaps_projection_v1.sql'),'f67b2e741564b71ddcd0aed7bf8a6452b7dd3256');
 assert.equal(gitBlobSha('20261003044600_community_dreamsnaps_native_revision_fix_v1.sql'),'e9489cfad4d85d4ef654ac6010c5a2dc955c34fb');
});
test('effective Search/Detail share Source144 work gate and correlated media tuple',()=>{
 const body=source('20261027000020_legacy_dreamsnap_gallery_public_reader_liveness.sql').toLowerCase();
 assert.equal([...body.matchAll(/^create or replace function public[.]/gm)].length,2);
 assert.equal(body.split('private.dreamsnap_public_work_accessible_r20(').length-1,3);
 assert.equal([...body.matchAll(/^security definer$/gm)].length,2);
 for(const token of ['cr.work_id=v_work.work_id','m.owner_account_id=v_work.owner_account_id','e.account_id=v_work.owner_account_id','gp.work_id=e.work_id','cp.owner_account_id=w.owner_account_id','dr.caption','m.purged_at is null']){
  assert(body.includes(token),'Missing '+token);
 }
 for(const forbidden of ['create or replace function public.community_get_public_media_storage_v2','create or replace function public.community_get_dreamsnap_results_public_v1','create or replace function private.dreamsnap_public_official_result']){
  assert(!body.includes(forbidden),'Unexpected historical issuer replacement '+forbidden);
 }
});
