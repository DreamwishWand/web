-- Cover DreamSnaps foreign keys reported by the staging performance advisor.
-- No product semantics or authorization behavior changes.

create index if not exists dreamsnap_entries_account_idx
  on public.dreamsnap_entries(account_id);

create index if not exists dreamsnap_entries_entry_revision_idx
  on public.dreamsnap_entries(entry_revision_id);

create index if not exists dreamsnap_entries_work_idx
  on public.dreamsnap_entries(work_id);

create index if not exists dreamsnap_entries_workspace_idx
  on public.dreamsnap_entries(workspace_id);

create index if not exists dreamsnap_entry_revision_history_revision_idx
  on public.dreamsnap_entry_revision_history(revision_id);

create index if not exists dreamsnap_formal_votes_entry_challenge_idx
  on public.dreamsnap_formal_votes(entry_id,challenge_id);

create index if not exists dreamsnap_formal_votes_entry_revision_idx
  on public.dreamsnap_formal_votes(entry_revision_id);

create index if not exists dreamsnap_formal_votes_voter_account_idx
  on public.dreamsnap_formal_votes(voter_account_id);

create index if not exists dreamsnap_gallery_publications_revision_idx
  on public.dreamsnap_gallery_publications(revision_id);

create index if not exists dreamsnap_official_results_account_idx
  on public.dreamsnap_official_results(account_id);

create index if not exists dreamsnap_special_picks_account_idx
  on public.dreamsnap_special_picks(account_id);

create index if not exists dreamsnap_special_picks_entry_challenge_idx
  on public.dreamsnap_special_picks(entry_id,challenge_id);

create index if not exists dreamsnap_special_picks_entry_revision_idx
  on public.dreamsnap_special_picks(entry_revision_id);

create index if not exists dreamsnap_wand_results_entry_revision_idx
  on public.dreamsnap_wand_results(entry_revision_id);

create index if not exists dreamsnap_works_source_workspace_idx
  on public.dreamsnap_works(source_workspace_id);
