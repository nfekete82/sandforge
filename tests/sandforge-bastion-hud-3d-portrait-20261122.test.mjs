import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const portraits=readFileSync('scripts/webgl-portraits.js','utf8');
const scene=readFileSync('scripts/webgl-battlefield.js','utf8');

test('Bastion portraits load the exact current world GLB by owner and mesh mode',()=>{
 for(const source of [scene,portraits]){
  assert.match(source,/meshyStructurePath\('bastion'\)\?\?/);
  assert.match(source,/\/src\/assets\/reborn\/buildings-3d\/bastion-'\+/);
 }
 assert.match(portraits,/new GLTFLoader\(\)\.loadAsync\(modelPath\)/);
 assert.match(portraits,/removeBastionFrontShield\(model\)/);
 assert.match(scene,/removeBastionFrontShield\(data\.scene\)/);
 assert.match(portraits,/prepareMeshyStructure\(model,'bastion',faction\)/);
 assert.match(scene,/prepareMeshyStructure\(detail,'bastion',owner\)/);
 assert.match(portraits,/unifyModelFactionFlags\(model,faction\)/);
 assert.match(scene,/unifyModelFactionFlags\(detail,owner\)/);
});

test('Bastion selection uses cached and safely isolated 3D render, including owner changes',()=>{
 assert.match(portraits,/const bastionPortraitCache=new Map\(\)/);
 assert.match(portraits,/const key=modelPath\+'#'\+faction/);
 assert.match(portraits,/node\.geometry=node\.geometry\.clone\(\)/);
 assert.match(portraits,/node\.material\.map\(m=>m\.clone\(\)\)/);
 assert.match(portraits,/return renderModelPortrait\(model,renderer,/);
 assert.match(scene,/'bastion:'\+selectedBastion\.id\+':'\+selectedBastion\.owner/);
 assert.match(scene,/portrait\.src=bastionIconUrl\(selectedBastion\.owner\)/);
 assert.match(scene,/if\(!this\.lite\)bastionIcon\(selectedBastion\.owner,this\.renderer\)/);
 assert.match(scene,/this\.previousPortraitKey===portraitKey&&portrait\.isConnected/);
 assert.ok(!scene.includes("portrait.src='/src/assets/reborn/bastion-grounded-v2.png'"),
  'outdated Bastion image may never be used for the selected HUD portrait');
});

test('fallback preview still matches faction ownership',()=>{
 assert.match(portraits,/owner===0\?0:owner===1\?1:-1/);
 assert.match(portraits,/bastion-'\+\(owner===0\?0:owner===1\?1:-1\)\+'\.png'/);
});
