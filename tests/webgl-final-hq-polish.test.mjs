import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createBuildingYard} from '../scripts/webgl-building-yard.js';
import {polishFinalFeldkommando,finalHqCamouflageTexture,FINAL_HQ_CAMO_COLORS} from '../scripts/webgl-final-hq-finish.js';
import {applyStrategicGlbFinish} from '../scripts/webgl-strategic-glb.js';

test('uploaded camouflage is decoded from the user's original desert reference',()=>{
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
