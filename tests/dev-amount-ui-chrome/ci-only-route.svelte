<script>
  // Test harness source is copied to a temporary LOCAL DEV route by CI only.
  import LocalAmountEditorDev from '$lib/dev/LocalAmountEditorDev.svelte';
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
         build?.schema!==626||originalSha256!=='a'.repeat(64))
         throw Error('DENIED');
      return kind('OPEN');
    },
    async backupOriginal(){backed=true;return{backupReadbackVerified:true,
      originalUnchanged:true,shaMatched:true,sizeMatched:true,separateName:true,
      originalName:'synthetic-ci.p1g',originalSha256:'a'.repeat(64),originalSizeBytes:64,
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
      return {kind:'EXPORTED',ok:true,editedCopyName:'edited-ci.p1g',
        backupName:'backup-ci.p1g',editedCiphertextVerified:true,
        freshWorkerReopenVerified:true,independentProcessReopenVerified:false,
        originalUnchanged:true,writerAuthorized:false,nativeV3Verified:false,
        originalOverwriteAuthorized:false};
    },
    async close(){staged=false;backed=false;return kind('CLOSED')}
  };
</script>
<LocalAmountEditorDev verifiedLocalDevGate={true} {trustedWorkerAdapter}/>
