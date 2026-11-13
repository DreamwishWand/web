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

// Actual OS synthetic protobuf; only in-memory fixture pins are substituted.
// No original game bytes, media, or private Save enter CI.
test('01D private path repair: actual HOLD sibling, ancestor/dotdot/repository and swap denial', () => {
  const py = String.raw`
import importlib.util, pathlib, tempfile, hashlib, json, stat, os
from unittest.mock import patch
spec=importlib.util.spec_from_file_location("preflight", pathlib.Path("scripts/asset-research/01d-v1253-image-preflight.py").resolve())
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
def vi(n):
    b=bytearray()
    while n>127:
        b.append((n&127)|128); n>>=7
    b.append(n); return bytes(b)
def field(n,b): return vi(n*8+2)+vi(len(b))+b
body=vi(8)+vi(40000047)+field(2,b"SYNTHETIC_FIXTURE")+field(4,b"guid:"+b"a"*32)
raw=vi(47)+vi(len(body))+body
with tempfile.TemporaryDirectory(prefix="wand-781-repair-") as tmp:
    base=pathlib.Path(tmp); original=base/"original"; output=base/"output"
    original.mkdir(); output.mkdir(); (original/"nested").mkdir()
    (original/"Furniture.json").write_bytes(raw)
    (original/"FullVersion.txt").write_bytes(m.FULLVERSION_BYTES)
    before={p.relative_to(original):p.read_bytes() for p in original.rglob("*") if p.is_file()}
    def deny(root,report):
        try: m.emit_private_report(root,report,["40000047"])
        except ValueError: return
        raise AssertionError("UNSAFE_PATH_ACCEPTED")
    with patch.multiple(m,FURNITURE_SHA256=hashlib.sha256(raw).hexdigest(),FURNITURE_BYTES=len(raw),STEAM_ITEM_COUNT=1):
        report=output/"receipt.json"; receipt=m.emit_private_report(original,report,["40000047","40006096"])
        data=json.loads(report.read_text()); assert receipt["publicImageRows"]==0
        assert data["releaseManifestDraft"]["items"]=={} and not data["canPublishImage"]
        assert not data["canEnableItemThumb"] and not data["canWriteSave"] and not data["cloudUploadAllowed"]
        assert data["samples"][0]["iconGuid"]=="guid:"+"a"*32 and data["samples"][1]["status"]=="MISSING_NATIVE_ITEM"
        assert stat.S_IMODE(report.stat().st_mode)==0o600
        saved=report.read_bytes(); deny(original,report); assert report.read_bytes()==saved
        link=base/"alias"; link.symlink_to(original,target_is_directory=True)
        deny(original,link/"nested"/"forbidden.json")
        deny(original,output/".."/"original"/"nested"/"forbidden.json")
        deny(original,original/"nested"/"forbidden.json")
        deny(original,base/"ancestor.json")
        deny(link,output/"bad-root.json")
        deny(original,pathlib.Path("scripts")/"never-create-private-781.json")
        assert not pathlib.Path("scripts/never-create-private-781.json").exists()
        leaf=output/"leaf.json"; leaf.symlink_to(original/"Furniture.json")
        deny(original,leaf); assert leaf.is_symlink()
        dangling=output/"dangling.json"; dangling.symlink_to(original/"not-created.json")
        deny(original,dangling); assert not (original/"not-created.json").exists()
        other=base/"other-checkout"; other.mkdir(); (other/".git").write_text("gitdir: dummy")
        deny(original,other/"forbidden.json")
        assert not (other/"forbidden.json").exists()
        # Swap an ancestor while the real parser is running; no write through it.
        outer=base/"outer"; outer.mkdir(); inner=outer/"nested"; inner.mkdir()
        moved=base/"moved"
        real_assemble=m.assemble
        def swap(*a,**kw):
            result=real_assemble(*a,**kw); outer.rename(moved)
            outer.symlink_to(original,target_is_directory=True); return result
        with patch.object(m,"assemble",side_effect=swap):
            deny(original,inner/"race.json")
        assert not (moved/"nested"/"race.json").exists()
        assert not (original/"nested"/"race.json").exists()
        # A different regular directory replacing the same name also fails.
        new=base/"new"; new.mkdir(); moved2=base/"moved2"
        def replace(*a,**kw):
            result=real_assemble(*a,**kw); new.rename(moved2); new.mkdir(); return result
        with patch.object(m,"assemble",side_effect=replace):
            deny(original,new/"race.json")
        assert not (new/"race.json").exists() and not (moved2/"race.json").exists()
    assert {p.relative_to(original):p.read_bytes() for p in original.rglob("*") if p.is_file()}==before
print("PR781_PRIVATE_PATH_REPAIR_PASS")
`;
  const r = spawnSync(python, ['-c', py], {encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
  assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/PR781_PRIVATE_PATH_REPAIR_PASS/);
});
