import { preflightScene } from './scene-preset-runtime.ts';

type AnyRecord = Record<string, any>;

export const SCENE_PRESET_DESTINATION_PREFLIGHT =
  'dreamwish-wand-scene-preset-destination-preflight@1';

function clone<T>(value:T):T { return structuredClone(value); }

export function preflightScenePresetDestinationV125({
  artifact,
  destinationDocument,
  placementBinding,
  anchor = { x: 0, y: 0 },
  inventory = null,
  roadFenceTopologySupported = false
}: {
  artifact:any;
  destinationDocument:AnyRecord;
  placementBinding:any;
  anchor?:{x:number;y:number};
  inventory?:Record<string,number>|null;
  roadFenceTopologySupported?:boolean;
}) {
  const issues:any[]=[];
  const target=destinationDocument?.target ?? {};
  const source=artifact?.source ?? {};

  if (
    target.platform !== 'Nintendo Switch' ||
    target.gameVersion !== '1.25.0' ||
    Number(target.profileSchemaVersion) !== 624 ||
    target.exactBuildKnown !== true ||
    String(target.contractBuildIdentity ?? '') !== '52BD625D9B4E0053' ||
    String(target.sourceBuildIdentity ?? '') !== '52BD625D9B4E0053'
  ) {
    issues.push({severity:'BLOCK',code:'DESTINATION_VERSION_BUILD_UNSUPPORTED'});
  }
  if (source.gameVersion && source.gameVersion !== target.gameVersion) {
    issues.push({
      severity:'BLOCK',
      code:'SOURCE_GAME_VERSION_UNSUPPORTED',
      sourceGameVersion:source.gameVersion,
      destinationGameVersion:target.gameVersion
    });
  }
  if (source.buildIdentity && source.buildIdentity !== target.contractBuildIdentity) {
    issues.push({
      severity:'BLOCK',
      code:'SOURCE_BUILD_IDENTITY_UNSUPPORTED',
      sourceBuildIdentity:source.buildIdentity,
      destinationBuildIdentity:target.contractBuildIdentity
    });
  }
  if (
    source.profileSchemaVersion != null &&
    Number(source.profileSchemaVersion) !== Number(target.profileSchemaVersion)
  ) {
    issues.push({
      severity:'BLOCK',
      code:'SOURCE_PROFILE_SCHEMA_UNSUPPORTED',
      sourceProfileSchemaVersion:Number(source.profileSchemaVersion),
      destinationProfileSchemaVersion:Number(target.profileSchemaVersion)
    });
  }

  const permittedLayers=new Set(['furniture','building','landscaping']);
  for(const object of artifact?.objects ?? []){
    if(!permittedLayers.has(String(object?.layer??''))){
      issues.push({
        severity:'BLOCK',
        code:'SCENE_OBJECT_CLASS_UNSUPPORTED',
        artifactObjectId:String(object?.artifactObjectId??''),
        layer:String(object?.layer??'')
      });
    }
  }

  const base=preflightScene(artifact,{
    inventory,
    capabilities:{
      roadTopologyApply:roadFenceTopologySupported?'supported':'unsupported',
      fenceTopologyApply:roadFenceTopologySupported?'supported':'unsupported'
    },
    destination:anchor
  });
  issues.push(...(base.issues ?? []));

  let nativePlacement:any=null;
  if(!issues.some((entry:any)=>entry.severity==='BLOCK')){
    if(
      !placementBinding ||
      placementBinding.contract!=='dreamwish-wand-wep-v125-placement-binding@1' ||
      typeof placementBinding.classifyEditorCandidates!=='function'
    ){
      issues.push({severity:'BLOCK',code:'NATIVE_PLACEMENT_PREFLIGHT_UNAVAILABLE'});
    }else{
      const currentObjects=Array.isArray(destinationDocument?.objects)
        ? clone(destinationDocument.objects)
        : [];
      const createdIds:string[]=[];
      const presetObjects=(artifact.objects ?? []).map((object:any,index:number)=>{
        const editorId=`preset-preflight:${String(object.artifactObjectId??index)}`;
        createdIds.push(editorId);
        return {
          editorId,
          itemId:Number(object.itemId),
          layer:String(object.layer),
          x:Number(anchor.x)+Number(object.localX),
          y:Number(anchor.y)+Number(object.localY),
          orientation:Number(object.orientation),
          footprint:clone(object.footprint),
          portableState:clone(object.portableState),
          dependencyIds:[],
          editability:'editable',
          source:null,
          metadata:{
            worldClass:'PRESET_PREFLIGHT',
            stateKind:object.portableState?.codec ?? 'NONE',
            presetArtifactObjectId:String(object.artifactObjectId)
          }
        };
      });
      const candidate={
        ...clone(destinationDocument),
        objects:[...currentObjects,...presetObjects]
      };
      try{
        nativePlacement=placementBinding.classifyEditorCandidates({
          document:candidate,
          candidateIds:createdIds
        });
        for(const entry of nativePlacement?.issues ?? []){
          issues.push({
            ...clone(entry),
            severity:'BLOCK',
            code:String(entry?.code ?? 'NATIVE_PLACEMENT_BLOCKED')
          });
        }
      }catch(error){
        issues.push({
          severity:'BLOCK',
          code:error instanceof Error?error.message:'NATIVE_PLACEMENT_PREFLIGHT_FAILED'
        });
      }
    }
  }

  const unique=new Map<string,any>();
  for(const entry of issues){
    const key=JSON.stringify([entry.code,entry.artifactObjectId??null,entry.itemId??null,entry.path??null]);
    if(!unique.has(key)) unique.set(key,entry);
  }
  const finalIssues=[...unique.values()];
  return Object.freeze({
    contract:SCENE_PRESET_DESTINATION_PREFLIGHT,
    ok:!finalIssues.some((entry:any)=>entry.severity==='BLOCK'),
    issues:Object.freeze(finalIssues.map(clone)),
    placements:Object.freeze((base.placements??[]).map(clone)),
    nativePlacement:clone(nativePlacement),
    writeReady:false,
    reason:'WHOLE_SCENE_PERSISTENT_APPLY_NOT_AUTHORIZED',
    persistentWriteAuthorized:false,
    WORLD_PERSISTENT_WRITE_V125:false,
    PERSISTENT_WRITE:false,
    productApplyAuthorized:false,
    directSourceReplacementAuthorized:false
  });
}
