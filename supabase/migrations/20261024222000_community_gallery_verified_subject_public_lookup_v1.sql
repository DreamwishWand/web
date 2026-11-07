-- 03-COMM-GALLERY-RETIREMENT-MEDIA-CLOUD-CONTRACT-V1
-- Read-only, service-only projection. Existing gallery_verified_subjects is 09 INT-owned.
-- Never expose direct anon/authenticated registry SQL.
create or replace function public.community_list_verified_gallery_subjects_v1(
  p_gallery_kind text default null,
  p_limit integer default 50
) returns jsonb language plpgsql stable security invoker
set search_path=pg_catalog,public
as $$
declare v_subjects jsonb;
begin
  if p_gallery_kind is not null
     and p_gallery_kind not in ('outdoor','indoor','tom_furniture','tom_clothing') then
    raise exception 'GALLERY_SUBJECT_KIND_INVALID';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'GALLERY_SUBJECT_LIMIT_INVALID';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'subjectId',s.subject_id,
    'galleryKind',s.gallery_kind,
    'subjectType',s.subject_type,
    'canonicalTargetId',s.canonical_target_id,
    'baseItemId',s.base_item_id,
    'platform',s.platform,
    'gameVersion',s.game_version,
    'buildId',s.build_id,
    'profileSchema',s.profile_schema,
    'displayIdentity',case
      when s.subject_type='floating_island' then 'SceneItemId '||s.canonical_target_id
      else s.canonical_target_id end,
    'displayName',null,
    'verificationState',s.verification_state,
    'evidenceRef',s.evidence_ref
  ) order by s.subject_type,s.canonical_target_id,s.subject_id),'[]'::jsonb)
  into v_subjects from (
    select * from public.gallery_verified_subjects
    where verification_state='verified'
      and (p_gallery_kind is null or gallery_kind=p_gallery_kind)
    order by subject_type,canonical_target_id,subject_id
    limit p_limit
  ) s;
  return jsonb_build_object(
    'contract','ddv.gallery-verified-subject-public-lookup@1',
    'subjects',v_subjects,
    'catalogStatus','partial_verified_only',
    'displayNamesVerified',false
  );
end $$;
revoke all on function public.community_list_verified_gallery_subjects_v1(text,integer)
  from public,anon,authenticated;
grant execute on function public.community_list_verified_gallery_subjects_v1(text,integer) to service_role;
