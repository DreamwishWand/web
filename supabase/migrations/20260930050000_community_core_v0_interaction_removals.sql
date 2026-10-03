
create or replace function public.community_unsave_entity(
  p_auth_subject uuid,
  p_target_entity_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_account_id uuid;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);

  delete from public.saved_items
  where account_id=v_account_id
    and target_entity_id=p_target_entity_id;

  return jsonb_build_object(
    'targetEntityId',p_target_entity_id,
    'saved',false
  );
end;
$$;

create or replace function public.community_unfollow_creator(
  p_auth_subject uuid,
  p_creator_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_account_id uuid;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);

  delete from public.follows
  where follower_account_id=v_account_id
    and creator_profile_id=p_creator_profile_id;

  return jsonb_build_object(
    'creatorProfileId',p_creator_profile_id,
    'following',false
  );
end;
$$;

create or replace function public.community_remove_reaction(
  p_auth_subject uuid,
  p_target_entity_id uuid,
  p_reaction_kind text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_account_id uuid;
  v_deleted boolean := false;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);

  delete from public.reactions
  where account_id=v_account_id
    and target_entity_id=p_target_entity_id
    and reaction_kind=p_reaction_kind
  returning true into v_deleted;

  if coalesce(v_deleted,false) then
    insert into public.outbox_events(
      aggregate_type,aggregate_id,event_type,payload,dedupe_key
    ) values (
      'community_entity',
      p_target_entity_id,
      'reaction.removed',
      jsonb_build_object(
        'targetEntityId',p_target_entity_id,
        'actorAccountId',v_account_id,
        'reactionKind',p_reaction_kind
      ),
      'reaction.removed:' || v_account_id::text || ':' ||
        p_target_entity_id::text || ':' || p_reaction_kind
    )
    on conflict (dedupe_key) do nothing;
  end if;

  return jsonb_build_object(
    'targetEntityId',p_target_entity_id,
    'reactionKind',p_reaction_kind,
    'reacted',false
  );
end;
$$;

revoke execute on function public.community_unsave_entity(uuid,uuid)
from public, anon, authenticated;
revoke execute on function public.community_unfollow_creator(uuid,uuid)
from public, anon, authenticated;
revoke execute on function public.community_remove_reaction(uuid,uuid,text)
from public, anon, authenticated;

grant execute on function public.community_unsave_entity(uuid,uuid)
to service_role;
grant execute on function public.community_unfollow_creator(uuid,uuid)
to service_role;
grant execute on function public.community_remove_reaction(uuid,uuid,text)
to service_role;
