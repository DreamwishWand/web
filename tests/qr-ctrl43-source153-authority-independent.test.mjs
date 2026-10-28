import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const get=p=>readFileSync(p);
const digest=p=>{const b=get(p);return createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex')};
const sql=get('supabase/migrations/20261028000060_x05_authoritative_owner_projection_v2.sql').toString();
const edge=get('supabase/functions/community-dreamsnap-owner/index.ts').toString();
test('fixed ADDITIVE Source153 SQL/Edge blobs, 153 migration inventory and immutable Source152',()=>{
 assert.equal(digest('supabase/migrations/20261028000060_x05_authoritative_owner_projection_v2.sql'),'356cc10138cd351674fde8dd943acc968e26fbbc');
 assert.equal(digest('supabase/functions/community-dreamsnap-owner/index.ts'),'38f6830b88eb37dc612cbc11901812a90b406146');
 assert.equal(digest('supabase/migrations/20261028000050_x05_first_work_media_bootstrap_v1.sql'),'cd297f48111afbb315651c6cb7e911afb1bcc03d');
 const files=readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).sort();
 assert.equal(files.length,153);assert.equal(files.at(-1),'20261028000060_x05_authoritative_owner_projection_v2.sql');
 assert.equal(new Set(files.map(x=>x.split('_')[0])).size,153);
});
test('RPC must derive identity, creator and exact per-Work revision/media and lock all',()=>{
 for(const s of ['private.dreamsnap_x05_verified_db_subject_v1()','private.resolve_active_account(v_subject)',
 'v_work.owner_account_id is distinct from v_account','v_control.creator_profile_id is distinct from v_work.creator_profile_id',
 'private.is_account_privacy_suppressed(v_account)','for share of cp,ce',
 'wrm.work_revision_id=r.revision_id','r.work_id=p_work_id','wrm.media_id=v_control.frozen_media_id',
 'm.owner_account_id=v_account','v_control.frozen_photo_revision_id',
 'v_work.current_published_revision_id is distinct from v_control.concept_revision_id',
 "e.entry_state='entered'","e.eligibility_state='eligible'","st.publication_state='staged'",
 "v_last_grant.event_version>v_control.row_version", "e.action='grant'",
 'private.preset_storage_work_quarantined_r19','private.preset_storage_media_quarantined_r19',
 'private.account_retention_holds'])assert.ok(sql.includes(s),s);
 assert.match(sql,/security definer/);
 assert.match(sql,/revoke all on function public\.community_dreamsnap_x05_owner_authority_v2\(uuid,bigint,bigint\)[\s\S]*?from public,anon,authenticated,service_role/);
 assert.match(sql,/grant execute on function public\.community_dreamsnap_x05_owner_authority_v2\(uuid,bigint,bigint\)[\s\S]*?to authenticated/);
 assert.doesNotMatch(sql,/\bp_actor_account_id\b|\bp_media_id\b|\bp_creator_id\b|\bp_auth_subject\b/);
});
test('No fabricated Policy permissions, global deletion proof or secret-bearing owner response',()=>{
 for(const s of ["'UNVERIFIED'","'APPROVED_CANONICAL_RECEIPT'",
 'encode(pg_catalog.sha256(convert_to(r.canonical_text,\'UTF8\')),\'hex\')=v_policy.policy_digest',
 "'scopeId',case when v_policy_valid","'approvedPurposeIds',case when v_policy_valid",
 "'publicUsageAuthorized',false","'globalPurgeScopeComplete',false",
 "'cloudCdnIssuedBearerStatus','UNKNOWN'","'localProviderScope','SINGLE_FROZEN_MEDIA_RECORD'",
 "'signedRuntimeSessionVerified',false","'storageProviderObjectVerified',false",
 "'cloudCdnPhysicalPurgeVerified',false","'publicActivationAllowed',false",
 "'ownerActionsEnabled',false","'mediaSigner',false",
 "'consumerTarget','wand.dreamsnaps.private-owner-consumer@2'"])assert.ok(sql.includes(s),s);
 assert.doesNotMatch(sql,/storage_key|signedUrl|ownerAccountId|cdnUrl|serviceKey/);
 const p=JSON.parse(get('docs/community/policy/dreamsnap-image-grant-v1.candidate.json').toString());
 assert.equal(p.approved,false);assert.equal(p.activateRegistry,false);
 assert.equal(p.sha256,'2c4e78e46345a3d230a304d74086aa49b66700396acca91bf6280cd6f938d0cb');
});
test('Edge authority operation exact allowlist, authenticated session, private no-store and guarded contract',()=>{
 assert.match(edge,/withSupabase\(\{auth:'user'\}/);
 assert.match(edge,/ctx\.supabaseAdmin\.rpc\('community_authorize_session'/);
 assert.match(edge,/if\(v\.operation==='authority'\)/);
 assert.match(edge,/exact\(v,\['operation','workId','expectedRowVersion','expectedAuthorizationEpoch'\]/);
 assert.match(edge,/community_dreamsnap_x05_owner_authority_v2/);
 assert.match(edge,/work\.workId!==body\.workId/);
 assert.match(edge,/g\.mediaId!==work\.photoMediaId/);
 assert.match(edge,/g\.photoRevisionId!==work\.photoRevisionId/);
 assert.match(edge,/g\.publicUsageAuthorized!==false/);
 assert.match(edge,/d\.globalPurgeScopeComplete!==false/);
 assert.match(edge,/AUTHORITY_PROJECTION_UNSUPPORTED/);
 for(const s of ["'Cache-Control':'private, no-store, max-age=0'","'CDN-Cache-Control':'no-store'","'Surrogate-Control':'no-store'","'Vary':'Authorization, Origin'"])assert.ok(edge.includes(s));
 assert.match(get('supabase/config.toml').toString(),/\[functions\.community-dreamsnap-owner\][\s\S]*?verify_jwt\s*=\s*true/);
 // Externally supplied account/role/media/scope cannot enter authority RPC body.
 const part=edge.slice(edge.indexOf("if(v.operation==='authority')"),edge.indexOf("if(v.operation==='register')"));
 for(const s of ['accountId','authSubject','creatorProfileId','mediaId','policyDigest','grant','scope','role'])assert.ok(!part.includes(s),s);
});
