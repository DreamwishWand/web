// CI-only GitHub Pages prefix simulation; no server code shipped to users.
// Serves the existing adapter-static 'build/' at the same /web/ base path
// as the protected GitHub Pages test main, with strict local file boundaries.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
const root=resolve('build');
const port=Number(process.env.WAND_PAGES_PREVIEW_PORT||4181);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.json':'application/json',
 '.wasm':'application/wasm','.svg':'image/svg+xml',
 '.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2'};
createServer(async(req,res)=>{
 const path=new URL(req.url||'/', 'http://127.0.0.1').pathname;
 if(req.method!=='GET'||!path.startsWith('/web/')){
  res.writeHead(404);res.end();return;
 }
 const rel=decodeURIComponent(path.slice('/web/'.length));
 const file=resolve(root,rel.endsWith('/')?rel+'index.html':rel);
 if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
 try {
  const bytes=await readFile(file);
  res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream',
   'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(bytes);
 }catch{
  res.writeHead(404);res.end();
 }
}).listen(port,'127.0.0.1',()=>{
 console.log('PAGES_TEST_STATIC_PREFIX_ONLY /web/ PORT='+port);
});
