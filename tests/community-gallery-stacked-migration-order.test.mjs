import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const migrationsDir=path.join(root,'supabase','migrations');
const migrations=fs.readdirSync(migrationsDir).filter(file=>file.endsWith('.sql')).sort();
const read=file=>fs.readFileSync(path.join(migrationsDir,file),'utf8');
const expected=[
 '20261025002200_gallery_abort_cover_only_reference_guard_v1.sql',
 '20261025002300_gallery_capacity_effective_cleanup_diagnostics_v1.sql',
 '20261025002400_gallery_known_reference_writer_fence_v1.sql'
];

test('Gallery stacked migrations have a unique numeric version across the complete tree',()=>{
 const seen=new Map();
 for(const file of migrations){
  assert.match(file,/^\d{14}_[a-z0-9_]+\.sql$/);
  const version=file.slice(0,14);
  assert.equal(seen.has(version),false,
   'duplicate migration number '+version+': '+seen.get(version)+' and '+file);
  seen.set(version,file);
 }
 for(const file of expected)assert.ok(migrations.includes(file),file);
 assert.ok(!migrations.includes('20261025002200_gallery_known_reference_writer_fence_v1.sql'));
 assert.deepEqual(migrations.filter(x=>x.startsWith('20261025002')),expected);
});

test('the ordered 022/023/024 migrations preserve independent abort, capacity and known-reference gates',()=>{
 const [abort,capacity,fence]=expected.map(read);
 assert.match(abort,/create or replace function public\.community_gallery_media_intent_cancel_v1/i);
 assert.match(abort,/gallery_photo_revision_fields where cover_media_id=v_media\.media_id/i);
 assert.match(abort,/GALLERY_MEDIA_ALREADY_BOUND/);
 assert.match(capacity,/effectivePhysicalCleanupPerHour',0/);
 assert.match(capacity,/nominalWorkerClaimCapacityPerHour',20/);
 assert.match(capacity,/safeCapacityCeilingsProven',false/);
 assert.match(fence,/create or replace function private\.gallery_known_reference_writer_fence_v1/i);
 for(const trigger of [
  'gallery_revision_presets_known_reference_fence',
  'preset_artifacts_known_gallery_reference_fence',
  'preset_revision_publications_known_gallery_reference_fence'
 ]) assert.ok(fence.includes('create trigger '+trigger),trigger);
 assert.match(fence,/revoke all on function private\.gallery_known_reference_writer_fence_v1\(\)/i);
 assert.doesNotMatch(fence,/grant execute on function private\.gallery_known_reference_writer_fence_v1\(\)/i);
});

test('Staging negative acceptance references the renamed 024 migration and uses rollback',()=>{
 const accept=fs.readFileSync(path.join(root,'supabase/staging/acceptance/gallery-known-reference-writer-fence-negative-v1.sql'),'utf8');
 assert.ok(accept.includes('20261025002400_gallery_known_reference_writer_fence_v1.sql'));
 assert.ok(!accept.includes('20261025002200_gallery_known_reference_writer_fence_v1.sql'));
 assert.match(accept,/\bBEGIN\s*;/i);
 assert.match(accept,/\bROLLBACK\s*;/i);
 assert.match(accept,/GALLERY_KNOWN_FENCE_THREE_SOURCE_WRITERS_BEGIN_ROLLBACK_PASS/);
});
