/** 01E source-only plan; never a Rust SaveSession or Writer capability. */
export type NativeOperationId =
  'INV_AMOUNT'|'INV_SLOT'|'INV_MOVE'|'CHEST_AMOUNT'|'CHEST_TRANSFER'|
  'FURNITURE_STORAGE'|'OWNERSHIP_LOCAL'|'APPEARANCE'|'WARDROBE'|
  'SKIN_SELECT'|'SKIN_UNLOCK'|'TIME_SIMPLE'|'TIME_EVENT'|'GRID_MOVE'|
  'GRID_ADDDEL'|'SUBGRID'|'ROAD_FENCE'|'QUEST'|'COLLECTION'|
  'PRESET_APPLY'|'ENTITLEMENT_REMOTE';
export type NativeTier = 'A_CANDIDATE'|'B_NATIVE_RECOMPUTE'|'C_PROTECTED';
export interface DeclaredNativeBuild {
  readonly platform:'switch'|'steam-windows';
  readonly buildKind:'switch-bid'|'steam-full-version';
  readonly buildId:string;
  readonly gameVersion:'1.25.3';
  readonly schema:626;
}
export interface NativeOperationRow {
  readonly operationId:NativeOperationId;
  readonly tier:NativeTier;
  readonly owner:string;
  readonly saveSource:string;
  readonly requiredStaticEvidence:readonly string[];
  readonly unresolvedNativeDependencies:readonly string[];
  readonly nativeConsumerVerified:false;
  readonly nativeProducerVerified:false;
  readonly nativeRecomputeVerified:false;
  readonly nativeV3Accepted:false;
  readonly writerAuthorized:false;
  readonly editedCopyAuthorized:false;
  readonly productEnabled:false;
}
export interface NativeStaticDenial {
  readonly contract:string;
  readonly status:'REJECTED';
  readonly reason:string;
  readonly operationId:NativeOperationId|null;
  readonly nativeV3Accepted:false;
  readonly productWriterAuthorized:false;
  readonly productEditedCopyAuthorized:false;
  readonly operationEnabled:false;
  readonly coreSessionAuthenticated:false;
}
/** Scoped static native facts, never an authenticated per-save grant. */
export interface ArchivedSteam626NativeWitness {
  readonly operationId:'INV_AMOUNT'|'CHEST_AMOUNT'|'GRID_MOVE';
  readonly kind:'ARCHIVED_STEAM626_NATIVE_STATIC_PARTIAL';
  readonly binarySha256:string;
  readonly localMutation:string;
  readonly consumer:readonly string[];
  readonly producer:readonly string[];
  readonly derived:readonly string[];
  readonly requiredBeforeOperationV3:readonly string[];
  readonly fullReferenceClosureVerified:false;
  readonly nativeV3Accepted:false;
  readonly nativeEventReplayAuthorized:false;
  readonly productWriterAuthorized:false;
}
export type NativeStaticDescription = NativeOperationRow & {
  readonly archivedSteam626NativeWitness?:ArchivedSteam626NativeWitness;
  readonly contract:string;
  readonly status:'TIER_A_STATIC_INDEPENDENT_CANDIDATE'|'TIER_B_NATIVE_DEPENDENCIES_OPEN';
  readonly w1OrRoadFenceGlobalBlocker:false|null;
  readonly target:Readonly<DeclaredNativeBuild>;
  readonly externalBuildIsAuthentication:false;
  readonly sourceOnly:true;
  readonly coreIssuedReadsetVerified:false;
  readonly productWriterAuthorized:false;
  readonly productEditedCopyAuthorized:false;
  readonly operationEnabled:false;
  readonly deviceV4Mandated:false;
  readonly deviceV4OnlyWhenStaticCannotCloseCriticalRisk:true;
};
export interface InventoryAmountStaticInput {
  declaredBuild?:DeclaredNativeBuild;
  inventoryId?:number;
  canonicalItemId?:number;
  compatibleItemType?:string;
  existingRow?:boolean;
  oldAmount?:number;
  nextAmount?:number;
  sourceHash?:string;
  changedPaths?:string[];
}
export interface NativeStaticCall {
  symbol:string;
  binarySha256:string;
}
export interface NativeStaticTraceDraftInput {
  operationId?:NativeOperationId;
  declaredBuild?:DeclaredNativeBuild;
  producerCalls?:NativeStaticCall[];
  consumerCalls?:NativeStaticCall[];
  saveReadPointers?:string[];
  saveWritePointers?:string[];
  derivedWritePointers?:string[];
  nativeBinarySha256?:string;
  eventsFromItemId?:number[];
  claim?:unknown;
}
export declare const OPERATION_NATIVE_STATIC_GATE:'wand.01e.native-operation-static-gate@1';
export declare const NATIVE_PRODUCT_WRITER_ENABLED:false;
export declare const NATIVE_STATIC_V3_ACCEPTED:false;
export declare const NATIVE_SOURCE_TARGETS:Readonly<{
  switch1253:Readonly<DeclaredNativeBuild>;
  steam1253:Readonly<DeclaredNativeBuild>;
}>;
export declare const NATIVE_OPERATION_ROWS:readonly NativeOperationRow[];
export declare function describeNativeOperation(
  operationId:NativeOperationId, declaredBuild?:DeclaredNativeBuild
):NativeStaticDescription|NativeStaticDenial;
export declare function previewNativeInventoryAmount(
  input?:InventoryAmountStaticInput
):NativeStaticDenial|Readonly<{
  contract:string;
  status:'TIER_A_01D_TO_01A_CAS_PREVIEW_ONLY';
  operationId:'INV_AMOUNT';
  tier:'A_CANDIDATE';
  sourcePointer:string;
  inventoryId:number;
  canonicalItemId:number;
  compatibleItemType:string;
  expectedOldAmount:number;
  hypotheticalNextAmount:number;
  recomputationRequirement:'UNKNOWN_UNTIL_SAME_BUILD_NATIVE_STATIC_TRACE';
  dependencyFence:readonly string[];
  unrelatedW1AndRoadFenceDoNotBlockStaticInvestigation:true;
  originalShaValidatedByCore:false;
  externalBuildIsAuthentication:false;
  fullReferenceClosureVerified:false;
  nativeV3Accepted:false;
  independentRealEditedCopyVerified:false;
  productWriterAuthorized:false;
  productEditedCopyAuthorized:false;
  operationEnabled:false;
}>;
export declare function inspectNativeStaticTraceDraft(
  input?:NativeStaticTraceDraftInput
):NativeStaticDenial|Readonly<{
  contract:string;
  operationId:NativeOperationId;
  status:'UNTRUSTED_STATIC_TRACE_SHAPE_ONLY';
  tier:NativeTier;
  declaredBuildIsAuthentic:false;
  nativeBinaryAuthenticated:false;
  claimedProducerCount:number;
  claimedConsumerCount:number;
  claimedSaveReads:number;
  claimedSaveWrites:number;
  claimedDerivedWrites:number;
  noDerivedWritesProven:false;
  sourceDigestValidated:false;
  missingEvidence:readonly string[];
  nativeV3Accepted:false;
  fullReferenceClosureVerified:false;
  productWriterAuthorized:false;
  productEditedCopyAuthorized:false;
  operationEnabled:false;
}>;
