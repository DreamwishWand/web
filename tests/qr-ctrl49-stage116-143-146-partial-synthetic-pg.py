#!/usr/bin/env python3
"""Targeted partial Stage116 *synthetic reconstruction* of Source143 + Source146.
Not a restored Stage116 clone, not a full 116→153 replay, no external network.
Runs only against a disposable PostgreSQL service. Tests UPDATE, RLS replacement,
rollback on failure, idempotent SQL replay, privacy/public reader fail closed.
"""
import os,psycopg,uuid
from pathlib import Path
assert os.getenv('DDVRE_QR49_SYNTHETIC_ONLY')=='CONFIRMED'
assert os.getenv('DATABASE_URL','')=='' and os.getenv('SUPABASE_ACCESS_TOKEN','')==''
dsn='postgresql://postgres:postgres@127.0.0.1:5432/postgres'
S143=Path('supabase/migrations/20261027000000_d06_dreamsnaps_account_global_official_consent.sql').read_text()
S146=Path('supabase/migrations/20261027000030_generic_public_search_work_liveness_source146.sql').read_text()
def sql(c,q,args=()):return c.execute(q,args).fetchall()
def one(c,q,args=()):return sql(c,q,args)[0][0]
class RollbackFixture(Exception):pass
with psycopg.connect(dsn,autocommit=True) as c:
 c.execute("create role anon nologin")
 c.execute("create role authenticated nologin")
 c.execute("create role service_role nologin")
 c.execute("create schema private")
 c.execute("grant usage on schema private to anon,authenticated")
 c.execute("grant usage on schema public to anon,authenticated")
 c.execute("create table public.wand_accounts (account_id uuid primary key)")
 c.execute("""create table public.dreamsnap_official_result_publication (
   entry_id uuid primary key, public_fields text[] not null default array[]::text[],
   published_at timestamptz,updated_at timestamptz not null default now())""")
 c.execute("""create table public.dreamsnap_entries (
   entry_id uuid primary key,account_id uuid not null,managed_under13 boolean not null,
   entry_state text not null,eligibility_state text not null)""")
 c.execute("""create table public.community_works(
    work_id uuid primary key,work_type text not null,is_discoverable boolean not null,
    is_dreamsnap_r20_live boolean not null)""")
 c.execute("create table public.search_documents(work_id uuid primary key)")
 c.execute("""create function private.is_discoverable_work(p_work_id uuid) returns boolean
  language sql stable security definer set search_path=pg_catalog,public,private as $$
   select w.is_discoverable from public.community_works w where w.work_id=p_work_id $$""")
 c.execute("""create function private.dreamsnap_public_work_accessible_r20(p_work_id uuid) returns boolean
  language sql stable security definer set search_path=pg_catalog,public,private as $$
   select w.is_dreamsnap_r20_live from public.community_works w where w.work_id=p_work_id $$""")
 c.execute("grant execute on function private.is_discoverable_work(uuid),private.dreamsnap_public_work_accessible_r20(uuid) to anon,authenticated")
 c.execute("grant select on public.search_documents to anon,authenticated")
 c.execute("alter table public.search_documents enable row level security")
 c.execute("""create policy search_documents_public_read on public.search_documents
  for select to anon,authenticated using(coalesce(private.is_discoverable_work(work_id),false))""")
 account=uuid.uuid4();e1=uuid.uuid4();e2=uuid.uuid4()
 with c.transaction():
  c.execute("insert into public.wand_accounts values(%s)",(account,))
  c.execute("insert into public.dreamsnap_entries values(%s,%s,false,'entered','eligible')",(e1,account))
  c.execute("insert into public.dreamsnap_entries values(%s,%s,false,'entered','eligible')",(e2,account))
  c.execute("insert into public.dreamsnap_official_result_publication(entry_id,public_fields,published_at) values(%s,array['rank'],now())",(e1,))
  c.execute("insert into public.dreamsnap_official_result_publication(entry_id,public_fields,published_at) values(%s,array['score'],now())",(e2,))
  works=[
   ('gallery',True,False),('gallery',False,True),
   ('dreamsnap',True,False),('dreamsnap',True,True)]
  for kind,old,live in works:
   w=uuid.uuid4()
   c.execute("insert into public.community_works(work_id,work_type,is_discoverable,is_dreamsnap_r20_live) values(%s,%s,%s,%s)",(w,kind,old,live))
   c.execute("insert into public.search_documents(work_id) values(%s)",(w,))
 # Directly observed Stage current search RLS has ONE permissive policy,
 # same name+old predicate; this is a limited synthetic table, NOT a full DB clone.
 def flags():return sql(c,"select entry_id,public_fields,published_at from public.dreamsnap_official_result_publication order by entry_id")
 def expr():return one(c,"select pg_get_expr(polqual,polrelid) from pg_policy where polname='search_documents_public_read' and polrelid='public.search_documents'::regclass")
 def rows_as(role):
  with c.transaction():
   c.execute("set local role "+role)
   return one(c,"select count(*) from public.search_documents")
 baseline=flags()
 assert len(baseline)==2 and all(f[1] and f[2] for f in baseline)
 assert 'is_discoverable_work' in expr()
 assert rows_as('anon')==3 # visible Gallery, both visible DreamSnaps even r20 denies one
 # A failure injected after both scripts must restore flags and policy atomically.
 try:
  with c.transaction():
   c.execute(S143)
   c.execute(S146)
   assert all(not f[1] and f[2] is None for f in flags())
   assert 'generic_public_search_work_accessible_r21' in expr()
   raise RollbackFixture()
 except RollbackFixture:pass
 assert flags()==baseline and 'is_discoverable_work' in expr() and 'generic_public' not in expr()
 assert rows_as('anon')==3
 print('QR49_SYNTHETIC_143_146_FORCED_TRANSACTION_ROLLBACK_OLD_POLICY_AND_FLAGS_RESTORED_PASS',flush=True)
 # Before migration, a second permissive policy would OR leak; abort.
 try:
  with c.transaction():
   c.execute("create policy unexpected_extra_select on public.search_documents for select to anon using(true)")
   assert one(c,"select count(*) from pg_policy where polrelid='public.search_documents'::regclass and polcmd='r' and polpermissive")!=1
   raise RollbackFixture()
 except RollbackFixture:pass
 assert one(c,"select count(*) from pg_policy where polrelid='public.search_documents'::regclass and polcmd='r' and polpermissive")==1
 print('QR49_SYNTHETIC_OR_POLICY_SHADOW_LEAK_GUARD_REJECTS_EXTRA_PERMISSIVE_POLICY_PASS',flush=True)
 # Apply both original Source SQL scripts exactly, not rewritten versions.
 with c.transaction():
  c.execute(S143);c.execute(S146)
 assert all(f[1]==[] and f[2] is None for f in flags())
 assert one(c,"select count(*) from pg_constraint where conname='dreamsnap_legacy_publication_disabled_r20'")==1
 assert 'generic_public_search_work_accessible_r21' in expr()
 assert one(c,"select count(*) from pg_policy where polrelid='public.search_documents'::regclass and polcmd='r' and polpermissive")==1
 assert rows_as('anon')==2 and rows_as('authenticated')==2
 assert one(c,"select count(*) from private.dreamsnap_official_result_account_consent_r20")==0
 assert one(c,"select private.dreamsnap_public_official_result(%s)",(e1,)) is None
 # Old service-role legacy setter never restores positive opt-in.
 try:
  c.execute("select public.community_dreamsnap_set_official_result_publication_v1(%s,%s,array['rank']::text[])",(account,e1))
 except psycopg.Error as e:assert 'D06_LEGACY_PER_ENTRY_OFFICIAL_RESULT_PUBLICATION_DISABLED' in str(e),str(e)
 else:raise AssertionError('legacy setter accepted after Source143')
 # Explicit Owner preference ON is not enough for public result.
 c.execute("insert into private.dreamsnap_official_result_account_consent_r20(account_id,enabled) values(%s,true)",(account,))
 assert one(c,"select private.dreamsnap_public_official_result(%s)",(e1,)) is None
 print('QR49_SYNTHETIC_SOURCE143_OFF_BACKFILL_OLD_SETTER_DISABLED_AND_SOURCE146_RLS_BOUNDARY_PASS',flush=True)
 # Reapplying SQL files in-place is safe for this limited no-live/ no-Stage fixture.
 snapshot=flags()
 with c.transaction():
  c.execute(S143);c.execute(S146)
 assert flags()==snapshot and rows_as('anon')==2 and rows_as('authenticated')==2
 assert one(c,"select count(*) from pg_policy where polrelid='public.search_documents'::regclass and polcmd='r' and polpermissive")==1
 print('QR49_SYNTHETIC_SOURCE143_146_SECOND_APPLY_REPLAY_IDEMPOTENT_PASS',flush=True)
 print('QR49_SYNTHETIC_PARTIAL_STAGE116_OBJECT_RECONSTRUCTION_ONLY_NO_REAL_STAGE_CLONE',flush=True)
