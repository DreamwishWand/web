create or replace function public.community_set_gallery_comments_enabled_v2(
  p_auth_subject uuid,
  p_work_id uuid,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_type public.work_type;
  v_managed boolean:=false;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  select work_type into v_type
  from public.community_works
  where work_id=p_work_id and owner_account_id=v_account_id;
  if v_type is null or v_type not in ('gallery','dreamsnap') then
    raise exception 'Actor does not own a Gallery-compatible Work';
  end if;

  if v_type='gallery' then
    raise exception 'R17_LEGACY_GALLERY_COMMENTS_PIN_REQUIRED';
  end if;

  select e.managed_under13 into v_managed
  from public.dreamsnap_gallery_publications gp
  join public.dreamsnap_entries e on e.entry_id=gp.entry_id
  where gp.work_id=p_work_id and gp.publication_state='published';

  if v_managed and p_enabled then
    raise exception 'Comments are disabled for this Work';
  end if;

  p_enabled:=case when v_managed then false else p_enabled end;

  update public.dreamsnap_gallery_publications
  set comments_enabled=p_enabled,updated_at=now()
  where work_id=p_work_id and publication_state='published';

  if not found then raise exception 'DreamSnaps Gallery publication not found'; end if;

  update public.search_documents
  set facets=facets || jsonb_build_object('commentsEnabled',p_enabled),updated_at=now()
  where work_id=p_work_id;

  insert into public.audit_events(actor_account_id,action_type,target_entity_id,metadata)
  values(v_account_id,'gallery.comments_enabled',p_work_id,jsonb_build_object('enabled',p_enabled));

  return jsonb_build_object('workId',p_work_id,'commentsEnabled',p_enabled);
end
$$;