-- 09 INT source-scoped Staging acceptance. Run as BEGIN/ROLLBACK only.
-- Existing staging golden Gallery Works remain unchanged after rollback.
begin;
do $accept$
declare
 v_id uuid;
 v_before jsonb;
 v_after jsonb;
 v_forged uuid:='00000000-0000-0000-0000-000000000001'::uuid;
 v_denied boolean:=false;
begin
 select work_id into v_id from public.community_works
 where work_type='gallery' order by work_id limit 1;
 if v_id is null then raise exception 'DEPENDENCY_ACCEPTANCE_NO_GALLERY_FIXTURE'; end if;
 v_before:=private.gallery_photo_dependency_snapshot_v1(v_id);
 if v_before->>'coverageContract' <> 'ddv.gallery-cross-product-coverage@1'
   or v_before->>'graphComplete'<>'false'
   or v_before->>'retirementAuthorized'<>'false'
   or v_before->>'issuedSignedUrlRevocationProven'<>'false'
   or length(v_before->>'graphFingerprintSha256')<>64
   or v_before->'coverageClassification'->>'native_listing'<>'REGISTRY_MISSING'
 then raise exception 'DEPENDENCY_ACCEPTANCE_FALSE_POSITIVE'; end if;
 if has_function_privilege('anon','private.gallery_photo_dependency_snapshot_v1(uuid)','EXECUTE')
  or has_function_privilege('authenticated','private.gallery_photo_dependency_snapshot_v1(uuid)','EXECUTE')
  or not has_function_privilege('service_role','private.gallery_photo_dependency_snapshot_v1(uuid)','EXECUTE')
 then raise exception 'DEPENDENCY_ACCEPTANCE_ACL'; end if;
 begin
   perform public.community_gallery_retirement_preflight_v1(v_forged,v_id);
 exception when others then
   if position('GALLERY_RETIREMENT_NOT_OWNER' in sqlerrm)>0
     or position('ACCOUNT' in upper(sqlerrm))>0
   then v_denied:=true; else raise; end if;
 end;
 if not v_denied then raise exception 'DEPENDENCY_ACCEPTANCE_NONOWNER_AUTHORIZED'; end if;
 -- A rolled-back row-version change simulates an obsolete preflight pin.
 update public.community_works set updated_at=now() where work_id=v_id;
 v_after:=private.gallery_photo_dependency_snapshot_v1(v_id);
 if v_before->>'graphFingerprintSha256'=v_after->>'graphFingerprintSha256'
    or (v_after->>'galleryRowVersion')::bigint<=(v_before->>'galleryRowVersion')::bigint
 then raise exception 'DEPENDENCY_ACCEPTANCE_STALE_PIN_UNDETECTED'; end if;
 if v_after->>'retirementAuthorized'<>'false'
 then raise exception 'DEPENDENCY_ACCEPTANCE_GRAPH_WRITE_ENABLED'; end if;
end $accept$;
rollback;
