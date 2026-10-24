-- 09-INT-GALLERY-V125-REVIEWED-SUBJECT-ENROLLMENT-V1
-- ADDITIVE SEED ONLY. Previous 13 v1.25 Floating Island rows are untouched.
-- Reviewed Switch 1.25.0 BID 52BD625D9B4E0053 / schema 624 ONLY.
-- ToM source: DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz
-- SHA256: df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048
-- 4949 typed FurnitureItemData, 1900 ClothingItemData; native OR predicate.
-- One-flag-true additional records = 0/0; 40 + 35 exact reviewed base definitions.
-- Review manifest: static/ddv/core/gallery/v1.25/reviewed-tom-base-items-v125.json
-- Biome authority: static/ddv/core/world/v1.25/grid-role-authority-v125.json
-- Git blob 184e43b91fd647c9661129cfa07a0f5edb3dda63; only 4 exact aliases.
-- No room/save-scoped enrollment. No DDV 1.25.3 or Steam enrollment.
do $seed$
declare
  rec record;
  prior public.gallery_verified_subjects%rowtype;
begin
  for rec in select * from (values
    ('outdoor','biome','1540000000:1',NULL::bigint,'static/ddv/core/world/v1.25/grid-role-authority-v125.json#/explicitAliasesByGridDataPath/GridData~1Villages~1Village04-WetlandsLevel-GridData.json'),
    ('outdoor','biome','1540000000:4',NULL::bigint,'static/ddv/core/world/v1.25/grid-role-authority-v125.json#/explicitAliasesByGridDataPath/GridData~1Villages~1Village04-SavannahLevel-GridData.json'),
    ('outdoor','biome','1540000000:5',NULL::bigint,'static/ddv/core/world/v1.25/grid-role-authority-v125.json#/explicitAliasesByGridDataPath/GridData~1Villages~1Village04-ForestLevel-GridData.json'),
    ('outdoor','biome','1540000000:7',NULL::bigint,'static/ddv/core/world/v1.25/grid-role-authority-v125.json#/explicitAliasesByGridDataPath/GridData~1Villages~1Village04-SnowLevel-GridData.json'),
    ('tom_furniture','tom_furniture','40001801',40001801::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/6179/itemID'),
    ('tom_furniture','tom_furniture','40001803',40001803::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/6183/itemID'),
    ('tom_furniture','tom_furniture','40001880',40001880::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/6242/itemID'),
    ('tom_furniture','tom_furniture','40001882',40001882::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/6243/itemID'),
    ('tom_furniture','tom_furniture','40001883',40001883::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/6244/itemID'),
    ('tom_furniture','tom_furniture','40001884',40001884::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/6245/itemID'),
    ('tom_furniture','tom_furniture','40001885',40001885::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/6246/itemID'),
    ('tom_furniture','tom_furniture','40001891',40001891::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/6252/itemID'),
    ('tom_furniture','tom_furniture','40001892',40001892::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/6253/itemID'),
    ('tom_furniture','tom_furniture','40001897',40001897::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/6257/itemID'),
    ('tom_furniture','tom_furniture','40001898',40001898::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/6258/itemID'),
    ('tom_furniture','tom_furniture','40001899',40001899::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/6259/itemID'),
    ('tom_furniture','tom_furniture','40001900',40001900::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/6260/itemID'),
    ('tom_furniture','tom_furniture','40001906',40001906::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/6266/itemID'),
    ('tom_furniture','tom_furniture','40001908',40001908::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/6268/itemID'),
    ('tom_furniture','tom_furniture','40002397',40002397::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/6749/itemID'),
    ('tom_furniture','tom_furniture','40002585',40002585::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/6908/itemID'),
    ('tom_furniture','tom_furniture','40002686',40002686::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/7006/itemID'),
    ('tom_furniture','tom_furniture','40002687',40002687::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/7007/itemID'),
    ('tom_furniture','tom_furniture','40002688',40002688::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/7008/itemID'),
    ('tom_furniture','tom_furniture','40002689',40002689::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/7009/itemID'),
    ('tom_furniture','tom_furniture','40002690',40002690::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/7010/itemID'),
    ('tom_furniture','tom_furniture','40002706',40002706::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/7023/itemID'),
    ('tom_furniture','tom_furniture','40002707',40002707::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/7024/itemID'),
    ('tom_furniture','tom_furniture','40002727',40002727::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/7047/itemID'),
    ('tom_furniture','tom_furniture','40002816',40002816::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/7130/itemID'),
    ('tom_furniture','tom_furniture','40300020',40300020::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/7348/itemID'),
    ('tom_furniture','tom_furniture','40004339',40004339::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/8518/itemID'),
    ('tom_furniture','tom_furniture','40004421',40004421::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/8569/itemID'),
    ('tom_furniture','tom_furniture','40004469',40004469::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/8606/itemID'),
    ('tom_furniture','tom_furniture','40005102',40005102::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/9354/itemID'),
    ('tom_furniture','tom_furniture','40005125',40005125::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/9382/itemID'),
    ('tom_furniture','tom_furniture','40005130',40005130::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/9420/itemID'),
    ('tom_furniture','tom_furniture','40005139',40005139::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/9429/itemID'),
    ('tom_furniture','tom_furniture','40005140',40005140::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/9430/itemID'),
    ('tom_furniture','tom_furniture','40005141',40005141::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/9431/itemID'),
    ('tom_furniture','tom_furniture','40005142',40005142::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/9432/itemID'),
    ('tom_furniture','tom_furniture','40005233',40005233::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/9513/itemID'),
    ('tom_furniture','tom_furniture','40005647',40005647::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/9906/itemID'),
    ('tom_furniture','tom_furniture','40006207',40006207::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/10329/itemID'),
    ('tom_clothing','tom_clothing','50000211',50000211::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/10587/itemID'),
    ('tom_clothing','tom_clothing','50000227',50000227::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/10617/itemID'),
    ('tom_clothing','tom_clothing','50900051',50900051::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/10920/itemID'),
    ('tom_clothing','tom_clothing','50900052',50900052::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/10921/itemID'),
    ('tom_clothing','tom_clothing','50000338',50000338::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/10928/itemID'),
    ('tom_clothing','tom_clothing','50900065',50900065::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/11070/itemID'),
    ('tom_clothing','tom_clothing','50900069',50900069::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/11074/itemID'),
    ('tom_clothing','tom_clothing','50400058',50400058::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/11104/itemID'),
    ('tom_clothing','tom_clothing','50700089',50700089::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/11108/itemID'),
    ('tom_clothing','tom_clothing','50700090',50700090::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/11109/itemID'),
    ('tom_clothing','tom_clothing','50700091',50700091::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/11113/itemID'),
    ('tom_clothing','tom_clothing','50000349',50000349::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/11114/itemID'),
    ('tom_clothing','tom_clothing','50400059',50400059::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/11115/itemID'),
    ('tom_clothing','tom_clothing','50400060',50400060::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/11116/itemID'),
    ('tom_clothing','tom_clothing','50400065',50400065::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/11123/itemID'),
    ('tom_clothing','tom_clothing','50800026',50800026::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/11131/itemID'),
    ('tom_clothing','tom_clothing','50400066',50400066::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/11140/itemID'),
    ('tom_clothing','tom_clothing','50400071',50400071::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/11145/itemID'),
    ('tom_clothing','tom_clothing','50400075',50400075::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/11158/itemID'),
    ('tom_clothing','tom_clothing','50400116',50400116::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/11417/itemID'),
    ('tom_clothing','tom_clothing','50400152',50400152::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/11588/itemID'),
    ('tom_clothing','tom_clothing','50600060',50600060::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/11592/itemID'),
    ('tom_clothing','tom_clothing','50900139',50900139::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/11602/itemID'),
    ('tom_clothing','tom_clothing','50700168',50700168::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/11604/itemID'),
    ('tom_clothing','tom_clothing','50700172',50700172::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/11612/itemID'),
    ('tom_clothing','tom_clothing','51200015',51200015::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/11613/itemID'),
    ('tom_clothing','tom_clothing','50200124',50200124::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/11614/itemID'),
    ('tom_clothing','tom_clothing','50200125',50200125::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/11615/itemID'),
    ('tom_clothing','tom_clothing','51200016',51200016::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/11620/itemID'),
    ('tom_clothing','tom_clothing','50700174',50700174::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/11621/itemID'),
    ('tom_clothing','tom_clothing','50400164',50400164::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/11622/itemID'),
    ('tom_clothing','tom_clothing','50000402',50000402::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/11689/itemID'),
    ('tom_clothing','tom_clothing','50000403',50000403::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/11690/itemID'),
    ('tom_clothing','tom_clothing','50700191',50700191::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/11822/itemID'),
    ('tom_clothing','tom_clothing','50900337',50900337::bigint,'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz#/items/12177/itemID')
  ) as evidence(gallery_kind,subject_type,canonical_target_id,base_item_id,evidence_ref)
  loop
    select * into prior from public.gallery_verified_subjects
    where platform='switch' and build_id='52BD625D9B4E0053'
      and subject_type=rec.subject_type
      and canonical_target_id=rec.canonical_target_id
    for update;

    if prior.subject_id is not null then
      if prior.gallery_kind<>rec.gallery_kind
        or prior.base_item_id is distinct from rec.base_item_id
        or prior.platform<>'switch'
        or prior.game_version<>'1.25.0'
        or prior.build_id<>'52BD625D9B4E0053'
        or prior.profile_schema<>624
        or prior.evidence_ref<>rec.evidence_ref
        or prior.verification_state<>'verified' then
        raise exception 'GALLERY_SUBJECT_EXISTING_EVIDENCE_CONFLICT';
      end if;
    else
      insert into public.gallery_verified_subjects(
        gallery_kind,subject_type,canonical_target_id,base_item_id,
        platform,game_version,build_id,profile_schema,
        evidence_ref,verification_state
      ) values (
        rec.gallery_kind,rec.subject_type,rec.canonical_target_id,rec.base_item_id,
        'switch','1.25.0','52BD625D9B4E0053',624,rec.evidence_ref,'verified'
      );
    end if;
  end loop;
end $seed$;
