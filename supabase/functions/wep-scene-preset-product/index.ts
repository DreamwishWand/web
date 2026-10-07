import { withSupabase } from 'npm:@supabase/server';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { resolveRuntimeWepPresetArtifactBucket } from '../_shared/wep-preset-artifact-bucket.ts';

const BUCKET=resolveRuntimeWepPresetArtifactBucket();
const MAX_BYTES=25*1024*1024;
const CONTENT_TYPE='application/json';

function reply(body:unknown,status=200){
  return Response.json(body,{status,headers:{...corsHeaders,'Cache-Control':'private, no-store'}});
}
function hex(bytes:ArrayBuffer){
  return Array.from(new Uint8Array(bytes),(b)=>b.toString(16).padStart(2,'0')).join('');
}
function plain(value:unknown):value is Record<string,any>{
  return value!==null&&typeof value==='object'&&!Array.isArray(value);
}
const FORBIDDEN=new Set([
  'editorid','gridid','gridobjectid','sourcegridid','sourcegridobjectid',
  'subgridid','nextgridid','nextgridobjectid','objectkey','sourcediagnostics'
]);
function rejectLocalIdentity(value:unknown){
  if(Array.isArray(value)){for(const child of value)rejectLocalIdentity(child);return;}
  if(!plain(value))return;
  for(const [key,child] of Object.entries(value)){
    if(FORBIDDEN.has(key.toLowerCase()))throw new Error('SAVE_LOCAL_IDENTITY_FORBIDDEN');
    rejectLocalIdentity(child);
  }
}
function validateFootprint(value:unknown){
  if(!Array.isArray(value)||value.length===0)throw new Error('FOOTPRINT_INVALID');
  for(const cell of value){
    if(!plain(cell)||!Number.isSafeInteger(Number(cell.x))||!Number.isSafeInteger(Number(cell.y))){
      throw new Error('FOOTPRINT_INVALID');
    }
  }
}
function validatePortableState(value:unknown){
  if(value==null)return;
  if(!plain(value))throw new Error('PORTABLE_STATE_INVALID');
  const codec=String(value.codec??'');
  if(codec==='subgrid.itemdata-default-empty-child@1')return;
  if(codec!=='subgrid.serialized-local-child@1')throw new Error('PORTABLE_STATE_CODEC_UNSUPPORTED');
  const child=value.child;
  if(!plain(child)||!Number.isSafeInteger(Number(child.width))||Number(child.width)<=0||
     !Number.isSafeInteger(Number(child.height))||Number(child.height)<=0||
     !Number.isSafeInteger(Number(child.tessellationFactor))||Number(child.tessellationFactor)<=0||
     !Array.isArray(child.objects))throw new Error('SUBGRID_CHILD_INVALID');
  const ids=new Set<string>();
  for(const object of child.objects){
    if(!plain(object))throw new Error('SUBGRID_OBJECT_INVALID');
    const id=String(object.artifactObjectId??'');
    if(!/^c\d+$/.test(id)||ids.has(id))throw new Error('SUBGRID_OBJECT_ID_INVALID');
    ids.add(id);
    if(!Number.isSafeInteger(Number(object.itemId))||Number(object.itemId)<=0||
       !Number.isSafeInteger(Number(object.localX))||!Number.isSafeInteger(Number(object.localY))||
       !Number.isSafeInteger(Number(object.orientation))||Number(object.orientation)<0||Number(object.orientation)>15){
      throw new Error('SUBGRID_OBJECT_INVALID');
    }
    validateFootprint(object.footprint);
    validatePortableState(object.portableState);
  }
}
function validateNetwork(value:unknown,kind:'roads'|'fences',width:number,height:number){
  if(value==null)return;
  if(!plain(value)||value.schema!=='dreamwish-wand-wep-network-capture'||Number(value.version)!==1||
     value.kind!==kind||value.originPolicy!=='capture-region-top-left'||!Array.isArray(value.networks)){
    throw new Error('NETWORK_CAPTURE_INVALID');
  }
  if(value.normalization?.partialTopologyFailsClosed!==true){
    throw new Error('TOPOLOGY_CONTAINMENT_PROOF_REQUIRED');
  }
  for(const network of value.networks){
    if(!plain(network)||!String(network.networkId??'')||
       !Number.isSafeInteger(Number(network.familyBaseItemID))||Number(network.familyBaseItemID)<=0){
      throw new Error('NETWORK_INVALID');
    }
    if(kind==='roads'){
      if(!Array.isArray(network.cells))throw new Error('ROAD_CELLS_INVALID');
      for(const cell of network.cells){
        const x=Number(cell?.x),y=Number(cell?.y);
        if(!plain(cell)||!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||x<0||y<0||x>=width||y>=height||
           !String(cell.mode??''))throw new Error('ROAD_CELL_INVALID');
      }
    }else{
      const graph=network.graph;
      if(!plain(graph)||!Array.isArray(graph.nodes)||!Array.isArray(graph.edges))throw new Error('FENCE_GRAPH_INVALID');
      const ids=new Set<string>();
      for(const node of graph.nodes){
        const id=String(node?.id??''),x=Number(node?.x),y=Number(node?.y);
        if(!plain(node)||!/^n\d+$/.test(id)||ids.has(id)||!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||
           x<0||y<0||x>=width||y>=height||!String(node.mode??''))throw new Error('FENCE_NODE_INVALID');
        ids.add(id);
      }
      for(const edge of graph.edges){
        if(!plain(edge)||!ids.has(String(edge.a??''))||!ids.has(String(edge.b??'')))throw new Error('FENCE_EDGE_INVALID');
      }
    }
  }
}
function validateArtifact(value:unknown){
  if(!plain(value))throw new Error('PRESET_ARTIFACT_INVALID');
  rejectLocalIdentity(value);
  if(value.schema!=='dreamwish-wand-preset')throw new Error('PRESET_SCHEMA_UNSUPPORTED');
  const schemaVersion=Number(value.artifactVersion??value.schemaVersion??0);
  if(schemaVersion!==1)throw new Error('PRESET_SCHEMA_VERSION_UNSUPPORTED');
  if(String(value.type??value.artifactType??'').toLowerCase()!=='scene')throw new Error('PRESET_TYPE_VALIDATOR_NOT_AVAILABLE');
  if(value.originPolicy!=='capture-region-top-left')throw new Error('SCENE_ORIGIN_POLICY_UNSUPPORTED');
  const width=Number(value.bounds?.w),height=Number(value.bounds?.h);
  if(!plain(value.bounds)||!Number.isSafeInteger(width)||width<=0||!Number.isSafeInteger(height)||height<=0){
    throw new Error('SCENE_BOUNDS_INVALID');
  }
  if(!Array.isArray(value.objects)||value.objects.length===0)throw new Error('SCENE_OBJECTS_INVALID');
  const ids=new Set<string>();
  for(const object of value.objects){
    if(!plain(object))throw new Error('SCENE_OBJECT_INVALID');
    const id=String(object.artifactObjectId??'');
    if(!/^o\d+$/.test(id)||ids.has(id))throw new Error('SCENE_OBJECT_ID_INVALID');
    if(!['furniture','building','landscaping'].includes(String(object.layer??''))){
      throw new Error('SCENE_OBJECT_CLASS_UNSUPPORTED');
    }
    ids.add(id);
    if(!Number.isSafeInteger(Number(object.itemId))||Number(object.itemId)<=0||
       !Number.isSafeInteger(Number(object.localX))||!Number.isSafeInteger(Number(object.localY))||
       !Number.isSafeInteger(Number(object.orientation))||Number(object.orientation)<0||Number(object.orientation)>15){
      throw new Error('SCENE_OBJECT_INVALID');
    }
    validateFootprint(object.footprint);
    validatePortableState(object.portableState);
    if(!Array.isArray(object.dependencyIds))throw new Error('SCENE_DEPENDENCIES_INVALID');
  }
  for(const object of value.objects){
    for(const dep of object.dependencyIds){
      if(typeof dep!=='string'||!ids.has(dep))throw new Error('SCENE_DEPENDENCY_OUTSIDE_ARTIFACT');
    }
  }
  const source=plain(value.source)?value.source:{};
  if(source.platform==='Nintendo Switch'&&(
    source.gameVersion!=='1.25.0'||source.exactBuildKnown!==true||
    source.buildIdentity!=='52BD625D9B4E0053'||Number(source.profileSchemaVersion)!==624
  ))throw new Error('PRESET_SOURCE_VERSION_BUILD_UNSUPPORTED');
  if(value.networks!=null&&!plain(value.networks))throw new Error('SCENE_NETWORK_ENVELOPE_INVALID');
  const networks=plain(value.networks)?value.networks:{};
  validateNetwork(networks.roads,'roads',width,height);
  validateNetwork(networks.fences,'fences',width,height);
  return {schemaVersion:1,presetType:'scene',artifact:value};
}
async function validateStored(ctx:any,accountId:string,storageKey:string,phase:'staging'|'published'){
  const prefix=phase+'/'+accountId+'/';
  if(!storageKey.startsWith(prefix)||storageKey.includes('..')||!storageKey.endsWith('.json'))throw new Error('INVALID_STORAGE_KEY');
  const {data:blob,error}=await ctx.supabaseAdmin.storage.from(BUCKET).download(storageKey);
  if(error||!blob)throw new Error('UPLOAD_NOT_FOUND');
  if(blob.size<=0||blob.size>MAX_BYTES)throw new Error('INVALID_FILE_SIZE');
  const buffer=await blob.arrayBuffer();
  let parsed:unknown;
  try{parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer));}
  catch{throw new Error('INVALID_JSON_ARTIFACT');}
  const validation=validateArtifact(parsed);
  const checksumSha256=hex(await crypto.subtle.digest('SHA-256',buffer));
  return {blob,buffer,checksumSha256,...validation};
}

const authenticatedFetch=withSupabase({auth:'user'},async(req,ctx)=>{
  if(req.method!=='POST')return reply({ok:false,error:'POST required'},405);
  const subject=ctx.userClaims?.id;
  if(!subject)return reply({ok:false,error:'Authenticated subject missing'},401);
  const issuedAt=Number(ctx.jwtClaims?.iat??0);
  if(!Number.isInteger(issuedAt)||issuedAt<=0)return reply({ok:false,error:'JWT issued-at claim missing'},401);
  const {data:authorization,error:authorizationError}=await ctx.supabaseAdmin.rpc('community_authorize_session',{
    p_auth_subject:subject,p_issued_at_epoch:issuedAt,p_max_age_seconds:null
  });
  if(authorizationError)return reply({ok:false,error:'SESSION_REVOKED_OR_INVALID',message:authorizationError.message},401);
  const accountId=String(authorization?.accountId??'');
  if(!accountId)return reply({ok:false,error:'WAND_ACCOUNT_ID_MISSING'},401);

  let body:Record<string,unknown>;
  try{body=await req.json();}catch{return reply({ok:false,error:'Invalid JSON body'},400);}
  const action=String(body.action??'');

  if(action==='prepare'){
    const byteSize=Number(body.byteSize??0);
    if(!Number.isSafeInteger(byteSize)||byteSize<=0||byteSize>MAX_BYTES)return reply({ok:false,error:'INVALID_PRESET_SIZE'},400);
    const storageKey='staging/'+accountId+'/'+crypto.randomUUID()+'.json';
    const {data,error}=await ctx.supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(storageKey);
    if(error||!data)return reply({ok:false,error:'UPLOAD_PREPARE_FAILED',message:error?.message},400);
    return reply({ok:true,action,storageKey,contentType:CONTENT_TYPE,maxBytes:MAX_BYTES,signedUpload:data});
  }

  if(action==='publish'){
    const storageKey=String(body.storageKey??'');
    const creatorProfileId=String(body.creatorProfileId??'');
    const title=String(body.title??'').trim();
    const description=body.description==null?null:String(body.description);
    const idempotencyKey=String(body.idempotencyKey??'').trim();
    const existingPresetArtifactId=body.presetArtifactId?String(body.presetArtifactId):null;
    const mediaIds=Array.isArray(body.mediaIds)?body.mediaIds.map(String):[];
    const metadata=plain(body.metadata)?body.metadata:{};
    if(!creatorProfileId||!title||!idempotencyKey)return reply({ok:false,error:'PUBLISH_METADATA_REQUIRED'},400);
    if(!existingPresetArtifactId&&mediaIds.length===0)return reply({ok:false,error:'PUBLIC_IMAGE_REQUIRED'},400);
    if(mediaIds.length>10)return reply({ok:false,error:'PUBLIC_IMAGE_LIMIT_EXCEEDED'},400);

    const finalDigest=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(accountId+':'+idempotencyKey)));
    const publishedStorageKey='published/'+accountId+'/'+finalDigest+'.json';
    let validated:any,source:'staging'|'published'='staging';
    try{validated=await validateStored(ctx,accountId,storageKey,'staging');}
    catch(stagingError){
      try{validated=await validateStored(ctx,accountId,publishedStorageKey,'published');source='published';}
      catch(publishedError){
        const sm=stagingError instanceof Error?stagingError.message:'ARTIFACT_VALIDATE_FAILED';
        const pm=publishedError instanceof Error?publishedError.message:'ARTIFACT_VALIDATE_FAILED';
        return reply({ok:false,error:pm==='UPLOAD_NOT_FOUND'?sm:pm},400);
      }
    }

    const artifact=validated.artifact as Record<string,any>;
    const itemQuantities=plain(artifact.requirements?.itemQuantities)?artifact.requirements.itemQuantities:{};
    const payloadMetadata={...metadata,wepScene:{
      artifactSchema:'dreamwish-wand-preset',schemaVersion:1,
      captureRegion:{width:Number(artifact.bounds.w),height:Number(artifact.bounds.h)},
      rootObjectCount:artifact.objects.length,
      rootDistinctItemCount:Object.keys(itemQuantities).length,
      itemQuantities:structuredClone(itemQuantities),
      roadTopology:artifact.requirements?.roadTopology===true,
      fenceTopology:artifact.requirements?.fenceTopology===true,
      sourceGameVersion:String(artifact.source?.gameVersion??''),
      sourcePlatform:String(artifact.source?.platform??'')
    }};

    let promoted=false;
    if(source==='staging'){
      const {error}=await ctx.supabaseAdmin.storage.from(BUCKET).copy(storageKey,publishedStorageKey);
      if(error){
        try{
          const existing=await validateStored(ctx,accountId,publishedStorageKey,'published');
          if(existing.checksumSha256!==validated.checksumSha256)return reply({ok:false,error:'PUBLISHED_KEY_CONFLICT'},409);
        }catch{return reply({ok:false,error:'ARTIFACT_PROMOTE_FAILED',message:error.message},400);}
      }else promoted=true;
    }

    const {data,error}=await ctx.supabaseAdmin.rpc('community_publish_scene_preset_product_v1',{
      p_auth_subject:subject,p_existing_preset_artifact_id:existingPresetArtifactId,
      p_creator_profile_id:creatorProfileId,p_title:title,p_description:description,
      p_artifact_storage_key:publishedStorageKey,p_schema_version:1,p_content_type:CONTENT_TYPE,
      p_byte_size:validated.blob.size,p_checksum_sha256:validated.checksumSha256,
      p_metadata:payloadMetadata,p_media_ids:mediaIds,p_idempotency_key:idempotencyKey
    });
    if(error){
      if(promoted)await ctx.supabaseAdmin.storage.from(BUCKET).remove([publishedStorageKey]);
      return reply({ok:false,error:'SCENE_PRESET_PRODUCT_PUBLISH_FAILED',message:error.message},400);
    }
    if(source==='staging')await ctx.supabaseAdmin.storage.from(BUCKET).remove([storageKey]);
    return reply({ok:true,action,data:{...data,storageKey:publishedStorageKey,schemaVersion:1,presetType:'scene',
      contentType:CONTENT_TYPE,byteSize:validated.blob.size,checksumSha256:validated.checksumSha256}});
  }

  if(action==='read'){
    const presetArtifactId=body.presetArtifactId?String(body.presetArtifactId):null;
    const presetRevisionId=body.presetRevisionId?String(body.presetRevisionId):null;
    const {data:meta,error}=await ctx.supabaseAdmin.rpc('wep_get_accessible_preset_blob',{
      p_auth_subject:subject,p_preset_artifact_id:presetArtifactId,p_preset_revision_id:presetRevisionId
    });
    if(error||!meta)return reply({ok:false,error:'PRESET_FORBIDDEN_OR_UNAVAILABLE',message:error?.message},403);
    if(meta.presetType!=='scene'||Number(meta.schemaVersion)!==1)return reply({ok:false,error:'SCENE_PRESET_SCHEMA_UNSUPPORTED'},409);
    const {data:signed,error:signError}=await ctx.supabaseAdmin.storage.from(BUCKET).createSignedUrl(String(meta.storageKey),300);
    if(signError||!signed)return reply({ok:false,error:'PRESET_SIGN_FAILED',message:signError?.message},400);
    return reply({ok:true,action,preset:{
      presetArtifactId:meta.presetArtifactId,presetRevisionId:meta.presetRevisionId,presetType:meta.presetType,
      blobId:meta.blobId,storageKey:meta.storageKey,schemaVersion:meta.schemaVersion,contentType:meta.contentType,
      byteSize:meta.byteSize,checksumSha256:meta.checksumSha256,signedUrl:signed.signedUrl,expiresIn:300
    }});
  }

  if(action==='unpublish'||action==='delete'){
    const presetArtifactId=String(body.presetArtifactId??'');
    const idempotencyKey=String(body.idempotencyKey??'').trim();
    if(!presetArtifactId||!idempotencyKey)return reply({ok:false,error:'LIFECYCLE_METADATA_REQUIRED'},400);
    const rpc=action==='unpublish'?'community_unpublish_scene_preset_v1':'community_delete_scene_preset_v1';
    const {data,error}=await ctx.supabaseAdmin.rpc(rpc,{
      p_auth_subject:subject,p_preset_artifact_id:presetArtifactId,p_idempotency_key:idempotencyKey
    });
    if(error)return reply({ok:false,error:'SCENE_PRESET_LIFECYCLE_FAILED',message:error.message},400);
    return reply({ok:true,action,data});
  }

  if(action==='discard'){
    const storageKey=String(body.storageKey??'');
    if(!storageKey.startsWith('staging/'+accountId+'/')||storageKey.includes('..')||!storageKey.endsWith('.json')){
      return reply({ok:false,error:'INVALID_STORAGE_KEY'},403);
    }
    const {data:registered,error:lookupError}=await ctx.supabaseAdmin.from('artifact_blobs')
      .select('blob_id').eq('storage_key',storageKey).maybeSingle();
    if(lookupError)return reply({ok:false,error:'DISCARD_LOOKUP_FAILED',message:lookupError.message},400);
    if(registered)return reply({ok:false,error:'REGISTERED_ARTIFACT_CANNOT_BE_DISCARDED'},409);
    const {error}=await ctx.supabaseAdmin.storage.from(BUCKET).remove([storageKey]);
    if(error)return reply({ok:false,error:'DISCARD_FAILED',message:error.message},400);
    return reply({ok:true,action,storageKey});
  }

  return reply({ok:false,error:'Unsupported action'},400);
});
export default{fetch(req:Request){if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});return authenticatedFetch(req);}};
