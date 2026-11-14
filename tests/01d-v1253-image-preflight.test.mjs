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
    const r = run(['--root',x.original,'--item-id','40000047']);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /ORIGINAL_FURNITURE_SHA_OR_SIZE_MISMATCH/);
    assert.equal(existsSync(report), false);
    assert.equal(readFileSync(join(x.original,'Furniture.json')).toString('hex'), '010203');
  } finally {x.cleanup();}
});

test('01D legacy report path writes are disabled and existing files remain unchanged', () => {
  const x = fixture();
  try {
    const report = join(x.output, 'report.json');
    writeFileSync(report, 'EXISTING_PRIVATE_RECEIPT');
    const duplicate = run(['--root',x.original,'--report',report,'--item-id','40000047']);
    assert.notEqual(duplicate.status, 0);
    assert.match(duplicate.stderr, /PRIVATE_REPORT_PATH_WRITE_DISABLED/);
    assert.equal(readFileSync(report,'utf8'), 'EXISTING_PRIVATE_RECEIPT');
    const alias = run(['--root',x.original,'--report',join(x.original,'Furniture.json'),'--item-id','40000047']);
    assert.notEqual(alias.status, 0);
    assert.match(alias.stderr, /PRIVATE_REPORT_PATH_WRITE_DISABLED/);
  } finally{x.cleanup();}
});

test('01D symlink root is rejected before canonicalization and cannot produce even a HOLD receipt', () => {
  const x = fixture();
  try {
    const link = join(x.dir,'root-link');
    symlinkSync(x.original, link, 'dir');
    const report = join(x.output,'result.json');
    const r = run(['--root',link,'--item-id','40000047']);
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
      const r=run(['--root',x.original,
        ...ids.flatMap(id=>['--item-id',id])]);
      assert.notEqual(r.status,0);
      assert.equal(existsSync(join(x.output,'bad.json')),false);
    }
  }finally{x.cleanup();}
});

// Actual OS synthetic protobuf; only in-memory fixture pins substituted.
// No original game bytes or media enter CI. No arbitrary path writes.
test('01D private memory-only HOLD and actual OS relocated-directory denial', () => {
  const py = String.raw`
import importlib.util, pathlib, tempfile, hashlib, json
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
with tempfile.TemporaryDirectory(prefix="wand-781-memory-") as tmp:
    base=pathlib.Path(tmp); original=base/"original"; output=base/"output"
    original.mkdir(); output.mkdir(); (original/"nested").mkdir()
    (original/"Furniture.json").write_bytes(raw)
    (original/"FullVersion.txt").write_bytes(m.FULLVERSION_BYTES)
    before={p.relative_to(original):p.read_bytes() for p in original.rglob("*") if p.is_file()}
    def deny(root,report):
        try: m.emit_private_report(root,report,["40000047"])
        except ValueError as e: assert str(e)=="PRIVATE_REPORT_PATH_WRITE_DISABLED"; return
        raise AssertionError("PATH_WRITE_ACCEPTED")
    with patch.multiple(m,FURNITURE_SHA256=hashlib.sha256(raw).hexdigest(),FURNITURE_BYTES=len(raw),STEAM_ITEM_COUNT=1):
        result=m.create_private_report(original,["40000047","40006096"])
        summary=m.report_summary(result)
        assert summary["publicImageRows"]==0 and not summary["privateReportWritten"]
        assert result["releaseManifestDraft"]["items"]=={} and not result["canPublishImage"]
        assert not result["canEnableItemThumb"] and not result["canWriteSave"] and not result["cloudUploadAllowed"]
        assert result["samples"][0]["iconGuid"]=="guid:"+"a"*32 and result["samples"][1]["status"]=="MISSING_NATIVE_ITEM"
        assert summary["reportSha256"]==hashlib.sha256((json.dumps(result,ensure_ascii=False,indent=2)+"\n").encode()).hexdigest()
        report=output/"receipt.json"; report.write_bytes(b"sentinel")
        deny(original,report); assert report.read_bytes()==b"sentinel"
        link=base/"alias"; link.symlink_to(original,target_is_directory=True)
        deny(original,link/"nested"/"forbidden.json")
        deny(original,output/".."/"original"/"nested"/"forbidden.json")
        deny(original,original/"nested"/"forbidden.json")
        deny(original,base/"ancestor.json")
        deny(original,pathlib.Path("scripts")/"never-create-private-781.json")
        assert not pathlib.Path("scripts/never-create-private-781.json").exists()
        try:m.create_private_report(link,["40000047"])
        except ValueError:pass
        else:raise AssertionError("SYMLINK_ROOT_ACCEPTED")
        # Actual directory relocation after assembly. There is no output
        # handle or file-creation operation in the memory-only producer.
        late=base/"late"; late.mkdir(); moved=original/"nested"/"relocated"
        real=m.assemble
        def relocate(*a,**kw):
            data=real(*a,**kw); late.rename(moved); late.mkdir(); return data
        with patch.object(m,"assemble",side_effect=relocate):
            result=m.create_private_report(original,["40000047"])
        assert result["counts"]["steamNativePresent"]==1
        deny(original,late/"late.json"); deny(original,moved/"late.json")
        assert not (late/"late.json").exists() and not (moved/"late.json").exists()
    assert {p.relative_to(original):p.read_bytes() for p in original.rglob("*") if p.is_file()}==before
print("PR781_MEMORY_ONLY_PASS")
`;
  const r = spawnSync(python, ['-c', py], {encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
  assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/PR781_MEMORY_ONLY_PASS/);
});
