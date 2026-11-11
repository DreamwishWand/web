window.__stageF=new Promise((resolve,reject)=>{
 const worker=new Worker('./worker.mjs',{type:'module'});
 let done=false;
 worker.onerror=e=>{if(!done){done=true;worker.terminate();reject(Error('R22_WORKER_ERROR:'+e.message))}};
 worker.onmessage=e=>{
  if(done)return;done=true;worker.terminate();
  if(e.data?.ok){document.getElementById('test').textContent='PASS';resolve(e.data.result)}
  else{document.getElementById('test').textContent='FAIL';reject(Error(String(e.data?.error||'unknown')))}
 };
 worker.postMessage({kind:'R22_CANDIDATE_TEST'});
});
