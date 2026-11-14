// Construct an exact candidate Git tree using a disposable index; never update a ref.
// Requires trusted local Git object store and accepted scope supplied by the caller.
// This is not a QA, approval, freshness, merge, deployment or Flag gate.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inspectSelection } from './int-selection-preflight.mjs';

const SHA = /^[0-9a-f]{40}$/;
const ZERO = '0'.repeat(40);
const deny = reason => { throw new Error(reason); };

export function constructCandidateTree(cwd, input) {
  const report = inspectSelection(cwd, input);
  const dir = mkdtempSync(join(tmpdir(), 'wand-int-candidate-'));
  const git = (args, stdin) => execFileSync('git', args, {
    cwd, encoding:'utf8', maxBuffer:16*1024*1024,
    env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1',GIT_INDEX_FILE:join(dir,'index')},
    input:stdin, stdio:['pipe','pipe','pipe']
  });
  try {
    git(['read-tree', report.main]);
    const records = report.entries.map(e => e.after
      ? e.after.mode+' '+e.after.blob+'\t'+e.path+'\0'
      : '0 '+ZERO+'\t'+e.path+'\0').join('');
    git(['update-index','-z','--index-info'],records);
    const tree = git(['write-tree']).trim();
    if (!SHA.test(tree) || git(['cat-file','-t',tree]).trim() !== 'tree') deny('CANDIDATE_TREE_INVALID');
    const changed = git(['diff-tree','--no-commit-id','--name-only','-r','-z','--no-renames',
      '--no-ext-diff','--no-textconv','--ignore-submodules=none',report.main,tree,'--']).split('\0').filter(Boolean).sort();
    const expected = report.entries.map(e=>e.path);
    if (changed.length!==expected.length || changed.some((p,i)=>p!==expected[i])) deny('CANDIDATE_PATH_SET_MISMATCH');
    for (const e of report.entries) {
      const raw = git(['ls-tree','-z',tree,'--',e.path]);
      const want = e.after ? e.after.mode+' blob '+e.after.blob+'\t'+e.path+'\0' : '';
      if (raw!==want) deny('CANDIDATE_POSTIMAGE_MISMATCH:'+e.path);
    }
    return {version:1,status:'EXACT_CANDIDATE_TREE_ONLY',base:report.base,source:report.source,
      main:report.main,tree,entries:report.entries,mergeAuthorized:false,
      acceptanceVerified:false,remoteFreshnessVerified:false,refsUpdated:false};
  } finally {
    rmSync(dir,{recursive:true,force:true});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) deny('USAGE: node scripts/int-candidate-tree.mjs manifest.json');
    const raw = readFileSync(process.argv[2]);
    if (raw.length > 256 * 1024) deny('INPUT_TOO_LARGE');
    console.log(JSON.stringify(constructCandidateTree(process.cwd(), JSON.parse(raw.toString('utf8')))));
  } catch (error) {
    console.error('INT_CANDIDATE_DENIED:', error.message);
    process.exitCode = 1;
  }
}
