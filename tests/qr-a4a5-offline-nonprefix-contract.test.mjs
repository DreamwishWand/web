import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

const root=process.cwd();
const read=p=>readFileSync(resolve(root,p),'utf8');
const led=JSON.parse(read('tests/fixtures/qr-a5-stage116-ledger-readonly-20261026.json'));
const names=readdirSync(resolve(root,'supabase/migrations')).filter(x=>/^\d{14}_.+\.sql$/.test(x));
const source=names.map(x=>({version:x.slice(0,14),name:x.slice(15,-4)}));
const stage=led.migrations;
function counts(){
 const sk=new Set(stage.map(x=>x.name)),src=new Set(source.map(x=>x.name));
 const sv=new Set(stage.map(x=>x.version+'_'+x.name));
 const counter=new Map();
 for(const x of stage)counter.set(x.name,(counter.get(x.name)||0)+1);
 return {
  stage:stage.length,source:source.length,
  exact:source.filter(x=>sv.has(x.version+'_'+x.name)).length,
  commonNames:[...src].filter(x=>sk.has(x)).length,
  stageOnly:[...sk].filter(x=>!src.has(x)).sort(),
  sourceOnly:[...src].filter(x=>!sk.has(x)).sort(),
  duplicateStageNames:[...counter.values()].filter(x=>x>1).length
 };
}
test('A5 executable nonprefix ledger witness: source is not a safe additive migration recipe',()=>{
 const x=counts();
 assert.equal(x.stage,116);
 assert.equal(x.source,142);
 assert.equal(x.exact,23);
 assert.equal(x.commonNames,107);
 assert.equal(x.sourceOnly.length,35);
 assert.equal(x.duplicateStageNames,4);
 assert.deepEqual(x.stageOnly,[
 'community_core_v0_staging_media_bucket',
 'community_staging_pg_net',
 'community_staging_remove_pg_net',
 'scene_preset_product_vertical_v1',
 'scene_preset_unattached_media_discard_v1'
 ].sort());
 assert.equal(led.stageProjectRef,'ptpdoxhrqopvczpclcij');
 assert.equal(led.stageLastVersion,'20261024043436');
 console.log('QR_A5_NONPREFIX_STAGE116_SOURCE142_REPRODUCED_OFFLINE',JSON.stringify({
  stage:x.stage,source:x.source,exact:x.exact,commonNames:x.commonNames,
  stageOnly:x.stageOnly.length,sourceOnly:x.sourceOnly.length,duplicateStageNames:x.duplicateStageNames,
  protectedHistoricalClone:false,semanticSQLReplayed:false
 }));
});
test('A5 source SQL prepares Scene revoke and R19 media fences, without proving historical clone parity',()=>{
 const scene=read('supabase/migrations/20261025003000_r18_scene_product_publisher_source_closure.sql');
 const pub=read('supabase/migrations/20261025003050_r19_direct_media_sql_issuer_authority.sql');
 const legacy=read('supabase/migrations/20261025003060_r19_legacy_media_signer_authority.sql');
 for(const n of ['community_publish_scene_preset_product_v1','community_unpublish_scene_preset_v1','community_delete_scene_preset_v1'])
  assert.ok(scene.includes("'"+n+"'"),n);
 assert.match(scene,/revoke all on function %s from public,anon,authenticated,service_role/);
 assert.match(scene,/R18_SCENE_LIFECYCLE_WRITER_EXECUTE_REMAINS_EXPOSED/);
 assert.match(pub,/community_preset_storage_assert_media_not_quarantined_r19/);
 assert.match(legacy,/community_preset_storage_assert_media_not_quarantined_r19/);
 assert.match(legacy,/grant execute on function public\.community_get_media_storage_key\(uuid,uuid\)/);
 console.log('QR_A5_SOURCE_ONLY_SQL_CONTRACT_PRESENT_NO_HISTORICAL116_CLONE');
});
test('A4 baseline Generic is NOT an inert transition: source file hashes never count as deployed bundle hashes',()=>{
 const paths=['wep-preset-artifact','wep-scene-preset-product','wep-preset-retention'];
 const markers=[];
 for(const slug of paths){
  const bytes=readFileSync(resolve(root,'supabase/functions',slug,'index.ts'));
  const content=bytes.toString('utf8');
  markers.push({slug,sourceGitBlobSha1:createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex'),
    sourceByteSha256:createHash('sha256').update(bytes).digest('hex'),
    hasSignedUpload:/\.createSignedUploadUrl\s*\(/.test(content),
    hasSignedRead:/\.createSignedUrl\s*\(/.test(content),
    hasCopy:/\.copy\s*\(/.test(content),hasRemove:/\.remove\s*\(/.test(content)});
 }
 assert.equal(markers[0].sourceGitBlobSha1,'7b07f750a9770886e4cf587537fed466b1965040');
 assert.equal(markers[1].sourceGitBlobSha1,'89338d77937729b170d7ec5940b3683be88248b9');
 assert.equal(markers[2].sourceGitBlobSha1,'052c642a2c739eb686e259135db8a2d33c26b965');
 assert.equal(markers[0].hasSignedUpload,true);
 assert.equal(markers[0].hasSignedRead,true);
 for(const x of markers){assert.equal(x.hasCopy,false);assert.equal(x.hasRemove,false);}
 console.log('QR_A4_BASELINE_GENERIC_SIGNERS_STILL_PRESENT_BRIDGE_CANDIDATE_NOT_ACCEPTED',JSON.stringify({
  candidateSubmitted:false,realDeployedBundleAttested:false,sourceOnlyFileHashes:markers
 }));
});
