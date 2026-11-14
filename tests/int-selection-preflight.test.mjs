import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { inspectSelection } from '../scripts/int-selection-preflight.mjs';

test('exact selection with stacked base, squash-equivalent main and deny cases', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wand-int-'));
  const git = (...args) => execFileSync('git', args, {cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  const write = (p,s) => writeFileSync(join(dir,p),s);
  const commit = msg => { git('add','-A'); git('commit','-m',msg); return git('rev-parse','HEAD'); };
  try {
    git('init','-b','main'); git('config','user.name','Synthetic'); git('config','user.email','synthetic@example.invalid');
    write('a.txt','old'); write('remove.txt','delete'); const root = commit('root');
    git('checkout','-b','source'); write('parent.txt','parent'); const base = commit('parent');
    write('a.txt','new'); write('add.txt','add'); rmSync(join(dir,'remove.txt')); const source = commit('child');
    git('checkout','main'); write('parent.txt','parent'); write('unrelated.txt','unrelated'); const main = commit('equivalent parent');
    const input = {base, source, main, paths:['a.txt','add.txt','remove.txt']};
    const out = inspectSelection(dir,input);
    assert.equal(out.status,'EXACT_SELECTION_PREFLIGHT_ONLY');
    assert.equal(out.mergeAuthorized,false); assert.equal(out.acceptanceVerified,false); assert.equal(out.remoteFreshnessVerified,false);
    assert.deepEqual(out.entries.map(e=>e.change),['MOD','ADD','DELETE']);
    assert.equal(out.entries[1].before,null); assert.equal(out.entries[2].after,null);
    assert.throws(()=>inspectSelection(dir,{...input,paths:['a.txt','add.txt']}),/SOURCE_PATH_SET_MISMATCH/);
    assert.throws(()=>inspectSelection(dir,{...input,paths:['a.txt','add.txt','remove.txt','unrelated.txt']}),/SOURCE_PATH_SET_MISMATCH/);
    for (const paths of [['a.txt','a.txt'],['../a.txt'],['.git/config'],['a*'],[]])
      assert.throws(()=>inspectSelection(dir,{...input,paths}),/INVALID_SELECTION_INPUT/);
    assert.throws(()=>inspectSelection(dir,{...input,source:'HEAD'}),/FIXED_COMMIT_REQUIRED/);
    assert.throws(()=>inspectSelection(dir,{...input,base:main}),/Command failed/);
    write('a.txt','conflict'); const conflict=commit('conflict');
    assert.throws(()=>inspectSelection(dir,{...input,main:conflict}),/MAIN_PREIMAGE_MISMATCH/);
    git('checkout','--detach',main); write('add.txt','already exists'); const exists=commit('collision');
    assert.throws(()=>inspectSelection(dir,{...input,main:exists}),/MAIN_PREIMAGE_MISMATCH/);
    git('checkout','--detach',base); symlinkSync('a.txt',join(dir,'link')); const link=commit('symlink');
    assert.throws(()=>inspectSelection(dir,{base,source:link,main,paths:['link']}),/NON_REGULAR_OR_AMBIGUOUS_PATH/);
    assert.throws(()=>inspectSelection(dir,{...input,base:root,paths:input.paths}),/SOURCE_PATH_SET_MISMATCH/);
    assert.throws(()=>inspectSelection(dir,{...input,extra:true}),/INVALID_SELECTION_INPUT/);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
