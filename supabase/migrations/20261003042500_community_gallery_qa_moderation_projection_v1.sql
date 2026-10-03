
create or replace function public.community_moderate_work_v3(
  p_auth_subject uuid,
  p_session_id uuid,
  p_issued_at_epoch bigint,
  p_case_id uuid,
  p_action text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_result jsonb;
  v_work_id uuid;
  v_work public.community_works%rowtype;
  v_title text;
  v_body text;
  v_tags text[];
  v_platform text;
  v_game_version text;
  v_resolution text;
  v_freshness text;
  v_gallery_kind text;
  v_comments_enabled boolean;
begin
  v_result:=public.community_moderate_work_v2(
    p_auth_subject,p_session_id,p_issued_at_epoch,p_case_id,p_action,p_reason
  );
  v_work_id:=(v_result->>'workId')::uuid;

  if p_action='restore' then
    select * into v_work from public.community_works where work_id=v_work_id;

    if v_work.work_type='gallery' then
      select gr.title,coalesce(gr.description,''),g.gallery_kind,coalesce(gs.comments_enabled,true)
      into v_title,v_body,v_gallery_kind,v_comments_enabled
      from public.gallery_works g
      join public.gallery_work_revisions gr
        on gr.revision_id=v_work.current_published_revision_id
      left join public.gallery_work_settings gs on gs.work_id=v_work.work_id
      where g.work_id=v_work.work_id;

      insert into public.search_documents(
        entity_id,work_id,work_type,creator_profile_id,title,text_content,tags,facets,published_at,updated_at
      ) values(
        v_work_id,v_work_id,'gallery',v_work.creator_profile_id,v_title,v_body,
        array[]::text[],
        jsonb_build_object('galleryKind',v_gallery_kind,'commentsEnabled',v_comments_enabled),
        v_work.published_at,now()
      ) on conflict(entity_id) do update set
        creator_profile_id=excluded.creator_profile_id,
        title=excluded.title,
        text_content=excluded.text_content,
        tags=excluded.tags,
        facets=excluded.facets,
        published_at=excluded.published_at,
        updated_at=now();

    elsif v_work.work_type='question' then
      select qr.title,qr.body,qr.context_tags,qr.platform,qr.game_version,
             qs.resolution_state,qs.freshness
      into v_title,v_body,v_tags,v_platform,v_game_version,v_resolution,v_freshness
      from public.qa_question_revisions qr
      join public.qa_question_state qs on qs.work_id=v_work.work_id
      where qr.revision_id=v_work.current_published_revision_id;

      if v_freshness='current' then
        insert into public.search_documents(
          entity_id,work_id,work_type,creator_profile_id,title,text_content,tags,facets,published_at,updated_at
        ) values(
          v_work_id,v_work_id,'question',v_work.creator_profile_id,v_title,v_body,v_tags,
          jsonb_strip_nulls(jsonb_build_object(
            'freshness',v_freshness,'resolutionState',v_resolution,
            'platform',v_platform,'gameVersion',v_game_version
          )),v_work.published_at,now()
        ) on conflict(entity_id) do update set
          creator_profile_id=excluded.creator_profile_id,
          title=excluded.title,text_content=excluded.text_content,tags=excluded.tags,
          facets=excluded.facets,published_at=excluded.published_at,updated_at=now();
      else
        delete from public.search_documents where entity_id=v_work_id;
      end if;

    elsif v_work.work_type='tip' then
      select tr.title,tr.body,tr.context_tags,tr.platform,tr.game_version,ts.freshness
      into v_title,v_body,v_tags,v_platform,v_game_version,v_freshness
      from public.qa_tip_revisions tr
      join public.qa_tip_state ts on ts.work_id=v_work.work_id
      where tr.revision_id=v_work.current_published_revision_id;

      if v_freshness='current' then
        insert into public.search_documents(
          entity_id,work_id,work_type,creator_profile_id,title,text_content,tags,facets,published_at,updated_at
        ) values(
          v_work_id,v_work_id,'tip',v_work.creator_profile_id,v_title,v_body,v_tags,
          jsonb_strip_nulls(jsonb_build_object(
            'freshness',v_freshness,'platform',v_platform,'gameVersion',v_game_version
          )),v_work.published_at,now()
        ) on conflict(entity_id) do update set
          creator_profile_id=excluded.creator_profile_id,
          title=excluded.title,text_content=excluded.text_content,tags=excluded.tags,
          facets=excluded.facets,published_at=excluded.published_at,updated_at=now();
      else
        delete from public.search_documents where entity_id=v_work_id;
      end if;
    end if;
  end if;

  return v_result;
end
$$;

revoke execute on function public.community_moderate_work_v3(uuid,uuid,bigint,uuid,text,text)
from public,anon,authenticated;
grant execute on function public.community_moderate_work_v3(uuid,uuid,bigint,uuid,text,text)
to service_role;
