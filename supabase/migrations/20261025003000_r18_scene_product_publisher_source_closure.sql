do $r18_scene$
declare v record;
begin
  for v in
    select p.oid::regprocedure as signature
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in (
        'community_publish_scene_preset_product_v1',
        'community_unpublish_scene_preset_v1',
        'community_delete_scene_preset_v1'
      )
  loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',v.signature);
  end loop;
end;$r18_scene$;

insert into private.community_writer_reference_registry_r16
(edge_key,source_relation,target_relation,identity_contract,owner_contract,time_scope,direction,mutation_owner,lock_scope,version_contract,privacy_visibility,enrollment_state,evidence_class)
values
('r18-scene-product-deployed-publish','STAGING ACTIVE wep-scene-preset-product v1 / community_publish_scene_preset_product_v1','WEP Preset published Storage + Scene Work','account/idempotency -> deterministic SHA256 key; cross-alias identity UNPROVEN','Account/Creator','BOTH','PUBLISHES','STAGING_DEPLOYED_NOT_SOURCE_ENROLLED','NO BEFORE_COPY LEASE OR PROVIDER ATTESTATION','Existing staged Copy before SQL registration','PUBLICATION_RISK','SOURCE_PRESENT_UNENROLLED','CONFIRMED'),
('r18-scene-generic-shared-key','wep-scene-preset-product v1 + wep-preset-artifact v14','published/{account}/{SHA256(account:idempotency)}.json','Shared namespace collision; no shared Storage CAS authority','Account','BOTH','SHARES_PUBLISHED_KEY','TWO_STAGING_EDGE_ISSUERS','NO PROVEN CROSS_ENDPOINT_FENCE','Reservation Source135 NOT DEPLOYED TO STAGING','PUBLICATION_RISK','SOURCE_PRESENT_UNENROLLED','HIGH CONFIDENCE'),
('r18-scene-product-physical-issuer','STAGING scene product failed-SQL compensation + stage discard/success cleanup','WEP Preset Storage.remove','Storage key / active publication and historical reference identity UNKNOWN','UNKNOWN','BOTH','DELETES_STORAGE','STAGING_DEPLOYED_NOT_SOURCE_ENROLLED','NO SHARED CLEANUP CLAIM','Delete on failed SQL after prior Copy is unsafe','PHYSICAL_DELETE_RISK','SOURCE_PRESENT_UNENROLLED','CONFIRMED'),
('r18-scene-lifecycle-issuer','public.community_unpublish_scene_preset_v1 + community_delete_scene_preset_v1','Scene/Preset Work and historical references','Owner/Creator/Moderator current and history must be revalidated','Account/Creator','BOTH','RETIRES','STAGING_DEPLOYED_NOT_SOURCE_ENROLLED','UNKNOWN GRAPH AND HISTORY LOCKS','Source SQL revokes service grants; deployment unknown','RETIREMENT_OFF','SOURCE_PRESENT_UNENROLLED','CONFIRMED'),
('r18-preset-worker-physical-issuer','STAGING ACTIVE wep-preset-retention v6','Storage.remove + community_finalize_artifact_blob_purge','worker claim/token != Storage deletion permit','Worker/Legal','BOTH','DELETES_STORAGE','STAGING_DEPLOYED_NOT_SOURCE_ENROLLED','NO SHARED FENCED CLEANUP CLAIM','Source135 retention returns 409, staging not switched','PHYSICAL_DELETE_RISK','SOURCE_PRESENT_UNENROLLED','CONFIRMED'),
('r18-scene-source-inert-alias','supabase/functions/wep-scene-preset-product/index.ts','NO published copy, NO cleanup, NO positive lifecycle RPC','Authenticated session only; no positive authorizations','Account','BOTH','DENIES_UNENROLLED_WRITES','03 COMM SOURCE ALIAS','NO STORAGE ACTIONS','Terminal 409 before copy/remove','SOURCE_ONLY','FAIL_CLOSED','CONFIRMED')
on conflict(edge_key) do update set
  enrollment_state=excluded.enrollment_state,
  version_contract=excluded.version_contract,
  lock_scope=excluded.lock_scope;

insert into private.community_writer_routes_r16
(writer_key,source_rpc,edge_call_site,enrollment_state,lock_scope,graph_registry,optimistic_contract,retry_contract,limitation)
values
('scene-product-staging-publish','public.community_publish_scene_preset_product_v1','STAGING ACTIVE wep-scene-preset-product v1.publish','SOURCE_PRESENT_UNENROLLED','COPY BEFORE SQL; NEVER CONSIDER PROTECTED','r18-scene-deployed-issuer@source136','NO SHARED RESERVATION','NONE','Source SQL service grant revoked; historical deployed Edge still does Copy before denied RPC'),
('scene-product-staging-unpublish','public.community_unpublish_scene_preset_v1','STAGING ACTIVE wep-scene-preset-product v1.unpublish','SOURCE_PRESENT_UNENROLLED','UNKNOWN historical references','r18-scene-deployed-issuer@source136','UNVERIFIED','NONE','Source service grant revoked; deployed SQL/Edge must be reconciled'),
('scene-product-staging-delete','public.community_delete_scene_preset_v1','STAGING ACTIVE wep-scene-preset-product v1.delete','SOURCE_PRESENT_UNENROLLED','UNKNOWN legal/cloud/current+historical references','r18-scene-deployed-issuer@source136','UNVERIFIED','NONE','Source service grant revoked; deployed SQL/Edge must be reconciled'),
('scene-product-staging-failed-compensation','NO RPC; Storage.remove(published key)','STAGING ACTIVE wep-scene-preset-product v1 failed SQL compensation','SOURCE_PRESENT_UNENROLLED','NO CLEANUP AUTHORITY','r18-scene-deployed-issuer@source136','NO OBJECT_IDENTITY CAS','NONE','Can delete competing same-key winner; source SQL revoke alone DOES NOT stop this'),
('scene-product-staging-discard','NO RPC; Storage.remove(staging key)','STAGING ACTIVE wep-scene-preset-product v1.discard','SOURCE_PRESENT_UNENROLLED','NO SHARED CLAIM','r18-scene-deployed-issuer@source136','NO GLOBAL REFERENCE SNAPSHOT','NONE','Physical stage deletion remains active until approved Edge switch'),
('scene-product-staging-success-stage-remove','NO RPC; Storage.remove(staging key)','STAGING ACTIVE wep-scene-preset-product v1 publish success','SOURCE_PRESENT_UNENROLLED','NO SHARED CLAIM','r18-scene-deployed-issuer@source136','NO LEASED FINALIZATION','NONE','Historical Edge removes staging key after SQL success'),
('scene-product-source-alias-deny','NONE','wep-scene-preset-product SOURCE stub all actions','FAIL_CLOSED','NO WRITES','r18-scene-source-alias@source136','NONE','TERMINAL_409','Source-only until protected Operator rollout'),
('preset-retention-staging-physical-remove','wep_get_claimed_retention_artifact_blobs / community_finalize_artifact_blob_purge','STAGING ACTIVE wep-preset-retention v6','SOURCE_PRESENT_UNENROLLED','NO PRESERVED CONCURRENT REFERENCE CLAIM','r18-shared-preset-cleanup@source136','NOT ENROLLED','NONE','Source135 retention disabled; Stage v6 still physical remove')
on conflict(writer_key) do update set
  enrollment_state=excluded.enrollment_state,
  limitation=excluded.limitation;

do $r18_scene_verify$
declare v record;
begin
  for v in
    select p.oid as function_oid,p.oid::regprocedure as signature
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in (
        'community_publish_scene_preset_product_v1',
        'community_unpublish_scene_preset_v1',
        'community_delete_scene_preset_v1'
      )
  loop
    if has_function_privilege('service_role',v.function_oid,'EXECUTE')
      or has_function_privilege('authenticated',v.function_oid,'EXECUTE')
      or has_function_privilege('anon',v.function_oid,'EXECUTE') then
      raise exception 'R18_SCENE_LIFECYCLE_WRITER_EXECUTE_REMAINS_EXPOSED: %',v.signature;
    end if;
  end loop;
end;$r18_scene_verify$;
