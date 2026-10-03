
create table if not exists public.community_entity_origins (
  entity_id uuid primary key references public.community_entities(entity_id) on delete cascade,
  origin_kind text not null check (
    origin_kind in ('user','staff_public','engineering_fixture','moderation_test_fixture','synthetic')
  ),
  created_at timestamptz not null default now()
);
alter table public.community_entity_origins enable row level security;
revoke all on public.community_entity_origins from public, anon, authenticated;
grant select,insert,update,delete on public.community_entity_origins to service_role;

create or replace function private.community_origin_kind_for_account(p_account_id uuid)
returns text
language sql
stable
security definer
set search_path=pg_catalog,public,private
as $$
  select case
    when exists (
      select 1 from public.account_roles
      where account_id=p_account_id and role in ('moderator','admin')
    ) then 'staff_public'
    else 'user'
  end
$$;
revoke execute on function private.community_origin_kind_for_account(uuid)
from public,anon,authenticated,service_role;

create table if not exists public.gallery_work_settings (
  work_id uuid primary key references public.gallery_works(work_id) on delete cascade,
  comments_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.gallery_work_settings enable row level security;
drop policy if exists gallery_work_settings_accessible_read on public.gallery_work_settings;
create policy gallery_work_settings_accessible_read
on public.gallery_work_settings for select to anon,authenticated
using (private.can_access_work(work_id));
grant select on public.gallery_work_settings to anon,authenticated,service_role;

create table if not exists public.gallery_revision_items (
  gallery_revision_id uuid not null references public.gallery_work_revisions(revision_id) on delete cascade,
  item_id bigint not null check (item_id > 0),
  featured boolean not null default false,
  primary key (gallery_revision_id,item_id)
);
alter table public.gallery_revision_items enable row level security;
drop policy if exists gallery_revision_items_accessible_read on public.gallery_revision_items;
create policy gallery_revision_items_accessible_read
on public.gallery_revision_items for select to anon,authenticated
using (
  exists (
    select 1
    from public.community_work_revisions r
    where r.revision_id=gallery_revision_id
      and private.can_access_work(r.work_id)
  )
);
grant select on public.gallery_revision_items to anon,authenticated,service_role;

create table if not exists public.qa_question_revisions (
  revision_id uuid primary key references public.community_work_revisions(revision_id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  body text not null check (char_length(body) between 1 and 20000),
  context_tags text[] not null check (cardinality(context_tags) between 1 and 20),
  platform text,
  game_version text
);
alter table public.qa_question_revisions enable row level security;
drop policy if exists qa_question_revisions_accessible_read on public.qa_question_revisions;
create policy qa_question_revisions_accessible_read
on public.qa_question_revisions for select to anon,authenticated
using (
  exists (
    select 1 from public.community_work_revisions r
    where r.revision_id=qa_question_revisions.revision_id
      and private.can_access_work(r.work_id)
  )
);
grant select on public.qa_question_revisions to anon,authenticated,service_role;

create table if not exists public.qa_question_state (
  work_id uuid primary key references public.community_works(work_id) on delete cascade,
  resolution_state text not null default 'unresolved'
    check (resolution_state in ('unresolved','solved')),
  freshness text not null default 'current'
    check (freshness in ('current','needs_recheck')),
  accepted_answer_id uuid references public.comments(comment_id) on delete set null,
  solution_note text check (
    solution_note is null or char_length(solution_note) between 1 and 10000
  ),
  updated_at timestamptz not null default now(),
  check (
    resolution_state='unresolved'
    or accepted_answer_id is not null
    or solution_note is not null
  )
);
alter table public.qa_question_state enable row level security;
drop policy if exists qa_question_state_accessible_read on public.qa_question_state;
create policy qa_question_state_accessible_read
on public.qa_question_state for select to anon,authenticated
using (private.can_access_work(work_id));
grant select on public.qa_question_state to anon,authenticated,service_role;

create table if not exists public.qa_answers (
  answer_id uuid primary key references public.comments(comment_id) on delete cascade,
  question_id uuid not null references public.community_works(work_id) on delete cascade,
  freshness text not null default 'current'
    check (freshness in ('current','needs_recheck')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists qa_answers_question_created_idx
  on public.qa_answers(question_id,created_at,answer_id);
alter table public.qa_answers enable row level security;
drop policy if exists qa_answers_accessible_read on public.qa_answers;
create policy qa_answers_accessible_read
on public.qa_answers for select to anon,authenticated
using (private.can_access_entity(answer_id));
grant select on public.qa_answers to anon,authenticated,service_role;

create table if not exists public.qa_same_here (
  account_id uuid not null references public.wand_accounts(account_id) on delete cascade,
  question_id uuid not null references public.community_works(work_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(account_id,question_id)
);
create index if not exists qa_same_here_question_idx on public.qa_same_here(question_id);
alter table public.qa_same_here enable row level security;
drop policy if exists qa_same_here_self_read on public.qa_same_here;
create policy qa_same_here_self_read
on public.qa_same_here for select to authenticated
using (account_id=private.current_wand_account_id() or private.is_staff());
grant select on public.qa_same_here to authenticated,service_role;

create table if not exists public.qa_answer_utility (
  account_id uuid not null references public.wand_accounts(account_id) on delete cascade,
  answer_id uuid not null references public.qa_answers(answer_id) on delete cascade,
  utility_kind text not null check (
    utility_kind in ('helpful','worked_for_me','doesnt_work_for_me')
  ),
  updated_at timestamptz not null default now(),
  primary key(account_id,answer_id)
);
create index if not exists qa_answer_utility_answer_idx on public.qa_answer_utility(answer_id);
alter table public.qa_answer_utility enable row level security;
drop policy if exists qa_answer_utility_self_read on public.qa_answer_utility;
create policy qa_answer_utility_self_read
on public.qa_answer_utility for select to authenticated
using (account_id=private.current_wand_account_id() or private.is_staff());
grant select on public.qa_answer_utility to authenticated,service_role;

create table if not exists public.qa_tip_revisions (
  revision_id uuid primary key references public.community_work_revisions(revision_id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  body text not null check (char_length(body) between 1 and 20000),
  context_tags text[] not null check (cardinality(context_tags) between 1 and 20),
  platform text,
  game_version text,
  source_question_id uuid references public.community_works(work_id) on delete set null,
  source_answer_id uuid references public.qa_answers(answer_id) on delete set null
);
alter table public.qa_tip_revisions enable row level security;
drop policy if exists qa_tip_revisions_accessible_read on public.qa_tip_revisions;
create policy qa_tip_revisions_accessible_read
on public.qa_tip_revisions for select to anon,authenticated
using (
  exists (
    select 1 from public.community_work_revisions r
    where r.revision_id=qa_tip_revisions.revision_id
      and private.can_access_work(r.work_id)
  )
);
grant select on public.qa_tip_revisions to anon,authenticated,service_role;

create table if not exists public.qa_tip_state (
  work_id uuid primary key references public.community_works(work_id) on delete cascade,
  freshness text not null default 'current'
    check (freshness in ('current','needs_recheck')),
  updated_at timestamptz not null default now()
);
alter table public.qa_tip_state enable row level security;
drop policy if exists qa_tip_state_accessible_read on public.qa_tip_state;
create policy qa_tip_state_accessible_read
on public.qa_tip_state for select to anon,authenticated
using (private.can_access_work(work_id));
grant select on public.qa_tip_state to anon,authenticated,service_role;

insert into private.community_action_rate_policies(
  bucket,window_seconds,max_actions,enabled,updated_at
) values
  ('qa_write',3600,60,true,now()),
  ('qa_signal',3600,300,true,now())
on conflict(bucket) do update
set window_seconds=excluded.window_seconds,
    max_actions=excluded.max_actions,
    enabled=excluded.enabled,
    updated_at=excluded.updated_at;

create index if not exists community_works_gallery_owner_idx
  on public.community_works(owner_account_id,published_at desc,work_id)
  where work_type='gallery';

create index if not exists community_works_qa_owner_idx
  on public.community_works(owner_account_id,published_at desc,work_id)
  where work_type in ('question','tip');
