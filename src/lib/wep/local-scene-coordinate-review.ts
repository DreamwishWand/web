// 02 WEP W-DEC-018: edit only a detached device-local Scene's relative coordinates.
// Not a game Save EditorSession, Native Grid, ownership proof or executable writer.
import { buildReadonlyLocalSceneReuseDraft } from './local-scene-reuse-readonly.ts';
import { captureScenePreset } from './scene-capture-runtime.ts';
import { preflightScene, validatePublishablePreset } from './scene-preset-runtime.ts';

export const WEP_LOCAL_SCENE_COORDINATE_REVIEW =
  'WEP_LOCAL_SCENE_COORDINATE_REVIEW_NONDESTRUCTIVE_SAVE_AS@1';

const fail=(s:string):never=>{throw Error('WEP_LOCAL_SCENE_COORD_'+s);};
const integer=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n);
export type LocalPosition={artifactObjectId:string;x:number;y:number};

export function reviewLocalSceneCoordinates({
 sceneId,sourceRevision,artifact,positions,title
}:{
 sceneId:string;sourceRevision:number;artifact:unknown;
 positions:LocalPosition[];title:string
}) {
 const base=buildReadonlyLocalSceneReuseDraft({sceneId,sourceRevision,artifact});
 const source=artifact as any;
 if(source?.source?.platform!=='synthetic'||source.source.gameVersion!==null||
    source.source.areaKey!==null||base.objects.length!==2||
    source.objects.length!==2||base.objects.some(o=>
      o.layer!=='furniture'||
      o.orientation!==0||o.dependencyIds.length!==0))
   fail('SOURCE_NOT_TWO_LOCAL_FURNITURE');
 if(typeof title!=='string'||title.trim().length<1||title.trim().length>120)
   fail('TITLE_INVALID');
 if(!Array.isArray(positions)||positions.length!==base.objects.length)fail('POSITIONS_INVALID');
 const idSet=new Set(base.objects.map(o=>o.artifactObjectId));
 const changed=new Map<string,LocalPosition>();
 for(const p of positions){
  if(!p||typeof p.artifactObjectId!=='string'||!idSet.has(p.artifactObjectId)||
     changed.has(p.artifactObjectId)||!integer(p.x)||!integer(p.y)||
     p.x<0||p.y<0||p.x>63||p.y>63)fail('POSITION_INVALID');
  changed.set(p.artifactObjectId,{artifactObjectId:p.artifactObjectId,x:p.x,y:p.y});
 }
 if(changed.size!==idSet.size)fail('POSITIONS_INVALID');
 // Preview layout is *local* only: bounded occupancy, NEVER native legal placement.
 const occupied=new Set<string>();
 let maxX=0,maxY=0;
 for(const o of base.objects){
  const p=changed.get(o.artifactObjectId)!;
  for(const cell of o.footprint){
   const x=p.x+cell.x,y=p.y+cell.y;
   if(!integer(x)||!integer(y)||x<0||y<0||x>=64||y>=64)
     fail('LOCAL_BOUNDS_DENIED');
   const key=x+','+y;
   if(occupied.has(key))fail('LOCAL_OVERLAP_DENIED');
   occupied.add(key);maxX=Math.max(x,maxX);maxY=Math.max(y,maxY);
  }
 }
 if((maxX+1)*(maxY+1)>4096)fail('LOCAL_BOUNDS_DENIED');
 const document={
  schema:'dreamwish-wand-wep-editor-document' as const,version:1 as const,
  target:{platform:'synthetic',gameVersion:null,areaKey:null},
  networks:{roads:null,fences:null},capabilities:{},metadata:{},
  objects:base.objects.map(o=>{
   const p=changed.get(o.artifactObjectId)!;
   return {
    editorId:'local-only-'+o.artifactObjectId,
    itemId:o.itemId,layer:'furniture' as const,
    x:p.x,y:p.y,orientation:o.orientation,
    footprint:o.footprint.map(cell=>({...cell})),
    portableState:null,dependencyIds:[],editability:'editable' as const,source:null
   };
  })
 };
 const captured=captureScenePreset(document,{
  selectionIds:document.objects.map(o=>o.editorId),
  title:title.trim(),includeRoads:false,includeFences:false
 },validatePublishablePreset);
 if(captured.publicationReady!==true||captured.artifact.objects.length!==2)
   fail('CAPTURE_DENIED');
 const result=captured.artifact;
 const preflight=preflightScene(result);
 if(preflight.ok!==true||preflight.writeReady!==false||
    result.bounds.w>64||result.bounds.h>64||
    result.source.platform!=='synthetic'||result.networks.roads!==null||
    result.networks.fences!==null)
   fail('PREFLIGHT_DENIED');
 // Require actual relative-layout change, not shifting the entire local Scene.
 const diffs=base.objects.map((old,i)=>{
  const updated=result.objects[i];
  if(!updated||updated.artifactObjectId!==old.artifactObjectId||
     updated.itemId!==old.itemId||updated.layer!==old.layer||
     updated.orientation!==old.orientation||
     JSON.stringify(updated.footprint)!==JSON.stringify(old.footprint))
    fail('SOURCE_IDENTITY_CHANGED');
  return {artifactObjectId:old.artifactObjectId,itemId:old.itemId,
   old:{x:old.x,y:old.y},next:{x:updated.localX,y:updated.localY}};
 });
 if(!diffs.some(d=>d.old.x!==d.next.x||d.old.y!==d.next.y))
   fail('LOCAL_LAYOUT_UNCHANGED');
 return Object.freeze({
  operation:WEP_LOCAL_SCENE_COORDINATE_REVIEW,sceneId,sourceRevision,
  sourceArtifactRaw:JSON.stringify(artifact),title:title.trim(),
  artifact:result,diffs,bounds:result.bounds,
  localOnly:true,writeReady:false,applyReady:false,
  nativePlacementAuthorized:false,editorMutationAuthorized:false
 });
}
