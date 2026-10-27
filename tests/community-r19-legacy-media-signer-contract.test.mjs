import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const old=source('supabase/migrations/20260930082000_community_core_v0_retention_policy.sql');
const delta=source('supabase/migrations/20261025003060_r19_legacy_media_signer_authority.sql');
const extract=s=>{
 const start=s.indexOf('create or replace function public.community_get_media_storage_key(');
 assert.ok(start>=0);
 return s.slice(start,s.indexOf('$$;',start)+3);
};
test('Source142 signer retains original active-account/entity-access/ready/moderation/purge authorization unchanged',()=>{
 const original=extract(old), actual=extract(delta);
 const guard='  perform public.community_preset_storage_assert_media_not_quarantined_r19(p_media_id);\n\n';
 assert.equal(actual.replace(guard,''),original);
 assert.ok(actual.indexOf('private.resolve_active_account')<actual.indexOf('private.can_access_entity'));
 assert.ok(actual.indexOf('private.can_access_entity')<actual.indexOf(guard.trim()));
 assert.ok(actual.indexOf(guard.trim())<actual.indexOf('select * into v_media'));
 assert.ok(actual.indexOf(guard.trim())<actual.indexOf("'storageKey',v_media.storage_key"));
 for(const semantic of ["processing_state='ready'","moderation_state='clear'","purged_at is null","'Media is not READY'"])assert.ok(actual.includes(semantic),semantic);
 assert.match(delta,/revoke all on function public\.community_get_media_storage_key\(uuid,uuid\)[\s\S]*?from public,anon,authenticated,service_role/);
 assert.match(delta,/grant execute on function public\.community_get_media_storage_key\(uuid,uuid\)[\s\S]*?to service_role/);
});
test('Source142 does not alter Source140 history/cover or Source141 two guarded issuers or enable any writer',()=>{
 const prev=source('supabase/migrations/20261025003050_r19_direct_media_sql_issuer_authority.sql');
 const cover=source('supabase/migrations/20261025003040_r19_reader_history_graph_gap_closure.sql');
 assert.match(prev,/perform public\.community_preset_storage_assert_media_not_quarantined_r19\(p_media_id\)/);
 assert.match(prev,/revoke all on function private\.community_gallery_owner_media_read_unfenced_r19/);
 assert.match(cover,/f\.cover_media_id=p_media_id/);
 assert.doesNotMatch(delta,/storage\.copy\(|storage\.remove\(|physicalDeleteAuthorized=true|provider_precondition_accepted=true/i);
 const ci=source('.github/workflows/comm-clean-bootstrap-acceptance.yml');
 assert.match(ci,/len\(fs\)==144/);
 assert.match(ci,/MIGRATION_LEDGER_NOT_144/);
 assert.match(ci,/THIRTY_ONE_ADDITIVE_SOURCE_MIGRATIONS/);
 assert.match(ci,/20261025003060_r19_legacy_media_signer_authority\.sql/);
});
