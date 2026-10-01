import assert from 'node:assert/strict';
import fs from 'node:fs';

const page=fs.readFileSync(
  new URL('../src/routes/community-lab/profiles/+page.svelte',import.meta.url),
  'utf8'
);
const lab=fs.readFileSync(
  new URL('../src/routes/community-lab/+page.svelte',import.meta.url),
  'utf8'
);

assert.match(page,/ddvProfileWorkspaces/);
assert.match(page,/createDdvProfileWorkspace/);
assert.match(page,/updateDdvProfileWorkspace/);
assert.match(page,/associateDdvIdentity/);
assert.match(page,/unlinkDdvIdentity/);
assert.match(page,/deleteDdvProfileWorkspace/);
assert.match(page,/retainedCount}\s*\/\s*5/);
assert.match(page,/Active \+ Archived count together/);
assert.match(page,/Archiving never frees a slot; deletion does/);
assert.match(page,/Profile \$\{workspace\.slotIndex\}/);
assert.match(page,/parent_guardian_managed/);
assert.match(page,/confirmation: 'DELETE'/);
assert.match(page,/Workspace-scoped private data is deleted/);
assert.match(page,/Gallery posts, Wand Presets, and Q&amp;A\/Tips remain independent/);
assert.match(page,/Player ID is not required/);
assert.match(page,/playerId = ''/);
assert.doesNotMatch(page,/localStorage\.setItem\([^\n]*playerId/i);
assert.doesNotMatch(page,/sessionStorage\.setItem\([^\n]*playerId/i);
assert.match(lab,/href="profiles\/"/);

console.log('PASS Profile Workspace staging UI contract');
