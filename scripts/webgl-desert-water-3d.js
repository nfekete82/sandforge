import * as THREE from 'three';
import {planDesertWaterways} from './webgl-desert-water-plan.js';

/** Water remains PBR, lit by the real Sandforge sunset and actually moves.
 * Two reused materials (lagoon / flowing creek), no render target, no
 * reflection camera, no geometry uploads per frame and no CPU particles.
 * The first release is fordable shallow water: visual-only by design.
 */
export function cinematicWaterMaterial(flowing=false){
 const time={value:0};
 const mat=new THREE.MeshPhysicalMaterial({
  color:'#6bafad',roughness:.24,metalness:.055,clearcoat:.52,
  clearcoatRoughness:.16,transparent:true,opacity:.88,depthWrite:false,
  side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2
 });
 mat.userData.waterTime=time;
 mat.userData.cinematicWater={flowing,shallowPassable:true};
 mat.onBeforeCompile=shader=>{
  shader.uniforms.sfWaterTime=time;
  const nl=String.fromCharCode(10),mode=flowing?1:0;
  shader.vertexShader=shader.vertexShader
   .replace('#include <common>','#include <common>'+nl+
    'uniform float sfWaterTime; varying vec2 vSFWaterXZ; varying vec2 vSFWaterUV;')
   .replace('#include <begin_vertex>','#include <begin_vertex>'+nl+
    'vSFWaterXZ=position.xz; vSFWaterUV=uv;'+nl+
    'transformed.y += .12*sin(position.x*.10+sfWaterTime*.85)'+
    '+.09*sin(position.z*.135-position.x*.044+sfWaterTime*.61);');
  const header=[
    'uniform float sfWaterTime;',
    'varying vec2 vSFWaterXZ;',
    'varying vec2 vSFWaterUV;'
  ].join(nl);
  const color=[
    'float sfShore=clamp(vSFWaterUV.y,0.0,1.0);',
    'float sfFlow='+mode+'.0;',
    'float sfW1=sin(vSFWaterXZ.x*.081+vSFWaterXZ.y*.043+sfWaterTime*.76);',
    'float sfW2=sin(vSFWaterXZ.y*.128-vSFWaterXZ.x*.058+sfWaterTime*1.11);',
    'float sfRipple=sfW1*.5+sfW2*.5;',
    // Medium-distance blue/green water, sand shallows at the edges.
    'vec3 sfDeep=vec3(.025,.19,.195);',
    'vec3 sfShallow=vec3(.22,.335,.285);',
    'vec3 sfWater=mix(sfDeep,sfShallow,smoothstep(.19,.93,sfShore));',
    'sfWater+=vec3(.014,.032,.031)*sfRipple;',
    'float sfFoam=(1.0-smoothstep(.018,.12,abs(sfShore-.87)));',
    'sfFoam*=.17+.10*sin(sfWaterTime*.9+vSFWaterXZ.x*.14-vSFWaterXZ.y*.11);',
    'float sfCurrent=sin(vSFWaterUV.x*.088-sfWaterTime*1.35+sfW2*1.1);',
    'float sfGlint=pow(max(0.0,sfCurrent),15.0)*(.052+.048*sfFlow);',
    'diffuseColor.rgb=sfWater+vec3(.10,.16,.15)*sfFoam+vec3(sfGlint);',
    'diffuseColor.a*=1.0-smoothstep(.91,1.0,sfShore);'
  ].join(nl);
  shader.fragmentShader=shader.fragmentShader
   .replace('#include <common>','#include <common>'+nl+header)
   .replace('#include <normal_fragment_maps>',
    '#include <normal_fragment_maps>'+nl+
    'normal=normalize(normal+vec3(.035*sin(vSFWaterXZ.x*.09+sfWaterTime),'+
    '.035*cos(vSFWaterXZ.y*.12-sfWaterTime*.79),0.0));')
   .replace('#include <color_fragment>','#include <color_fragment>'+nl+color);
 };
 mat.customProgramCacheKey=()=>flowing?
  'sf-cinematic-river-water-v1':'sf-cinematic-lagoon-water-v1';
 return mat;
}
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
function meshFrom(vertices,uv,indices,material,name,root){
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.setIndex(indices);
 geometry.computeVertexNormals();
 geometry.computeBoundingSphere();
 const mesh=new THREE.Mesh(geometry,material);
 mesh.name=name;mesh.renderOrder=4;mesh.frustumCulled=true;
 mesh.receiveShadow=true;mesh.castShadow=false;mesh.raycast=()=>{};
 mesh.userData={visualOnly:true,nonPlayable:true,nonBlocking:true,
  shallowPassable:true,cinematicWater:true};
 root.add(mesh);
 return mesh;
}
function lagoonGeometry(o,heightAt,size,lowQuality=false){
 const positions=[],uv=[],indices=[],segments=lowQuality?64:96;
 const rings=[.002,.12,.26,.40,.55,.70,.81,.90,.96,1];
 const half=size*.5,co=Math.cos(o.rotation),si=Math.sin(o.rotation);
 for(let k=0;k<rings.length;k++){
  const radius=rings[k];
  for(let i=0;i<=segments;i++){
   const a=i/segments*Math.PI*2;
   const contour=1+.095*Math.sin(a*3+o.phase)+.058*Math.sin(a*7-o.phase*1.5)
     +.026*Math.sin(a*13+o.phase*.9);
   const dx=Math.cos(a)*o.radius*radius*contour;
   const dz=Math.sin(a)*o.radius*o.aspect*radius*contour;
   const x=o.x+dx*co-dz*si,z=o.y+dx*si+dz*co;
   positions.push(x-half,heightAt(x,z)+.42,z-half);
   uv.push(i/segments,radius);
   if(k&&i<segments){
    const a0=(k-1)*(segments+1)+i,b0=k*(segments+1)+i;
    indices.push(a0,b0,a0+1,a0+1,b0,b0+1);
   }
  }
 }
 return {positions,uv,indices};
}
function riverGeometry(r,heightAt,size,lowQuality=false){
 const positions=[],uv=[],indices=[],half=size*.5,
  rows=lowQuality?[-1,-.65,0,.65,1]:[-1,-.80,-.49,0,.49,.80,1],
  last=rows.length,points=r.points;
 let traveled=0;
 for(let i=0;i<points.length;i++){
  const p=points[i],before=points[Math.max(0,i-1)],
   after=points[Math.min(points.length-1,i+1)];
  if(i)traveled+=Math.hypot(p.x-points[i-1].x,p.y-points[i-1].y);
  const dx=after.x-before.x,dz=after.y-before.y,
   len=Math.hypot(dx,dz)||1,nx=-dz/len,nz=dx/len;
  const taper=clamp(i/3,0,1)*clamp((points.length-1-i)/3,0,1);
  const width=r.width*(.77+.23*Math.sin(i*.43+r.phase))*(.60+.40*taper);
  for(let j=0;j<rows.length;j++){
   const s=rows[j],edgy=1+.055*Math.sin(i*1.36+r.phase+j*1.3);
   const x=p.x+nx*width*s*edgy,z=p.y+nz*width*s*edgy;
   positions.push(x-half,heightAt(x,z)+.47,z-half);
   uv.push(traveled,Math.abs(s));
   if(i&&j<last-1){
    const a=(i-1)*last+j,b=i*last+j;
    indices.push(a,b,a+1,a+1,b,b+1);
   }
  }
 }
 return {positions,uv,indices};
}
/** Pure visual layer; deterministic based on the existing fixed map seed. */
export function createCinematicDesertWaterways({
 scene,world,terrain=world?.generated,heightAt,mapId,
 seed=world?.seed??0,oases=[],lowQuality=false
}){
 const layout=planDesertWaterways({mapId,world,terrain,seed,oases,lowQuality});
 const root=new THREE.Group();root.name='visual-cinematic-desert-waterways';
 root.userData={visualOnly:true,nonPlayable:true,shallowPassable:true};
 const meshes=[],materials=[];
 if(layout.lakes.length||layout.rivers.length){
  const lakeMaterial=cinematicWaterMaterial(false),riverMaterial=cinematicWaterMaterial(true);
  materials.push(lakeMaterial,riverMaterial);
  for(const o of layout.lakes){
   const g=lagoonGeometry(o,heightAt,world.size,lowQuality);
   const mesh=meshFrom(g.positions,g.uv,g.indices,lakeMaterial,'desert-lagoon-'+o.id,root);
   mesh.userData.lakeId=o.id;meshes.push(mesh);
  }
  for(const r of layout.rivers){
   const g=riverGeometry(r,heightAt,world.size,lowQuality);
   const mesh=meshFrom(g.positions,g.uv,g.indices,riverMaterial,'desert-river-'+r.id,root);
   mesh.userData.riverId=r.id;meshes.push(mesh);
  }
 }
 scene.add(root);
 let disposed=false;
 return {
  root,layout,meshes,materials,
  drawCalls:meshes.length,
  update(time){if(disposed)return;for(const m of materials)m.userData.waterTime.value=time;},
  dispose(){if(disposed)return;disposed=true;root.removeFromParent();
   for(const mesh of meshes)mesh.geometry.dispose();
   for(const mat of materials)mat.dispose();root.clear();
  }
 };
}
