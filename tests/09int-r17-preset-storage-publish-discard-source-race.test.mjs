import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const edge=source('supabase/functions/wep-preset-artifact/index.ts');
const sql=source('supabase/migrations/20260930035240_community_core_v0_preset_bridge.sql');
const registry=source('supabase/migrations/20261025002890_community_writer_registry_r16.sql');
const publish=edge.slice(edge.indexOf("if (action === 'publish')"),edge.indexOf("if (action === 'read')"));
const discard=edge.slice(edge.indexOf("if (action === 'discard')"),edge.indexOf("return reply({ ok: false, error: 'Unsupported action'"));
const rpc=sql.slice(sql.indexOf('create or replace function public.community_publish_preset_envelope('),sql.indexOf('create or replace function public.community_publish_gallery_v3('));
const at=(v,needle)=>{const i=v.indexOf(needle);assert.ok(i>=0,needle);return i};

test('Owner133 Preset source copies Storage before independent SQL registration',()=>{
 assert.ok(at(publish,'.copy(storageKey, publishedStorageKey)')<at(publish,".rpc('community_publish_preset_envelope'"));
 assert.match(publish,/publishedStorageKey = .*published\/.*finalDigest/);
 assert.match(publish,/finalDigest = hex\(await crypto\.subtle\.digest\('SHA-256'/);
 assert.match(publish,/promotedNewObject = true/);
 assert.match(publish,/if \(error\) \{\s*if \(promotedNewObject\) \{\s*await ctx\.supabaseAdmin\.storage\.from\(BUCKET\)\.remove\(\[publishedStorageKey\]\)/);
 assert.ok(at(rpc,'insert into public.artifact_blobs(')>at(rpc,'select request_hash,response into'));
 assert.doesNotMatch(rpc,/storage\.objects|\.download\(|storage\.from\(/);
 console.log(JSON.stringify({case:'R17_WEP_PUBLISH_COPIES_BYTES_BEFORE_SQL_REGISTRATION',source:'actual Owner133 Edge and SQL',positiveEnrollment:false}));
});
test('Owner133 discard accepts published owner key and checks only preexisting blob row',()=>{
 assert.match(discard,/storageKey\.startsWith\(.{0,15}published\//);
 assert.ok(at(discard,".from('artifact_blobs')")<at(discard,".remove([storageKey])"));
 assert.match(discard,/\.select\('blob_id'\)\.eq\('storage_key', storageKey\)\.maybeSingle\(\)/);
 assert.match(discard,/if \(registered\) return reply\(\{ ok: false, error: 'REGISTERED_ARTIFACT_CANNOT_BE_DISCARDED' \}, 409\)/);
 assert.doesNotMatch(discard,/for update|advisory|reservation|publication_intent|storage_lock/i);
 assert.match(registry,/'preset-envelope'[\s\S]{0,250}'SOURCE_PRESENT_UNENROLLED'/);
 console.log(JSON.stringify({case:'R17_WEP_DISCARD_COMMITTED_BLOB_LOOKUP_BEFORE_PHYSICAL_REMOVE',sourceOnly:true}));
});
test('Deterministic source-conforming interleaving permits a dangling Storage pointer',()=>{
 const state={storage:new Set(['staging/A/upload.json']),artifactBlobs:new Set(),events:[]};
 const published='published/A/'+('a'.repeat(64))+'.json';
 state.storage.add(published);state.events.push('A_copy_staging_to_published');
 const registered=state.artifactBlobs.has(published);state.events.push('B_artifact_blobs_lookup_false');
 assert.equal(registered,false);
 state.storage.delete(published);state.events.push('B_discard_published_physical');
 state.artifactBlobs.add(published);state.events.push('A_actual_SQL_rpc_would_commit_metadata');
 assert.ok(state.artifactBlobs.has(published)&&!state.storage.has(published));
 console.log(JSON.stringify({result:'09INT_R17_PRESET_PUBLISH_DISCARD_ORDERED_SOURCE_RACE_WITNESS',
   sourcePin:'8a4a5a8d23fe89e4b4402cd7ce0d048cc5e2b0ec',events:state.events,
   missingPublishedObjectWithCommittedMetadata:true,
   executedRealStorage:false,executedRealEdge:false,executedRealSQL:false,
   classification:'HIGH_CONFIDENCE_SOURCE_ORDERING_NOT_RUNTIME',
   sourceFullyEnrolled:false,graphComplete:false}));
});
