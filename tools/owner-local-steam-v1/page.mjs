import {OWNER_LOCAL_V1_ATTESTATION_CONTRACT}
  from './attestation.mjs';
const worker=new Worker('./worker.mjs',{type:'module'});
let requestId=0,latest=0;
const by=id=>document.getElementById(id);
const show=(message,receipt=null)=>{
  by('status').textContent=message;
  by('receipt').textContent=receipt?JSON.stringify(receipt,null,2):'';
};
worker.addEventListener('message',e=>{
  const x=e.data;
  if(!x||x.requestId!==latest)return; // A->B stale output ignored
  if(x.ok===true)show(x.summary?.closed?'Closed / Rust Session revoked':
    'Owner-local scoped V1 structural read completed (NOT Writer accepted)',x.summary);
  else show('Fail-closed: '+String(x.error||'OWNER_LOCAL_DENIED').slice(0,110));
});
worker.addEventListener('error',()=>show('Worker execution failed closed'));
by('proof').addEventListener('submit',e=>{
  e.preventDefault();
  const file=by('file').files?.[0];
  if(!file){show('Choose a local encrypted P1G');return}
  const attestation={
    contract:OWNER_LOCAL_V1_ATTESTATION_CONTRACT,
    platform:'steam-windows',
    buildKind:'steam-full-version',
    fullVersion:by('build').value,
    schema:626,
    originalSha256:by('sha').value,
    evidenceKind:'owner-observed-installed-steam-fullversion',
    observedOutsideSave:by('ack').checked
  };
  latest=++requestId;
  show('Checking only inside the local Worker...');
  // File is structured-cloned to Worker, NOT read/decoded by the page.
  worker.postMessage({kind:'OPEN_LOCAL_V1',requestId:latest,file,attestation});
});
by('close').addEventListener('click',()=>{
  latest=++requestId;
  worker.postMessage({kind:'CLOSE_LOCAL_V1',requestId:latest});
  by('file').value='';
  show('Closing local Rust Session...');
});
