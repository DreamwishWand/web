import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { makeSyntheticP1gProfile, syntheticProfile } from './helpers/p1g-fixture.mjs';
import { createEditorSession } from '../src/lib/wep/editor-runtime.ts';
import { openWorldSaveBytes } from '../src/lib/wep/world-save-source.ts';
import {
  ROOM_FINISH_TRIMMING_PACK_SHA256,
  ROOM_FINISH_RUNTIME_EVIDENCE,
  WALLPAPER_SCOPE,
  applyRoomFinishDraftMutationV125,
  commitRoomFinishVerifiedExportV125,
  compileRoomFinishFlooringDraftV125,
  compileRoomFinishWallpaperDraftV125,
  createRoomFinishEditorDocumentV125,
  listIndoorRoomFinishRoutesV125,
  listOwnedRoomFinishTrimmingV125,
  loadRoomFinishTrimmingPackV125,
  resolveRoomFinishCurrentWallV125,
  resolveRoomFinishTrimmingEvidenceV125,
  reviewRoomFinishVerifiedExportV125,
  roomFinishDraftReviewChange
} from '../src/lib/wep/room-finish-verified-export-v125.ts';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const root=new URL('../',import.meta.url);
async function repoFile(path){
  return new Uint8Array(await readFile(new URL(path,root)));
}
async function localFetch(url){
  const pathname=new URL(String(url),'https://wand.invalid').pathname;
  try{
    const bytes=await repoFile(`./static${pathname}`);
    return new Response(bytes,{status:200});
  }catch{
    return new Response('not found',{status:404});
  }
}
function sha(bytes){return createHash('sha256').update(bytes).digest('hex');}

function profile(){
  const p=syntheticProfile('DeviceType_Switch');
  p.Player.ListInventories={
    '4':{
      ID:4,
      CompatibleItemType:'ItemType_Trimming',
      Inventory:{
        '160000000':{Amount:1,Marker:'ItemMarker_None'},
        '160000224':{Amount:1,Marker:'ItemMarker_None'},
        '160100000':{Amount:1,Marker:'ItemMarker_None'},
        '160100001':{Amount:1,Marker:'ItemMarker_None'}
      }
    }
  };
  p.World.PlayerHouses=[{
    HouseItemID:20500005,
    Floors:[{
      BoughtRooms:{},
      Rooms:{
        '0':{
          Name:'Main',
          FloorGridID:900,
          WallGridIDs:{'0':901,'1':902,'2':903,'3':904},
          RoomPrefabAddress:'Room/Main',
          Flooring:160100000,
          Wallpapers:{
            '0':160000224,
            '1':160000224,
            '2':160000224,
            '3':160000224
          },
          WallpaperOffsetById:{'160000224':0.4623557},
          Ceiling:160000000,
          OpaqueRoom:{keep:true}
        }
      }
    }],
    OpaqueHouse:{keep:true}
  }];
  p.World.GridCollection={Grids:{
    '900':{ID:900,Objects:{}},
    '901':{ID:901,Objects:{}},
    '902':{ID:902,Objects:{}},
    '903':{ID:903,Objects:{}},
    '904':{ID:904,Objects:{}}
  }};
  p.World.Villages=[];
  p.World.FloatingIslands={};
  p.World.OpaqueWorld={keep:{future:true}};
  return p;
}
async function fixture(){
  const sourceBytes=Uint8Array.from(makeSyntheticP1gProfile(profile()));
  const opened=await openWorldSaveBytes(sourceBytes,{sourcePlatform:'switch'});
  const pack=await loadRoomFinishTrimmingPackV125({fetchImpl:localFetch});
  const routes=listIndoorRoomFinishRoutesV125(opened.profile);
  assert.equal(routes.routes.length,1);
  const document=createRoomFinishEditorDocumentV125(routes.routes[0].projection);
  return {sourceBytes,opened,pack,routes,document};
}

test('Room Finish trimming pack is exact, minimal and pinned to promoted v1.25 Query authority',async()=>{
  const bytes=await repoFile('./static/ddv/wep/world/v1.25/room-finish-trimming-pack-v125.json');
  assert.equal(sha(bytes),ROOM_FINISH_TRIMMING_PACK_SHA256);
  const pack=await loadRoomFinishTrimmingPackV125({fetchImpl:localFetch});
  assert.equal(pack.counts.total,360);
  assert.equal(pack.counts.wallpaper,215);
  assert.equal(pack.counts.flooring,145);
  assert.deepEqual(pack.records['160000000'],[0,160000000,4]);
  assert.deepEqual(pack.records['160100000'],[1,160100000,4]);
});

test('Room Finish ownership uses exact Trimming role Data.Amount and never guesses subtype',async()=>{
  const f=await fixture();
  let evidence=resolveRoomFinishTrimmingEvidenceV125({
    profile:f.opened.profile,pack:f.pack,itemId:160100001,requiredSubtype:1
  });
  assert.equal(evidence.owned,true);
  assert.equal(evidence.ownedAmount,1);
  assert.equal(evidence.ownershipCanonicalItemID,160100001);
  assert.equal(evidence.listInventoryRoleHint,4);

  assert.throws(()=>resolveRoomFinishTrimmingEvidenceV125({
    profile:f.opened.profile,pack:f.pack,itemId:160100001,requiredSubtype:0
  }),/WEP_ROOM_FINISH_WALLPAPER_SUBTYPE_REQUIRED/);

  const unowned=structuredClone(f.opened.profile);
  unowned.Player.ListInventories['4'].Inventory['160100001'].Amount=0;
  evidence=resolveRoomFinishTrimmingEvidenceV125({
    profile:unowned,pack:f.pack,itemId:160100001,requiredSubtype:1
  });
  assert.equal(evidence.owned,false);
  assert.equal(evidence.ownedAmount,0);

  assert.equal(listOwnedRoomFinishTrimmingV125({
    profile:f.opened.profile,pack:f.pack,subtype:1
  }).some(x=>x.itemId===160100001),true);
});

test('Indoor Room binding is exact and current wall identity cross-checks wall Grid identity',async()=>{
  const f=await fixture();
  const route=f.routes.routes[0];
  assert.deepEqual(route.locator,{
    houseItemId:20500005,playerHouseIndex:0,floorIndex:0,roomSlot:0
  });
  assert.equal(route.projection.currentSaveLocator.floorGridId,900);
  assert.deepEqual(route.projection.currentSaveLocator.wallGridIds,{'0':901,'1':902,'2':903,'3':904});
  const wall=resolveRoomFinishCurrentWallV125(f.document,2);
  assert.deepEqual(wall,{wallPosition:2,wallPositionName:'Bottom',wallGridId:903});
});

test('Flooring is one room-level draft transaction with Undo/Redo and semantic Review Changes',async()=>{
  const f=await fixture();
  const compiled=compileRoomFinishFlooringDraftV125({
    document:f.document,
    profile:f.opened.profile,
    pack:f.pack,
    itemId:160100001
  });
  const next=applyRoomFinishDraftMutationV125(f.document,compiled);
  const semantic=roomFinishDraftReviewChange(next);
  assert.equal(semantic.kind,'ROOM_FINISH');
  assert.equal(semantic.finishKind,'FLOORING');
  assert.equal(semantic.oldItemId,160100000);
  assert.equal(semantic.newItemId,160100001);

  const session=createEditorSession(f.document);
  const result=session.commitRoomFinishDraft({
    roomFinish:next.roomFinish,
    reviewChange:semantic,
    mutationSet:compiled.mutationSet
  });
  assert.equal(result.applied,true);
  assert.equal(session.getDocument().roomFinish.current.flooringItemId,160100001);
  assert.equal(session.reviewChanges().changes.at(-1).finishKind,'FLOORING');
  session.undo();
  assert.equal(session.getDocument().roomFinish.current.flooringItemId,160100000);
  assert.equal(session.getDocument().roomFinish.pendingMutationSet,null);
  session.redo();
  assert.equal(session.getDocument().roomFinish.current.flooringItemId,160100001);
  assert.equal(session.exportRecoverySnapshot().document.roomFinish.current.flooringItemId,160100001);
});

test('Current Wall Wallpaper targets exactly one WallPosition',async()=>{
  const f=await fixture();
  const compiled=compileRoomFinishWallpaperDraftV125({
    document:f.document,
    profile:f.opened.profile,
    pack:f.pack,
    itemId:160000000,
    scope:WALLPAPER_SCOPE.CURRENT_WALL,
    wallPosition:1
  });
  assert.equal(compiled.mutationSet.scope,'CURRENT_WALL');
  assert.deepEqual(compiled.mutationSet.selectedWallPositions,[1]);
  assert.equal(compiled.nextState.wallpapers['0'],160000224);
  assert.equal(compiled.nextState.wallpapers['1'],160000000);
  assert.equal(compiled.nextState.wallpapers['2'],160000224);
});

test('All Walls Wallpaper is one atomic draft transaction and carries displaced stale-offset cleanup',async()=>{
  const f=await fixture();
  const compiled=compileRoomFinishWallpaperDraftV125({
    document:f.document,
    profile:f.opened.profile,
    pack:f.pack,
    itemId:160000000,
    scope:WALLPAPER_SCOPE.ALL_WALLS
  });
  assert.equal(compiled.mutationSet.scope,'ALL_WALLS');
  assert.deepEqual(compiled.mutationSet.selectedWallPositions,[0,1,2,3]);
  assert.equal(
    compiled.mutationSet.changes.filter(x=>/\/Wallpapers\//.test(x.path)).length,
    4
  );
  const cleanup=compiled.mutationSet.changes.find(x=>
    x.path.endsWith('/WallpaperOffsetById/160000224')
  );
  assert.equal(cleanup.kind,'REMOVE');
  assert.equal(cleanup.before,0.4623557);
  const next=applyRoomFinishDraftMutationV125(f.document,compiled);
  assert.deepEqual(next.roomFinish.current.wallpapers,{
    '0':160000000,'1':160000000,'2':160000000,'3':160000000
  });
  assert.equal(Object.hasOwn(next.roomFinish.current.wallpaperOffsetById,'160000224'),false);

  const session=createEditorSession(f.document);
  session.commitRoomFinishDraft({
    roomFinish:next.roomFinish,
    reviewChange:roomFinishDraftReviewChange(next),
    mutationSet:compiled.mutationSet
  });
  assert.equal(session.getHistoryState().undoDepth,1);
  session.undo();
  assert.equal(session.getHistoryState().undoDepth,0);
  assert.equal(session.getDocument().roomFinish.current.wallpapers['0'],160000224);
});

test('Room Finish verified export binds 01B adapter -> PLAYER_HOUSE_ROOM -> independent verifier -> bundle -> canonical reopen',async()=>{
  const f=await fixture();
  const compiled=compileRoomFinishFlooringDraftV125({
    document:f.document,
    profile:f.opened.profile,
    pack:f.pack,
    itemId:160100001
  });
  const draft=applyRoomFinishDraftMutationV125(f.document,compiled);
  const review=await reviewRoomFinishVerifiedExportV125({
    sourceBytes:f.sourceBytes,
    sourceName:'profile',
    sourceEpoch:1,
    opened:f.opened,
    draftDocument:draft,
    exactBuildConfirmed:true
  });
  assert.equal(review.status,'READY');
  assert.equal(review.plan.target.kind,'PLAYER_HOUSE_ROOM');
  assert.equal(review.plan.mutationAdapter.id,'01b-room-finish-v125-v1');
  assert.equal(review.runtimeAcceptance.status,'CLOSED_PASS');
  assert.equal(review.productExportAuthorized,true);
  assert.equal(review.persistentWriteAuthorized,false);

  const evidence=await commitRoomFinishVerifiedExportV125({
    review,
    currentSourceEpoch:1,
    sourceBytes:f.sourceBytes,
    draftDocument:draft
  });
  assert.equal(evidence.status,'PASS');
  assert.equal(evidence.verification.status,'PASS');
  assert.equal(evidence.reload.finishState.flooringItemId,160100001);
  assert.equal(evidence.source.untouched,true);
  assert.ok(evidence.artifacts.edited.bytes.length>0);
  assert.deepEqual(Array.from(evidence.artifacts.backup.bytes),Array.from(f.sourceBytes));
  assert.equal(evidence.runtimeAcceptance.status,ROOM_FINISH_RUNTIME_EVIDENCE.status);
  assert.equal(evidence.productApplyAuthorized,false);
  assert.equal(evidence.directSourceReplacementAuthorized,false);
});

test('All-Walls verified export reopens with all walls changed and stale offset removed',async()=>{
  const f=await fixture();
  const compiled=compileRoomFinishWallpaperDraftV125({
    document:f.document,
    profile:f.opened.profile,
    pack:f.pack,
    itemId:160000000,
    scope:WALLPAPER_SCOPE.ALL_WALLS
  });
  const draft=applyRoomFinishDraftMutationV125(f.document,compiled);
  const review=await reviewRoomFinishVerifiedExportV125({
    sourceBytes:f.sourceBytes,
    sourceName:'profile',
    sourceEpoch:2,
    opened:f.opened,
    draftDocument:draft,
    exactBuildConfirmed:true
  });
  const evidence=await commitRoomFinishVerifiedExportV125({
    review,currentSourceEpoch:2,sourceBytes:f.sourceBytes,draftDocument:draft
  });
  assert.deepEqual(evidence.reload.finishState.wallpapers,{
    '0':160000000,'1':160000000,'2':160000000,'3':160000000
  });
  assert.deepEqual(evidence.reload.finishState.wallpaperOffsetById,{});
});

test('Room Finish fails closed for unowned candidate, wrong subtype and a second unreviewed transaction',async()=>{
  const f=await fixture();
  const unowned=structuredClone(f.opened.profile);
  unowned.Player.ListInventories['4'].Inventory['160100001'].Amount=0;
  assert.throws(()=>compileRoomFinishFlooringDraftV125({
    document:f.document,profile:unowned,pack:f.pack,itemId:160100001
  }),/FLOORING_COMPILE_REJECTED/);

  assert.throws(()=>compileRoomFinishFlooringDraftV125({
    document:f.document,profile:f.opened.profile,pack:f.pack,itemId:160000000
  }),/FLOORING_SUBTYPE_REQUIRED/);

  const first=compileRoomFinishFlooringDraftV125({
    document:f.document,profile:f.opened.profile,pack:f.pack,itemId:160100001
  });
  const dirty=applyRoomFinishDraftMutationV125(f.document,first);
  assert.throws(()=>compileRoomFinishWallpaperDraftV125({
    document:dirty,profile:f.opened.profile,pack:f.pack,itemId:160000000,
    scope:WALLPAPER_SCOPE.ALL_WALLS
  }),/WEP_ROOM_FINISH_PENDING_REVIEW_REQUIRED/);
});
