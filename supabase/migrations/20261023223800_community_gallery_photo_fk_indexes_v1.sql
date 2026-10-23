-- Cover foreign keys reported by staging Performance Advisor; no semantics change.
create index if not exists gallery_photo_revision_cover_media_idx
  on public.gallery_photo_revision_fields(cover_media_id);
create index if not exists gallery_photo_subject_creator_idx
  on public.gallery_photo_subjects(creator_profile_id);
create index if not exists gallery_photo_subject_owner_idx
  on public.gallery_photo_subjects(owner_account_id);
