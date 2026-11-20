// 07 DBK limited normal CI: syntax and public fail-closed static contract.
// Actual Pillow/libwebp pixel positives are executed in dedicated source workflow.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
test('07DBK Steam1261 private pixel admission requires lossless exact actual decode, never publication',()=>{
 const source=fileURLToPath(new URL('../scripts/asset-research/07dbk-steam1261-private-native-webp-pixels.py',import.meta.url));
 const py=spawnSync('python3',['-c','import ast,sys;ast.parse(open(sys.argv[1],encoding="utf-8").read())',source],
  {encoding:'utf8',timeout:10000});
 assert.equal(py.status,0,py.stderr);
 const text=readFileSync(source,'utf8');
 for(const s of ['WEBPVP8L','Image.Resampling.LANCZOS','reference.tobytes()',
  'WEBP_RGBA_OR_ALPHA_PIXELS_NOT_EXACT','nativeStreamShaVerified',
  '"itemVisibilityVerified": 0','"newPublicMediaOn": 0','"signedBatchCreated": False',
  'os.O_EXCL','O_NOFOLLOW','secure_private_path'])assert.ok(text.includes(s),'SOURCE_INVARIANT_'+s);
});
