#!/usr/bin/env python3
import json
import os
import psycopg
assert os.getenv('DDVRE_PRIVACY_ISOLATED_LOCAL') == 'CONFIRMED'
assert not os.getenv('DATABASE_URL')
dsn='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
functions=[
 'community_publish_scene_preset_product_v1',
 'community_unpublish_scene_preset_v1',
 'community_delete_scene_preset_v1'
]
refs=[
 'r18-scene-product-deployed-publish','r18-scene-generic-shared-key',
 'r18-scene-product-physical-issuer','r18-scene-lifecycle-issuer',
 'r18-preset-worker-physical-issuer','r18-scene-source-inert-alias'
]
routes=[
 'scene-product-staging-publish','scene-product-staging-unpublish',
 'scene-product-staging-delete','scene-product-staging-failed-compensation',
 'scene-product-staging-discard','scene-product-staging-success-stage-remove',
 'scene-product-source-alias-deny','preset-retention-staging-physical-remove'
]
with psycopg.connect(dsn,autocommit=True) as a,psycopg.connect(dsn,autocommit=True) as b:
 assert a.execute('select pg_backend_pid()').fetchone()[0] != b.execute('select pg_backend_pid()').fetchone()[0]
 for con in (a,b):
  for name in functions:
   rows=con.execute("""
       select p.oid, p.prosecdef,pg_get_function_identity_arguments(p.oid)
       from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.proname=%s
    """,(name,)).fetchall()
   if not rows:
    continue
   for oid,definer,signature in rows:
    assert definer is True
    for role in ('anon','authenticated','service_role'):
     allowed=con.execute('select has_function_privilege(%s,%s,%s)',
            (role,oid,'EXECUTE')).fetchone()[0]
     assert allowed is False,(name,signature,role)
    assert con.execute('select pg_get_functiondef(%s::oid) is not null',(oid,)).fetchone()[0]
  # New Scene Product source is not retroactively deployed: the authority registry distinguishes them.
  for edge in refs:
   row=con.execute("""
      select enrollment_state,mutation_owner,version_contract
      from private.community_writer_reference_registry_r16
      where edge_key=%s""",(edge,)).fetchone()
   assert row is not None,edge
   if edge=='r18-scene-source-inert-alias':
    assert row[0]=='FAIL_CLOSED'
   else:
    assert row[0]=='SOURCE_PRESENT_UNENROLLED',(edge,row)
  for writer in routes:
   row=con.execute("""select enrollment_state,limitation
     from private.community_writer_routes_r16 where writer_key=%s""",(writer,)).fetchone()
   assert row is not None,writer
   expected='FAIL_CLOSED' if writer=='scene-product-source-alias-deny' else 'SOURCE_PRESENT_UNENROLLED'
   assert row[0]==expected,(writer,row)
  gate=con.execute("""select enabled,provider_precondition_accepted
    from private.preset_storage_release_gate_r18
    where gate_key='verified_preset_publication'""").fetchone()
  assert gate==(False,False)
  assert con.execute('select count(*) from private.preset_storage_commit_scope_r18').fetchone()[0]==0
 # Fresh Source136 bootstrap does not include these historically deployed Scene Product functions.
 # Prove the exact Owner migration's name-wide REVOKE with synthetic legacy definitions.
 from pathlib import Path
 source=Path('supabase/migrations/20261025003000_r18_scene_product_publisher_source_closure.sql').read_text()
 start=source.index('do $r18_scene$')
 end=source.index('end;$r18_scene$;',start)+len('end;$r18_scene$;')
 actual_revoker=source[start:end]
 assert 'service_role' in actual_revoker and all(n in actual_revoker for n in functions)
 a.execute('begin')
 try:
  for n in functions:
   a.execute(f"""create function public.{n}(p_auth_subject uuid)
     returns jsonb language sql security definer as
     $$ select '{}'::jsonb $$""")
   a.execute(f"grant execute on function public.{n}(uuid) to service_role,anon,authenticated")
   oid=a.execute("""select p.oid from pg_proc p join pg_namespace n on p.pronamespace=n.oid
        where n.nspname='public' and p.proname=%s""",(n,)).fetchone()[0]
   assert a.execute("select has_function_privilege('service_role',%s,'EXECUTE')",(oid,)).fetchone()[0]
  a.execute(actual_revoker)
  for n in functions:
   oid=a.execute("""select p.oid from pg_proc p join pg_namespace n on p.pronamespace=n.oid
        where n.nspname='public' and p.proname=%s""",(n,)).fetchone()[0]
   for role in ('anon','authenticated','service_role'):
    assert a.execute("select has_function_privilege(%s,%s,'EXECUTE')",(role,oid)).fetchone()[0] is False
 finally:
  a.execute('rollback')
 assert b.execute("""select count(*) from pg_proc p join pg_namespace n on p.pronamespace=n.oid
    where n.nspname='public' and p.proname=any(%s)""",(functions,)).fetchone()[0]==0
 print(json.dumps({'case':'09INT_R18_SOURCE136_ACTUAL_PG_LEGACY_RPC_SYNTHETIC_REVOKE_ROLLBACK_PASS',
  'exactOwnerSQLApplied':True,'freshSourceLegacyFunctionsAbsent':True,
  'deployedStagingOldFunctionsNotModified':True}))
 print(json.dumps({'case':'09INT_R18_SOURCE136_ACTUAL_TWO_POSTGRES_BACKENDS_SCENE_RPC_DENIAL_AND_SEPARATE_WRITER_REGISTRY_PASS',
  'actualPostgreSQL':True,'signedJWT':False,'actualProvider':False,
  'source135PositiveCommitEnabled':False,'newSource136Deployed':False,
  'scopedSeparatePublisherRegistered':True}))
