// DEV-only isolated Owner-local read metadata UI (no full JSON transport).
import {OWNER_LOCAL_V1_ATTESTATION_CONTRACT}
  from './attestation.mjs';
const worker=new Worker('./dev-read.worker.mjs',{type:'module'});
const by=id=>document.getElementById(id);
let nextRequestId=0,latest=0,opened=false;
const pageState={player:0,world:0};
const setEnabled=v=>{
  opened=v;
  for(const d of ['player','world'])by(d).disabled=!v||pageState[d]===null;
};
const show=(message,data=null)=>{
  by('status').textContent=message;
  by('receipt').textContent=data===null?'':JSON.stringify(data,null,2);
};
worker.addEventListener('message',({data})=>{
  if(!data||data.requestId!==latest)return;
  if(data.ok!==true){
    show('Fail-closed: '+String(data.error||'OWNER_LOCAL_DEV_DENIED').slice(0,128));
    if(data.error==='OWNER_LOCAL_DEV_READ_FAILED_CLOSED')setEnabled(false);
    return;
  }
  const result=data.summary;
  if(result?.closed===true){
    pageState.player=0;pageState.world=0;setEnabled(false);
    show('Session closed and revoked');return;
  }
  if(result?.contract==='wand.owner.local.dev-read-metadata@1'){
    const domain=result.domain==='/Player'?'player':'world';
    pageState[domain]=result.nextPageIndex;
    setEnabled(opened);
    show('DEV Rust typed metadata only — no field values',result);
    return;
  }
  pageState.player=0;pageState.world=0;
  setEnabled(true);
  show('Local Rust read-only Session opened, product operation still OFF',result);
});
worker.addEventListener('error',()=>{
  setEnabled(false);show('Worker execution failed closed');
});
by('proof').addEventListener('submit',e=>{
  e.preventDefault();
  const file=by('file').files?.[0];
  if(!file){show('Choose an encrypted P1G');return}
  setEnabled(false);
  latest=++nextRequestId;
  const attestation={
    contract:OWNER_LOCAL_V1_ATTESTATION_CONTRACT,
    platform:'steam-windows',
    buildKind:'steam-full-version',fullVersion:by('build').value,
    schema:626,originalSha256:by('sha').value,
    evidenceKind:'owner-observed-installed-steam-fullversion',
    observedOutsideSave:by('ack').checked
  };
  show('Opening local Rust read-only Session...');
  worker.postMessage({kind:'OPEN_LOCAL_V1',requestId:latest,file,attestation});
});
for(const domain of ['player','world']){
  by(domain).addEventListener('click',()=>{
    if(!opened||pageState[domain]===null)return;
    latest=++nextRequestId;
    const pageIndex=pageState[domain];
    by('player').disabled=true;by('world').disabled=true;
    show('Reading Rust-validated typed metadata (maximum 16 entries)...');
    worker.postMessage({kind:'DEV_READ_METADATA',requestId:latest,domain,pageIndex});
  });
}
by('close').addEventListener('click',()=>{
  setEnabled(false);
  latest=++nextRequestId;
  pageState.player=0;pageState.world=0;
  by('file').value='';
  worker.postMessage({kind:'CLOSE_LOCAL_V1',requestId:latest});
  show('Closing Rust Session...');
});
