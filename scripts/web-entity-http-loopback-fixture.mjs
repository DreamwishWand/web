// ONLY a disposable loopback HTTP acceptance fixture. Not a server/runtime for Wand.
// Even a 200 here establishes neither public rights nor real GitHub Pages support.
// No Game records, user files, CDN/signed URLs, Provider or personal Save are touched.
import { createServer } from 'node:http';
import {compileEntityHostPlan,expectedDirectHttpStatus} from '../src/lib/foundation/public-entity-host-contract.mjs';

export const SYNTHETIC_HOST_FIXTURE_CONTRACT='wand.synthetic-entity-http-host@1';
const textHeaders=Object.freeze({'content-type':'text/plain; charset=utf-8','x-robots-tag':'noindex,nofollow','cache-control':'no-store','x-wand-test-fixture':'synthetic-only'});
export function createSyntheticEntityHost(entries=[]) {
 const compiled=compileEntityHostPlan(entries);
 if(compiled.status!=='COMPILED_ONLY')throw Error('FIXTURE_DENIED_MANIFEST');
 const server=createServer((req,res)=>{
  const pathname=new URL(req.url??'/', 'http://localhost').pathname;
  const decision=expectedDirectHttpStatus(pathname,compiled);
  if(req.method!=='GET'){
   res.writeHead(405,{...textHeaders,allow:'GET'});res.end('METHOD_NOT_ALLOWED');return;
  }
  if(pathname==='/web/'){
   res.writeHead(200,{...textHeaders,'content-type':'text/html; charset=utf-8'});
   res.end('<!doctype html><html><head><meta name="robots" content="noindex"></head><body><p>synthetic public-root transport test only</p></body></html>');
   return;
  }
  if(decision.status===301){
   res.writeHead(301,{...textHeaders,location:decision.location});
   res.end('SYNTHETIC_ALIAS_REDIRECT_ONLY');return;
  }
  if(decision.status===200){
   // A real deployment must render a rights-reviewed entity page at this path
   // using actual authoritative data. This fixture intentionally NEVER does.
   res.writeHead(200,{...textHeaders,'content-type':'text/html; charset=utf-8'});
   res.end('<!doctype html><html><head><meta name="robots" content="noindex"></head><body><p>synthetic HTTP200 route transport only; NOT a published Entity</p></body></html>');
   return;
  }
  res.writeHead(404,textHeaders);res.end('UNVERIFIED_OR_UNPUBLISHED_ENTITY');
 });
 return Object.freeze({server,compiled});
}
