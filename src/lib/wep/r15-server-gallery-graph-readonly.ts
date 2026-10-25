/**
 * 03 COMM Source124 R15: signed-Owner, server-issued and SCOPED Gallery graph.
 * We NEVER canonicalize/hash the PostgreSQL JSONB graph. The exact SHA text
 * is retained unmodified as a server observation, not a client writer pin.
 * Raw expectedGraph includes actor/account/storage metadata: do NOT expose it.
 */
export const WEP_R15_REGISTRY = 'gallery-scene-scoped@r15' as const;
export const WEP_R15_SCHEMA = 1 as const;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA=/^[0-9a-f]{64}$/;
const rec=(v:unknown):v is Record<string,any>=>v!==null && typeof v==='object' && !Array.isArray(v);
const uuid=(v:unknown):v is string=>typeof v==='string' && UUID.test(v);
const fail=(s:string):never=>{throw new Error(s)};
const unique=(list:unknown,key:string,maximum=1000):string[]=>{
  if(!Array.isArray(list)||list.length>maximum||list.some(v=>!uuid(v)) ||
      new Set(list).size!==list.length)fail('WEP_R15_'+key+'_INVALID');
  return list as string[];
};
export interface R15GraphExpectation {
  galleryWorkId:string;
  presetArtifactId:string;
  presetWorkId:string;
  creatorProfileId:string;
  currentPresetRevisionId:string;
  currentGalleryRevisionId:string;
  requestedPresetRevisionIds:string[];
  // Optional session-verified context from the SAME signed Owner bridge.
  // Absent means not independently cross-attested, never authorizes a writer.
  authSubject?:string;
  accountId?:string;
}
export interface R15ScopedGraphObservation {
  schemaVersion:1;
  registryVersion:typeof WEP_R15_REGISTRY;
  expectedGraphSha256:string;
  observedGalleryWorkId:string;
  observedAccountId:string;
  observedAuthSubject:string;
  observedCreatorProfileId:string;
  observedGalleryRowVersion:number;
  observedGalleryCurrentRevisionId:string;
  observedPresetRowVersion:number;
  observedPresetCurrentRevisionId:string;
  historicalPresetLinkCount:number;
  mediaReferenceCount:number;
  coverReferenceCount:number;
  requestedPresetRevisionIds:readonly string[];
  expectedArtifactIds:readonly string[];
  expectedPresetWorkIds:readonly string[];
  expectedGalleryWorkIds:readonly string[];
  authoritative:true;
  graphComplete:false;
  globalGraphAuthorized:false;
  actualStorageReceiptAuthorized:false;
  saveRevisionAuthorized:false;
  pairedGalleryPublishAuthorized:false;
  productApplyAuthorized:false;
  observedOnly:true;
  blockedReasons:readonly string[];
}
export function parseR15ServerGalleryGraph(rawInput:unknown,expected:R15GraphExpectation):R15ScopedGraphObservation {
  if(!rec(rawInput)||rawInput.schemaVersion!==WEP_R15_SCHEMA||
      rawInput.registryVersion!==WEP_R15_REGISTRY)fail('WEP_R15_SCHEMA_OR_REGISTRY_UNSUPPORTED');
  if(rawInput.authoritative!==true||rawInput.graphComplete!==false||
      typeof rawInput.expectedGraphSha256!=='string'||!SHA.test(rawInput.expectedGraphSha256)) {
    fail('WEP_R15_AUTHORITY_OR_SHA_INVALID');
  }
  if(!rec(expected)||!uuid(expected.galleryWorkId)||!uuid(expected.presetArtifactId)||
      !uuid(expected.presetWorkId)||!uuid(expected.creatorProfileId)||
      !uuid(expected.currentPresetRevisionId)||!uuid(expected.currentGalleryRevisionId))
    fail('WEP_R15_REQUEST_CONTEXT_INVALID');
  const wanted=unique(expected.requestedPresetRevisionIds,'REQUESTED');
  if(expected.authSubject!==undefined&&!uuid(expected.authSubject) ||
      expected.accountId!==undefined&&!uuid(expected.accountId))fail('WEP_R15_SESSION_ID_INVALID');
  const root=rawInput.expectedGraph, graph=rec(root)?root.graph:null;
  if(!rec(root)||!rec(graph)||root.registryVersion!==WEP_R15_REGISTRY||
      !uuid(root.accountId)||!uuid(root.authSubject)||root.ownerActive!==true||
      root.identityActive!==true||root.galleryWorkId!==expected.galleryWorkId)
    fail('WEP_R15_OWNER_SESSION_OR_GRAPH_INVALID');
  if(expected.accountId!==undefined&&root.accountId!==expected.accountId ||
      expected.authSubject!==undefined&&root.authSubject!==expected.authSubject)
    fail('WEP_R15_OWNER_SESSION_MISMATCH');
  const requested=unique(root.requestedPresetRevisionIds,'GRAPH_REQUESTED');
  if(requested.length!==wanted.length||requested.some((x,i)=>x!==wanted[i]))
    fail('WEP_R15_REQUESTED_REVISIONS_STALE');
  const artifacts=unique(rawInput.expectedArtifactIds,'ARTIFACT_IDS');
  const presets=unique(rawInput.expectedPresetWorkIds,'PRESET_WORK_IDS');
  const galleries=unique(rawInput.expectedGalleryWorkIds,'GALLERY_WORK_IDS');
  const arrays:[string,readonly string[]][]=[
    ['artifactIds',artifacts],['presetWorkIds',presets],['galleryWorkIds',galleries]];
  for(const [key,list] of arrays){
    const nested=unique(graph[key],'NESTED_'+key.toUpperCase());
    if(nested.length!==list.length||nested.some((x,i)=>x!==list[i]))
      fail('WEP_R15_GRAPH_ROSTER_MISMATCH');
  }
  if(artifacts.length!==1||artifacts[0]!==expected.presetArtifactId||
      !presets.includes(expected.presetWorkId)||!galleries.includes(expected.galleryWorkId))
    fail('WEP_R15_UNKNOWN_FACET_OR_GRAPH_SCOPE');
  if(!Array.isArray(graph.artifacts)||graph.artifacts.length!==1||
      !rec(graph.artifacts[0])||graph.artifacts[0].preset_artifact_id!==expected.presetArtifactId||
      graph.artifacts[0].preset_type!=='scene'||
      graph.artifacts[0].community_work_id!==expected.presetWorkId||
      graph.artifacts[0].owner_account_id!==root.accountId||
      graph.artifacts[0].creator_profile_id!==expected.creatorProfileId)
    fail('WEP_R15_UNKNOWN_FACET_OR_OWNER_CREATOR');
  const states=rawInput.expectedWorkStates;
  if(!Array.isArray(states)||!Array.isArray(graph.works)||
      states.length!==graph.works.length)fail('WEP_R15_WORK_STATES_MISSING');
  const workMap=new Map<string,Record<string,any>>();
  for(let i=0;i<states.length;i++){
    const state=states[i],nested=graph.works[i];
    if(!rec(state)||!rec(nested)||!uuid(state.work_id)||
       state.work_id!==nested.work_id||state.row_version!==nested.row_version||
       !Number.isSafeInteger(state.row_version)||state.row_version<0||
       !uuid(state.owner_account_id)||state.owner_account_id!==root.accountId||
       state.creator_profile_id!==expected.creatorProfileId||
       !['gallery','preset'].includes(state.work_type)||
       !uuid(state.current_published_revision_id)||workMap.has(state.work_id))
      fail('WEP_R15_WORK_STATE_OR_OWNER_INVALID');
    workMap.set(state.work_id,state);
  }
  for(const id of [...presets,...galleries])if(!workMap.has(id))
    fail('WEP_R15_MISSING_LINKED_WORK_STATE');
  const g=workMap.get(expected.galleryWorkId),p=workMap.get(expected.presetWorkId);
  if(!g||!p||g.work_type!=='gallery'||p.work_type!=='preset'||
      g.current_published_revision_id!==expected.currentGalleryRevisionId||
      p.current_published_revision_id==null)
    fail('WEP_R15_CURRENT_GALLERY_REVISION_STALE');
  // PresetRevision is immutable and distinct from Preset WorkRevision:
  // correlate via the historical/current publication rows, not equality.
  const publications=graph.presetPublications;
  if(!Array.isArray(publications)||!publications.some(x=>rec(x)&&
      x.work_revision_id===p.current_published_revision_id&&
      x.preset_revision_id===expected.currentPresetRevisionId))
    fail('WEP_R15_CURRENT_PRESET_REVISION_STALE');
  const pairs:[string,string][]=[
    ['historicalPresetLinks','gallery_revision_id'],
    ['mediaReferences','work_revision_id'],
    ['coverReferences','revision_id']
  ];
  for(const [key,revisionKey] of pairs){
    const outer=rawInput[key],inner=graph[key];
    if(!Array.isArray(outer)||!Array.isArray(inner)||outer.length!==inner.length)
      fail('WEP_R15_'+key.toUpperCase()+'_MISSING');
    for(let i=0;i<outer.length;i++){
      const x=outer[i],y=inner[i];
      if(!rec(x)||!rec(y)||!uuid(x[revisionKey])||
        x[revisionKey]!==y[revisionKey]||
        (key==='historicalPresetLinks'&&(!uuid(x.preset_revision_id)||
           x.preset_revision_id!==y.preset_revision_id))||
        (key==='mediaReferences'&&(!uuid(x.media_id)||x.media_id!==y.media_id||
           !Number.isSafeInteger(x.ordinal)||x.ordinal<0||x.ordinal!==y.ordinal))||
        (key==='coverReferences'&&(!uuid(x.cover_media_id)||
           x.cover_media_id!==y.cover_media_id)))
        fail('WEP_R15_'+key.toUpperCase()+'_INVALID');
    }
  }
  if(!rawInput.historicalPresetLinks.some((x:any)=>x.gallery_revision_id===expected.currentGalleryRevisionId&&
      x.preset_revision_id===expected.currentPresetRevisionId))
    fail('WEP_R15_CURRENT_HISTORICAL_LINK_MISMATCH');
  const blocked=[
    'R15_GALLERY_SCOPED_GRAPH_NOT_GLOBAL',
    'R15_GRAPH_COMPLETENESS_FALSE',
    'R15_ACTUAL_STORAGE_RECEIPT_NOT_VERIFIED',
    'R15_SCENE_SAVE_REVISION_ATOMIC_WRITER_NOT_APPROVED',
    'R15_SESSION_CHANGE_REQUIRES_NEW_PREFLIGHT'
  ];
  if(expected.authSubject===undefined||expected.accountId===undefined)
    blocked.push('R15_CLIENT_SESSION_CROSS_ATTESTATION_UNAVAILABLE');
  return Object.freeze({
    schemaVersion:1,registryVersion:WEP_R15_REGISTRY,
    expectedGraphSha256:rawInput.expectedGraphSha256,
    observedGalleryWorkId:g.work_id,observedAccountId:root.accountId,
    observedAuthSubject:root.authSubject,
    observedCreatorProfileId:expected.creatorProfileId,
    observedGalleryRowVersion:g.row_version,
    observedGalleryCurrentRevisionId:g.current_published_revision_id,
    observedPresetRowVersion:p.row_version,
    observedPresetCurrentRevisionId:p.current_published_revision_id,
    historicalPresetLinkCount:rawInput.historicalPresetLinks.length,
    mediaReferenceCount:rawInput.mediaReferences.length,
    coverReferenceCount:rawInput.coverReferences.length,
    requestedPresetRevisionIds:Object.freeze([...requested]),
    expectedArtifactIds:Object.freeze([...artifacts]),
    expectedPresetWorkIds:Object.freeze([...presets]),
    expectedGalleryWorkIds:Object.freeze([...galleries]),
    authoritative:true,graphComplete:false,globalGraphAuthorized:false,
    actualStorageReceiptAuthorized:false,saveRevisionAuthorized:false,
    pairedGalleryPublishAuthorized:false,productApplyAuthorized:false,
    observedOnly:true,blockedReasons:Object.freeze(blocked)
  });
}
