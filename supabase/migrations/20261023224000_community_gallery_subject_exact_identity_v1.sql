-- Enforce one authoritative versioned subject identity even when base_item_id is NULL.
-- PostgreSQL ordinary UNIQUE treats NULL values as distinct.
create unique index if not exists gallery_verified_subjects_exact_identity_idx
  on public.gallery_verified_subjects(platform,build_id,subject_type,canonical_target_id,coalesce(base_item_id,0));
