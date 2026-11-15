// ACT965: thin, Worker-private source adapter for PR1318's read-only candidate ABI.
// No new Session, Worker, registry, edit grant or UI route. A trusted existing
// owner must supply its active Rust instance, receipt, identity and strict parser.
// Candidate-only data must never be passed to the exact1 editable-target consumer.
const deny=()=>{throw Error('COLLECTION_CANDIDATE_READ_DENIED')};
const exact=(v,k)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===k.split(',').sort().join(',');
const uint=n=>Number.isSafeInteger(n)&&n>=0&&n<=0xffffffff;
const sha=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const sid=s=>typeof s==='string'&&/^[a-f0-9]{32}$/.test(s)&&!/^0{32}$/.test(s);
const STEAM='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',SWITCH='9A239D3DB569756D';
const CONTRACT='wand.worker.collection-scoped-candidate@1';
const HASHES=['itemDefinitionSha256','collectionDefinitionSha256','groupDefinitionSha256','entrySha256','groupSha256','mapSha256','stockEntrySha256'];
const KEYS='contract,platform,buildKind,buildId,sessionId,revision,indexGeneration,decodedSha256,definitionId,groupIndex,itemId,old,new,falseCount,positiveStock,packagedCandidateVerified,sourcePhysicalVerified,effectiveEligibilityVerified,writerAuthorized,editedCopyAuthorized,applyAuthorized,'+HASHES.join(',');
export function readCollectionCandidate(owner,selector){
 if(typeof document!=='undefined'||!owner||typeof owner.current!=='function'||typeof owner.revoke!=='function'||typeof owner.parse!=='function'||!owner.current())deny();
 const {wasm,receipt:r,identity:b}=owner;
 if(!wasm||typeof wasm.preview_scoped_collection_candidate!=='function'||!r||!b||b.schema!==626||
   r.contract!=='wand.product.single-save-session.boundary@1'||r.schema!==626||!sid(r.sessionId)||!sha(r.decodedSha256)||
   r.revision!==0||r.indexGeneration!==1||r.productWorkerBound!==true||r.fullDocumentJsonValidated!==true||
   r.writerAuthorized!==false||r.editedCopyAuthorized!==false||r.applyAuthorized!==false)deny();
 const steam=b.platform==='steam-windows'&&b.buildKind==='steam-full-version'&&b.buildId===STEAM;
 const sw=b.platform==='switch'&&b.buildKind==='switch-bid'&&b.buildId===SWITCH;
 if(!steam&&!sw)deny();
 if(!exact(selector,'definitionId,groupIndex,itemId')||!uint(selector.definitionId)||Math.floor(selector.definitionId/10000000)!==212||
   !uint(selector.groupIndex)||!uint(selector.itemId)||Math.floor(selector.itemId/10000000)!==4)deny();
 const {definitionId,groupIndex,itemId}=selector;
 const scope={sessionId:r.sessionId,revision:r.revision,indexGeneration:r.indexGeneration,decodedSha256:r.decodedSha256};
 let raw;
 try{raw=wasm.preview_scoped_collection_candidate(definitionId,groupIndex,itemId,scope.sessionId,BigInt(scope.revision),BigInt(scope.indexGeneration),scope.decodedSha256)}
 catch{deny()} // Core candidate rejection is not authorization and need not close an unrelated read.
 if(!owner.current())deny();
 try{
  if(typeof raw!=='string'||raw.length>4096)deny();
  const x=owner.parse(raw,4096);
  if(!exact(x,KEYS)||x.contract!==CONTRACT||x.platform!==(steam?'SteamWindows':'Switch')||x.buildKind!==(steam?'SteamFullVersion':'SwitchBid')||x.buildId!==b.buildId||
    x.sessionId!==scope.sessionId||x.revision!==scope.revision||x.indexGeneration!==scope.indexGeneration||x.decodedSha256!==scope.decodedSha256||
    x.definitionId!==definitionId||x.groupIndex!==groupIndex||x.itemId!==itemId||x.old!==false||x.new!==true||
    !uint(x.falseCount)||x.falseCount<2||(steam&&x.falseCount!==3)||!uint(x.positiveStock)||x.positiveStock<1||x.positiveStock>0x7fffffff||
    !HASHES.every(k=>sha(x[k]))||x.packagedCandidateVerified!==true||x.sourcePhysicalVerified!==true||
    x.effectiveEligibilityVerified!==false||x.writerAuthorized!==false||x.editedCopyAuthorized!==false||x.applyAuthorized!==false)deny();
  if(!owner.current())deny();
  // No raw receipt, scope tokens, hashes, candidate edit plan, Core-minted
  // target, or eligibility grant leaves this projection.
  return Object.freeze({kind:'COLLECTION_CANDIDATE_READ_ONLY',definitionId,groupIndex,itemId,platform:b.platform,
   falseCount:x.falseCount,positiveStock:x.positiveStock,packagedCandidateVerified:true,sourcePhysicalVerified:true,
   effectiveEligibilityVerified:false,writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false});
 }catch{
  if(owner.current())owner.revoke();
  deny();
 }
}
