import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const media=fs.readFileSync(new URL('../supabase/functions/community-media/index.ts',import.meta.url),'utf8');
const retention=fs.readFileSync(new URL('../supabase/functions/community-retention/index.ts',import.meta.url),'utf8');
const guard=fs.readFileSync(new URL('../supabase/migrations/20261025000400_gallery_physical_delete_failclosed_v1.sql',import.meta.url),'utf8');

test('galleryFinalize never physically removes its object on invalid size or malformed image',()=>{
  assert.match(media,/if \(action === 'finalize' \|\| action === 'galleryFinalize'\)/);
  const start=media.indexOf("if (action === 'finalize' || action === 'galleryFinalize')");
  const end=media.indexOf("if (action === 'galleryStatus' || action === 'galleryCapacity')",start);
  const block=media.slice(start,end);
  assert.ok(start>=0 && end>start);
  const deleteCalls=[...block.matchAll(/await ctx\.supabaseAdmin\.storage\.from\(BUCKET\)\.remove\(\[storageKey\]\)/g)];
  assert.equal(deleteCalls.length,2,'both legacy invalid-file paths must be accounted for');
  assert.match(block,/if \(blob\.size <= 0 \|\| blob\.size > MAX_BYTES\)[\s\S]*?if \(action !== 'galleryFinalize'\) \{\s*await ctx\.supabaseAdmin\.storage\.from\(BUCKET\)\.remove\(\[storageKey\]\);\s*\}/);
  assert.match(block,/catch \(error\) \{\s*\/\/ #124:[\s\S]*?if \(action !== 'galleryFinalize'\) \{\s*await ctx\.supabaseAdmin\.storage\.from\(BUCKET\)\.remove\(\[storageKey\]\);\s*\}/);
  // Existing unrelated Media finalize still uses the legacy cleanup.
  assert.equal((block.match(/if \(action !== 'galleryFinalize'\)/g)||[]).length,2);
  assert.doesNotMatch(media.slice(0,start)+media.slice(end),/\.remove\(\[storageKey\]\)/);
});
test('the original Retention/DB physical Gallery gate remains disabled; no new entitlement or writer',()=>{
  assert.match(guard,/physical_orphan_cleanup_accepted/);
  assert.match(retention,/physical_orphan_cleanup_accepted|community_gallery_physical_cleanup_gate_v1|galleryPhysicalCleanup/);
  assert.doesNotMatch(media,/community_gallery_physical_cleanup_gate_v1[^\n]*true/);
});
