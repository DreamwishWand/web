import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const files={
 original:'supabase/migrations/20261003044500_community_dreamsnaps_projection_v1.sql',
 incident:'supabase/migrations/20261025003050_r19_direct_media_sql_issuer_authority.sql',
 source143:'supabase/migrations/20261027000000_d06_dreamsnaps_account_global_official_consent.sql',
 source144:'supabase/migrations/20261027000010_f08_f09_dreamsnap_public_work_liveness.sql',
 signer:'supabase/functions/community-public-media/index.ts',
 publicQuery:'supabase/functions/community-public-query/index.ts'
};
const v=Object.fromEntries(Object.entries(files).map(([k,path])=>[k,readFileSync(path,'utf8')]));
const blob=s=>{const b=Buffer.from(s);return createHash('sha1').update('blob '+b.length).update(Buffer.from([0])).update(b).digest('hex')};
const func=(body,name)=>{const a=body.toLowerCase().indexOf('create or replace function '+name.toLowerCase()+'(');assert.ok(a>=0,'missing '+name);const b=body.indexOf('$$;',a);assert.ok(b>a,name);return body.slice(a,b+3)};
test('Source original F08/F09 retained as historic conditional RED, pin exact original and later Source141 identity',()=>{
 assert.equal(blob(v.original),'f67b2e741564b71ddcd0aed7bf8a6452b7dd3256');
 assert.equal(blob(v.incident),'755c45a5edfe0d8cdab4b4320ecdfa02443183fe');
 const old=func(v.original,'public.community_get_public_media_storage_v2');
 const third=old.slice(old.indexOf('join public.dreamsnap_entries e on e.entry_revision_id'));
 assert.match(third,/and w.moderation_state='clear'/);
 assert.doesNotMatch(third,/and w.lifecycle_state='published'/);
 assert.doesNotMatch(third,/and w.visibility='public'/);
 const w=func(v.original,'public.community_get_dreamsnap_results_public_v1');
 const wand=w.slice(w.indexOf('into v_wand'),w.indexOf('into v_official'));
 assert.doesNotMatch(wand,/w.lifecycle_state='published'/);
 assert.doesNotMatch(wand,/w.visibility='public'/);
});
test('new Owner Source144 exact blob and 143/144 order, no retrofit of earlier SQL',()=>{
 assert.equal(blob(v.source144),'64fe31ac0424b0032553c51a9aca7f10d79f6d36');
 assert.equal(blob(v.source143),'5364449011a06d1b53dff92c4d16bc47305766aa');
 assert.doesNotMatch(v.source144,/create table|alter table|drop function|storage\.remove|storage\.copy/i);
});
test('source144 single fail-closed Work helper verifies publish/public, Creator, active Account Identity & R12 privacy',()=>{
 const s=v.source144.slice(v.source144.indexOf('create or replace function private.dreamsnap_public_work_accessible_r20('),v.source144.indexOf('$dreamsnap_public_work$;',v.source144.indexOf('create or replace function private.dreamsnap_public_work_accessible_r20('))+24);
 for(const k of ["w.lifecycle_state='published'","w.visibility='public'","w.moderation_state='clear'","w.work_type='dreamsnap'","a.status='active'","a.deleted_at is null","cp.profile_visibility='public'","cp.moderation_state='clear'","ai.identity_state='active'","private.is_discoverable_work(w.work_id)","cp.owner_account_id=w.owner_account_id"])
  assert.ok(s.includes(k),k);
 assert.match(v.source144,/revoke all on function private\.dreamsnap_public_work_accessible_r20\(uuid\)[\s\S]*?service_role/);
 assert.doesNotMatch(s,/dreamsnap_official_result_account_consent/);
});
test('Source144 F08 preserves all 3 ORs and Source141 FIRST mandatory Incident veto',()=>{
 const m=func(v.source144,'public.community_get_public_media_storage_v2');
 assert.equal((m.match(/\bor exists\(/g)||[]).length,2);
 assert.ok(m.indexOf('perform public.community_preset_storage_assert_media_not_quarantined_r19(p_media_id)')>0);
 assert.ok(m.indexOf('perform public.community_preset_storage_assert_media_not_quarantined_r19(p_media_id)')<m.indexOf('select jsonb_build_object('));
 assert.match(m,/w.work_type='gallery'[\s\S]*?private.is_discoverable_work\(w.work_id\)/);
 assert.equal((m.match(/private\.dreamsnap_public_work_accessible_r20\(w.work_id\)/g)||[]).length,2);
 assert.equal((m.match(/wrm.role='dreamsnap' and wrm.ordinal=0/g)||[]).length,2);
 assert.equal((m.match(/m.owner_account_id=w.owner_account_id/g)||[]).length,2);
 assert.equal((m.match(/e.account_id=w.owner_account_id/g)||[]).length,2);
 assert.equal((m.match(/e.managed_under13=false/g)||[]).length,2);
 assert.match(m,/gp.work_id=e.work_id/);
 assert.match(m,/gp.publication_state='published'/);
 assert.match(m,/dr.integrity_state='eligible'/);
 assert.match(m,/m.processing_state='ready'/);
});
test('Source144 F09 v_wand and v_official guard current pinned Work+ready image before identifier emission',()=>{
 const w=func(v.source144,'public.community_get_dreamsnap_results_public_v1');
 assert.equal((w.match(/private\.dreamsnap_public_work_accessible_r20\(w.work_id\)/g)||[]).length,2);
 assert.match(w,/r.entry_revision_id=e.entry_revision_id/);
 assert.match(w,/cr.work_id=w.work_id/);
 assert.match(w,/m.owner_account_id=w.owner_account_id/);
 assert.match(w,/dr.integrity_state='eligible'/);
 assert.match(w,/e.managed_under13=false/);
 assert.match(w,/and is_synthetic=false/);
 assert.match(w,/private\.dreamsnap_public_official_result\(e.entry_id\) is not null/);
});
test('Source143 untouched: official numbers remain NULL even Account ON, not an image gate',()=>{
 const h=func(v.source143,'private.dreamsnap_public_official_result');
 assert.match(h,/return null;[\s\S]*?return null;/);
 assert.match(h,/v_consent is distinct from true/);
 assert.doesNotMatch(v.source144,/create or replace function private\.dreamsnap_public_official_result/);
 assert.doesNotMatch(v.source144,/community_dreamsnap_set_official_result_publication_v1/);
});
test('reachability: public Media signer service_role post signs 300s only after V2, Results public query routes through V1',()=>{
 const i=v.signer.indexOf("'community_get_public_media_storage_v2'");
 assert.ok(i>=0);
 assert.ok(v.signer.indexOf('createSignedUrl',i)>i);
 assert.match(v.signer,/createSignedUrl\(String\(media\.storageKey\),300\)/);
 assert.match(v.signer,/if \(req\.method === 'GET'\) return reply\(\{ok:false,error:'MEDIA_NOT_GALLERY'\},404\)/);
 assert.match(v.publicQuery,/'community_get_dreamsnap_results_public_v1'/);
 assert.match(v.publicQuery,/private, no-store/);
});
