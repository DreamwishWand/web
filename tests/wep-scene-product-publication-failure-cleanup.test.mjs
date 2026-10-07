import test from 'node:test';
import assert from 'node:assert/strict';
import { createPresetCommunityBridge } from '../src/lib/wep/preset-community-bridge.ts';

test('failed Scene product publication discards unattached finalized media without weakening attached-media guards',async()=>{
  const calls=[];
  const community={
    async preset(){throw new Error('legacy preset path must not be used');},
    async presetProduct(action,payload={}){
      calls.push(['presetProduct',action,payload]);
      if(action==='prepare'){
        return {ok:true,storageKey:'staging/a/preset.json',signedUpload:{signedUrl:'https://upload.invalid'}};
      }
      if(action==='publish') throw new Error('EXPECTED_PUBLISH_FAILURE');
      if(action==='discard') return {ok:true};
      throw new Error('unexpected presetProduct action '+action);
    },
    async command(){return {ok:true};},
    async query(){return {ok:true,data:[]};},
    async searchPublicWorks(){return [];},
    async uploadAndFinalizeImage(){
      calls.push(['uploadImage']);
      return {mediaId:'00000000-0000-4000-8000-000000000111'};
    },
    async discardFinalizedImage(mediaId){
      calls.push(['discardImage',mediaId]);
      return {ok:true};
    }
  };
  const hooks={
    buildPublishEnvelope(){
      return {
        ok:true,
        presetType:'scene',
        schemaVersion:1,
        issues:[],
        envelope:{contentType:'application/json',byteSize:2,json:'{}'}
      };
    },
    validatePublishablePreset(){return {ok:true,presetType:'scene',schemaVersion:1,issues:[]};},
    preflightScene(){return {ok:true,issues:[],placements:[],writeReady:false};}
  };
  const fetchImpl=async()=>({ok:true,status:200,text:async()=>''});
  const bridge=createPresetCommunityBridge({community,hooks,fetchImpl});

  await assert.rejects(
    ()=>bridge.publishSceneProduct({
      artifact:{},
      creatorProfileId:'creator-1',
      visibility:'public',
      title:'Scene',
      idempotencyKey:'publish-fail-1',
      images:[{}]
    }),
    /EXPECTED_PUBLISH_FAILURE/
  );

  assert.equal(
    calls.some((entry)=>entry[0]==='presetProduct'&&entry[1]==='discard'),
    true
  );
  assert.deepEqual(
    calls.find((entry)=>entry[0]==='discardImage'),
    ['discardImage','00000000-0000-4000-8000-000000000111']
  );
});
