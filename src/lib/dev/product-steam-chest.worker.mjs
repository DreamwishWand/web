// Dedicated product Worker, one existing owner/bridge/adapter/port. Only the
// build-sealed, actually signed scoped Runtime can reach this entrypoint.
import {loadProtectedScopedSteamChestRustWasm} from '../ddv/core/save/product-scoped-steam-chest-release.mjs';
import {createProductSteam626ChestLocalAdapter} from '../ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {installLocalDevAmountWorker} from './local-scoped-edit-worker-port.mjs';
const fail=()=>{throw Error('STEAM_CHEST_PRODUCT_RUNTIME_DENIED')};
async function boot(){
 const runtime=await loadProtectedScopedSteamChestRustWasm();
 if(runtime.writerAuthorized!==false||runtime.productConsumerEnabled!==false||runtime.attestationVerifiedAtBuild!==true)fail();
 const local=createProductSteam626ChestLocalAdapter({wasmFactory:async()=>({WorkerWasmSource:runtime.WorkerWasmSource})});
 // Scope comes only from the sealed release, not a UI-supplied flag or plan.
 const adapter=Object.freeze({...local,open(args){
  if(!args||!runtime.builds.some(b=>args.build?.platform===b.platform&&args.build?.buildId===b.buildId))fail();
  return local.open(args);
 }});
 installLocalDevAmountWorker(self,adapter);
 self.postMessage({kind:'SCOPED_STEAM_CHEST_RUNTIME_READY',releaseId:runtime.releaseId,operation:runtime.operation,
  mode:runtime.mode,builds:runtime.builds,writerAuthorized:false});
}
boot().catch(()=>{self.postMessage({kind:'SCOPED_STEAM_CHEST_RUNTIME_DENIED'});self.close()});
