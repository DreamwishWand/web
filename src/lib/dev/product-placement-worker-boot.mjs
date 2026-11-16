// One existing owner/bridge/P1G adapter; runtime and operation fixed by the dedicated entrypoint.
export async function bootPlacement(runtimeLoader,localFactory,install,operation){
 try{
  const runtime=await runtimeLoader();if(runtime.operation!==operation||runtime.writerAuthorized!==false||runtime.productConsumerEnabled!==false||runtime.attestationVerifiedAtBuild!==true)throw Error('DENIED');
  const local=localFactory({wasmFactory:async()=>({WorkerWasmSource:runtime.WorkerWasmSource})});
  const adapter=Object.freeze({...local,open(args){if(!args||!runtime.builds.some(b=>args.build?.platform===b.platform&&args.build?.buildId===b.buildId))throw Error('DENIED');return local.open(args)}});
  install(self,adapter);self.postMessage({kind:'SCOPED_PLACEMENT_RUNTIME_READY',releaseId:runtime.releaseId,operation:runtime.operation,mode:runtime.mode,builds:runtime.builds,writerAuthorized:false});
 }catch{self.postMessage({kind:'SCOPED_PLACEMENT_RUNTIME_DENIED'});self.close()}
}
