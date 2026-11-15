import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {applyLowpolyFeldkommandoFinish,lowpolyHqTexture,LOWPOLY_HQ_DESERT_FINISH} from '../scripts/webgl-lowpoly-hq-finish.js';
import {applyStrategicGlbFinish} from '../scripts/webgl-strategic-glb.js';

function makeLowpolyHQ(){
 const root=new THREE.Group();
 const left=new THREE.Group();left.name='Gate_Left_Pivot';
 const radar=new THREE.Group();radar.name='Radar_Pivot';
 root.add(left,radar);
 const source=new THREE.MeshStandardMaterial({name:'sand_wall',color:'#f2e7d5'});
 const geom=new THREE.BoxGeometry(12,4,1);
 geom.deleteAttribute('uv'); // exact GLB constraint: source has no TEXCOORD_0
 const wall=new THREE.Mesh(geom,source);wall.name='HQ_sand_wall';
 root.add(wall);
 const door=new THREE.Mesh(new THREE.BoxGeometry(1,2,.1),
  new THREE.MeshStandardMaterial({name:'door_wood'}));
 left.add(door);
 const glass=new THREE.Mesh(new THREE.BoxGeometry(1,1,.05),
  new THREE.MeshStandardMaterial({name:'glass'}));
 root.add(glass);
 const star=new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.02),
  new THREE.MeshStandardMaterial({name:'star',color:'#ffffff'}));
 root.add(star);
 return {root,wall,door,glass,star,source,geom};
}

test('low-poly HQ material finish adds UVs and desert textures without altering authored GLB mesh',()=>{
 const {root,wall,door,glass,star,source,geom}=makeLowpolyHQ();
 assert.equal(applyStrategicGlbFinish(root)>=0,true);
 assert.equal(root.userData.sfLowpolyDesertFinish,LOWPOLY_HQ_DESERT_FINISH);
 assert.notStrictEqual(wall.geometry,geom);
 assert.equal(geom.getAttribute('uv'),undefined);
 assert.equal(wall.geometry.getAttribute('uv').count,wall.geometry.getAttribute('position').count);
 assert.equal(wall.material.map,lowpolyHqTexture('camo'));
 assert.equal(wall.material.map.colorSpace,THREE.SRGBColorSpace);
 assert.equal(wall.material.map.wrapS,THREE.RepeatWrapping);
 assert.equal(door.material.map,lowpolyHqTexture('door'));
 assert.equal(glass.material.map,null);
 assert.equal(star.material.map,null,'team insignia stays crisp');
 assert.equal(source.map,null,'source material is not mutated');
 assert.equal(applyLowpolyFeldkommandoFinish(root),false,'no second texture/UV application');
});

test('desert camouflage is irregular, deterministic and fixed when ghost moves or rotates',()=>{
 const {root,wall}=makeLowpolyHQ();
 applyLowpolyFeldkommandoFinish(root);
 const before=Array.from(wall.geometry.getAttribute('uv').array);
 const tex=wall.material.map;
 const colors=new Set();
 for(let p=0;p<tex.image.data.length;p+=4){
  const d=tex.image.data;
  colors.add((d[p]<<16)|(d[p+1]<<8)|d[p+2]);
 }
 assert.ok(colors.size>20,'camo has large patches plus subtle surface grain');
 root.position.set(190,10,-42);
 root.rotation.y=Math.PI/2;
 root.scale.setScalar(1.7);
 root.updateMatrixWorld(true,true);
 assert.deepEqual(Array.from(wall.geometry.getAttribute('uv').array),before);
 assert.strictEqual(lowpolyHqTexture('camo'),tex,'shared texture cache for game, preview and portrait');
});

test('unrelated buildings are unaffected and never get lowpoly camouflage',()=>{
 const ordinary=new THREE.Group(),mesh=new THREE.Mesh(
  new THREE.BoxGeometry(2,2,2),
  new THREE.MeshStandardMaterial({name:'sand_wall',color:'#e0d0a0'}));
 ordinary.add(mesh);
 assert.equal(applyLowpolyFeldkommandoFinish(ordinary),false);
 assert.equal(mesh.material.map,null);
 assert.equal(ordinary.userData.sfLowpolyDesertFinish,undefined);
});
