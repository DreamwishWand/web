import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('DreamSnaps is a first-class CommunityWork domain with account-scoped competition rights', () => {
  const schema = read('supabase/migrations/20261003044300_community_dreamsnaps_schema_v1.sql');
  const fix = read('supabase/migrations/20261003044600_community_dreamsnaps_native_revision_fix_v1.sql');
  const integrity = read('supabase/migrations/20261003044700_community_dreamsnaps_integrity_pool_v1.sql');

  for (const token of [
    'public.dreamsnap_challenges',
    'public.dreamsnap_works',
    'public.dreamsnap_work_revisions',
    'public.dreamsnap_entries',
    'public.dreamsnap_entry_revision_history',
    'public.dreamsnap_formal_votes',
    'public.dreamsnap_special_picks',
    'public.dreamsnap_wand_results',
    'public.dreamsnap_official_results',
    'public.dreamsnap_official_result_publication',
    'public.dreamsnap_gallery_publications'
  ]) assert.ok(schema.includes(token), token);

  assert.match(schema, /unique\(challenge_id,account_id\)/i);
  assert.match(schema, /entry_revision_id uuid not null/i);
  assert.match(schema, /managed_under13 boolean not null/i);
  assert.match(schema, /formal_vote_allowance integer not null/i);
  assert.match(schema, /special_pick_allowance integer not null/i);
  assert.match(schema, /minimum_real_eligible_entries integer not null/i);
  assert.match(integrity, /minimum_real_eligible_creators/i);
  assert.match(integrity, /count\(distinct w\.creator_profile_id\)/i);
  assert.match(integrity, /e\.origin_kind='user'/i);
  assert.match(integrity, /work_revision_media_one_dreamsnap_competition_image_uq/i);

  assert.match(fix, /add column if not exists caption text/i);
  assert.match(fix, /insert into public\.dreamsnap_work_revisions/i);
  assert.doesNotMatch(fix, /insert into public\.gallery_works/i);
  assert.doesNotMatch(fix, /insert into public\.gallery_work_revisions/i);
});

test('integrity assessment can fail closed before entry and project into active entry eligibility', () => {
  const integrity = read('supabase/migrations/20261003044700_community_dreamsnaps_integrity_pool_v1.sql');
  const acceptance = read('supabase/staging/acceptance/dreamsnaps-golden-vertical-20261003.sql');

  assert.ok(integrity.includes('community_dreamsnap_apply_integrity_assessment_v1'));
  assert.match(integrity, /'eligible','under_review','rejected'/);
  assert.match(integrity, /suspicion_flags/);
  assert.match(integrity, /entryEligibilityState/);
  assert.match(acceptance, /ACCEPTANCE_INVALID_MEDIA_NOT_BLOCKED/);
  assert.match(acceptance, /ACCEPTANCE_INTEGRITY_REVIEW_DID_NOT_BLOCK_ENTRY/);
  assert.match(acceptance, /ACCEPTANCE_REAL_POOL_ENTRY_CREATOR_FLOOR_NOT_MET/);
});

test('Work revision editing stays separate from explicit competition entry revision replacement', () => {
  const commands = read('supabase/migrations/20261003044400_community_dreamsnaps_commands_v1.sql');

  assert.ok(commands.includes('community_dreamsnap_update_work_revision_v1'));
  assert.ok(commands.includes('community_dreamsnap_join_event_v1'));
  assert.ok(commands.includes('community_dreamsnap_replace_entry_revision_v1'));
  assert.match(commands, /competitionEntryChanged',false/);
  assert.match(commands, /DreamSnaps entry revision is frozen/);
  assert.match(commands, /already used its DreamSnaps entry right/);
});

test('Judge projection is blind and formal votes are separated from browse reactions and Special Picks', () => {
  const projection = read('supabase/migrations/20261003044500_community_dreamsnaps_projection_v1.sql');
  const commands = read('supabase/migrations/20261003044400_community_dreamsnaps_commands_v1.sql');
  const judgeUi = read('src/routes/dreamsnaps/judge/+page.svelte');

  assert.ok(projection.includes('community_get_dreamsnap_judge_v1'));
  assert.match(projection, /'entryId',x\.entry_id/);
  assert.match(projection, /'entryRevisionId',x\.entry_revision_id/);
  assert.match(projection, /'mediaId',x\.media_id/);
  assert.doesNotMatch(judgeUi, /candidate\.creator|candidate\.owner|officialResult/);

  assert.ok(commands.includes('community_dreamsnap_cast_formal_vote_v1'));
  assert.ok(commands.includes('community_dreamsnap_add_browse_reaction_v1'));
  assert.ok(commands.includes('community_dreamsnap_special_pick_v1'));
  assert.match(commands, /Formal judging allowance must be exhausted before browse reactions/);
  assert.match(commands, /Formal judging allowance must be exhausted before Special Pick/);
});

test('official in-game results remain separate and private-by-default', () => {
  const commands = read('supabase/migrations/20261003044400_community_dreamsnaps_commands_v1.sql');
  const provenance = read('supabase/migrations/20261003044800_community_dreamsnaps_ingame_result_provenance_v1.sql');
  const edge = read('supabase/functions/community-command/index.ts');
  const projection = read('supabase/migrations/20261003044500_community_dreamsnaps_projection_v1.sql');
  const my = read('src/routes/dreamsnaps/my/+page.svelte');
  const results = read('src/routes/dreamsnaps/results/+page.svelte');

  assert.ok(provenance.includes('community_dreamsnap_ingest_ingame_result_v1'));
  assert.match(provenance, /p_source_kind not in \('save','official_evidence'\)/);
  assert.match(provenance, /source_reference/);
  assert.doesNotMatch(edge, /recordDreamsnapOfficialResult/);
  assert.ok(commands.includes('community_dreamsnap_set_official_result_publication_v1'));
  assert.ok(projection.includes('private.dreamsnap_public_official_result'));
  assert.ok(projection.includes("'wandResults'"));
  assert.ok(projection.includes("'inGameResults'"));
  assert.ok(my.includes('setDreamsnapOfficialResultPublication'));
  assert.ok(results.includes("dreamsnaps.results.wand"));
  assert.ok(results.includes("dreamsnaps.results.ingame"));
});

test('post-Results Gallery projection is explicit and managed-under-13 comments fail closed', () => {
  const schema = read('supabase/migrations/20261003044300_community_dreamsnaps_schema_v1.sql');
  const fix = read('supabase/migrations/20261003044600_community_dreamsnaps_native_revision_fix_v1.sql');
  const gallery = read('src/routes/gallery/dreamsnaps/+page.svelte');

  assert.match(schema, /c\.lifecycle_state in \('results','closed'\)/);
  assert.match(fix, /v_comments:=case when v_entry\.managed_under13 then false/);
  assert.match(fix, /if v_managed and p_enabled then/);
  assert.ok(gallery.includes('community_search_gallery_dreamsnaps_public_v1'));
  assert.ok(gallery.includes('community_get_gallery_dreamsnap_public_v1'));
  assert.ok(gallery.includes("addComment"));
  assert.ok(gallery.includes("reportEntity"));
});

test('DreamSnaps Edge boundaries expose only the intended signed and public operations', () => {
  const command = read('supabase/functions/community-command/index.ts');
  const query = read('supabase/functions/community-query/index.ts');
  const publicQuery = read('supabase/functions/community-public-query/index.ts');
  const media = read('supabase/functions/community-media/index.ts');
  const publicMedia = read('supabase/functions/community-public-media/index.ts');

  for (const name of [
    'registerDreamsnapWork',
    'updateDreamsnapWork',
    'joinDreamsnapEvent',
    'replaceDreamsnapEntryRevision',
    'castDreamsnapVote',
    'addDreamsnapBrowseReaction',
    'addDreamsnapSpecialPick',
    'setDreamsnapOfficialResultPublication',
    'publishDreamsnapGallery'
  ]) assert.ok(command.includes(name), name);
  assert.doesNotMatch(command, /recordDreamsnapOfficialResult/);

  assert.ok(query.includes("dreamsnapJudge: 'community_get_dreamsnap_judge_v1'"));
  assert.ok(query.includes("myDreamsnaps: 'community_get_my_dreamsnaps_v1'"));
  assert.ok(media.includes("'dreamsnapJudgeRead'"));
  assert.ok(media.includes("'community_get_dreamsnap_judge_media_storage_v1'"));

  for (const rpc of [
    'community_get_current_dreamsnap_challenge_public_v1',
    'community_list_dreamsnap_result_rounds_public_v1',
    'community_get_dreamsnap_results_public_v1',
    'community_get_gallery_dreamsnap_public_v1',
    'community_search_gallery_dreamsnaps_public_v1'
  ]) assert.ok(publicQuery.includes(`'${rpc}'`), rpc);

  assert.doesNotMatch(publicQuery, /community_get_dreamsnap_judge_v1/);
  assert.match(publicMedia, /community_get_public_media_storage_v2/);
});

test('DreamSnaps launch locale catalogs have identical key sets and critical UI coverage', async () => {
  const { communityCatalogs } = await import('../src/lib/i18n/messages/community/index.js');
  const locales = ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
  const keys = Object.keys(communityCatalogs.en).sort();

  for (const locale of locales) {
    assert.deepEqual(Object.keys(communityCatalogs[locale]).sort(), keys, locale);
  }

  for (const key of [
    'dreamsnaps.tab.submit',
    'dreamsnaps.tab.judge',
    'dreamsnaps.tab.results',
    'dreamsnaps.tab.my',
    'dreamsnaps.submit.registeredOnly',
    'dreamsnaps.judge.remaining',
    'dreamsnaps.results.officialSeparate',
    'dreamsnaps.my.officialPrivate',
    'dreamsnaps.gallery.title',
    'dreamsnaps.gallery.commentsUnavailable'
  ]) assert.ok(key in communityCatalogs.en, key);
});
