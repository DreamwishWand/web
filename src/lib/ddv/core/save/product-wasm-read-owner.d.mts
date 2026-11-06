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
  close():void;
}
export type ProductWorkerWasmFactory=()=>Promise<{
  WorkerWasmSource:new(platform:string,kind:string,buildId:string,schema:number,
    externallyAttested:boolean,entropy:Uint8Array)=>WorkerWasmSource
}>;
export declare function createProductWasmReadOwner(factory:ProductWorkerWasmFactory):
 Readonly<{
  openDecoded(args:{build:WorkerBuildEvidence;decodedChunks:AsyncIterable<Uint8Array>}):
    Promise<ProductWasmReceipt>;
  readCoreVersion(scope:ProductWasmScope):CoreVersionWitness;
  close():Readonly<{closed:true;writerAuthorized:false}>;
  submitOperation(command:unknown):never;
  getReceipt():ProductWasmReceipt|null;
  getCapabilities():Readonly<{
    productWorkerBoundary:true;productReadAccepted:false;oneRustSession:true;
    readCoreVersionOnly:true;completeAllDomains:false;
    canStage:false;canExportEditedCopy:false;canApply:false;
    canOriginalOverwrite:false;maxChunkBytes:number;maxDecodedBytes:number;
  }>;
 }>;
