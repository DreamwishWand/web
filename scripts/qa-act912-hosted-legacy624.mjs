// QA-only hosted replay: exact existing synthetic browser assertions, no product source change.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const base='https://dreamwishwand.github.io/web/editor/world/';
assert.equal(process.env.WEP_BASE_URL,base);
assert.equal(process.env.WEP_VERIFIED_TRANSFORM_ONLY,'1');
const source=fileURLToPath(new URL('./wep-primary-job-browser-acceptance.mjs',import.meta.url));
const generated=fileURLToPath(new URL('./.act912-hosted-generated.mjs',import.meta.url));
const raw=readFileSync(source,'utf8');
const replaceOnce=(s,from,to)=>{
  assert.equal(s.split(from).length,2,'fixed harness anchor mismatch');
  return s.replace(from,to);
};
let patched=replaceOnce(raw,"acceptDownloads: true\n  });","acceptDownloads: true,\n    serviceWorkers: 'block'\n  });");
patched=replaceOnce(patched,"  const page = await context.newPage();",`  report.hostedNetwork = { sameOriginReads: 0, blockedExternalReads: 0, blockedNonRead: 0 };
  await context.route('**/*',async route=>{
    const request=route.request(), url=new URL(request.url());
    if (!['http:','https:'].includes(url.protocol)) return route.continue();
    if (!['GET','HEAD'].includes(request.method())) {
      report.hostedNetwork.blockedNonRead++;
      return route.abort('blockedbyclient');
    }
    if (url.origin!=='https://dreamwishwand.github.io'||!url.pathname.startsWith('/web/')) {
      report.hostedNetwork.blockedExternalReads++;
      return route.abort('blockedbyclient');
    }
    report.hostedNetwork.sameOriginReads++;
    return route.continue();
  });
  const page = await context.newPage();`);
patched=replaceOnce(patched,"  report.result = 'PASS';",`  assert.equal(report.hostedNetwork.blockedNonRead,0,'hosted acceptance attempted non-read network');
  assert.ok(report.hostedNetwork.sameOriginReads>0,'no actual hosted reads');
  assert.equal(new URL(page.url()).origin,'https://dreamwishwand.github.io');
  report.result = 'PASS';`);
writeFileSync(generated,patched,{flag:'wx',mode:0o600});
try { execFileSync(process.execPath,[generated],{stdio:'inherit',env:process.env}); }
finally { rmSync(generated,{force:true}); }
