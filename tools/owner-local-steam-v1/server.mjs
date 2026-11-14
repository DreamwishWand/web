// Synthetic CI localhost server. Actual Owner launcher and UI are private.
// GET/HEAD only; fixed public-source/WASM/fixture allowlist; no upload,
// telemetry, general source serving, cookies, cloud, or Save logging.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('../../',import.meta.url)));
const staticShared=new Set([
  // Real DEV and normal Worker entries remain separate CI witnesses.
  '/tools/owner-local-steam-v1/dev-read.worker.mjs',
  '/tools/owner-local-steam-v1/worker.mjs',
  '/tools/owner-local-steam-v1/worker-core.mjs',
  '/tools/owner-local-steam-v1/attestation.mjs',
  '/src/lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs',
  '/src/lib/ddv/core/save/product-wasm-read-owner.mjs',
  '/src/lib/ddv/core/save/p1g-packaged-profile-codec.js',
  '/src/lib/ddv/core/save/safe-edit-session.js',
  '/src/lib/ddv/core/save/versioning.js',
  '/tests/stage-e/pkg/ddv_save_core.js',
  '/tests/stage-e/pkg/ddv_save_core_bg.wasm'
]);
const staticCi=new Set([
  '/tests/stage-g/index.html',
  '/tests/stage-g/page.mjs',
  '/tests/stage-g/worker.mjs',
  '/tests/stage-h/index.html',
  '/tests/stage-h/page.mjs',
  '/tests/stage-h/worker.mjs',
  '/tests/stage-f/fixtures/synthetic626.p1g',
  '/tests/stage-f/fixtures/expected.json'
]);
const mime={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8',
  '.mjs':'text/javascript;charset=utf-8','.wasm':'application/wasm',
  '.p1g':'application/octet-stream','.json':'application/json'};
export async function startOwnerLocalV1Server({ciFixture=false}={}){
  // Public repository has no Owner UI or private-input launcher. Fail closed
  // unless the caller explicitly starts the synthetic test harness.
  if(ciFixture!==true)throw Error('OWNER_LOCAL_CI_FIXTURE_REQUIRED');
  let port=0;
  const server=createServer(async(req,res)=>{
    const deny=(status=403)=>{res.writeHead(status,{'cache-control':'no-store'});res.end()};
    if(req.method!=='GET'&&req.method!=='HEAD')return deny(405);
    if(req.headers.host!==`127.0.0.1:${port}`)return deny();
    let pathname;
    try{
      const u=new URL(req.url,`http://127.0.0.1:${port}`);
      pathname=decodeURIComponent(u.pathname);
    }catch{return deny(400)}
    if(!staticShared.has(pathname)&&!staticCi.has(pathname))
      return deny();
    const file=resolve(root,'.'+pathname);
    if(!file.startsWith(root+'/'))return deny();
    try{
      const body=await readFile(file);
      res.writeHead(200,{
        'content-type':mime[extname(file)]||'application/octet-stream',
        'cache-control':'no-store','x-content-type-options':'nosniff',
        'referrer-policy':'no-referrer',
        'x-frame-options':'DENY',
        'cross-origin-resource-policy':'same-origin',
        'cross-origin-opener-policy':'same-origin',
        'content-security-policy':[
          "default-src 'none'",
          "script-src 'self' 'wasm-unsafe-eval'",
          "worker-src 'self'",
          "connect-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'none'","object-src 'none'","base-uri 'none'",
          "form-action 'none'","frame-ancestors 'none'"
        ].join('; ')
      });
      res.end(req.method==='HEAD'?undefined:body);
    }catch{return deny(404)}
  });
  await new Promise((ok,err)=>{
    server.once('error',err);
    server.listen(0,'127.0.0.1',ok);
  });
  port=server.address().port;
  return {server,port,url:`http://127.0.0.1:${port}/tests/stage-g/index.html`};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  // Do not accidentally launch a private-input surface from public Source.
  process.stderr.write('OWNER_LOCAL_CI_FIXTURE_REQUIRED\n');
  process.exitCode=12;
}
