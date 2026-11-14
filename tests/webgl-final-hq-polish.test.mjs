import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createBuildingYard} from '../scripts/webgl-building-yard.js';
import {polishFinalFeldkommando,finalHqCamouflageTexture,FINAL_HQ_CAMO_COLORS} from '../scripts/webgl-final-hq-finish.js';
import {applyStrategicGlbFinish} from '../scripts/webgl-strategic-glb.js';
import {prepareHeadquartersPortal,finalHeadquartersExitRoute} from '../scripts/webgl-production-gates.js';
import {addFinalHeadquartersRoofDetails} from '../scripts/webgl-final-hq-roof.js';

test("uploaded camouflage is decoded from the user\'s original desert reference",()=>{
 const texture=finalHqCamouflageTexture();
 assert.equal(texture.image.width,48);
 assert.equal(texture.image.height,34);
 assert.equal(texture.image.data.length,48*34*4);
 assert.equal(texture.wrapS,THREE.MirroredRepeatWrapping);
 assert.equal(FINAL_HQ_CAMO_COLORS.length,8);
 const sample=new Set();
 for(let p=0;p<texture.image.data.length;p+=4)
  sample.add((texture.image.data[p]<<16)|(texture.image.data[p+1]<<8)|texture.image.data[p+2]);
 assert.equal(sample.size,8);
 for(const color of FINAL_HQ_CAMO_COLORS)assert.ok(sample.has(color));
});
test('HQ alone loses both tall security poles while keeping yard details',()=>{
 const hq=createBuildingYard('headquarters',225);
 const barracks=createBuildingYard('barracks',160);
 let hqLamps=0,barracksLamps=0;
 hq.traverse(o=>{if(o.name==='SecurityLamp')hqLamps++;});
 barracks.traverse(o=>{if(o.name==='SecurityLamp')barracksLamps++;});
 assert.equal(hqLamps,0);
 assert.ok(barracksLamps>0);
 assert.ok(hq.getObjectByName('BaseSupplyCache'));
});
test('one GLB, added radar feed and one desert shader for gameplay, preview and HUD',()=>{
 const model=new THREE.Group(),hq=new THREE.Group();hq.name='SF_Feldkommando_Final';
 const radar=new THREE.Group();radar.name='Radar_Dish_Pivot';
 const texture=new THREE.DataTexture(new Uint8Array([225,219,208,255]),1,1,THREE.RGBAFormat);
 const body=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({map:texture}));
 hq.add(radar);hq.add(body);model.add(hq);
 applyStrategicGlbFinish(model);
 assert.ok(radar.getObjectByName('SF_Final_Dish_Feedhorn'));
 assert.equal(radar.children.filter(c=>c.name==='SF_Final_Dish_Feed_Assembly').length,1);
 assert.equal(body.material.userData.sandforgeFinalCamo,true);
 assert.equal(body.material.userData.sandforgePreserveHQDesertTextures,true);
 const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'};
 body.material.onBeforeCompile(shader,{});
 assert.ok(shader.uniforms.sfFinalCamoTex?.value);
 assert.match(shader.fragmentShader,/sfPaint/);
 assert.equal(polishFinalFeldkommando(model),false,'idempotent, no duplicated dish');
});
test('preview and live pioneer suppress only the spurious markers',()=>{
 const script=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(script,/kind!=='barracks'&&kind!=='headquarters'\)tint\(model,false,\.50\)/);
 assert.match(script,/ring\.visible=!\(unit\.kind==='engineer'&&this\.units\.get\(id\)\?\.productionMotion\)/);
});

test('two graphite grilles use shared instanced geometry, no third dish',()=>{
 const root=new THREE.Group(),hq=new THREE.Group();hq.name='SF_Feldkommando_Final';
 root.add(hq);
 assert.equal(addFinalHeadquartersRoofDetails(root),true);
 const roof=hq.getObjectByName('SF_Final_Roof_Grilles');
 assert.equal(roof.children.length,3);
 assert.ok(roof.children.every(c=>c.isInstancedMesh));
 assert.equal(roof.getObjectByName('SF_Final_Roof_Grille_Ribs').count,10);
 assert.equal(addFinalHeadquartersRoofDetails(root),false);
 assert.equal(hq.children.filter(c=>c.name==='SF_Final_Roof_Grilles').length,1);
});
test('actual front gate keeps engineer route outside model on 4 rotations',()=>{
 for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
  const root=new THREE.Group(),main=new THREE.Group();main.name='SF_Feldkommando_Final';
  const body=new THREE.Mesh(new THREE.BoxGeometry(.95,.54,.80),new THREE.MeshStandardMaterial());
  body.name='SF_Final_Static_Body';main.add(body);
  const door1=new THREE.Group(),door2=new THREE.Group();
  door1.name='Door_Left_Pivot';door1.position.set(-.012,-.215,.295);
  door2.name='Door_Right_Pivot';door2.position.set(.080,-.215,.295);
  main.add(door1,door2);root.add(main);
  const portal=prepareHeadquartersPortal({kind:'headquarters',detail:root});
  assert.ok(portal?.final);
  assert.ok(root.userData.portal.outside[2]>=.58);
  assert.ok(root.userData.portal.inside[1]<=-.25,'pioneer feet on floor');
  root.position.set(500,0,500);root.rotation.y=yaw;root.scale.setScalar(220);
  root.updateWorldMatrix(true,true);
  for(const side of [-1,1]){
   const target=root.localToWorld(new THREE.Vector3(side*.86,-.26,-.40));
   const start=root.worldToLocal(finalHeadquartersExitRoute(root,target,0));
   assert.ok(start.z>.58,'start outside front facade');
   for(const t of [.05,.15,.3,.45,.57,.7,.82,.91]){
    const point=root.worldToLocal(finalHeadquartersExitRoute(root,target,t));
    assert.ok(Math.abs(point.x)>.49||point.z>.40,
     'do not cut through the left/right or rear wing at t='+t);
   }
   const end=finalHeadquartersExitRoute(root,target,1);
   assert.ok(end.distanceTo(target)<.00001,'exact authoritative spawn handoff');
  }
 }
});
test('final HQ specifically suppresses scaffold poles and adjusts health positions',()=>{
 const construction=readFileSync('scripts/webgl-construction.js','utf8');
 const health=readFileSync('scripts/webgl-actor-presentation.js','utf8');
 const gates=readFileSync('scripts/webgl-production-gates.js','utf8');
 assert.match(construction,/if\(base\.kind!=='headquarters'\)for\(const x/);
 assert.match(construction,/if\(base\.kind!=='headquarters'\)for\(const t/);
 assert.match(health,/kind==='headquarters'\?52/);
 assert.match(health,/kind==='engineer'\?40/);
 assert.match(gates,/hideHealth:hq\|\|fraction<clearFraction\*\.64/);
});
