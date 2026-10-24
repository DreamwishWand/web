import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
import { REVIEWED_EN_PAGES } from '../tests/fixtures/guide-systems-reviewed-en.js';

const built=resolve(process.argv[2] || 'build');
const manifestPath=join(built,'ddv','guide','v1.25','systems-public.json');
const runtimePath=join(built,'ddv','guide','v1.25','runtime.json');
const [manifest,runtime]=await Promise.all([
 readFile(manifestPath,'utf8').then(JSON.parse),
 readFile(runtimePath,'utf8').then(JSON.parse)
]);
assert.equal(manifest.schema,'ddv.guide.systems-public@1');
assert.deepEqual(manifest.articles,[], 'Publication-approved count is zero; static manifest must not publish any editorial body');
assert.deepEqual(runtime.records?.systems,[], 'Legacy Systems must not publish reviewed-only bodies');
assert.deepEqual(runtime.records?.issues,[], 'CHC Issue candidates must not be presented as public Guide articles');
const hashes=REVIEWED_EN_PAGES.map(page=>page.sourceHash.toLowerCase());
assert.equal(hashes.length,45);
// V17 reviewer-only corpus fields must not appear in any emitted browser asset.
// These markers catch accidental import of machine/editorial drafts without
// requiring the 315 unpublished draft bodies or their hashes in this repo.
const privateV17Markers=['ddv.guide-systems-native-locdb-provenance-promotion@17',
  'editorialguidancetext','aiinternaleditorial','nativetermproof',
  'humanreviewqueue315','verifiedv16nativecorrections11'];
// 07 DBK V18 is an owner-only reviewer workbook/package, never a public asset.
const privateV18Markers=['ddv.guide-systems-independent-review-package@18',
  'ddv.guide-systems-consumer-return@18','ddv.guide-systems-reviewer-consumer@18',
  'sourceenglishfivesections','humanreview315','reviewerdecision','rightsrevieweridentity'];
let scanned=0;
const leaks=[];
async function scan(dir) {
  for(const entry of await readdir(dir,{withFileTypes:true})) {
    const path=join(dir,entry.name);
    if(entry.isDirectory()) { await scan(path);continue; }
    if(!entry.isFile() || !/\.(?:js|json|html|css|txt|xml|webmanifest)$/i.test(entry.name))continue;
    const size=(await stat(path)).size;
    if(size>8_000_000)throw new Error('Unexpectedly large published text asset: '+path);
    const source=(await readFile(path,'utf8')).toLowerCase();
    scanned++;
    for(let i=0;i<hashes.length;i++)if(source.includes(hashes[i]))leaks.push({file:path,record:REVIEWED_EN_PAGES[i].id});
    for(const marker of privateV17Markers)if(source.includes(marker))leaks.push({file:path,privateMarker:marker});
    for(const marker of privateV18Markers)if(source.includes(marker))leaks.push({file:path,privateV18Marker:marker});
  }
}
await scan(built);
assert.equal(leaks.length,0,'Unapproved article source hashes are present in emitted public assets: '+JSON.stringify(leaks.slice(0,8)));
console.log(JSON.stringify({result:'PASS',publicApproved:0,reviewedEN:45,unpublishedHashesExposed:0,privateV17MarkersExposed:0,privateV18MarkersExposed:0,assetsScanned:scanned}));
