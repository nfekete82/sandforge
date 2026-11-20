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
  color:'#6c9b91',roughness:.43,metalness:0,clearcoat:.30,
  clearcoatRoughness:.32,transparent:true,opacity:.66,depthWrite:false,
  side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2
 });
 mat.userData.waterTime=time;
 mat.userData.cinematicWater={flowing,shallowPassable:true};
 mat.onBeforeCompile=shader=>{
  shader.uniforms.sfWaterTime=time;
  const nl=String.fromCharCode(10),mode=flowing?1:0;
  shader.vertexShader=shader.vertexShader
   .replace('#include <common>','#include <common>'+nl+
    'uniform float sfWaterTime; attribute vec2 sfWaterCoordinates; varying vec2 vSFWaterXZ; varying vec2 vSFWaterUV;')
   .replace('#include <begin_vertex>','#include <begin_vertex>'+nl+
    'vSFWaterXZ=position.xz; vSFWaterUV=sfWaterCoordinates;'+nl+
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
    'float sfW1=sin(vSFWaterXZ.x*.049+vSFWaterXZ.y*.074+sfWaterTime*.46);',
    'float sfW2=sin(vSFWaterXZ.y*.091-vSFWaterXZ.x*.037+sfWaterTime*.71);',
    'float sfRipple=sfW1*.46+sfW2*.32+.22*sin(vSFWaterXZ.x*.17+vSFWaterXZ.y*.083+sfWaterTime*.33);',
    // Medium-distance blue/green water, sand shallows at the edges.
    'vec3 sfDeep=vec3(.052,.18,.16);',
    'vec3 sfShallow=vec3(.25,.31,.265);',
    'vec3 sfWater=mix(sfDeep,sfShallow,smoothstep(.19,.93,sfShore));',
    'sfWater+=vec3(.009,.015,.014)*sfRipple;',
    'float sfFoam=(1.0-smoothstep(.02,.10,abs(sfShore-.945)));',
    'sfFoam*=.045+.025*sin(sfWaterTime*.45+vSFWaterXZ.x*.061-vSFWaterXZ.y*.047);',
    'float sfCurrent=sin(vSFWaterXZ.x*.053+vSFWaterXZ.y*.073-sfWaterTime*.72+sfW2*.47);',
    'float sfGlint=pow(max(0.0,sfCurrent),24.0)*(.011+.007*sfFlow);',
    'diffuseColor.rgb=sfWater+vec3(.055,.065,.045)*sfFoam+vec3(sfGlint);',
    'diffuseColor.a*=1.0-smoothstep(.82,1.0,sfShore);'
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
 // Custom attribute is always available, even when the PBR material has no UV texture.
 geometry.setAttribute('sfWaterCoordinates',new THREE.Float32BufferAttribute(uv,2));
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
 const positions=[],uv=[],indices=[],segments=lowQuality?96:160;
 // Dense concentric tessellation tracks the genuine terrain heightfield.
 // The old 10 wide rings cut through the ground and produced striped
 // z-fighting artefacts visible as diagonal white bands on the lake.
 const rings=Array.from({length:lowQuality?22:36},(_,i)=>Math.max(.002,i/(lowQuality?21:35)));
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
   positions.push(x-half,heightAt(x,z)+.65,z-half);
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
   positions.push(x-half,heightAt(x,z)+.65,z-half);
   uv.push(traveled,Math.abs(s));
   if(i&&j<last-1){
    const a=(i-1)*last+j,b=i*last+j;
    indices.push(a,b,a+1,a+1,b,b+1);
   }
  }
 }
 return {positions,uv,indices};
}
/** Wet banks reveal the depth gradient without changing the physical sand.
 * Transparent vertex colors fade back to the original dry PBR ground.
 * Shore meshes are merged PER body (one additional draw call), render-only.
 */
function shorelineMaterial(){
 return new THREE.MeshStandardMaterial({
  color:'#dfcbb1',vertexColors:true,roughness:.94,metalness:0,
  transparent:true,opacity:.68,depthWrite:false,
  polygonOffset:true,polygonOffsetFactor:-1,side:THREE.DoubleSide
 });
}
function shoreMesh(g,mat,name,root){
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(g.positions,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(g.colors,4));
 geometry.setIndex(g.indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
 const mesh=new THREE.Mesh(geometry,mat);
 mesh.name=name;mesh.renderOrder=2;mesh.castShadow=false;
 mesh.receiveShadow=true;mesh.raycast=()=>{};
 mesh.userData={visualOnly:true,nonPlayable:true,nonBlocking:true,wetShore:true};
 root.add(mesh);return mesh;
}
function lagoonShore(o,heightAt,size,lowQuality=false){
 const positions=[],colors=[],indices=[],half=size*.5,segments=lowQuality?64:96;
 const rings=[.84,.95,1.025,1.13,1.24],alpha=[.62,.63,.49,.18,0];
 const co=Math.cos(o.rotation),si=Math.sin(o.rotation);
 for(let k=0;k<rings.length;k++){
  for(let i=0;i<=segments;i++){
   const a=i/segments*Math.PI*2;
   const shape=1+.095*Math.sin(a*3+o.phase)+.058*Math.sin(a*7-o.phase*1.5)+.026*Math.sin(a*13+o.phase*.9);
   const dx=Math.cos(a)*o.radius*rings[k]*shape,dz=Math.sin(a)*o.radius*o.aspect*rings[k]*shape;
   const x=o.x+dx*co-dz*si,z=o.y+dx*si+dz*co;
   positions.push(x-half,heightAt(x,z)+.26,z-half);
   const t=k/4;
   colors.push(.30+.38*t,.29+.32*t,.225+.23*t,alpha[k]);
   if(k&&i<segments){
    const a0=(k-1)*(segments+1)+i,b0=k*(segments+1)+i;
    indices.push(a0,b0,a0+1,a0+1,b0,b0+1);
   }
  }
 }
 return {positions,colors,indices};
}
function riverShore(r,heightAt,size){
 const positions=[],colors=[],indices=[],points=r.points,half=size*.5;
 const spans=[.85,1,1.22,1.48],alpha=[.54,.51,.24,0];
 for(const side of [-1,1]){
  const first=positions.length/3;
  for(let i=0;i<points.length;i++){
   const p=points[i],a=points[Math.max(i-1,0)],b=points[Math.min(points.length-1,i+1)],
     dx=b.x-a.x,dz=b.y-a.y,len=Math.hypot(dx,dz)||1,nx=-dz/len,nz=dx/len,
     taper=clamp(i/3,0,1)*clamp((points.length-1-i)/3,0,1),
     width=r.width*(.77+.23*Math.sin(i*.43+r.phase))*(.60+.40*taper);
   for(let j=0;j<spans.length;j++){
    const w=width*spans[j]*side*(1+.055*Math.sin(i*1.36+r.phase+j*.5));
    const x=p.x+nx*w,z=p.y+nz*w;
    positions.push(x-half,heightAt(x,z)+.27,z-half);
    const t=j/(spans.length-1);
    colors.push(.30+.38*t,.28+.34*t,.225+.23*t,alpha[j]);
    if(i&&j<spans.length-1){
     const q=first+(i-1)*spans.length+j,n=first+i*spans.length+j;
     indices.push(q,n,q+1,q+1,n,n+1);
    }
   }
  }
 }
 return {positions,colors,indices};
}

/** Pure visual layer; deterministic based on the existing fixed map seed. */
export function createCinematicDesertWaterways({
 scene,world,terrain=world?.generated,heightAt,mapId,
 seed=world?.seed??0,oases=[],lowQuality=false,layout:plannedLayout=null
}){
 const layout=plannedLayout??planDesertWaterways({mapId,world,terrain,seed,oases,lowQuality});
 const root=new THREE.Group();root.name='visual-cinematic-desert-waterways';
 root.userData={visualOnly:true,nonPlayable:true,shallowPassable:true};
 const meshes=[],materials=[],shores=[];
 if(layout.lakes.length||layout.rivers.length){
  const lakeMaterial=cinematicWaterMaterial(false),riverMaterial=cinematicWaterMaterial(true);
  materials.push(lakeMaterial,riverMaterial);
  const bankMat=shorelineMaterial();materials.push(bankMat);
  for(const o of layout.lakes){
   const g=lagoonGeometry(o,heightAt,world.size,lowQuality);
   const mesh=meshFrom(g.positions,g.uv,g.indices,lakeMaterial,'desert-lagoon-'+o.id,root);
   mesh.userData.lakeId=o.id;meshes.push(mesh);
   shores.push(shoreMesh(lagoonShore(o,heightAt,world.size,lowQuality),bankMat,
     'desert-lagoon-wet-bank-'+o.id,root));
  }
  for(const r of layout.rivers){
   const g=riverGeometry(r,heightAt,world.size,lowQuality);
   const mesh=meshFrom(g.positions,g.uv,g.indices,riverMaterial,'desert-river-'+r.id,root);
   mesh.userData.riverId=r.id;meshes.push(mesh);
   shores.push(shoreMesh(riverShore(r,heightAt,world.size),bankMat,
     'desert-river-wet-bank-'+r.id,root));
  }
 }
 scene.add(root);
 let disposed=false;
 return {
  root,layout,meshes,shores,materials,
  drawCalls:meshes.length+shores.length,
  update(time){if(disposed)return;for(const m of materials)if(m.userData.waterTime)m.userData.waterTime.value=time;},
  dispose(){if(disposed)return;disposed=true;root.removeFromParent();
   for(const mesh of [...meshes,...shores])mesh.geometry.dispose();
   for(const mat of materials)mat.dispose();root.clear();
  }
 };
}
