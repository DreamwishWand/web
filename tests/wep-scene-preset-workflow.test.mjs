import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createScenePresetWorkflow,
  WepSceneWorkflowError
} from '../src/lib/wep/scene-preset-workflow.ts';

const doc={
  target:{gameVersion:'1.25.0',platform:'synthetic',areaKey:'demo'},
  objects:[
    {
      editorId:'source-object-1',
      itemId:10,
      layer:'furniture',
      x:3,
      y:4,
      orientation:0,
      footprint:[{x:0,y:0}],
      portableState:null,
      dependencyIds:[],
      editability:'editable'
    }
  ]
};

test('capture→publish passes only portable Scene artifact to publisher',async()=>{
  let received=null;
  const workflow=createScenePresetWorkflow({
    async publishScene(options){
      received=options;
      return {presetArtifactId:'pa1',workId:'w1'};
    }
  });

  const result=await workflow.publishCapturedScene({
    document:doc,
    capture:{selectionIds:['source-object-1']},
    creatorProfileId:'cp1',
    visibility:'public',
    title:'Captured Scene',
    idempotencyKey:'idem-1'
  });

  assert.equal(received.artifact.objects[0].artifactObjectId,'o0');
  assert.equal(JSON.stringify(received.artifact).includes('source-object-1'),false);
  assert.equal(received.title,'Captured Scene');
  assert.equal(result.published.workId,'w1');
});

test('capture failure prevents any network publication',async()=>{
  let calls=0;
  const workflow=createScenePresetWorkflow({
    async publishScene(){calls++;return {};}
  });
  const bad=structuredClone(doc);
  bad.objects[0].editability='readonly';

  await assert.rejects(
    ()=>workflow.publishCapturedScene({
      document:bad,
      capture:{selectionIds:['source-object-1']},
      creatorProfileId:'cp1',
      title:'Blocked',
      idempotencyKey:'idem-blocked'
    }),
    (error)=>{
      assert.equal(error instanceof WepSceneWorkflowError,true);
      assert.equal(error.stage,'capture');
      return true;
    }
  );
  assert.equal(calls,0);
});

test('requested Road topology remains fail-closed without Core adapter',()=>{
  const workflow=createScenePresetWorkflow({async publishScene(){return {};}});
  assert.throws(
    ()=>workflow.capture(doc,{
      selectionIds:['source-object-1'],
      includeRoads:true
    }),
    (error)=>{
      assert.equal(error instanceof WepSceneWorkflowError,true);
      assert.equal(error.issues.some((x)=>x.code==='ROADS_TOPOLOGY_CAPTURE_UNAVAILABLE'),true);
      return true;
    }
  );
});

test('publisher failure is surfaced as publication-stage failure',async()=>{
  const workflow=createScenePresetWorkflow({
    async publishScene(){throw new Error('transport down');}
  });
  await assert.rejects(
    ()=>workflow.publishCapturedScene({
      document:doc,
      capture:{selectionIds:['source-object-1']},
      creatorProfileId:'cp1',
      title:'Scene',
      idempotencyKey:'idem-fail'
    }),
    (error)=>{
      assert.equal(error instanceof WepSceneWorkflowError,true);
      assert.equal(error.stage,'publication');
      assert.equal(error.message,'WEP_SCENE_PUBLICATION_FAILED');
      return true;
    }
  );
});
