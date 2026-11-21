// 04 QR-W / R12/R19/R20: passive real DNS / TLS SNI / HTTP root+www.
// Never changes DNS, custom-domain files, Pages, account, production, or code.
// Every result includes evidence type; transport errors are NOT proof of DNS misconfiguration.
import { promises as dns } from 'node:dns';
import tls from 'node:tls';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec=promisify(execFile);
const main='340461f4a2960f8033fc13be9d5eaef8554d252d';
if(process.env.QRW_ROOT_EXPECTED_MAIN!==main)throw Error('FIXED_MAIN_MISMATCH');
const target='dreamwishwand.com';
const hosts=[target,'www.'+target];
const now=new Date().toISOString();
function info(kind,data){console.log('QRW_ROOT '+kind+' '+JSON.stringify(data));}
info('START',{timestamp:now,scope:'READ_ONLY_EXTERNAL_OBSERVATION',main,queryHosts:hosts,authoritativeAudit:true});
async function dig(host,type,server=null,timeout=6500){
 const args=['+time=3','+tries=1','+noall','+comments','+answer','+authority','+nocmd'];
 if(server){args.push('+norecurse','@'+server);}
 args.push(host,type);
 try{
  const r=await exec('dig',args,{timeout,maxBuffer:100000});
  const lines=r.stdout.split('\n');
  const status=lines.find(x=>/^;; ->>HEADER<<-/.test(x))?.match(/status:\s*([A-Z]+)/)?.[1]??'UNKNOWN';
  const flags=lines.find(x=>x.startsWith(';; flags:'))??'';
  const aa=/\baa\b/.test(flags);
  const records=lines.filter(x=>x&&!x.startsWith(';')&&/\sIN\s(?:A|AAAA|CNAME|NS|SOA|CAA|HTTPS|TXT|DS)\s/.test(x));
  const ns=records.filter(x=>/\sIN\sNS\s/.test(x)).map(x=>x.trim().split(/\s+/).at(-1).replace(/\.$/,'').toLowerCase());
  return {resolver:server??'system-recursive',host,type,status,aa,records,ns,flags:flags.trim(),error:null};
 }catch(e){return {resolver:server??'system-recursive',host,type,status:'UNKNOWN',aa:false,records:[],ns:[],error:e.code??String(e).slice(0,140)};}
}
const delegated=await dig(target,'NS','a.gtld-servers.net');
info('GTLD_DELEGATION',{query:delegated,status:delegated.status,delegatedNameservers:delegated.ns,source:'registry-server-direct-not-zone-authority'});
const NS=await dig(target,'NS');
const SOA=await dig(target,'SOA');
info('RECURSIVE_NS_SOA',{ns:NS,soa:SOA});
let nameservers=[...new Set([...delegated.ns,...NS.ns])];
if(nameservers.length===0){
 try{
  nameservers=await dns.resolveNs(target);
  info('NODE_RECURSIVE_NS',{nameservers,source:'system-recursive-not-authority'});
 }catch(e){info('NODE_RECURSIVE_NS_ERROR',{code:e.code,message:String(e.message).slice(0,180)});}
}
const recTypes=['A','AAAA','CNAME','HTTPS'];
const publicDNS=await Promise.all(hosts.flatMap(h=>[...recTypes,'CAA'].map(t=>dig(h,t))));
publicDNS.forEach(x=>info('RECURSIVE_RECORD',{host:x.host,type:x.type,status:x.status,aa:x.aa,records:x.records,error:x.error}));
for(const resolver of ['https://cloudflare-dns.com/dns-query','https://dns.google/resolve']){
 for(const type of ['NS','A','AAAA','CNAME']){
  const h=type==='NS'?target:hosts[type==='CNAME'?1:0];
  try{
   const u=new URL(resolver);u.searchParams.set('name',h);u.searchParams.set('type',type);
   const resp=await fetch(u,{headers:{Accept:'application/dns-json'},signal:AbortSignal.timeout(6500)});
   const result=resp.status===200?await resp.json():null;
   info('PUBLIC_DOH',{resolver,host:h,type,http:resp.status,rcode:result?.Status??null,AD:result?.AD??null,
     answers:result?.Answer?.map(x=>({name:x.name,type:x.type,ttl:x.TTL,data:x.data})).slice(0,15)??[],
     errors:result?.Comment?.slice?.(0,200)??null});
  }catch(e){info('PUBLIC_DOH_ERROR',{resolver,host:h,type,code:e.cause?.code??e.code??'ERROR',message:String(e.message).slice(0,140)});}
 }
}
nameservers=nameservers.filter(x=>/^[a-z0-9.-]+$/i.test(x));
info('AUTHORITATIVE_CANDIDATE_NS',{nameservers,delegationFromRegistry:delegated.ns.length>0});
const authQueries=[];
for(const ns of nameservers.slice(0,4)){
 authQueries.push(dig(target,'SOA',ns),dig(target,'NS',ns));
 for(const host of hosts)for(const type of recTypes)authQueries.push(dig(host,type,ns));
}
const authoritative=await Promise.all(authQueries);
for(const x of authoritative)info('DIRECT_NS_QUERY',{host:x.host,type:x.type,ns:x.resolver,rcode:x.status,AA:x.aa,
  records:x.records,error:x.error});
const aaCount=authoritative.filter(x=>x.aa&&x.status!=='UNKNOWN').length;
info('AUTHORITATIVE_SUMMARY',{authoritativeRespondingRecords:aaCount,totalDirectQueries:authoritative.length,
  note:'Only AA=true and actual DNS answers qualify as direct zone evidence. No response is UNKNOWN, not NXDOMAIN.'});
async function tlsProbe(host,rejectUnauthorized){
 return await new Promise(resolve=>{
  let done=false;
  const finish=x=>{if(done)return;done=true;resolve(x);};
  const state={host,sni:host,rejectUnauthorized,connected:false,authorized:false,authorizationError:null,peerIP:null,protocol:null,cert:null,error:null};
  const s=tls.connect({host,port:443,servername:host,timeout:7500,rejectUnauthorized});
  s.once('secureConnect',()=>{
   state.connected=true;state.authorized=s.authorized;state.authorizationError=s.authorizationError??null;
   state.peerIP=s.remoteAddress??null;state.protocol=s.getProtocol();
   const c=s.getPeerCertificate();
   if(c&&c.subject){
    state.cert={subject:c.subject,issuer:c.issuer,valid_from:c.valid_from,valid_to:c.valid_to,
      subjectaltname:c.subjectaltname,fingerprint256:c.fingerprint256,
      serialNumber:c.serialNumber};
   }
   s.end();finish(state);
  });
  s.once('timeout',()=>{state.error='TIMEOUT';s.destroy();finish(state);});
  s.once('error',e=>{state.error={code:e.code??'ERROR',message:String(e.message).slice(0,220)};finish(state);});
  s.once('close',()=>{if(!done){state.error='CLOSED_BEFORE_HANDSHAKE';finish(state);}});
 });
}
for(const host of hosts){
 const [presented,strict]=await Promise.all([tlsProbe(host,false),tlsProbe(host,true)]);
 info('TLS_SNI_CERT',{host,presented,strictVerified:{connected:strict.connected,authorized:strict.authorized,
   authorizationError:strict.authorizationError,error:strict.error,peerIP:strict.peerIP},confidence:strict.authorized?'ACTUAL_VALID_TLS':'UNVERIFIED_OR_FAILED_NOT_ASSUMED'});
}
const httpEndpoints=hosts.flatMap(h=>['http:','https:'].map(proto=>proto+'//'+h+'/'));
const requests=[];
for(const u of httpEndpoints){
 for(const method of ['HEAD','GET']){
  try{
   const r=await fetch(u,{method,redirect:'manual',signal:AbortSignal.timeout(9500),headers:{'User-Agent':'QR-W-read-only-domain-probe/20261109'}});
   const x={url:u,method,status:r.status,statusText:r.statusText,location:r.headers.get('location'),
     contentType:r.headers.get('content-type'),server:r.headers.get('server'),resolvedUrl:r.url,
     wasRedirect:[301,302,303,307,308].includes(r.status),error:null};
   requests.push(x);
   if(r.body)await r.body.cancel();
   info('HTTP_MANUAL',x);
  }catch(e){const x={url:u,method,status:null,location:null,
    error:{code:e.cause?.code??e.code??'ERROR',message:String(e.message).slice(0,220)}};requests.push(x);info('HTTP_MANUAL',x);}
 }
}
const visited=new Set();
for(let start of httpEndpoints){
 const links=[];let url=start;
 for(let i=0;i<5;i++){
  if(visited.has(url))break;
  visited.add(url);
  let r;
  try{r=await fetch(url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(9000)});}
  catch(e){links.push({url,error:e.cause?.code??'FETCH_FAILED'});break;}
  const next=r.headers.get('location');
  links.push({url,status:r.status,location:next});
  if(r.body)await r.body.cancel();
  if(!next||![301,302,303,307,308].includes(r.status))break;
  try{
   const dest=new URL(next,url);
   if(!['dreamwishwand.com','www.dreamwishwand.com','dreamwishwand.github.io'].includes(dest.hostname)){
    links.push({unfollowed:dest.toString(),reason:'UNRELATED_HOST_NO_FOLLOW'});break;
   }
   url=dest.toString();
  }catch(e){links.push({invalidLocation:next});break;}
 }
 info('HTTP_ACTUAL_REDIRECT_CHAIN',{start,links});
}
try{
 const r=await fetch('https://dreamwishwand.github.io/web/',{method:'HEAD',redirect:'manual',signal:AbortSignal.timeout(9000)});
 info('EXISTING_GITHUB_PAGES_UNTOUCHED',{url:r.url,status:r.status,location:r.headers.get('location')});
 if(r.body)await r.body.cancel();
}catch(e){info('EXISTING_GITHUB_PAGES_UNKNOWN',{code:e.cause?.code??'ERROR',message:String(e.message).slice(0,150)});}
info('END',{timestamp:new Date().toISOString(),dnsAuthAA:aaCount,requestCount:requests.length,
  httpObserved:requests.filter(x=>x.status!==null).length,tlsNotInferred:true,
  changes:'NONE',writer:'OFF',cloud:'OFF',provider:'OFF',communityPublic:'OFF'});
