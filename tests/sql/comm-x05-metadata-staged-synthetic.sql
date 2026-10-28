-- X05 synthetic/local PostgreSQL test. Legacy Source144/145 here are
-- *STUBS*: this tests the NEW delta only, NOT historic SQL or signed runtime.
\set ON_ERROR_STOP on
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema private;

create table public.community_works(
  work_id uuid primary key, owner_account_id uuid not null,
  creator_profile_id uuid not null, work_type text not null,
  lifecycle_state text not null, visibility text not null,
  current_published_revision_id uuid, moderation_state text not null default 'clear'
);
create table public.creator_profiles(
  creator_profile_id uuid primary key, owner_account_id uuid not null
);
create table public.community_work_revisions(
  revision_id uuid primary key,work_id uuid not null references public.community_works(work_id)
);
create table public.dreamsnap_work_revisions(
  revision_id uuid primary key references public.community_work_revisions(revision_id),
  challenge_id uuid not null,integrity_state text not null
);
create table public.media_assets(
  media_id uuid primary key,owner_account_id uuid not null,
  processing_state text not null,moderation_state text not null,purged_at timestamptz
);
create table public.work_revision_media(
  work_revision_id uuid not null,media_id uuid not null,role text not null,ordinal integer not null
);
create table public.dreamsnap_challenges(
  challenge_id uuid primary key,lifecycle_state text not null,is_synthetic boolean not null
);
create table public.dreamsnap_works(
  work_id uuid primary key references public.community_works(work_id),
  challenge_id uuid not null references public.dreamsnap_challenges(challenge_id),
  managed_under13 boolean not null default false
);
create table public.dreamsnap_entries(
  entry_id uuid primary key,work_id uuid not null,challenge_id uuid not null,
  entry_revision_id uuid not null,entry_state text not null,
  eligibility_state text not null,managed_under13 boolean not null default false
);
create table public.dreamsnap_gallery_publications(
  work_id uuid primary key,entry_id uuid not null,revision_id uuid not null,
  publication_state text not null
);
-- Local STUBS intentionally over-simplify historical Source144/145; only
-- new migration's own additional fail-closed logic may be claimed.
create function private.dreamsnap_public_work_accessible_r20(p_work_id uuid)
returns boolean language sql as $$
  select exists(select 1 from public.community_works
    where work_id=p_work_id and work_type='dreamsnap' and
    lifecycle_state='published' and visibility='public' and
    moderation_state='clear')
$$;
create function public.community_get_gallery_dreamsnap_public_v1(p_work_id uuid)
returns jsonb language plpgsql as $$
declare v record;
begin
  select w.creator_profile_id,c.challenge_id
  into v from public.community_works w
  join public.dreamsnap_gallery_publications gp on gp.work_id=w.work_id
  join public.dreamsnap_entries e on e.entry_id=gp.entry_id
  join public.dreamsnap_challenges c on c.challenge_id=e.challenge_id
  where w.work_id=p_work_id and gp.publication_state='published'
    and c.lifecycle_state in ('results','closed');
  if not found then raise exception 'unavailable'; end if;
  return jsonb_build_object('creatorProfileId',v.creator_profile_id,
    'challengeId',v.challenge_id,'caption','synthetic original',
    'mediaId','77777777-7777-4777-8777-777777777777',
    'publishedAt','2026-10-28T00:00:00Z','creator',jsonb_build_object('handle','synthetic'));
end
$$;

\ir ../../supabase/migrations/20261028000000_x05_shared_dreamsnap_metadata_staged_v1.sql

insert into public.creator_profiles values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.dreamsnap_challenges values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','results',false);
insert into public.community_works(work_id,owner_account_id,creator_profile_id,work_type,lifecycle_state,visibility,current_published_revision_id)
values
 ('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','dreamsnap','published','public','44444444-4444-4444-8444-444444444444'),
 ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','dreamsnap','published','private','55555555-5555-4555-8555-555555555555'),
 ('33333333-3333-4333-8333-333333333333','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','dreamsnap','published','private','66666666-6666-4666-8666-666666666666');
insert into public.dreamsnap_works(work_id,challenge_id)
select work_id,'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
from public.community_works;
insert into public.community_work_revisions values
 ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111'),
 ('55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222'),
 ('66666666-6666-4666-8666-666666666666','33333333-3333-4333-8333-333333333333');
insert into public.dreamsnap_work_revisions values
 ('44444444-4444-4444-8444-444444444444','cccccccc-cccc-4ccc-8ccc-cccccccccccc','eligible'),
 ('55555555-5555-4555-8555-555555555555','cccccccc-cccc-4ccc-8ccc-cccccccccccc','eligible'),
 ('66666666-6666-4666-8666-666666666666','cccccccc-cccc-4ccc-8ccc-cccccccccccc','eligible');
insert into public.media_assets values
 ('77777777-7777-4777-8777-777777777777','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','ready','clear',null),
 ('88888888-8888-4888-8888-888888888888','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','ready','clear',null),
 ('99999999-9999-4999-8999-999999999999','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','ready','clear',null);
insert into public.work_revision_media values
 ('44444444-4444-4444-8444-444444444444','77777777-7777-4777-8777-777777777777','dreamsnap',0),
 ('55555555-5555-4555-8555-555555555555','88888888-8888-4888-8888-888888888888','dreamsnap',0),
 ('66666666-6666-4666-8666-666666666666','99999999-9999-4999-8999-999999999999','dreamsnap',0);
insert into public.dreamsnap_entries values
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111',
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc','44444444-4444-4444-8444-444444444444',
 'entered','eligible',false);
insert into public.dreamsnap_gallery_publications values
 ('11111111-1111-4111-8111-111111111111','dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '44444444-4444-4444-8444-444444444444','published');

-- Same owner+Challenge with TWO distinct PostEvent works and no EntryIDs.
insert into private.dreamsnap_post_event_staged_v1
 (work_id,challenge_id,creator_profile_id,immutable_photo_revision_id,
  media_id,concept_revision_id)
values
 ('22222222-2222-4222-8222-222222222222','cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','55555555-5555-4555-8555-555555555555','88888888-8888-4888-8888-888888888888','55555555-5555-4555-8555-555555555555'),
 ('33333333-3333-4333-8333-333333333333','cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','66666666-6666-4666-8666-666666666666','99999999-9999-4999-8999-999999999999','66666666-6666-4666-8666-666666666666');

do $check$
declare j jsonb; denied boolean;
begin
 if (select count(*) from private.dreamsnap_post_event_staged_v1)<>2 then
   raise exception 'X05_TWO_DISTINCT_STAGES_FAILED'; end if;
 if (select count(*) from public.dreamsnap_entries)<>1 then
   raise exception 'X05_NO_FABRICATED_ENTRY_FAILED'; end if;

 j:=private.dreamsnap_shared_public_work_metadata_v1(
   '11111111-1111-4111-8111-111111111111');
 if j->>'kind'<>'OriginalCompetition'
    or j->>'contractVersion'<>'wand.dreamsnaps.public-work-detail-metadata@1'
    or j->>'entryId'<>'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    or j->'capabilities'->>'media'<>'false' then
   raise exception 'X05_ORIGINAL_METADATA_FAILED %',j; end if;
 if private.dreamsnap_shared_public_work_metadata_v1(
    '22222222-2222-4222-8222-222222222222') is not null
   or private.dreamsnap_shared_public_work_metadata_v1(
    '33333333-3333-4333-8333-333333333333') is not null then
   raise exception 'X05_STAGED_POSTEVENT_PUBLIC_LEAK'; end if;
 -- No release path even if caller tries to set the publication flag.
 denied:=false;
 begin
  update private.dreamsnap_post_event_staged_v1
     set publication_state='published'
   where work_id='22222222-2222-4222-8222-222222222222';
 exception when others then denied:=true;
 end;
 if not denied then raise exception 'X05_STAGING_PUBLISH_UNLOCKED'; end if;
 -- Incorrect cross-Work photo/media reference must be refused on UPDATE.
 denied:=false;
 begin
  update private.dreamsnap_post_event_staged_v1
  set media_id='99999999-9999-4999-8999-999999999999'
  where work_id='22222222-2222-4222-8222-222222222222';
 exception when others then denied:=true;
 end;
 if not denied then raise exception 'X05_CROSS_WORK_MEDIA_ACCEPTED'; end if;
 -- Embargo blocks the private ORIGINAL projection.
 update public.dreamsnap_challenges set lifecycle_state='judging_open';
 if private.dreamsnap_shared_public_work_metadata_v1(
    '11111111-1111-4111-8111-111111111111') is not null then
   raise exception 'X05_EMBARGO_NOT_CLOSED'; end if;
 update public.dreamsnap_challenges set lifecycle_state='results';
 -- Revision tampering must fail rather than reading a stale/different photo.
 update public.community_works set current_published_revision_id=null
 where work_id='11111111-1111-4111-8111-111111111111';
 if private.dreamsnap_shared_public_work_metadata_v1(
    '11111111-1111-4111-8111-111111111111') is not null then
   raise exception 'X05_REVISION_MISMATCH_NOT_CLOSED'; end if;
 update public.community_works
 set current_published_revision_id='44444444-4444-4444-8444-444444444444'
 where work_id='11111111-1111-4111-8111-111111111111';
 update public.community_works set visibility='private'
 where work_id='11111111-1111-4111-8111-111111111111';
 if private.dreamsnap_shared_public_work_metadata_v1(
    '11111111-1111-4111-8111-111111111111') is not null then
    raise exception 'X05_PRIVATE_NOT_CLOSED'; end if;
 if has_function_privilege('anon','private.dreamsnap_shared_public_work_metadata_v1(uuid)','execute')
  or has_function_privilege('service_role','private.dreamsnap_shared_public_work_metadata_v1(uuid)','execute')
  or has_table_privilege('service_role','private.dreamsnap_post_event_staged_v1','insert') then
   raise exception 'X05_ACL_IS_NOT_CLOSED'; end if;
 raise notice 'COMM_X05_SYNTHETIC_DELTA_METADATA_STAGED_NEGATIVE_PASS';
end $check$;
