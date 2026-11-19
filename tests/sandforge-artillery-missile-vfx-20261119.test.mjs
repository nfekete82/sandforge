import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {ORDNANCE_VISUALS,ordnanceVisualProfile,ordnanceVisualKind}
 from '../scripts/webgl-ordnance-profile.js';
import {UNITS} from '../dist/src/reborn/catalog.js';

const src=readFileSync('scripts/webgl-combat-vfx.js','utf8');
const finFunction=src.match(/function artilleryFinGeometry\(\)\{[\s\S]*?\n\}\nconst rocketVisualOrientation/);
assert.ok(finFunction,'runtime should expose a real four-fin geometry constructor');
const createFins=new Function('THREE',finFunction[0].replace(/\nconst rocketVisualOrientation$/,'')
 +'\nreturn artilleryFinGeometry;')(THREE);

test('artillery missile has four true tapered metal stabilizers, finite normals and one pooled mesh',()=>{
 const geometry=createFins();
 assert.ok(geometry.isBufferGeometry);
 assert.equal(geometry.getAttribute('position').count,24);
 assert.equal(geometry.index.count,96);
 assert.ok(Array.from(geometry.getAttribute('normal').array).every(Number.isFinite));
 geometry.computeBoundingBox();
 assert.ok(geometry.boundingBox.max.x>=7.7);
 assert.ok(geometry.boundingBox.min.x<=-7.7);
 assert.ok(geometry.boundingBox.max.z>=7.7);
 assert.ok(geometry.boundingBox.min.z<=-7.7);
 assert.ok(geometry.boundingBox.max.y<0&&geometry.boundingBox.min.y<-11);
 geometry.dispose();
});

test('only the six-tube vehicle missiles get the new fins, motor and paint stripe',()=>{
 assert.match(src,/if\(kind==='artillery'\)\{/);
 for(const name of ['this.artilleryFins','this.artilleryNozzles','this.artilleryBands'])
  assert.match(src,new RegExp(name.replaceAll('.','\\.')+'\\.setMatrixAt\\(artilleryCount,dummy\\.matrix\\)'));
 assert.match(src,/for\(const mesh of \[this\.artilleryFins,this\.artilleryNozzles,this\.artilleryBands\]\)/);
 assert.match(src,/mesh\.count=artilleryCount/);
 assert.match(src,/new THREE\.InstancedMesh\(geometry,material,rocketLimit\)/);
 assert.match(src,/visualOnly:true,nonPlayable:true,projectile:true,artillery:true/);
 assert.match(src,/mesh\.castShadow=false/);
 assert.equal(ordnanceVisualKind({type:'guided'},'artillery'),'artillery');
 assert.equal(ordnanceVisualKind({type:'guided'},'tank'),'tank');
 assert.notEqual(ordnanceVisualProfile({type:'guided'},'tank'),
  ordnanceVisualProfile({type:'guided'},'artillery'));
});

test('rocket plume is pale, capped, recyclable and does not alter simulation ordnance',()=>{
 assert.match(src,/mode==='rocketSmoke'/);
 assert.match(src,/rgba\(255,251,234,\.92\)/);
 assert.match(src,/this\.rocketSmoke=makePool\(scene,'rocketSmoke',lowQuality\?48:160,\.68\)/);
 assert.match(src,/rocketJet\?this\.rocketSmoke:this\.smoke/);
 assert.ok(ORDNANCE_VISUALS.artillery.body>=1.35);
 assert.ok(ORDNANCE_VISUALS.artillery.smokeRate>=.07);
 assert.deepEqual([UNITS.artillery.cost,UNITS.artillery.hp,
  UNITS.artillery.damage,UNITS.artillery.cooldown,UNITS.artillery.range],
  [600,340,120,3.8,680]);
 assert.doesNotMatch(src,/this\.game\.(step|recruit|build|damage)\(/);
});

test('rocket fins are never re-created during the 20 Hz flight update loop',()=>{
 const ctor=src.indexOf('constructor({');
 const update=src.indexOf('updateRockets(active=true');
 assert.ok(ctor>0&&update>ctor);
 const flight=src.slice(update,src.indexOf('updateFallingBombs(',update));
 assert.doesNotMatch(flight,/new THREE\.(BufferGeometry|BoxGeometry|InstancedMesh|CylinderGeometry|MeshStandardMaterial)/);
 assert.match(src.slice(ctor,update),/artilleryFinGeometry\(\)/);
 assert.match(src,/const rocketVisualOrientation=new THREE\.Quaternion\(\)/);
});
