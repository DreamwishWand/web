import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const script = resolve('scripts/asset-research/01d-v1253-image-preflight.py');
const python = process.env.PYTHON || 'python3';
function run(args) {
  return spawnSync(python, [script, ...args], {
    encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024
  });
}
const expectedFull = 'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22\n';
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'wand-01d-1253-'));
  const original = join(dir, 'original');
  const output = join(dir, 'output');
  mkdirSync(original); mkdirSync(output);
  writeFileSync(join(original, 'FullVersion.txt'), expectedFull);
  // Deliberately synthetic, never a private original game asset.
  writeFileSync(join(original, 'Furniture.json'), Buffer.from([0x01, 0x02, 0x03]));
  return {dir, original, output, cleanup: () => rmSync(dir, {recursive:true,force:true})};
}

test('01D real source parser is reused and a synthetic source can never mint published image rows', () => {
  const r = run(['--self-test']);
  assert.equal(r.status, 0, r.stderr);
  const obj = JSON.parse(r.stdout);
  assert.equal(obj.selfTest, 'SYNTHETIC_ONLY_PASS');
  assert.equal(obj.checks, 13);
  assert.equal(obj.publicImageRows, 0);
  assert.equal(obj.realGameBytesInCI, false);
});

test('01D private source accepts neither a counterfeit size/SHA nor an alleged current Build', () => {
  const x = fixture();
  try {
    const report = join(x.output, 'report.json');
    const r = run(['--root',x.original,'--report',report,'--item-id','40000047']);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /ORIGINAL_FURNITURE_SHA_OR_SIZE_MISMATCH/);
    assert.equal(existsSync(report), false);
    assert.equal(readFileSync(join(x.original,'Furniture.json')).toString('hex'), '010203');
  } finally {x.cleanup();}
});

test('01D report is exclusive no-clobber and cannot alias the original input directory', () => {
  const x = fixture();
  try {
    const report = join(x.output, 'report.json');
    writeFileSync(report, 'EXISTING_PRIVATE_RECEIPT');
    const duplicate = run(['--root',x.original,'--report',report,'--item-id','40000047']);
    assert.notEqual(duplicate.status, 0);
    assert.match(duplicate.stderr, /REPORT_ALIAS_OR_EXISTS/);
    assert.equal(readFileSync(report,'utf8'), 'EXISTING_PRIVATE_RECEIPT');
    const alias = run(['--root',x.original,'--report',join(x.original,'Furniture.json'),'--item-id','40000047']);
    assert.notEqual(alias.status, 0);
    assert.match(alias.stderr, /REPORT_ALIAS_OR_EXISTS/);
  } finally{x.cleanup();}
});

test('01D symlink root is rejected before canonicalization and cannot produce even a HOLD receipt', () => {
  const x = fixture();
  try {
    const link = join(x.dir,'root-link');
    symlinkSync(x.original, link, 'dir');
    const report = join(x.output,'result.json');
    const r = run(['--root',link,'--report',report,'--item-id','40000047']);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /PRIVATE_ROOT_INVALID/);
    assert.equal(existsSync(report), false);
  } finally{x.cleanup();}
});

test('01D wrong external FullVersion or unsafe IDs fail closed before reading original item rows', () => {
  const x=fixture();
  try {
    writeFileSync(join(x.original,'FullVersion.txt'),'releases_1.25-v1.25.0-untrusted\n');
    for (const ids of [['0'], ['040000047'], ['__proto__'], ['40000047','40000047']]) {
      const r=run(['--root',x.original,'--report',join(x.output,'bad.json'),
        ...ids.flatMap(id=>['--item-id',id])]);
      assert.notEqual(r.status,0);
      assert.equal(existsSync(join(x.output,'bad.json')),false);
    }
  }finally{x.cleanup();}
});