import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const registryPath = 'static/ddv/integrity/promoted-baselines.json';
const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
const errors = [];

if (registry.schema !== 'ddv.canonical-baseline-registry@1') errors.push('invalid registry schema');
if (!Array.isArray(registry.baselines) || registry.baselines.length === 0) errors.push('baselines must be non-empty');

const sha = /^[0-9a-f]{64}$/;
const versions = new Map();
for (const b of registry.baselines ?? []) {
  for (const k of ['artifactId','artifactType','version','status','platform','gameVersion','artifactSha256']) {
    if (typeof b[k] !== 'string' || b[k].length === 0) errors.push(`${b.artifactId ?? '<unknown>'}: missing ${k}`);
  }
  if (b.status !== 'PROMOTED') errors.push(`${b.artifactId}: protected registry entry must be PROMOTED`);
  if (b.mutable === true) errors.push(`${b.artifactId}: protected baseline cannot be mutable`);
  if (!sha.test(b.artifactSha256)) errors.push(`${b.artifactId}: invalid artifactSha256`);
  if (b.payloadSha256 != null && !sha.test(b.payloadSha256)) errors.push(`${b.artifactId}: invalid payloadSha256`);
  const key = `${b.artifactId}@${b.version}`;
  if (versions.has(key)) errors.push(`duplicate baseline ${key}`);
  versions.set(key, b);
}

const expected = {
  'DDV-GRIDDATA-V125-V1_7': {
    version: 'v1.7',
    artifactSha256: '333af50fd78a4b0f50372beca7cae1d7cd22d60f673b956c05427cf3576beeb8',
    payloadSha256: '75f33dc20d521d579070aa7919a96c23ce5dd329dbc6f58392f267c9dd0b1aaa'
  },
  'DDV-GRIDDATA-V125-V1_8': {
    version: 'v1.8',
    artifactSha256: 'e7ca77d212789e94968d93aa1dc661fe10abf7381f8b0e63f5ccd642d3d90a71',
    payloadSha256: 'c282132aa56d4936490d36c5a398ed16436cc1ffd86bd17a49b770f8372d8cb3'
  },
  'DDV-GRIDDATA-V125-V1_9': {
    version: 'v1.9',
    artifactSha256: 'bf1b38ff1d725bb0facb913bc9efc06d283feda030990748a1ad1a73483936c2'
  }
};

for (const [id, expectedBaseline] of Object.entries(expected)) {
  const actual = (registry.baselines ?? []).find((x) => x.artifactId === id);
  if (!actual) {
    errors.push(`missing protected baseline ${id}`);
    continue;
  }
  for (const [key, value] of Object.entries(expectedBaseline)) {
    if (actual[key] !== value) errors.push(`${id}: protected ${key} changed`);
  }
}

let registryChanged = false;
let explicitPromotion = false;

try {
  const eventName = process.env.GITHUB_EVENT_NAME ?? '';
  if (eventName === 'pull_request') {
    const diff = execFileSync('git', ['diff', '--name-only', 'origin/main...HEAD'], { encoding: 'utf8' });
    registryChanged = diff.split(/\r?\n/).includes(registryPath);
    const commitMessages = execFileSync('git', ['log', '--format=%B', 'origin/main..HEAD'], { encoding: 'utf8' });
    explicitPromotion = /\[PROMOTE\]/i.test(commitMessages);
  } else if (eventName === 'push') {
    const diff = execFileSync('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'], { encoding: 'utf8' });
    registryChanged = diff.split(/\r?\n/).includes(registryPath);
    const commitMessage = execFileSync('git', ['log', '-1', '--format=%B', 'HEAD'], { encoding: 'utf8' });
    explicitPromotion = /\[PROMOTE\]/i.test(commitMessage);
  }
} catch {
  // If Git history cannot establish the event diff, fail closed below only when a registry change is detected.
}

if (registryChanged && !explicitPromotion) {
  errors.push(`${registryPath}: changed without canonical-promotion label or [PROMOTE] marker`);
}

if (errors.length) {
  console.error('CANONICAL BASELINE VERIFICATION: FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`CANONICAL BASELINE VERIFICATION: PASS (${registry.baselines.length} protected entries)`);
