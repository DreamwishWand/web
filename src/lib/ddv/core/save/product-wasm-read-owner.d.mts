/** W-CORE-004/R04: opt-in WASM interface bound only inside a trusted Worker.
 * No UI P1G bytes, no whole-document transfer via postMessage, no Writer.
 * This module is NOT imported by the existing production Worker until a real
 * signed wasm bundle, external Build evidence and independent QA are accepted.
 */
export declare const PRODUCT_WASM_READ_CONTRACT:
  'wand.product.single-save-session.boundary@1';
export declare const PRODUCT_WASM_WORKER_MAX_BYTES:134217728;
export declare const PRODUCT_WASM_CHUNK_MAX_BYTES:1048576;
export type WorkerBuildEvidence=Readonly<{
  platform:'switch'|'steam-windows';
  buildKind:'switch-bid'|'steam-full-version';
  buildId:string;
  schema:626;
  externallyConfirmed:true;
}>;
export type ProductWasmReceipt=Readonly<{
  contract:typeof PRODUCT_WASM_READ_CONTRACT;
  sessionId:string; // Rust-derived single session id; not authorization from UI
  decodedSha256:string; // not encrypted P1G source SHA
  revision:0;indexGeneration:1;schema:626;
  fullDocumentJsonValidated:true;
  productWorkerBound:true;
  allDomainReferencesVerified:false;productReadAccepted:false;
  writerAuthorized:false;editedCopyAuthorized:false;applyAuthorized:false;
}>;
export type ProductWasmScope=Pick<ProductWasmReceipt,
  'sessionId'|'revision'|'indexGeneration'|'decodedSha256'>;
export type CoreVersionWitness=Readonly<ProductWasmScope &{
  coreOwnedReadset:'/GameInfo/Version';
  completeAllDomains:false;writerAuthorized:false;
}>;
export interface WorkerWasmSource {
  append_chunk(chunk:Uint8Array):void;
  finish():string;
  read_core_version_witness(sessionId:string,revision:bigint,indexGeneration:bigint,decodedSha256:string):string;
  /** Optional indexed-read WASM feature only; not the production Reader. */
  issue_typed_cursor(domain:'player'|'world',sessionId:string,revision:bigint,indexGeneration:bigint,decodedSha256:string):string;
  read_typed_page(cursor:string,sessionId:string,revision:bigint,indexGeneration:bigint,decodedSha256:string):string;
  /** R22 stored DiffGrids ONLY; native effective Layout and Writer remain OFF. */
  issue_saved_diffgrids_typed_cursor(sessionId:string,revision:bigint,indexGeneration:bigint,decodedSha256:string):string;
  read_saved_diffgrids_typed_page(cursor:string,sessionId:string,revision:bigint,indexGeneration:bigint,decodedSha256:string):string;
  close():void;
}
export type ProductWorkerWasmFactory=()=>Promise<{
  WorkerWasmSource:new(platform:string,kind:string,buildId:string,schema:number,
    externallyAttested:boolean,entropy:Uint8Array)=>WorkerWasmSource
}>;
export type ProductWasmReadOwner=
 Readonly<{
  openDecoded(args:{build:WorkerBuildEvidence;decodedChunks:AsyncIterable<Uint8Array>}):
    Promise<ProductWasmReceipt>;
  readCoreVersion(scope:ProductWasmScope):CoreVersionWitness;
  /** Source-only Worker internal; no product/consumer permission. */
  issueTypedCursor(scope:ProductWasmScope,domain:'player'|'world'):Readonly<ProductWasmScope &{
    cursor:string;domain:'/Player'|'/World';maxEntriesPerPage:16;
    completeAllDomains:false;productReadAccepted:false;writerAuthorized:false;
  }>;
  readTypedPage(scope:ProductWasmScope,cursor:string):Readonly<ProductWasmScope &{
    domain:'/Player'|'/World';fields:ReadonlyArray<Readonly<{
      key:string;kind:'object'|'array'|'string'|'number'|'boolean'|'null';valueBytes:number;
    }>>;nextCursor:string|null;
    completeAllDomains:false;productReadAccepted:false;writerAuthorized:false;
  }>;
  /** Trusted Worker-private token: NEVER post cursor to UI. */
  issueSavedDiffGridsCursor(scope:ProductWasmScope):Readonly<{
    cursor:string;indexedRecords:number;maxRecordsPerPage:8;
    productReadAccepted:false;writerAuthorized:false;
  }>;
  /** UI-safe projection, no full ObjectID arrays, path, read-set or secret. */
  readSavedDiffGridsPage(scope:ProductWasmScope,cursor:string):Readonly<{
    records:ReadonlyArray<Readonly<{
      gridId:number;defaultLayoutGridId:number|null;
      defaultGridHashCode:number|null;defaultGridDataHashCode:number|null;
      modifiedObjectCount:number;removedObjectCount:number;
      modifiedRemovedSameIdPairs:number;
      externalLayoutStatus:'UNRESOLVED_EXTERNAL_LAYOUT';
      nativeEffectiveGridVerified:false;
    }>>;
    nextCursor:string|null;
    externalLayoutStatus:'UNRESOLVED_EXTERNAL_LAYOUT';
    allNativeReferencesVerified:false;productReadAccepted:false;
    writerAuthorized:false;
  }>;
  close():Readonly<{closed:true;writerAuthorized:false}>;
  submitOperation(command:unknown):never;
  getReceipt():ProductWasmReceipt|null;
  getCapabilities():Readonly<{
    productWorkerBoundary:true;productReadAccepted:false;oneRustSession:true;
    typedMetadataSourceOnly:true;canReadTypedMetadataInProduct:false;
    readCoreVersionOnly:true;completeAllDomains:false;
    canStage:false;canExportEditedCopy:false;canApply:false;
    canOriginalOverwrite:false;maxChunkBytes:number;maxDecodedBytes:number;
  }>;
 }>;

/** Opt-in source-only transport; no authority or public route. The decoded
 * result is Worker-private and must go directly to the existing P1G Codec. */
export type ScopedAmountSelection=Readonly<{
 profile:'catalog0-furniture'|'linked-crop-chest48';id:number;selector:number;newAmount:number;
}>;
export type ScopedAmountPreview=Readonly<ScopedAmountSelection & {
 itemId:number;oldAmount:number;scopedCandidate:true;writerAuthorized:false;editedCopyAuthorized:false;
}>;
export type ScopedAmountSourceOwner=ProductWasmReadOwner & Readonly<{
 discoverScopedTargets(profile:ScopedAmountSelection['profile']):ReadonlyArray<Readonly<{profile:ScopedAmountSelection['profile'];id:number;selector:number;itemId:number;oldAmount:number}>>;
 previewScopedAmount(selection:ScopedAmountSelection):ScopedAmountPreview;
 stageScopedAmount():Readonly<ScopedAmountPreview & {applied:true;exactFieldChangedCount:1}>;
 toggleScopedAmount(redo:boolean):Readonly<ScopedAmountPreview & {applied:boolean;exactFieldChangedCount:1}>;
 takeScopedAmountOutput():Promise<Readonly<{decodedBytes:Uint8Array;decodedSha256:string}>>;
}>;
export type FixedCollectionSelection=Readonly<{definitionId:number;groupIndex:number;itemId:number}>;
export type FixedCollectionPreview=Readonly<FixedCollectionSelection & {
 oldValue:false;newValue:true;groupState:'NotComplete';falseCount:3;remainingFalseCount:2;
 fixedDefinitionVerified:true;installedRuntimeParityVerified:false;
 writerAuthorized:false;editedCopyAuthorized:false;applyAuthorized:false;
}>;
export type FixedCollectionSourceOwner=ProductWasmReadOwner & Readonly<{
 previewFixedCollection(selection:FixedCollectionSelection):FixedCollectionPreview;
 stageFixedCollection():Readonly<FixedCollectionPreview & {applied:true;exactFieldChangedCount:1}>;
 toggleFixedCollection(redo:boolean):Readonly<FixedCollectionPreview & {applied:boolean;exactFieldChangedCount:1}>;
 takeFixedCollectionOutput():Promise<Readonly<{decodedBytes:Uint8Array;decodedSha256:string}>>;
}>;
export type CollectionCandidateSourceOwner=ProductWasmReadOwner & Readonly<{
 readCollectionCandidate(selection:FixedCollectionSelection):Promise<Readonly<{
 kind:'COLLECTION_CANDIDATE_READ_ONLY';definitionId:number;groupIndex:number;itemId:number;
 platform:'steam-windows'|'switch';falseCount:number;positiveStock:number;
 packagedCandidateVerified:true;sourcePhysicalVerified:true;effectiveEligibilityVerified:false;
 writerAuthorized:false;editedCopyAuthorized:false;applyAuthorized:false;
 }>>;
}>;
export declare function createProductWasmReadOwner(factory:ProductWorkerWasmFactory,options:{allowScopedAmountSource:true;allowScopedCollectionSource?:false;allowCollectionCandidateSource?:false;allowSwitch626ChestSource?:false;allowSteam626ChestSource?:false;placementScope?:null;allowSwitch626Catalog0Source?:false;backpackScope?:null;wardrobeScope?:null;appearanceScope?:null}):ScopedAmountSourceOwner;
export declare function createProductWasmReadOwner(factory:ProductWorkerWasmFactory,options:{allowScopedCollectionSource:true;allowScopedAmountSource?:false;allowCollectionCandidateSource?:false;allowSwitch626ChestSource?:false;allowSteam626ChestSource?:false;placementScope?:null;allowSwitch626Catalog0Source?:false;backpackScope?:null;wardrobeScope?:null;appearanceScope?:null}):FixedCollectionSourceOwner;
export declare function createProductWasmReadOwner(factory:ProductWorkerWasmFactory,options:{allowCollectionCandidateSource:true;allowScopedAmountSource?:false;allowScopedCollectionSource?:false;allowSwitch626ChestSource?:false;allowSteam626ChestSource?:false;placementScope?:null;allowSwitch626Catalog0Source?:false;backpackScope?:null;wardrobeScope?:null;appearanceScope?:null}):CollectionCandidateSourceOwner;
export declare function createProductWasmReadOwner(factory:ProductWorkerWasmFactory,options?:{allowScopedAmountSource?:false;allowScopedCollectionSource?:false;allowCollectionCandidateSource?:false;allowSwitch626ChestSource?:false;allowSteam626ChestSource?:false;placementScope?:null;allowSwitch626Catalog0Source?:false;backpackScope?:null;wardrobeScope?:null;appearanceScope?:null}):ProductWasmReadOwner;

export declare function createProductWasmReadOwner(factory:ProductWorkerWasmFactory,options:{allowSwitch626ChestSource:true;allowSteam626ChestSource?:false;allowScopedAmountSource?:false;allowScopedCollectionSource?:false;allowCollectionCandidateSource?:false;placementScope?:null;allowSwitch626Catalog0Source?:false;backpackScope?:null;wardrobeScope?:null;appearanceScope?:null}):ScopedAmountSourceOwner;

export declare function createProductWasmReadOwner(factory:ProductWorkerWasmFactory,options:{allowSteam626ChestSource:true;allowSwitch626ChestSource?:false;allowScopedAmountSource?:false;allowScopedCollectionSource?:false;allowCollectionCandidateSource?:false;placementScope?:null;allowSwitch626Catalog0Source?:false;backpackScope?:null;wardrobeScope?:null;appearanceScope?:null}):ScopedAmountSourceOwner;

export type ScopedMixedRoadSelection=Readonly<{gridId:number;retainedId:number;movedId:number}>;
export type ScopedMixedRoadPreview=Readonly<ScopedMixedRoadSelection&{itemId:40100068;nextObjectId:number;oldAmount:number;newAmount:number;exactFieldChangedCount:8;inventoryDelta:-3;addObjects:3;scopedCandidate:true;writerAuthorized:false;editedCopyAuthorized:false}>;
export type ScopedMixedRoadSourceOwner=ProductWasmReadOwner&Readonly<{previewScopedPlacement(selection:ScopedMixedRoadSelection):ScopedMixedRoadPreview;stageScopedPlacement():Readonly<ScopedMixedRoadPreview&{applied:true}>;toggleScopedPlacement(redo:boolean):Readonly<ScopedMixedRoadPreview&{applied:boolean}>;takeScopedPlacementOutput():Promise<Readonly<{decodedBytes:Uint8Array;decodedSha256:string}>>}>;
export declare function createProductWasmReadOwner(factory:ProductWorkerWasmFactory,options:{placementScope:'rm01';allowScopedAmountSource?:false;allowScopedCollectionSource?:false;allowCollectionCandidateSource?:false;allowSwitch626ChestSource?:false;allowSteam626ChestSource?:false;allowSwitch626Catalog0Source?:false;backpackScope?:null;wardrobeScope?:null;appearanceScope?:null}):ScopedMixedRoadSourceOwner;
export type ScopedPlacementSelection=Readonly<{seedId:number}|{gridId:number;x:number;y:number}>;
export type ScopedPlacementPreview=Readonly<{itemId:number;gridId:number;nextObjectId:number;oldAmount:number;newAmount:number;exactFieldChangedCount:3|9;inventoryDelta:-1|0;addObjects:1|8;seedId?:number;retainSeed?:1;x?:number;y?:number;orientation?:'GridOrientation_Up';inventoryId?:0;scopedCandidate:true;writerAuthorized:false;editedCopyAuthorized:false}>;
export type ScopedPlacementSourceOwner=ProductWasmReadOwner & Readonly<{previewScopedPlacement(selection:ScopedPlacementSelection):ScopedPlacementPreview;stageScopedPlacement():Readonly<ScopedPlacementPreview&{applied:true}>;toggleScopedPlacement(redo:boolean):Readonly<ScopedPlacementPreview&{applied:boolean}>;takeScopedPlacementOutput():Promise<Readonly<{decodedBytes:Uint8Array;decodedSha256:string}>>}>;
export declare function createProductWasmReadOwner(factory:ProductWorkerWasmFactory,options:{placementScope:'comp03'|'vase'|'sr03';allowScopedAmountSource?:false;allowScopedCollectionSource?:false;allowCollectionCandidateSource?:false;allowSwitch626ChestSource?:false;allowSteam626ChestSource?:false;allowSwitch626Catalog0Source?:false;backpackScope?:null;wardrobeScope?:null;appearanceScope?:null}):ScopedPlacementSourceOwner;

export declare function createProductWasmReadOwner(factory:ProductWorkerWasmFactory,options:{allowSwitch626Catalog0Source:true;allowSwitch626ChestSource?:false;allowSteam626ChestSource?:false;allowScopedAmountSource?:false;allowScopedCollectionSource?:false;allowCollectionCandidateSource?:false;placementScope?:null;backpackScope?:null;wardrobeScope?:null;appearanceScope?:null}):ScopedAmountSourceOwner;

export type ScopedBackpackSelection=Readonly<{sourceSlot:number;destinationSlot:number}>;
export type ScopedBackpackPreview=Readonly<ScopedBackpackSelection&{containerId:0;itemId:30200001;oldAmount:number;newSourceAmount:number;newDestinationAmount:1;quantity:1;effectiveStackBound:50;exactFieldChangedCount:3;writerAuthorized:false;editedCopyAuthorized:false;originalOverwriteAuthorized:false}>;
export type ScopedBackpackSourceOwner=ProductWasmReadOwner&Readonly<{previewScopedBackpack(s:ScopedBackpackSelection):ScopedBackpackPreview;stageScopedBackpack():Readonly<ScopedBackpackPreview&{applied:true}>;toggleScopedBackpack(redo:boolean):Readonly<ScopedBackpackPreview&{applied:boolean}>;takeScopedBackpackOutput():Promise<Readonly<{decodedBytes:Uint8Array;decodedSha256:string}>>}>;
export declare function createProductWasmReadOwner(factory:ProductWorkerWasmFactory,options:{backpackScope:'steam'|'switch';placementScope?:null;allowSwitch626ChestSource?:false;allowSteam626ChestSource?:false;allowSwitch626Catalog0Source?:false;allowScopedAmountSource?:false;allowScopedCollectionSource?:false;allowCollectionCandidateSource?:false;wardrobeScope?:null;appearanceScope?:null}):ScopedBackpackSourceOwner;

export type ScopedWardrobePreview=Readonly<{slot:0;oldItemId:50000352;newItemId:50000214;exactFieldChangedCount:1;writerAuthorized:false;editedCopyAuthorized:false;originalOverwriteAuthorized:false}>;
export type ScopedWardrobeSourceOwner=ProductWasmReadOwner&Readonly<{previewScopedWardrobe():ScopedWardrobePreview;stageScopedWardrobe():Readonly<ScopedWardrobePreview&{applied:true}>;toggleScopedWardrobe(redo:boolean):Readonly<ScopedWardrobePreview&{applied:boolean}>;takeScopedWardrobeOutput():Promise<Readonly<{decodedBytes:Uint8Array;decodedSha256:string}>>}>;
export declare function createProductWasmReadOwner(factory:ProductWorkerWasmFactory,options:{wardrobeScope:'steam'|'switch';appearanceScope?:null;backpackScope?:null;placementScope?:null;allowSwitch626ChestSource?:false;allowSteam626ChestSource?:false;allowSwitch626Catalog0Source?:false;allowScopedAmountSource?:false;allowScopedCollectionSource?:false;allowCollectionCandidateSource?:false}):ScopedWardrobeSourceOwner;

export type ScopedComp03SpatialPreview=Readonly<{rootSceneItemId:1540000150;gridId:number;seedId:number;nextObjectId:number;anchors:readonly Readonly<{objectId:number;x:number;y:number;role:'retained'|'proposed'}>[];writerAuthorized:false;editedCopyAuthorized:false}>;
export declare function createProductWasmReadOwner(factory:ProductWorkerWasmFactory,options:{placementScope:'comp03-spatial';allowScopedAmountSource?:false;allowScopedCollectionSource?:false;allowCollectionCandidateSource?:false;allowSwitch626ChestSource?:false;allowSteam626ChestSource?:false;allowSwitch626Catalog0Source?:false;backpackScope?:null;wardrobeScope?:null;appearanceScope?:null}):ScopedPlacementSourceOwner&Readonly<{spatialPreview():ScopedComp03SpatialPreview}>;

export type ScopedAppearancePreview=Readonly<{old:number;new:number;exactFieldChangedCount:1;writerAuthorized:false;editedCopyAuthorized:false;originalOverwriteAuthorized:false}&({activeMale:boolean}|{characterId:10000053})>;
export type ScopedAppearanceSourceOwner=ProductWasmReadOwner&Readonly<{previewScopedAppearance():ScopedAppearancePreview;stageScopedAppearance():Readonly<ScopedAppearancePreview&{applied:true}>;toggleScopedAppearance(redo:boolean):Readonly<ScopedAppearancePreview&{applied:boolean}>;takeScopedAppearanceOutput():Promise<Readonly<{decodedBytes:Uint8Array;decodedSha256:string}>>}>;
export declare function createProductWasmReadOwner(factory:ProductWorkerWasmFactory,options:{appearanceScope:'hair'|'skin';placementScope?:null;backpackScope?:null;wardrobeScope?:null;allowScopedAmountSource?:false;allowScopedCollectionSource?:false;allowCollectionCandidateSource?:false;allowSwitch626ChestSource?:false;allowSteam626ChestSource?:false;allowSwitch626Catalog0Source?:false}):ScopedAppearanceSourceOwner;

export type ScopedFd01Selection=Readonly<{gridId:number;x:number;y:number}>;
export type ScopedFe01Selection=Readonly<{gridId:number;oldIds:readonly [number,number,number,number]}>;
type ScopedFencePreviewBase={itemId:40700246;gridId:number;nextObjectId:number;layout:'PRESERVE_EXISTING';inventoryDelta:0;scopedCandidate:true;writerAuthorized:false;editedCopyAuthorized:false};
export type ScopedFd01Preview=Readonly<ScopedFencePreviewBase&ScopedFd01Selection&{oldAmount:number;newAmount:number;exactFieldChangedCount:4;addObjects:3}>;
export type ScopedFe01Preview=Readonly<ScopedFencePreviewBase&ScopedFe01Selection&{retainedIds:readonly number[];deletedIds:readonly number[];exactFieldChangedCount:7;addObjects:4}>;
export type ScopedFenceSourceOwner<S,P>=ProductWasmReadOwner&Readonly<{previewScopedPlacement(selection:S):P;stageScopedPlacement():Readonly<P&{applied:true}>;toggleScopedPlacement(redo:boolean):Readonly<P&{applied:boolean}>;takeScopedPlacementOutput():Promise<Readonly<{decodedBytes:Uint8Array;decodedSha256:string}>>}>;
type ScopedFenceOptions<T extends 'fd01'|'fe01'>={placementScope:T;allowScopedAmountSource?:false;allowScopedCollectionSource?:false;allowCollectionCandidateSource?:false;allowSwitch626ChestSource?:false;allowSteam626ChestSource?:false;allowSwitch626Catalog0Source?:false;backpackScope?:null;wardrobeScope?:null;appearanceScope?:null};
export declare function createProductWasmReadOwner(factory:ProductWorkerWasmFactory,options:ScopedFenceOptions<'fd01'>):ScopedFenceSourceOwner<ScopedFd01Selection,ScopedFd01Preview>;
export declare function createProductWasmReadOwner(factory:ProductWorkerWasmFactory,options:ScopedFenceOptions<'fe01'>):ScopedFenceSourceOwner<ScopedFe01Selection,ScopedFe01Preview>;
