import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');
const sql = read('supabase/migrations/20261025003050_r19_direct_media_sql_issuer_authority.sql');
const old = read('supabase/migrations/20261003044500_community_dreamsnaps_projection_v1.sql');
const publicDef = source => {
 const begin = source.indexOf('create or replace function public.community_get_public_media_storage_v2(');
 assert.ok(begin>=0);
 return source.slice(begin,source.indexOf('\n$$;',begin)+4);
};
test('direct PUBLIC media SQL inserts a first-statement integrity veto without altering Gallery and DreamSnaps classifications',()=>{
 const delta=publicDef(sql);
 const original=publicDef(old);
 const needle='  perform public.community_preset_storage_assert_media_not_quarantined_r19(p_media_id);\n';
 assert.equal(delta.replace(needle,''), original, 'the historical production SQL classification must remain byte-equivalent');
 assert.ok(delta.indexOf(needle)<delta.indexOf("'storageKey',m.storage_key"));
 assert.match(sql,/revoke all on function public\.community_get_public_media_storage_v2\(uuid\) from public,anon,authenticated,service_role/);
 assert.match(sql,/grant execute on function public\.community_get_public_media_storage_v2\(uuid\) to service_role/);
});
test('owner SQL preserves actual owner/Moderator implementation behind non-executable private legacy and fences the existing public signature',()=>{
 assert.match(sql,/to_regprocedure\('private\.community_gallery_owner_media_read_unfenced_r19\(uuid,uuid\)'\)/);
 assert.match(sql,/alter function public\.community_gallery_owner_media_read_v1\(uuid,uuid\)[\s\S]*?rename to community_gallery_owner_media_read_unfenced_r19/);
 assert.match(sql,/alter function public\.community_gallery_owner_media_read_unfenced_r19\(uuid,uuid\)[\s\S]*?set schema private/);
 assert.match(sql,/revoke all on function private\.community_gallery_owner_media_read_unfenced_r19\(uuid,uuid\)/);
 const pub=sql.slice(sql.indexOf('create or replace function public.community_gallery_owner_media_read_v1('));
 assert.ok(pub.indexOf('perform public.community_preset_storage_assert_media_not_quarantined_r19(p_media_id)') <
   pub.indexOf('return private.community_gallery_owner_media_read_unfenced_r19(p_auth_subject,p_media_id)'));
 assert.match(pub,/revoke all on function public\.community_gallery_owner_media_read_v1\(uuid,uuid\)/);
 assert.match(pub,/grant execute on function public\.community_gallery_owner_media_read_v1\(uuid,uuid\)[\s\S]*?to service_role/);
});
test('Source140 Cover-only, old source migration and all remote physical/positive operations remain unchanged',()=>{
 const prior=read('supabase/migrations/20261025003040_r19_reader_history_graph_gap_closure.sql');
 assert.match(prior,/f\.cover_media_id=p_media_id/);
 assert.doesNotMatch(sql,/storage\.copy\(|storage\.remove\(|physicalDeleteAuthorized=true|provider_precondition_accepted=true|incident_state='RESOLVED'/i);
 const flow=read('.github/workflows/comm-clean-bootstrap-acceptance.yml');
 assert.match(flow,/len\(fs\)==148/);
 assert.match(flow,/MIGRATION_LEDGER_NOT_148/);
 assert.match(flow,/20261025003050_r19_direct_media_sql_issuer_authority\.sql/);
 assert.match(flow,/THIRTY_ONE_ADDITIVE_SOURCE_MIGRATIONS/);
});
