import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createStrategicBuilding} from '../scripts/webgl-strategic-buildings.js';
import {createBuildingYard,disposeBuildingYard} from '../scripts/webgl-building-yard.js';
import {globalCatalogAvailability,GLOBAL_PRODUCTION_TABS} from '../scripts/webgl-global-catalog.js';
import {DESERT_SURFACE_DETAIL,installDesertSurfaceDetail}
 from '../scripts/webgl-sand-surface-detail.js';

const src=path=>readFileSync(path,'utf8');

test('research lab has an enlarged roof-supported radar; yard and HUD share its shape',()=>{
 for(const owner of [0,1]){
  const model=createStrategicBuilding('research',owner);
  const mount=model.getObjectByName('Research_RadarMount');
  const reflector=model.getObjectByName('Research_Radar');
  const rim=model.getObjectByName('Research_RadarRim');
  const feed=model.getObjectByName('Research_ReceiverFeed');
  assert.ok(mount?.isGroup&&reflector?.isMesh&&rim?.isMesh&&feed?.isMesh);
  assert.equal(reflector.parent.parent,mount,'reflector belongs to radar swivel');
  const bounds=new THREE.Box3().setFromObject(model);
  assert.ok(bounds.max.y>95&&bounds.max.y<150,'compact, not towering');
  assert.ok(model.getObjectByName('Research_SensorArray'),'retain laboratory character');
 }
 const yard=createBuildingYard('research',170);
 const wire=yard.getObjectByName('BasePerimeter_research');
 assert.ok(wire?.getObjectByName('BarracksWireFenceStrands')?.isInstancedMesh);
 assert.ok(wire.getObjectByName('BarracksWireFenceBarbs')?.isInstancedMesh);
 const cache=wire.getObjectByName('BaseSupplyCache');
 assert.ok(cache,'research right-side supplies are present');
 const bounds=wire.userData.researchFenceBounds;
 assert.ok(bounds,'the enlarged lab uses adaptive, measured fence geometry');
 wire.updateWorldMatrix(true,true);
 const box=new THREE.Box3().setFromObject(cache);
 box.applyMatrix4(wire.matrixWorld.clone().invert());
 assert.ok(bounds.rightX>=box.max.x+17,
  'entire right pallet, supply crates and barrel rims are inside fence with clearance');
 assert.ok(bounds.rear<=box.min.z-15,'rear wire clears the supplies');
 assert.ok(bounds.front>=box.max.z+17,'front wire clears the supplies');
 assert.ok(bounds.rightX>170*.8,'research wire extends distinctly to the right');
 assert.equal(bounds.gateHalf,170*.28,'building entrance stays open');
 disposeBuildingYard(yard);
});

test('four global tabs only; research requires an explicit player click on a finished lab',()=>{
 const hud=src('scripts/webgl-classic-hud.js');
 const game=src('scripts/webgl-battlefield.js');
 const deck=src('scripts/webgl-research-deck.js');
 assert.deepEqual(GLOBAL_PRODUCTION_TABS,['buildings','infantry','vehicles','aircraft']);
 assert.doesNotMatch(hud,/data-tab="research"/);
 assert.doesNotMatch(game,/data-sf-group="research"/);
 assert.match(game,/this.researchDeckRequestedFor=hit.entity.kind==='research'/);
 assert.match(game,/base:clickedLab\?base:null/);
 assert.match(game,/this.researchDeck\?\.update\(\{/);
 assert.match(deck,/base.buildRemaining<=0\?base.id:null/);
 const gameState={bases:[]};
 assert.equal('research' in globalCatalogAvailability(gameState),false);
});

test('destructive confirmation uses a screen-center native modal and pauses then restores',()=>{
 const hud=src('scripts/webgl-battlefield.js');
 const dialog=src('scripts/webgl-confirm-dialog.js');
 const css=src('src/reborn/webgl-classic-hud.css');
 const preview=src('scripts/webgl-preview.js');
 assert.match(hud,/this.confirmDialog.ask\(\{/);
 assert.doesNotMatch(hud,/window.confirm\(/);
 assert.match(dialog,/dialog.showModal\(\)/);
 assert.match(dialog,/dialog.addEventListener\('cancel'/);
 assert.match(dialog,/if\(pending\)return Promise.resolve\(false\)/);
 assert.match(css,/inset:0!important/);
 assert.match(css,/margin:auto!important/);
 assert.match(preview,/confirmationWasRunning=running/);
 assert.match(preview,/if\(confirmationWasRunning\)setSimulationRunning\(true/);
});

test('track marks start translucent, and sand shader gets rotated multi-scale sediment',()=>{
 const tracks=src('scripts/webgl-ground-tracks.js');
 assert.match(tracks,/markPool\(scene,'foot',lite\?440:900,12,.34\)/);
 assert.match(tracks,/markPool\(scene,'vehicle',lite\?500:1000,16,.27\)/);
 const shader=src('scripts/webgl-sand-surface-detail.js');
 assert.match(shader,/sfSandTwist/);
 assert.match(shader,/sfWindDrift/);
 assert.equal(DESERT_SURFACE_DETAIL.size,512);
 assert.ok(DESERT_SURFACE_DETAIL.coverageStrength>.40);
 const material=new THREE.MeshStandardMaterial();
 const maps=installDesertSurfaceDetail(material,{capabilities:{getMaxAnisotropy:()=>8}});
 assert.equal(maps.mask.image.data.length,512*512*4);
 Object.values(maps).forEach(map=>map.dispose());
 material.dispose();
});
