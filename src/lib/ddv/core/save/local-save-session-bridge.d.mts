/** W-CORE-004 / W-LOCAL-019. READ-only TEST main contract.
 * Single Worker owner is shared by 01D, 02 WEP, 08 WEB in this browser tab.
 * The session metadata is NOT an authorization token or Native identity proof.
 */
export type LocalSourcePlatform = 'switch';
export type LocalFullVersion = '1.25.3';
export type LocalBID = '9A239D3DB569756D';
export type LocalSchema = 626;
export interface LocalBuildAttestation {
 readonly platform:LocalSourcePlatform;
 readonly fullVersion:LocalFullVersion;
 readonly buildKind:'switch-bid';
 readonly buildId:LocalBID;
 readonly schema:LocalSchema;
 readonly externallyConfirmed:true;
}
export interface LocalSaveSessionReceipt {
 readonly contract:'wand.local.save-session.read@1';
 readonly platform:LocalSourcePlatform;
 readonly fullVersion:LocalFullVersion;
 readonly buildKind:'switch-bid';
 readonly buildId:LocalBID;
 readonly schema:LocalSchema;
 readonly sourceIdentity:'externally-attested-switch-bid';
 readonly sourceFileName:string;
 /** Informational only: Worker stores the actual authoritative Session. */
 readonly sessionId:string;
 readonly revision:0;
 readonly indexGeneration:number;
 readonly sourceSha256:string;
 /** Worker-owned fixed same-origin registry witness for UI Preview only. */
 readonly registrySha256:string;
 readonly savedContainerCount:number;
 readonly unsupportedContainerCount:number;
 readonly indexedRoots:readonly ['World.RecurringEvents'];
 readonly completeStructuralRead:true;
 readonly completeAllDomainIndexes:false;
 readonly completeNativeReferenceClosure:false;
 readonly writerAuthorized:false;
 readonly productRustWorkerAccepted:false;
}
export interface LocalOperationCapabilities {
 readonly contract:'wand.local.save-session.read@1';
 readonly sessionOwner:'worker-singleton';
 readonly readW1RecurringEvents:true;
 readonly readInventory:false;
 readonly readOwnership:false;
 readonly readGrid:false;
 readonly readCompleteAllDomains:false;
 readonly uiW1IntentPreview:false;
 readonly nativeSemanticsW1Verified:false;
 readonly sourceCoreWriterAccepted:false;
 readonly canCommit:false;
 readonly canEncodeEditedCopy:false;
 readonly canApply:false;
 readonly canReplaceOriginal:false;
 readonly maxCiphertextBytes:number;
 readonly maximumExpandedBytes:number;
 readonly supportedPlatform:'switch';
 readonly supportedFullVersion:'1.25.3';
 readonly supportedBID:LocalBID;
 readonly supportedSchema:626;
}
export interface LocalW1Row {
 readonly mapKey:string;
 readonly savedIndex:number;
 readonly eventId:number|null;
 readonly oneof:string;
 readonly name:string;
 readonly group:string;
 readonly policy:'W1'|'W2'|'HOLD'|'REPAIR_ONLY';
 readonly sourcePointer:string;
 readonly nextOccurrence:string|null;
 readonly lastOccurrence:string|null;
 readonly endDate:string|null;
 readonly ambiguous:boolean;
 readonly registryKnown:boolean;
 readonly editable:false;
 readonly items:readonly {readonly itemId:number;readonly linkIndex:number;
   readonly en:string;readonly ja:string}[];
}
export interface LocalW1ReadPage {
 readonly sessionId:string;
 readonly revision:0;
 readonly indexGeneration:number;
 readonly sourceSha256:string;
 readonly total:number;
 readonly rows:readonly LocalW1Row[];
 readonly nextCursor:string|null;
 readonly complete:boolean;
 readonly productRustWorkerAccepted:false;
 readonly writerAuthorized:false;
}
export interface LocalW1PageQuery {
 readonly search?:string;
 readonly cursor?:string|null;
 readonly limit?:number; // 1...64
}
/** Typed source-scoped Read request for 01D, 01B/02 WEP and 08 WEB.
 * The source receipt is a scope fence, never a Writer capability.
 */
export type LocalDomainReadRequest = Readonly<{
 domain:'RecurringEvents'|'Inventory'|'Ownership'|'Spatial'|'ItemDetail';
 sessionId:string;
 sourceSha256:string;
 revision:number;
 indexGeneration:number;
 search?:string;
 cursor?:string|null;
 limit?:number;
}>;
/** Command contracts for 01D/08 WEB/02 WEP. All writers fail closed. */
export type LocalSaveOperationCommand =
 | Readonly<{kind:'W1_NEXT_OCCURRENCE_CHANGE';
   sessionId:string;revision:number;indexGeneration:number;
   sourceSha256:string;registrySha256:string;
   savedMapKey:string;eventId:number;oneof:'ItemSpawning';
   expectedOldUtc:string;proposedNewUtc:string}>
 | Readonly<{kind:'INVENTORY_CHANGE';
   sessionId:string;revision:number;itemId:number;expectedOldQuantity:number;newQuantity:number}>
 | Readonly<{kind:'OWNERSHIP_CHANGE';
   sessionId:string;revision:number;itemId:number;expectedOwned:boolean;proposedOwned:boolean}>
 | Readonly<{kind:'WORLD_OBJECT_CHANGE';
   sessionId:string;revision:number;gridId:number;objectId:string;action:'move'|'remove'}>;
export type SessionSubscriber = (data:Readonly<{
 readonly ready:boolean;
 readonly receipt:LocalSaveSessionReceipt|null;
 readonly capabilities:LocalOperationCapabilities;
}>)=>void;
export interface LocalSaveSessionBridge {
 ensureReady():Promise<void>;
 openLocalFile(file:File,attestation:LocalBuildAttestation):Promise<LocalSaveSessionReceipt>;
 queryW1Page(query?:LocalW1PageQuery):Promise<LocalW1ReadPage>;
 readDomainPage(query:LocalDomainReadRequest):Promise<LocalW1ReadPage>;
 close():Promise<Readonly<{closed:true;writerAuthorized:false}>>;
 getSession():LocalSaveSessionReceipt|null;
 getCapabilities():LocalOperationCapabilities;
 subscribe(listener:SessionSubscriber):()=>void;
 submitOperation(command:LocalSaveOperationCommand):Promise<never>;
 destroy():void;
}
export const SINGLE_SAVESESSION_CONTRACT:'wand.local.save-session.read@1';
export const LOCAL_MAX_P1G_BYTES:number;
export const LOCAL_SWITCH_BID:LocalBID;
export const LOCAL_SWITCH_FULL_VERSION:LocalFullVersion;
export const LOCAL_SWITCH_SCHEMA:LocalSchema;
export function createLocalSaveSessionBridge(workerFactory:()=>Worker):LocalSaveSessionBridge;
export function getSingleSaveSessionBridge(workerFactory:()=>Worker):LocalSaveSessionBridge;
