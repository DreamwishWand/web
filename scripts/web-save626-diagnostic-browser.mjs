import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { makeSyntheticP1gProfile } from '../tests/helpers/p1g-fixture.mjs';
import { SAVE626_DIAGNOSTIC_LOCALES, save626DiagnosticCopy } from '../src/lib/wep/save626-diagnostics-copy.js';

const chromiumPath=process.env.CHROME_BIN;
if(!chromiumPath)throw Error('CHROME_BIN_REQUIRED');
const origin=(process.env.WEB_SAVE626_URL??'http://127.0.0.1:4179').replace(/\/$/,'');
const sentinel='SYNTHETIC_PRIVATE_PLAYER_MARKER_626_NEVER_TRANSMIT';
const quantity='9081726354';
const profile={
  GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Windows'}},
  Player:{PrivateMarker:sentinel,ListInventories:{PrivateQuantity:quantity}},
  World:{}, // valid source-level root, but incomplete optional World structural diagnostics
  PrivateUnknownRoot:{synthetic:true}
};
const bytes=Buffer.from(makeSyntheticP1gProfile(profile));
const browser=await chromium.launch({headless:true,executablePath:chromiumPath,
  args:['--no-sandbox','--disable-dev-shm-usage']});
const errors=[], outgoing=[];
let passed=0;
const pass=()=>passed++;
try {
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push('pageerror:'+e.message));
  page.on('console',msg=>{if(msg.type()==='error')errors.push('console:'+msg.text());});
  page.on('request',r=>outgoing.push([r.url(),r.method(),r.postData()??''].join('|')));
  const upload=async(data,name='profile.save')=>page.locator('.load-panel input[type=file]')
    .setInputFiles({name,mimeType:'application/octet-stream',buffer:data});
  await page.goto(origin+'/editor/world/',{waitUntil:'networkidle'});
  await page.locator('.platform-select select').selectOption('switch');
  await page.locator('[data-wep-626-bid] input').fill('9A239D3DB569756D');
  await page.locator('[data-wep-626-provenance] input').check();
  await upload(bytes,sentinel+'.save');
  const readonly=page.locator('[data-wep-626-readonly]');
  await readonly.waitFor({state:'visible',timeout:15000});
  await page.locator('[data-wep-626-incomplete][role=alert]').waitFor({state:'visible'});
  assert.match(await readonly.innerText(),/v1\.25\.3.*schema 626/);
  assert.equal(await page.locator('[data-wep-626-incomplete]').count(),1);
  assert.equal(await page.locator('.editor-shell,.area-route-list,[data-wep-verified-export]').count(),0);
  pass(); // source accepted, structurally incomplete remains unknown and non-editable

  for(const locale of SAVE626_DIAGNOSTIC_LOCALES){
    await page.locator('#site-locale').selectOption(locale);
    await page.waitForFunction(expected=>document.documentElement.lang===expected,locale);
    const copy=save626DiagnosticCopy(locale);
    for(const [sel,text] of [
      ['[data-wep-626-collection-gated]',copy.collectionBoundary],
      ['[data-wep-626-incomplete]',copy.incompleteDiagnostic],
      ['[data-wep-626-local-only]',copy.localOnly]
    ])assert.equal((await page.locator(sel).innerText()).trim(),text,locale+':'+sel);
    await page.setViewportSize({width:320,height:760});
    const m=await page.evaluate(()=>({inner:window.innerWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(m.scroll<=m.inner+2,locale+':'+JSON.stringify(m));
    await page.setViewportSize({width:1280,height:900});
  }
  pass(); // eight launch locales + 320px

  await page.locator('#site-locale').selectOption('en');
  const fileInput=page.locator('.load-panel input[type=file]');
  await fileInput.focus();
  assert.equal(await fileInput.evaluate(node=>document.activeElement===node),true);
  assert.equal(await readonly.getAttribute('role'),'status');
  assert.equal(await page.locator('[data-wep-626-incomplete]').getAttribute('role'),'alert');
  assert.equal(await readonly.locator('dt').count(),3);
  assert.equal(await readonly.locator('dd').count(),3);
  pass(); // focus and screen-reader semantics

  const docText=await page.locator('body').innerText();
  assert.ok(!docText.includes(sentinel));
  assert.ok(!docText.includes(quantity));
  const stored=await page.evaluate(()=>JSON.stringify({
    local:Object.entries(localStorage),session:Object.entries(sessionStorage),
    location:location.href
  }));
  for(const value of [sentinel,quantity]) {
    assert.ok(!docText.includes(value));
    assert.ok(!stored.includes(value));
    assert.ok(!outgoing.some(x=>x.includes(value)),value);
    assert.ok(!errors.some(x=>x.includes(value)),value);
  }
  assert.equal(outgoing.some(x=>/\/static\/ddv\/collection\/v1\.25\//.test(x)),false);
  pass(); // no personal values/Collection source promotion/network transmission

  await page.locator('[data-wep-626-bid] input').fill('0000000000000000');
  await upload(bytes);
  await page.getByText(/Unsupported save version or build/).waitFor({timeout:15000});
  assert.equal(await readonly.count(),0);
  pass(); // incompatible BID revokes previous diagnostics

  await page.locator('[data-wep-626-bid] input').fill('9A239D3DB569756D');
  await upload(Buffer.alloc(32,0));
  await page.locator('.status').waitFor({state:'visible',timeout:15000});
  assert.equal(await readonly.count(),0);
  assert.equal(await page.locator('.editor-shell').count(),0);
  pass(); // unreadable file fail closed

  assert.deepEqual(errors,[]);
  pass(); // no console/page exceptions
  await context.close();
} finally {
  await browser.close();
}
assert.equal(passed,7);
process.stdout.write('WEB_SAVE626_DIAGNOSTIC_BROWSER_7_OF_7_PASS\n');
