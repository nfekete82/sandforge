import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {createLandscapeMeshes} from '../scripts/webgl-landscape-network.js';
import {bakeMesaCliffGroundMask,cliffRampCoverage,
 installMesaCliffGroundPBR,DESERT_CLIFF_GROUND_REVISION,
 DESERT_STRIKE_SANDSTONE_GRADE}
 from '../scripts/webgl-desert-cliff-ground-pbr.js';
const size=1200;
const mesa={center:{x:600,y:600},topRadius:190,footRadius:370,
 rampWidth:154,rampEnd:530,direction:{x:1,y:0},
 ramps:[{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1}],
 seed:9999,siteIndex:-1};
const sample=(b,x,y,channel=0)=>{
 const i=Math.min(b.resolution-1,Math.max(0,Math.floor(x/size*b.resolution)));
 const j=Math.min(b.resolution-1,Math.max(0,Math.floor(y/size*b.resolution)));
 return b.pixels[(j*b.resolution+i)*4+channel]/255;
};

test('baked cliff is one softly bounded map-wide material mask; actual ramps stay clear',()=>{
 const a=bakeMesaCliffGroundMask({size,plateaus:[mesa],resolution:512});
 const b=bakeMesaCliffGroundMask({size,plateaus:[mesa],resolution:512});
 assert.equal(a.revision,DESERT_CLIFF_GROUND_REVISION);
 assert.deepEqual(a.pixels,b.pixels,'all visuals must be deterministic per authored map');
 const angle=Math.PI/4,fromR=r=>{
  const factor=1+.045*Math.sin(angle*5+mesa.seed*.00047+mesa.siteIndex*1.7)+
   .025*Math.cos(angle*9-(mesa.seed*.00047+mesa.siteIndex*1.7)*.8);
  return {x:mesa.center.x+Math.cos(angle)*r*factor,
   y:mesa.center.y+Math.sin(angle)*r*factor};
 };
 const mid=fromR((mesa.topRadius+mesa.footRadius)*.5);
 assert.ok(cliffRampCoverage(mid,mesa)<.1,'test the non-ramp cliff face');
 assert.ok(sample(a,mid.x,mid.y)>.40,'exposed sandstone should be visible');
 const rim=fromR(mesa.topRadius-24),toe=fromR(mesa.footRadius+60);
 assert.ok(sample(a,rim.x,rim.y)<sample(a,mid.x,mid.y),
  'rock should fade into upper plateau sand');
 assert.ok(sample(a,toe.x,toe.y)<sample(a,mid.x,mid.y),
  'rock should fade into valley sand');
 assert.ok(sample(a,600,100)<.005,'ordinary sand cannot become a rock carpet');
 for(const ramp of mesa.ramps){
  const r=(mesa.topRadius+mesa.footRadius)*.5;
  const p={x:mesa.center.x+r*ramp.x,y:mesa.center.y+r*ramp.y};
  assert.ok(cliffRampCoverage(p,mesa)>.8);
  assert.ok(sample(a,p.x,p.y)<.035,'no rock paint on any vehicle ramp');
 }
 let intermediate=0;
 for(let n=0;n<a.pixels.length;n+=4)if(a.pixels[n]>5&&a.pixels[n]<250)intermediate++;
 assert.ok(intermediate>500,'enough pixels must support a gradual transition');
});

test('integrated PBR remains opaque and shares exactly the existing ground draw calls',()=>{
 const mat=new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true});
 let priorCalled=false;
 mat.onBeforeCompile=shader=>{priorCalled=true;shader.fragmentShader+='\n// prior ground layers';};
 const handle=installMesaCliffGroundPBR(mat,{size,plateaus:[mesa],lowQuality:true});
 assert.equal(handle.integratedIntoGround,true);
 assert.equal(handle.drawCallsAdded,0);
 assert.equal(handle.mask.image.width,256);
 assert.equal(handle.mask.wrapS,THREE.ClampToEdgeWrapping);
 assert.equal(handle.mask.colorSpace,THREE.NoColorSpace);
 assert.equal(mat.transparent,false);
 assert.equal(mat.depthWrite,true);
 assert.equal(installMesaCliffGroundPBR(mat,{size,plateaus:[mesa]}),handle,
  'avoid duplicate shaders and textures');
 const shader={uniforms:{},
  vertexShader:'#include <common>\n#include <begin_vertex>',
  fragmentShader:'#include <common>\n#include <map_fragment>\n#include <color_fragment>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>'};
 mat.onBeforeCompile(shader,{});
 assert.equal(priorCalled,true);
 assert.equal(shader.uniforms.sfCliffZone.value,handle.mask);
 assert.equal(shader.uniforms.sfCliffStone.value,handle.rock.map);
 assert.equal(shader.uniforms.sfCliffNormal.value,handle.rock.normalMap);
 assert.match(shader.vertexShader,/vSfMesaWorld=position/);
 assert.match(shader.fragmentShader,/sfMesaStone=smoothstep/);
 assert.match(shader.fragmentShader,/diffuseColor.rgb=mix\(diffuseColor.rgb,sfMesaAlbedo/);
 assert.match(shader.fragmentShader,/sfMesaAlbedo\*=vec3\(0\.74,0\.61,0\.48\)/);
 assert.match(shader.fragmentShader,/sfMesaStoneUV\*2\.17/);
 assert.match(shader.fragmentShader,/1\.0-0\.46\*sfMesaMask\.g/);
 assert.match(shader.fragmentShader,/smoothstep\(0\.16,0\.84,sfMesaMask\.r\)/);
 assert.match(shader.fragmentShader,/sfMesaStone\*0\.94/);
 assert.match(shader.fragmentShader,/normal=normalize\(normal\+sfMesaViewN/);
 assert.match(shader.fragmentShader,/prior ground layers/);
 assert.match(mat.customProgramCacheKey(),/integrated-cliff-pbr/);
 handle.dispose();mat.dispose();
});

test('actual Desert Strike browser entrypoint uses one rock/sand surface without the transparent cliff overlay',()=>{
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(preview,/installMesaCliffGroundPBR\(material,/);
 assert.match(preview,/terrain\.battlefield\?\.generatorVersion>=7&&\s*desertRegion\?\.id!=='desert-strike'/);
 assert.match(preview,/cliffGroundBlend\?\.dispose\(\)/);
 assert.match(build,/webgl-desert-cliff-ground-pbr\.js/);
 assert.doesNotMatch(preview,/renderHeightAt:desertRegion\?\.id==='desert-strike'/);
});

test('elevated sandstone ridge foot has a true alpha fade into sand, not an opaque carpet',()=>{
 const scene=new THREE.Scene(),size=3200;
 const ridges=[{spine:[{x:300,y:1600},{x:2700,y:1600}],
  width:145,height:95,ramps:[],clearings:[]}];
 const meshes=createLandscapeMeshes({
  scene,size,heightAt:()=>0,roads:[],ridges,plateaus:[],
  biome:'desert',mapId:'desert-strike',seed:765,lowQuality:true,
  showOutcrops:false
 });
 const cliff=meshes.find(m=>m.name==='procedural-v3-eroded-sandstone');
 assert.ok(cliff,'ridge geometry must remain sculpted 3D, not be removed');
 assert.equal(cliff.material.map?.isTexture,true);
 assert.equal(cliff.material.normalMap?.isTexture,true);
 assert.equal(cliff.material.roughnessMap?.isTexture,true);
 assert.equal(cliff.material.transparent,true);
 assert.equal(cliff.material.depthWrite,false);
 assert.equal(cliff.material.forceSinglePass,true);
 assert.equal(cliff.userData.cliffFootBlend,'rise-normalized-vertex-alpha-v1');
 const fade=cliff.geometry.getAttribute('ridgeFade');
 const p=cliff.geometry.getAttribute('position');
 assert.ok(fade&&fade.count===p.count);
 let transparent=0,middle=0,solid=0;
 for(let i=0;i<fade.count;i++){
  const alpha=fade.getX(i);
  assert.ok(alpha>=0&&alpha<=1);
  if(alpha<.01)transparent++;
  else if(alpha>.98)solid++;
  else middle++;
 }
 assert.ok(transparent>30,'the entire foot should not be opaque');
 assert.ok(middle>200,'rock and sand need a broad gradual transition');
 assert.ok(solid>200,'keep a visible upper face');
 const shader={vertexShader:'#include <common>\n#include <begin_vertex>',
  fragmentShader:'#include <common>\n#include <color_fragment>'};
 cliff.material.onBeforeCompile(shader);
 assert.match(shader.fragmentShader,/diffuseColor.a \*= clamp\(vSfRidgeFade/);
 for(const m of meshes){m.removeFromParent();m.geometry.dispose();m.material.dispose();}
});

test('warm sandstone grade is measurably darker than the chalky v1 tint',()=>{
 const g=DESERT_STRIKE_SANDSTONE_GRADE;
 assert.equal(DESERT_CLIFF_GROUND_REVISION,'desert-strike-integrated-cliff-pbr-v2');
 const v1=[.82,.78,.70].map(n=>n*(.70+1.07)/2);
 const v2=g.tint.map(n=>n*(g.lightFloor+g.lightFloor+g.lightRange)/2);
 const luminance=c=>c[0]*.2126+c[1]*.7152+c[2]*.0722;
 assert.ok(luminance(v2)<luminance(v1)*.87,
  'rock should not be a bright grey chalk wash at nominal daylight');
 assert.ok(v2[0]>v2[1]&&v2[1]>v2[2],
  'sun-warmed sandstones should remain ochre rather than neutral grey');
 assert.ok(g.veinDarken>.40,'weathered fissures should remain visible');
 assert.ok(g.blendStart>=.12&&g.blendEnd<=.86,
  'the physical sand-to-rock blend should not create a giant milky halo');
 assert.ok(g.rockStrength>.9,'visible cliffs should have a clear material identity');
});
