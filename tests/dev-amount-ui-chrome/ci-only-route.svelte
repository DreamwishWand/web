<script>
  // Test harness source is copied to a temporary LOCAL DEV route by CI only.
  import LocalAmountEditorDev from '$lib/dev/LocalAmountEditorDev.svelte';
  import {readBoundEncryptedCopy} from '$lib/dev/local-amount-worker-adapter.mjs';
  const aSha='f5a5fd42d16a20302798ef6ed309979b43003d2320d9f0e8ea9831a92759fb4b',bSha='16abab341fb7f370e27e4dadcf81766dd0dfd0ae64469477bb2cf6614938b2af';
  const originalBytes=new Uint8Array(64),editedBytes=Uint8Array.from([1,...new Uint8Array(63)]);
  let directory=null,epoch=0;
  async function persist(name,bytes){
    directory=await navigator.storage.getDirectory();
    const h=await directory.getFileHandle(name,{create:true}),w=await h.createWritable();
    await w.write(bytes);await w.close();
  }
  const kind=k=>({kind:k,ok:true,writerAuthorized:false,nativeV3Verified:false,
    originalOverwriteAuthorized:false});
  const target={kind:'InventoryExistingAmountDecrease',targetId:4,
    itemId:30000001,slotIndex:0,compatibleItemType:'ItemType_Ingredient',
    oldAmount:50,registryVerified:true,sourceVerified:true,rightsAllowed:true};
  const furnitureZero={...target,targetId:0,itemId:40000001,compatibleItemType:'ItemType_Furniture',oldAmount:7};
  let staged=false,backed=false;
  const trustedWorkerAdapter={
    async open({file,build,originalSha256}){
      if(file?.name!=='synthetic-ci.p1g'||file.size!==64||
         build?.schema!==626||originalSha256!==aSha)
         throw Error('DENIED');
      return kind('OPEN');
    },
    async backupOriginal(){await persist('backup-ci.p1g',originalBytes);backed=true;return{backupReadbackVerified:true,
      originalUnchanged:true,shaMatched:true,sizeMatched:true,separateName:true,
      originalName:'synthetic-ci.p1g',originalSha256:aSha,originalSizeBytes:64,
      backupName:'backup-ci.p1g'}},
    async listVerifiedTargets(){if(!backed)throw Error('DENIED');
      return {targets:[target,furnitureZero],rawDocumentExposed:false}},
    async stageTyped(commands){
      const c=commands?.[0];
      const exact=t=>c?.kind===t.kind&&c.inventoryId===t.targetId&&
        c.canonicalItemId===t.itemId&&c.compatibleItemType===t.compatibleItemType&&
        c.expectedOldAmount===t.oldAmount&&c.newAmount===t.oldAmount-1;
      if(commands?.length!==1||![target,furnitureZero].some(exact))throw Error('DENIED');
      staged=true;return kind('STAGED');
    },
    async undo(){staged=false;return kind('UNDONE')},
    async redo(){staged=true;return kind('REDONE')},
    async exportEditedCopy(){if(!backed||!staged)throw Error('DENIED');
      await persist('edited-ci.p1g',editedBytes);
      return {kind:'EXPORTED',ok:true,editedCopyName:'edited-ci.p1g',editedSha256:bSha,editedSizeBytes:64,
        backupName:'backup-ci.p1g',editedCiphertextVerified:true,
        freshWorkerReopenVerified:true,independentProcessReopenVerified:false,
        originalUnchanged:true,writerAuthorized:false,nativeV3Verified:false,
        originalOverwriteAuthorized:false};
    },
    async downloadVerifiedCopy(which){
      if(!backed||!directory||(which!=='backup'&&which!=='edited')||(which==='edited'&&!staged))throw Error('DENIED');
      const token=epoch;return readBoundEncryptedCopy({directory,name:which==='backup'?'backup-ci.p1g':'edited-ci.p1g',sha:which==='backup'?aSha:bSha,size:64},()=>{if(epoch!==token)throw Error('STALE')});
    },
    async close(){epoch++;staged=false;backed=false;directory=null;return kind('CLOSED')}
  };
</script>
<LocalAmountEditorDev verifiedLocalDevGate={true} {trustedWorkerAdapter}/>
