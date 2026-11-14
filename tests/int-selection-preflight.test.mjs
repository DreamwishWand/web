import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, symlinkSync, mkdirSync } from 'node:fs';
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
    git('checkout','--detach',base); mkdirSync(join(dir,'nested')); write('nested/item.txt','new');
    const nested=commit('nested add');
    git('checkout','--detach',main); write('nested','blocking file'); const blocked=commit('namespace collision');
    assert.throws(()=>inspectSelection(dir,{base,source:nested,main:blocked,paths:['nested/item.txt']}),/PATH_NAMESPACE_CONFLICT/);
    assert.equal(inspectSelection(dir,{base,source:nested,main,paths:['nested/item.txt']}).entries[0].change,'ADD');
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('ambient submodule ignore cannot hide added, modified or deleted gitlinks', () => {
  const dir=mkdtempSync(join(tmpdir(),'wand-int-gitlink-'));
  const git=(...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  const write=(value)=>writeFileSync(join(dir,'a.txt'),value);
  const commit=msg=>{git('commit','-m',msg);return git('rev-parse','HEAD');};
  const link=(sha)=>git('update-index','--add','--cacheinfo','160000,'+sha+',hidden-submodule');
  try {
    git('init','-b','main');git('config','user.name','Synthetic');git('config','user.email','synthetic@example.invalid');
    write('base');git('add','a.txt');const base=commit('base');
    write('add');git('add','a.txt');link(base);const added=commit('add gitlink');
    write('modify');git('add','a.txt');link(added);const modified=commit('modify gitlink');
    write('delete');git('add','a.txt');git('update-index','--force-remove','hidden-submodule');const deleted=commit('delete gitlink');
    git('config','diff.ignoreSubmodules','all');
    for(const [before,after] of [[base,added],[added,modified],[modified,deleted]]) {
      const input={base:before,source:after,main:before,paths:['a.txt']};
      assert.throws(()=>inspectSelection(dir,input),/SOURCE_PATH_SET_MISMATCH/);
      assert.throws(()=>inspectSelection(dir,{...input,paths:['a.txt','hidden-submodule']}),/NON_REGULAR_OR_AMBIGUOUS_PATH/);
    }
    git('checkout','--detach',added);write('regular only');git('add','a.txt');const regular=commit('regular only');
    const out=inspectSelection(dir,{base:added,source:regular,main:added,paths:['a.txt']});
    assert.equal(out.status,'EXACT_SELECTION_PREFLIGHT_ONLY');
    assert.equal(out.mergeAuthorized,false);
    assert.equal(out.acceptanceVerified,false);
    assert.equal(out.remoteFreshnessVerified,false);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
