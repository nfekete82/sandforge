import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {bakeMesaCliffGroundMask,cliffRampCoverage,
 installMesaCliffGroundPBR,DESERT_CLIFF_GROUND_REVISION}
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
