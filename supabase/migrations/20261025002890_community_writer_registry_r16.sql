create table if not exists private.community_writer_reference_registry_r16(
 edge_key text primary key,
 registry_version text not null default 'ddv.writer-reference@r16',
 source_relation text not null,
 target_relation text not null,
 identity_contract text not null,
 owner_contract text not null,
 time_scope text not null check(time_scope in ('CURRENT','HISTORICAL','BOTH','UNKNOWN')),
 direction text not null,
 mutation_owner text not null,
 lock_scope text not null,
 version_contract text not null,
 privacy_visibility text not null,
 enrollment_state text not null check(enrollment_state in ('SOURCE_SCOPED_ENROLLED','SOURCE_PRESENT_UNENROLLED','SOURCE_READONLY_UNVERIFIED_BYTES','SAFETY_INDEPENDENT','FAIL_CLOSED','UNKNOWN')),
 evidence_class text not null check(evidence_class in ('CONFIRMED','HIGH CONFIDENCE','HYPOTHESIS','UNKNOWN'))
);
create table if not exists private.community_writer_routes_r16(
 writer_key text primary key,
 registry_version text not null default 'ddv.writer-reference@r16',
 source_rpc text not null,
 edge_call_site text not null,
 enrollment_state text not null,
 lock_scope text not null,
 graph_registry text not null,
 optimistic_contract text not null,
 retry_contract text not null,
 limitation text not null
);
alter table private.community_writer_reference_registry_r16 enable row level security;
alter table private.community_writer_routes_r16 enable row level security;
revoke all on private.community_writer_reference_registry_r16 from public,anon,authenticated,service_role;
revoke all on private.community_writer_routes_r16 from public,anon,authenticated,service_role;
grant select on private.community_writer_reference_registry_r16 to service_role;
grant select on private.community_writer_routes_r16 to service_role;
insert into private.community_writer_reference_registry_r16
(edge_key,source_relation,target_relation,identity_contract,owner_contract,time_scope,direction,mutation_owner,lock_scope,version_contract,privacy_visibility,enrollment_state,evidence_class)
values
('actor-account','auth_identities(auth_subject)','wand_accounts(account_id)','auth_subject -> account_id','Account','CURRENT','AUTHENTICATED_IDENTITY','Community account/identity lifecycle','Account root FOR SHARE/UPDATE','Identity state + Account privacy cutoff','PRIVATE','SAFETY_INDEPENDENT','CONFIRMED'),
('account-creator','creator_profiles(owner_account_id)','wand_accounts(account_id)','creator_profile_id -> owner_account_id','Account','BOTH','OWNS','Community creator profile owner','Account -> Creator','Owner/Creator profile state','PROFILE_SCOPED','SOURCE_PRESENT_UNENROLLED','CONFIRMED'),
('work-owner','community_works(owner_account_id)','wand_accounts(account_id)','work_id -> owner_account_id','Account','BOTH','OWNED_BY','Community work owner','Account -> Work by type','row_version/current_published_revision_id','OWNER_PRIVATE_OR_PUBLIC','SOURCE_PRESENT_UNENROLLED','CONFIRMED'),
('work-creator','community_works(creator_profile_id)','creator_profiles(creator_profile_id)','work_id -> creator_profile_id','Account','BOTH','ATTRIBUTED_TO','Community work create/update','Account -> Work','Creator owner + moderation','PROFILE_SCOPED','SOURCE_PRESENT_UNENROLLED','CONFIRMED'),
('work-current-revision','community_works(current_published_revision_id)','community_work_revisions(revision_id)','work_id -> current_published_revision_id','Work owner','CURRENT','POINTS_TO','Work publication/Revision updates','Account -> Artifact -> PresetWork -> GalleryWork','Work row_version + expected current Revision','VISIBILITY_AND_MODERATION','SOURCE_SCOPED_ENROLLED','CONFIRMED'),
('work-historical-revisions','community_work_revisions(work_id)','community_works(work_id)','revision_id -> work_id','Work owner','HISTORICAL','BELONGS_TO','Revision publisher','Account -> Artifact -> PresetWork -> GalleryWork','Immutable revision_number/revision_id','RETAINED_HISTORY','SOURCE_SCOPED_ENROLLED','CONFIRMED'),
('preset-artifact-work','preset_artifacts(community_work_id)','community_works(work_id)','preset_artifact_id -> community_work_id','Artifact owner','BOTH','BINDS_TO','Preset owner lifecycle','Account -> Artifact -> PresetWork','Artifact identity immutable once revision exists','OWNER_AND_CREATOR','SOURCE_SCOPED_ENROLLED','CONFIRMED'),
('preset-artifact-associated-gallery','preset_artifacts(associated_gallery_work_id)','gallery_works(work_id)','preset_artifact_id -> associated_gallery_work_id','Artifact owner','BOTH','ASSOCIATED_TO','Preset Artifact associated-gallery writer','Account -> Artifact -> GalleryWork','Old+New associated_gallery_work_id','HISTORY_MAY_PERSIST','SOURCE_SCOPED_ENROLLED','CONFIRMED'),
('preset-revision-artifact','preset_revisions(preset_artifact_id)','preset_artifacts(preset_artifact_id)','preset_revision_id -> preset_artifact_id','Artifact owner','HISTORICAL','DERIVES_FROM','PresetRevision writer','Account -> Artifact -> PresetWork','revision_number + blob + metadata','OWNER_OR_PUBLIC_PUBLISHED','SOURCE_SCOPED_ENROLLED','CONFIRMED'),
('preset-revision-blob','preset_revisions(artifact_blob_id)','artifact_blobs(blob_id)','preset_revision_id -> blob_id','Artifact owner','HISTORICAL','USES_BLOB','Preset Artifact Storage pipeline','Account -> Artifact -> Blob UNKNOWN','storage_key/schema_version/content_type/byte_size/checksum_sha256; actual downloaded bytes unproven','PRIVATE_OR_PUBLISHED','SOURCE_READONLY_UNVERIFIED_BYTES','CONFIRMED'),
('preset-publication','preset_revision_publications(preset_revision_id,work_revision_id)','preset_revisions & community_work_revisions','publication pair','PresetWork owner','HISTORICAL','PUBLISHES','Preset Publisher','Account -> Artifact -> PresetWork -> linked GalleryWork','Both revision UUIDs, current publish pointer','HISTORY_AFFECTS_GALLERY','SOURCE_SCOPED_ENROLLED','CONFIRMED'),
('gallery-revision-presets','gallery_revision_presets(gallery_revision_id,preset_revision_id)','community_work_revisions & preset_revisions','gallery_revision_id + preset_revision_id','Gallery+Preset owners','HISTORICAL','REFERENCES','Gallery v4 / pinned r15','Account -> Artifact -> PresetWork -> GalleryWork','Immutable historical edge + graph sha','PUBLIC_REFERENCE_MAY_REMAIN','SOURCE_SCOPED_ENROLLED','CONFIRMED'),
('gallery-photo-subject','gallery_photo_subjects(work_id,subject_id)','gallery_verified_subjects(subject_id)','work_id -> subject_id','Gallery owner','BOTH','VERIFIED_SUBJECT','Gallery Photo v1','Account -> GalleryWork -> Subject UNKNOWN','Verification state/platform/version/build/schema','VERIFIED_SUBJECT_PRIVATE','SOURCE_PRESENT_UNENROLLED','CONFIRMED'),
('gallery-photo-cover','gallery_photo_revision_fields(revision_id,cover_media_id)','media_assets(media_id)','revision_id -> cover_media_id','Gallery owner','HISTORICAL','COVER_REF','Gallery Photo v1','Account -> Media -> GalleryWork UNKNOWN','Immutable cover per revision; signed bearer not proved','PUBLIC_IMAGE_RISK','SOURCE_PRESENT_UNENROLLED','CONFIRMED'),
('gallery-revision-media','work_revision_media(work_revision_id,media_id)','community_work_revisions & media_assets','work_revision_id+ordinal -> media_id','Work+Media owner','HISTORICAL','ATTACHES_MEDIA','Gallery Photo / DreamSnaps / Gallery pinned','Account -> Media -> Work UNKNOWN','Immutable media reference, cover role','PUBLIC_IMAGE_RISK','SOURCE_PRESENT_UNENROLLED','CONFIRMED'),
('gallery-media-asset','media_assets(media_id)','Storage object key','media_id -> storage_key','Media owner','BOTH','OBJECT_POINTER','community-media intent/complete','Account -> Media intent/storage UNKNOWN','byte_size/checksum_sha256/processing_state, actual bytes unproven','PRIVATE_THEN_PUBLIC_ISSUER','SOURCE_READONLY_UNVERIFIED_BYTES','CONFIRMED'),
('gallery-media-intent','community_media_upload_intents','media_assets/media storage','intent_id -> pending media/storage key','Account','CURRENT','UPLOAD_LIFECYCLE','community-media prepare/put/finalize/cancel','Account -> Intent -> Media/Storage UNKNOWN','intent state + receipt + expiry','PRIVATE_SAFETY_GATED','SOURCE_PRESENT_UNENROLLED','CONFIRMED'),
('gallery-settings','gallery_work_settings(work_id)','community_works(work_id)','work_id -> comments_enabled','Gallery owner','CURRENT','SETTINGS_OF','Gallery comments writer','Account -> GalleryWork','Expected row_version + current revision; R16 new route','OWNER_METADATA','SOURCE_PRESENT_UNENROLLED','CONFIRMED'),
('dreamsnap-entry','dreamsnap_entries(entry_id,work_id)','community_works(work_id)','entry_id -> work_id','Account/competition','BOTH','COMPETITION_ENTRY','DreamSnaps entry lifecycle','Account -> Challenge -> Work UNKNOWN','entry_state/judging/result, challenge limits','COMPETITION_PUBLICATION_GATED','SOURCE_PRESENT_UNENROLLED','CONFIRMED'),
('dreamsnap-gallery','dreamsnap_gallery_publications(work_id,entry_id)','dreamsnap_entries(entry_id)','gallery_work_id -> competition_entry','Account/competition','BOTH','ARCHIVE_PUBLICATION','DreamSnaps result publisher','Account -> Challenge/Entry -> Work UNKNOWN','competition phase/judging/results','PUBLIC_AFTER_RESULTS','SOURCE_PRESENT_UNENROLLED','CONFIRMED'),
('cloud-private-restore','UNKNOWN Cloud object/restore manifest','Gallery/Preset work','UNKNOWN','UNKNOWN','UNKNOWN','UNKNOWN','Cloud preservation/restore','UNKNOWN','Storage durability/entitlement/revocation unproven','PRIVATE_RESTORE_UNKNOWN','UNKNOWN','UNKNOWN'),
('native-in-game-preset','UNKNOWN Native/In-Game Preset','Wand Preset or DDV profile','UNKNOWN','UNKNOWN','UNKNOWN','UNKNOWN','Native DDV reference importer/writer','UNKNOWN','Switch 1.25.0 vs 1.25.3 vs Steam semantics unknown','NATIVE_WRITE_OFF','UNKNOWN','UNKNOWN'),
('biome-preset-native','preset_artifacts(preset_type=''biome'')','DDV native biome state UNKNOWN','artifact ID only','Artifact owner','UNKNOWN','UNKNOWN','WEP/Native writer NOT ENROLLED','UNKNOWN','No native semantics proof','PRIVATE_UNVERIFIED','UNKNOWN','UNKNOWN'),
('floating-island-native','preset_artifacts(preset_type=''floating_island'')','DDV native island state UNKNOWN','artifact ID only','Artifact owner','UNKNOWN','UNKNOWN','WEP/Native writer NOT ENROLLED','UNKNOWN','No native semantics proof','PRIVATE_UNVERIFIED','UNKNOWN','UNKNOWN'),
('tom-furniture-native','preset_artifacts(preset_type=''tom_furniture'')','DDV native ToM furniture UNKNOWN','artifact ID only','Artifact owner','UNKNOWN','UNKNOWN','WEP/Native writer NOT ENROLLED','UNKNOWN','No native semantics proof','PRIVATE_UNVERIFIED','UNKNOWN','UNKNOWN'),
('tom-clothing-native','preset_artifacts(preset_type=''tom_clothing'')','DDV native ToM clothing UNKNOWN','artifact ID only','Artifact owner','UNKNOWN','UNKNOWN','WEP/Native writer NOT ENROLLED','UNKNOWN','No native semantics proof','PRIVATE_UNVERIFIED','UNKNOWN','UNKNOWN'),
('moderation-restrict','community_works(moderation_state)','search_documents/outbox/visibility','work_id + moderation_state','Moderator/Account','BOTH','SUPPRESSES','community_moderate_entity_v5','SAFETY_INDEPENDENT','moderation state, active signed moderator','PUBLIC_SUPPRESSED','SAFETY_INDEPENDENT','CONFIRMED'),
('account-privacy-phase1','wand_accounts(privacy_state)','Search/Visibility and deferred cleanup','account_id + cutoff','Account','BOTH','SUPPRESSES','community_request_privacy_suppression_v1','Account FOR UPDATE safety independent','identity revocation/cutoff','PRIVACY_SUPPRESSED','SAFETY_INDEPENDENT','CONFIRMED'),
('deferred-erasure','provider_identity_cleanup_jobs / physical storage jobs','media_assets/storage','account/media job id','Operator','UNKNOWN','DEFERRED_CLEANUP','Deferred cleanup workers','UNKNOWN','Legal retention/actual revoke/CDN TTL unresolved','PRIVATE_DELETE_UNPROVEN','FAIL_CLOSED','CONFIRMED')
on conflict(edge_key) do nothing;
insert into private.community_writer_routes_r16
(writer_key,source_rpc,edge_call_site,enrollment_state,lock_scope,graph_registry,optimistic_contract,retry_contract,limitation)
values
('gallery-pinned-scene-publish','public.community_publish_gallery_pinned_r15','community-command.publishGallery','SOURCE_SCOPED_ENROLLED','Account>Artifact>PresetWork>GalleryWork','gallery-scene-scoped@r15','CALLER_SHA256','40P01/55P03/40001 fresh retry; stale terminal','Known zero/one Scene only'),
('gallery-legacy-v4-scene','public.community_publish_gallery_v4','direct service RPC','FAIL_CLOSED','R15_PINNED_GRAPH_REQUIRED','gallery-scene-scoped@r15','NONE','NONE','Any Scene requested, historical or associated'),
('gallery-photo-publish','public.community_publish_gallery_photo_v1','community-command.publishGalleryPhoto','SOURCE_PRESENT_UNENROLLED','UNKNOWN Media/Subject/Cover','UNKNOWN','TARGET_ROW_VERSION_ONLY','UNENROLLED','Actual Storage bytes/issuer/historical lock not proved'),
('gallery-media-open','public.community_gallery_media_intent_open_v1','community-media prepare','SOURCE_PRESENT_UNENROLLED','UNKNOWN Storage','UNKNOWN','INTENT_ONLY','UNKNOWN','No native/Graph writer authority'),
('gallery-media-complete','public.community_gallery_media_intent_complete_v1','community-media finalize','SOURCE_PRESENT_UNENROLLED','UNKNOWN Media/Storage','UNKNOWN','INTENT_ONLY','UNKNOWN','Actual bytes/hash needs signed independent evidence'),
('gallery-media-cancel','public.community_gallery_media_intent_cancel_v1','community-media cancel','SAFETY_INDEPENDENT','Negative cleanup only','UNKNOWN','INTENT_ONLY','UNKNOWN','No positive cleanup authority'),
('gallery-comments-legacy','public.community_set_gallery_comments_enabled_v2','community-command.setGalleryCommentsEnabled','SOURCE_PRESENT_UNENROLLED','UNKNOWN target Work','NONE','NONE','NONE','Not global graph-enrolled; DreamSnaps shared semantics'),
('gallery-comments-pinned-r16','public.community_set_gallery_comments_enabled_atomic_r16','community-command.setGalleryCommentsAtomicR16','SOURCE_SCOPED_ENROLLED','Account>GalleryWork','gallery-metadata@r16','ROWVERSION+CURRENT_REVISION','No transient automatic retry until accepted','Gallery work only, no graph refs or media writes'),
('preset-envelope','public.community_publish_preset_envelope','wep-preset-artifact','SOURCE_PRESENT_UNENROLLED','Account>Artifact/Work UNKNOWN','UNKNOWN','GENERIC_IDEMPOTENCY','UNKNOWN','Portable bytes, all facets & lineage not accepted'),
('scene-paired-revision','UNKNOWN Scene Owner paired writer','wep-preset-artifact candidate','PRIVATE_INERT','UNKNOWN','UNKNOWN','OFF','NONE','Storage bytes/Portable JSON/SubGrid/RoadFence not accepted'),
('dreamsnap-publish','public.community_dreamsnap_publish_gallery_v1','community-command.publishDreamsnapGallery','SOURCE_PRESENT_UNENROLLED','Challenge>Entry>Work UNKNOWN','UNKNOWN','UNKNOWN','UNKNOWN','Competition phase and moderation separate'),
('qa-question-tip','public.community_ask_question_v1 / community_create_tip_v1','community-command.askQuestion/createTip','SOURCE_PRESENT_UNENROLLED','Account/Work UNKNOWN','UNKNOWN','UNKNOWN','UNKNOWN','Q&A/Tips own privacy and activity'),
('guide-curated','UNKNOWN curated Guide moderation writer','Guide/private corpus','UNKNOWN','UNKNOWN','UNKNOWN','UNKNOWN','UNKNOWN','Curated/private source, not Community publication'),
('community-moderation-restrict','public.community_moderate_entity_v5','community-command.moderateWork','SAFETY_INDEPENDENT','Privacy/Moderator independent','NONE','MODERATOR_ROLE','NONE','Emergency Restrict/Remove not blocked by graph enrollment'),
('account-privacy-suppress','public.community_request_privacy_suppression_v1','community-account','SAFETY_INDEPENDENT','Account FOR UPDATE','NONE','PRIVACY_CUTOFF','NONE','No deferred physical erase claim'),
('gallery-positive-retire','public.community_unpublish_work / community_delete_work','community-command.unpublishWork/deleteWork','FAIL_CLOSED','UNKNOWN all references','NONE','OFF','NONE','Cloud/Media/History permission false'),
('cloud-private-restore','UNKNOWN','Cloud','UNKNOWN','UNKNOWN','UNKNOWN','OFF','NONE','Unregistered durability/entitlement'),
('native-in-game-apply','UNKNOWN','Native/In-Game','UNKNOWN','UNKNOWN','UNKNOWN','OFF','NONE','No DDV persistent writer')
on conflict(writer_key) do nothing;
