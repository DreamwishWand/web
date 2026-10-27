import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const candidateRoot = join(repoRoot, 'operator/gate-a/wep-source142-stop-candidate');
const sourceRoot = join(candidateRoot, 'supabase/functions');
const output = join(repoRoot, 'dist/wep-gate-a-source142-stop');
const contents = join(output, 'bundle');
const names = ['wep-preset-artifact', 'wep-scene-preset-product', 'wep-preset-retention'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

rmSync(output, { recursive: true, force: true });
mkdirSync(contents, { recursive: true });
const entries = [];
for (const name of names) {
  const relative = 'supabase/functions/' + name + '/index.ts';
  const src = join(candidateRoot, relative);
  const dest = join(contents, relative);
  const data = readFileSync(src);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest);
  entries.push({ path: relative, sha256: sha(data), bytes: data.byteLength });
}
const manifest = {
  schema: 'wep-operator-gate-a-transition-bundle@1',
  lifecycle: 'OFFLINE_CANDIDATE_DO_NOT_DEPLOY',
  source142FunctionalHead: '0b90e6681507a20c5cfa637752fb6c5a575c5d06',
  source142DocsHead: 'daeca51eb6c838d9042322a2f3f67fe744e9d01f',
  sourceGitBlobs: {
    'wep-preset-artifact': '7b07f750a9770886e4cf587537fed466b1965040',
    'wep-scene-preset-product': '89338d77937729b170d7ec5940b3683be88248b9',
    'wep-preset-retention': '052c642a2c739eb686e259135db8a2d33c26b965'
  },
  offlineNoDeployment: true,
  existingInFlightDrained: false,
  all21EdgesAnd7CronsQuiesced: false,
  liveOperatorGateA4Passed: false,
  expectedStatusForValidAuthenticatedAction: 409,
  automaticRetryAllowed: false,
  files: entries
};
writeFileSync(join(contents, 'BUNDLE_MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');
const archive = join(output, 'wep-gate-a-source142-stop-candidate.tar');
execFileSync('tar', ['--sort=name','--mtime=@0','--owner=0','--group=0','--numeric-owner',
  '--format=ustar','-C',contents,'-cf',archive,'.']);
const archiveSha = sha(readFileSync(archive));
const result = {
  archive: 'dist/wep-gate-a-source142-stop/wep-gate-a-source142-stop-candidate.tar',
  sha256: archiveSha,
  source142FunctionalHead: manifest.source142FunctionalHead,
  files: entries
};
writeFileSync(join(output, 'SHA256SUMS'),
  archiveSha + '  wep-gate-a-source142-stop-candidate.tar\n');
writeFileSync(join(output, 'BUILD_PROVENANCE.json'), JSON.stringify(result, null, 2) + '\n');
process.stdout.write('GATE_A_BUNDLE_SHA256=' + archiveSha + '\n');
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
