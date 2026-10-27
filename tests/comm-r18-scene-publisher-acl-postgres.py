#!/usr/bin/env python3
import os
from pathlib import Path
import psycopg
assert os.getenv('DDVRE_PRIVACY_ISOLATED_LOCAL') == 'CONFIRMED' and not os.getenv('DATABASE_URL')
sql=Path('supabase/migrations/20261025003000_r18_scene_product_publisher_source_closure.sql').read_text()
dsn='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
names=[
 'community_publish_scene_preset_product_v1',
 'community_unpublish_scene_preset_v1',
 'community_delete_scene_preset_v1',
]
with psycopg.connect(dsn,autocommit=True) as a,psycopg.connect(dsn,autocommit=True) as b:
 assert a.execute('select pg_backend_pid()').fetchone()[0] != b.execute('select pg_backend_pid()').fetchone()[0]
 before=b.execute('select count(*) from private.community_writer_routes_r16').fetchone()[0]
 a.execute('begin')
 try:
  for name in names:
   existing=a.execute("""select count(*) from pg_proc p join pg_namespace n on p.pronamespace=n.oid
     where n.nspname='public' and p.proname=%s""",(name,)).fetchone()[0]
   assert existing==0,('unexpected real source lifecycle function',name)
   a.execute(f"create function public.{name}() returns text language sql as $$select 'UNSAFE'::text$$")
   a.execute(f"grant execute on function public.{name}() to service_role,authenticated,anon")
  a.execute(sql)
  for name in names:
   for role in ('service_role','authenticated','anon'):
    allowed=a.execute('select has_function_privilege(%s,%s,\'EXECUTE\')',
      (role,'public.'+name+'()')).fetchone()[0]
    assert allowed is False,(name,role,'was not revoked')
  keys=['scene-product-staging-publish','scene-product-staging-unpublish','scene-product-staging-delete',
   'scene-product-staging-failed-compensation','scene-product-staging-discard',
   'scene-product-staging-success-stage-remove','scene-product-source-alias-deny',
   'preset-retention-staging-physical-remove']
  for key in keys:
   state=a.execute('select enrollment_state from private.community_writer_routes_r16 where writer_key=%s',
     (key,)).fetchone()[0]
   assert state == ('FAIL_CLOSED' if key=='scene-product-source-alias-deny' else 'SOURCE_PRESENT_UNENROLLED')
  assert a.execute("select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'").fetchone()[0] is False
  print('03COMM_R18_SCENE_SOURCE_ISSUER_ACL_ROLLBACK_ACCEPTED')
 finally:
  a.execute('rollback')
 assert b.execute('select count(*) from private.community_writer_routes_r16').fetchone()[0] == before
 for name in names:
  assert b.execute("""select count(*) from pg_proc p join pg_namespace n on p.pronamespace=n.oid
    where n.nspname='public' and p.proname=%s""",(name,)).fetchone()[0]==0
 print('03COMM_R18_SCENE_SOURCE_2PG_NO_DURABLE_FIXTURE_CHANGES')
