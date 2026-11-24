import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';
import {BuildingPresentation,classicBuildingAtlasKind} from '../dist/src/reborn/building-presentation.js';

test('every simulation building has an available team-specific legacy Canvas atlas',()=>{
 const renderer=new BuildingPresentation();
 const authored=['headquarters','bastion','barracks','factory','airfield','generator','turret'];
 for(const kind of authored){
  const teams=kind==='bastion'?[0,1,-1]:[0,1];
  for(const owner of teams){
   assert.ok(existsSync(new URL(`../src/assets/reborn/buildings-3d/${kind}-${owner}.json`,import.meta.url)));
   renderer.assets.set(kind+owner,{data:{kind,team:owner},sprite:{kind,owner}});
  }
  assert.equal(classicBuildingAtlasKind(kind),kind);
 }
 for(const kind of Object.keys(BUILDINGS)){
  for(const team of [0,1]){
   const art=renderer.asset(kind,team);
   assert.ok(art,`Canvas has no atlas for ${kind} / team ${team}`);
   assert.equal(art.data.team,team);
   assert.equal(renderer.sprite(kind,team),art.sprite);
  }
 }
 assert.equal(renderer.asset('bastion',-1).data.team,-1);
 assert.equal(renderer.asset('bastion',0).data.team,0);
 assert.equal(renderer.asset('bastion',1).data.team,1);
});

test('only modern buildings without authored Canvas atlases reuse existing art',()=>{
 const aliases={research:'headquarters',silo:'generator',interceptor:'generator',wall:'barracks',wallGate:'barracks',bunker:'turret'};
 for(const [kind,atlas] of Object.entries(aliases))assert.equal(classicBuildingAtlasKind(kind),atlas);
});
