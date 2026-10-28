#!/usr/bin/env python3
"""CTRL49 independent read-only Stage-managed ledger vs immutable Source153 Git tree.
No database, credentials, Supabase connection, secrets or data. Fail closed on drift.
This is NOT a Stage116-to-153 migration executor or a protected clone.
"""
import json,re,subprocess,pathlib,collections,hashlib,sys
root=pathlib.Path(__file__).resolve().parents[1]
path=root/'docs/qa/evidence/qr-ctrl49-stage116-source153-ledger-20261029.json'
j=json.loads(path.read_text())
stage=j['stageLedger'];source=j['sourceGitTree']
assert j['sourceOwnerHead']=='b24eec2cb4dae4ab30824636670c520d7c6eea40'
assert j['evidenceKind']=='LIVE_STAGE_MANAGEMENT_LEDGER_METADATA_ONLY'
assert len(stage)==j['stageCount']==116
assert len(source)==j['sourceCount']==153
assert all(re.fullmatch(r'\d{12,14}',x['version']) for x in stage+source)
assert len({x['version'] for x in stage})==116
assert len({x['version'] for x in source})==153
assert len({x['path'] for x in source})==153
for row in source:
 f=root/row['path']
 assert f.exists(),row['path']
 assert f.name==row['version']+'_'+row['name']+'.sql'
 assert subprocess.check_output(['git','hash-object',str(f)],cwd=root,text=True).strip()==row['blob'],f
names_by_version={x['version']:x for x in source}
source_name=set(x['name'] for x in source)
stage_name=set(x['name'] for x in stage)
stage_version={x['version'] for x in stage}
exact=[x for x in stage if names_by_version.get(x['version'],{}).get('name')==x['name']]
version_conflict=[x for x in stage if x['version'] in names_by_version and names_by_version[x['version']]['name']!=x['name']]
stage_only=[x for x in stage if x['name'] not in source_name and x['version'] not in names_by_version]
version_remap=[x for x in stage if x['name'] in source_name and x['version'] not in names_by_version]
source_only=[x for x in source if x['name'] not in stage_name and x['version'] not in stage_version]
shared_source=[x for x in source if x['name'] in stage_name and x['version'] not in stage_version]
counts=collections.Counter(x['name'] for x in stage)
duplicate_names={k:v for k,v in counts.items() if v>1}
assert (len(exact),len(version_conflict),len(stage_only),len(version_remap),len(source_only),len(shared_source))==(23,0,5,88,46,84)
assert sum([len(exact),len(version_conflict),len(stage_only),len(version_remap)])==len(stage)
assert sum([len(exact),len(source_only),len(shared_source)])==len(source)
assert len(duplicate_names)==4 and set(duplicate_names.values())=={2}
assert stage[-1]=={'version':'20261024043436','name':'gallery_known_reference_writer_fence_v1'}
must_absent=[
'community_core_v0_provider_cleanup_scheduler_auth',
'community_core_v0_provider_cleanup_scheduler_setup',
'community_core_v0_operations_alerts',
'community_core_v0_safe_identity_bootstrap',
'provider_identity_cleanup_parent_bootstrap_v1']
assert all(x in {r['name'] for r in source_only} for x in must_absent)
last=source[-11:]
expected_names=[
'd06_dreamsnaps_account_global_official_consent',
'f08_f09_dreamsnap_public_work_liveness',
'legacy_dreamsnap_gallery_public_reader_liveness',
'generic_public_search_work_liveness_source146',
'x05_shared_dreamsnap_metadata_staged_v1',
'x05_post_event_staged_liveness_immutable_guard',
'x05_nonpublic_consent_phase_revoke_controls',
'x05_authenticated_owner_service_v1',
'x05_private_pregrant_policy_receipt_v1',
'x05_first_work_media_bootstrap_v1',
'x05_authoritative_owner_projection_v2']
assert [x['name'] for x in last]==expected_names
assert all(x in source_only for x in last)
texts=[(root/x['path']).read_text() for x in last]
assert 'update public.dreamsnap_official_result_publication' in texts[0].lower()
assert "set public_fields=array[]::text[],published_at=null" in texts[0].replace('\n','').lower()
assert 'drop constraint if exists dreamsnap_legacy_publication_disabled_r20' in texts[0].lower()
assert 'D06_LEGACY_PER_ENTRY_OFFICIAL_RESULT_PUBLICATION_DISABLED' in texts[0]
assert 'return null;' in texts[0]
assert texts[3].lower().count('drop policy if exists search_documents_public_read')==1
assert texts[3].lower().count('create policy search_documents_public_read')==1
assert 'private.dreamsnap_public_work_accessible_r20' in texts[3]
assert 'private.is_discoverable_work' in texts[3]
assert 'grant execute on function private.generic_public_search_work_accessible_r21' in texts[3]
assert 'create table private.dreamsnap_post_event_staged_v1' in texts[4]
assert "check (publication_state = 'staged')" in texts[4]
assert 'create trigger x05_post_event_stage_guard' in texts[4]
assert 'create or replace function private.dreamsnap_post_event_stage_validate_v1' in texts[5]
assert 'create table private.dreamsnap_x05_consent_events_v1' in texts[6]
assert 'create or replace function private.dreamsnap_x05_public_activation_v1' in texts[6].lower() and 'select false' in texts[6].lower()
assert 'alter function public.validate_current_published_revision() security definer' in texts[7]
assert 'create trigger dreamsnap_x05_policy_activation_receipt_gate' in texts[8]
assert 'create or replace function public.community_dreamsnap_x05_register_initial_work_v1' in texts[9]
assert 'create or replace function public.community_dreamsnap_x05_owner_authority_v2' in texts[10]
assert all('drop table public.' not in t.lower() for t in texts)
# A management migration ledger never contains applied SQL-body checksums: this is
# deliberately NOT interpreted as exact SQL parity.
report={'classification':'CONFIRMED_LEDGER_VERSION_NAME_ONLY',
 'stageCount':len(stage),'sourceCount':len(source),
 'exactVersionAndName':len(exact),'sameNameDifferentStageVersionRows':len(version_remap),
 'stageOnly':stage_only,'stageDuplicateNames':duplicate_names,
 'sourceOnlyCount':len(source_only),'sourceOnly':source_only,
 'versionNameCollisions':version_conflict,
 'historicalSQLBodyEquality':'NOT_VERIFIED','actualStage116ProtectedClone':'NOT_AVAILABLE',
 'safeAutomaticApplyAllowed':False,'gateA5':'NEED_OPERATOR_AND_SEMANTIC_RECONCILIATION'}
print(json.dumps(report,sort_keys=True,indent=2))
print('QR_CTRL49_STAGE116_SOURCE153_REAL_LEDGER_CLASSIFICATION_AND_FROZEN_11_SQL_STATIC_PASS')
