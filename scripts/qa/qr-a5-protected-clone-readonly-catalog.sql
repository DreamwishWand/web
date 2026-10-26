-- 04 QR A5 — read-only semantic catalog inventory FOR APPROVED OFFLINE CLONES ONLY.
-- Human-protected historical Stage116 clone versus reviewed 116→142 candidate clone.
-- NEVER execute DDL/DML, export data rows, or treat these hashes as runtime bundle SHA.
-- Does not inspect Storage object bytes, legal holds, or signed URLs.
begin transaction isolation level repeatable read read only;
with routines as (
 select n.nspname as schema_name,p.proname as function_name,
 pg_get_function_identity_arguments(p.oid) as arguments,
 p.prosecdef as security_definer,
 encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') as definition_sha256,
 has_function_privilege('service_role',p.oid,'EXECUTE') as service_role_execute,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
 has_function_privilege('public',p.oid,'EXECUTE') as public_execute
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','private')
   and (p.proname like 'community_%' or p.proname like 'wep_%'
     or p.proname like 'preset_storage_%' or p.proname like 'gallery_%'
     or p.proname like 'guard_%')
), relations as (
 select n.nspname as schema_name,c.relname as relation_name,c.relkind as kind,c.relrowsecurity as rls_enabled,
 c.relforcerowsecurity as rls_forced,
 has_table_privilege('service_role',c.oid,'SELECT') as service_select,
 has_table_privilege('anon',c.oid,'SELECT') as anon_select,
 has_table_privilege('authenticated',c.oid,'SELECT') as authenticated_select
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('public','private') and c.relkind in ('r','p','v','m')
), triggers as (
 select n.nspname as schema_name,c.relname as table_name,t.tgname as trigger_name,
 t.tgenabled as enabled,encode(sha256(convert_to(pg_get_triggerdef(t.oid),'UTF8')),'hex') as definition_sha256
 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
 where not t.tgisinternal and n.nspname in ('public','private')
), policies as (
 select n.nspname as schema_name,c.relname as table_name,p.polname as policy_name,
 p.polcmd as command, p.polpermissive as permissive,
 encode(sha256(convert_to(coalesce(pg_get_expr(p.polqual,p.polrelid),'')||'|'||
   coalesce(pg_get_expr(p.polwithcheck,p.polrelid),''),'UTF8')),'hex') as expression_sha256
 from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('public','private')
)
select jsonb_pretty(jsonb_build_object(
 'contract','ddvre.qr.a5-semantic-catalog@1',
 'source','PROTECTED_CLONE_CATALOG_NOT_STAGING',
 'collected_at_utc',clock_timestamp(),
 'routines',(select coalesce(jsonb_agg(to_jsonb(r) order by r.schema_name,r.function_name,r.arguments),'[]'::jsonb) from routines r),
 'relations',(select coalesce(jsonb_agg(to_jsonb(r) order by r.schema_name,r.relation_name),'[]'::jsonb) from relations r),
 'triggers',(select coalesce(jsonb_agg(to_jsonb(t) order by t.schema_name,t.table_name,t.trigger_name),'[]'::jsonb) from triggers t),
 'policies',(select coalesce(jsonb_agg(to_jsonb(p) order by p.schema_name,p.table_name,p.policy_name),'[]'::jsonb) from policies p)
)) as qr_gate_a5_catalog_json;
commit;
