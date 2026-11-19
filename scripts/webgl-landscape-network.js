import * as THREE from 'three';
import {sharedStoneMaps,stoneMaterial,weatheredStoneGeometry} from './webgl-rock-materials.js';
import {DESERT_SCENIC_STYLE as desertStyle} from './webgl-desert-style.js';

/** Render-only v3 geography. The authoritative terrain and World.blocked
 * remain responsible for heights, navigation, combat, and buildability.
 *
 * Roads: one mesh with per-vertex RGBA falloff (no stacked opaque ribbons).
 * Mountains: a continuous, eroded cross-section mesh (no repeated vertical
 * slabs). Both fade out before real passes and protected building clearings.
 */
const clamp01=v=>Math.min(1,Math.max(0,v));
const smooth=v=>{const t=clamp01(v);return t*t*(3-2*t);};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

export function createLandscapeMeshes({scene,size,heightAt,roads=[],ridges=[],biome='desert',lowQuality=false}){
 const half=size/2,meshes=[];
 const protectedZones=ridges.flatMap(r=>r.clearings??[]);
 const distanceFromBuildPad=(x,z)=>protectedZones.reduce((closest,zone)=>
   Math.min(closest,Math.hypot(x-zone.point.x,z-zone.point.y)-zone.radius),Infinity);
 const point=(x,z,y=.25)=>[x-half,heightAt(x,z)+y,z-half];
 const roadShade={desert:'#aa8b61',snow:'#8e8e83',jungle:'#938061'}[biome]??'#aa8b61';
 const rockColors=({desert:['#b99c75','#8e7153','#d2b38c','#e0c29b'],
   snow:['#9ca2a0','#707b7e','#c3c6bf','#e1ddd3'],
   jungle:['#9a9871','#64694e','#afa982','#c9b78f']})[biome]??['#b99c75','#8e7153','#d2b38c','#e0c29b'];

 // Use a single ribbon with feathered shoulders and subtle twin wheel ruts.
 // The road may cross another road, but never doubles its own opaque geometry.
 const roadPositions=[],roadColors=[],tireOffsets=[-1,-.83,-.56,-.25,0,.25,.56,.83,1];
 const ruts=[0,.045,.17,.26,.135,.26,.17,.045,0];
 const roadColor=new THREE.Color(roadShade);
 for(const route of roads){
  if(route.length<2)continue;
  const curve=new THREE.CatmullRomCurve3(
    route.map(p=>new THREE.Vector3(p.x,0,p.y)),false,'centripetal');
  const routeDistance=route.slice(1).reduce((sum,p,i)=>sum+
    Math.hypot(p.x-route[i].x,p.y-route[i].y),0);
  const count=Math.max(5,Math.ceil(routeDistance/24));
  const centers=curve.getPoints(count);
  const crossSections=centers.map((center,i)=>{
   const before=centers[Math.max(0,i-1)],after=centers[Math.min(count,i+1)];
   const dx=after.x-before.x,dz=after.z-before.z,len=Math.hypot(dx,dz)||1;
   const nx=-dz/len,nz=dx/len;
   // Keep road width in visual units; slight natural wear variation only.
   const width=51*(.95+.045*Math.sin(center.x*.013+center.z*.021));
   const padFade=smooth((distanceFromBuildPad(center.x,center.z)-15)/118);
   const endFade=smooth(Math.min(i,count-i)/3.5);
   return tireOffsets.map((offset,j)=>{
    const x=center.x+nx*width*.5*offset,z=center.z+nz*width*.5*offset;
    const elevation=point(x,z,.27);
    const alpha=ruts[j]*padFade*endFade*
      (.9+.08*Math.sin(i*.54+offset*3.4));
    const tint=roadColor.clone().multiplyScalar(
      1+.045*Math.sin(center.x*.021+center.z*.017+offset*5));
    return {position:elevation,color:[tint.r,tint.g,tint.b,alpha]};
   });
  });
  for(let i=1;i<crossSections.length;i++){
   for(let j=1;j<tireOffsets.length;j++){
    const a=crossSections[i-1][j-1],b=crossSections[i-1][j],
      c=crossSections[i][j-1],d=crossSections[i][j];
    // Fully omit invisible pads; avoid a subtle dark line over build zones.
    if(Math.max(a.color[3],b.color[3],c.color[3],d.color[3])<.005)continue;
    for(const vertex of [a,b,c,b,d,c]){
     roadPositions.push(...vertex.position);
     roadColors.push(...vertex.color);
    }
   }
  }
 }
 if(roadPositions.length){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(roadPositions,3));
  // The fourth channel is per-vertex opacity; no stacked dark road bands.
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(roadColors,4));
  geometry.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({
   color:'#ffffff',vertexColors:true,transparent:true,opacity:1,
   roughness:1,metalness:0,depthWrite:false,side:THREE.DoubleSide,
   polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1
  });
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name='procedural-v3-soft-sand-roads';mesh.renderOrder=2;
  mesh.userData={visualOnly:true,roadNetwork:true,featheredRoads:true};
  mesh.receiveShadow=false;mesh.castShadow=false;mesh.raycast=()=>{};
  scene.add(mesh);meshes.push(mesh);
 }

 // Continuous terrain-following massif with irregular profile, layered
 // colors and gradually rounded ends. No sharp top teeth or squared pillars.
 const rockPositions=[],rockRgb=[],rockUv=[];
 const rockPalette=rockColors.map(c=>new THREE.Color(c));
 // Stratified ledges and asymmetrical fractured crowns, shaped like the
 // existing Sandforge mesas. Keep a broad foot over the physical cliff cells.
 const offsets=[-1.55,-1.32,-1.13,-1.01,-.89,-.77,-.59,-.40,-.23,0,
                 .19,.36,.52,.66,.79,.96,1.10,1.32,1.55];
 const silhouette=[0,.028,.085,.16,.29,.32,.49,.68,.79,1,
                    .91,.83,.67,.58,.39,.33,.15,.055,0];
 for(const ridge of ridges){
  const spine=ridge.spine;
  if(spine.length<2)continue;
  const line=[];
  let along=0;
  for(let i=1;i<spine.length;i++){
   const a=spine[i-1],b=spine[i],dx=b.x-a.x,dz=b.y-a.y;
   const length=Math.hypot(dx,dz);
   if(length<.01)continue;
   const steps=Math.ceil(length/21);
   for(let k=0;k<steps;k++){
    const t=k/steps;
    line.push({x:a.x+dx*t,z:a.y+dz*t,along:along+length*t});
   }
   along+=length;
  }
  const last=spine.at(-1);
  line.push({x:last.x,z:last.y,along});
  const sections=line.map((center,i)=>{
   const prev=line[Math.max(0,i-1)],next=line[Math.min(line.length-1,i+1)];
   const dx=next.x-prev.x,dz=next.z-prev.z,len=Math.hypot(dx,dz)||1;
   const nx=-dz/len,nz=dx/len;
   const phase=center.along*.014+spine[0].x*.00071+spine[0].y*.00037;
   const ridgeRoll=.73+.19*Math.sin(phase*.48+.25)+
     .12*Math.sin(phase*1.14+1.7)+.045*Math.cos(phase*2.3);
   const edgeTaper=smooth(Math.min(center.along,along-center.along)/105);
   const nearestPass=ridge.ramps.reduce((d,ramp)=>
     Math.min(d,Math.abs(center.x-ramp.x)-ramp.width*.5),Infinity);
   const passTaper=smooth((nearestPass-ridge.width*.55)/105);
   return offsets.map((offset,j)=>{
    const jitter=1+.082*Math.sin(phase*1.38+offset*5.7)+
      .057*Math.cos(phase*2.17-offset*8);
    const x=center.x+nx*ridge.width*offset*jitter,
      z=center.z+nz*ridge.width*offset*jitter;
    // Fade for every vertex, not just the centerline; ensures cliffs never
    // visually invade the physically protected HQ/Bastion construction pads.
    const padTaper=smooth((distanceFromBuildPad(x,z)-ridge.width*.58)/135);
    // Fractured shelves replace a rounded, uniformly smooth dune.
    const fractures=.89+.12*Math.sin(phase*.88+offset*5.5)+
      .06*Math.sin(phase*2.47-offset*9.4);
    const height=ridge.height*silhouette[j]*ridgeRoll*fractures*
      edgeTaper*passTaper*padTaper;
    const position=point(x,z,.16+Math.max(0,height));
    const grains=.13*Math.sin(center.along*.02+offset*7)+
      .055*Math.sin(center.along*.066+offset*13);
    const color=rockPalette[0].clone()
      .lerp(rockPalette[1],clamp01(.25+Math.abs(offset)*.34+grains))
      .lerp(rockPalette[2],clamp01(.15+silhouette[j]*.24))
      .lerp(rockPalette[3],clamp01(.035+Math.max(0,grains)*.25));
    return {position,color,rise:Math.max(0,height)};
   });
  });
  for(let i=1;i<sections.length;i++){
   for(let j=1;j<offsets.length;j++){
    const a=sections[i-1][j-1],b=sections[i-1][j],
      c=sections[i][j-1],d=sections[i][j];
    // No flat rock-colored carpet across openings or the safe build zones.
    if(Math.max(a.rise,b.rise,c.rise,d.rise)<1)continue;
    for(const vertex of [a,b,c,b,d,c]){
     rockPositions.push(...vertex.position);
     rockRgb.push(vertex.color.r,vertex.color.g,vertex.color.b);
     // Same world-scale mineral atlas mapping as physical-battlefield-rocks.
     rockUv.push((vertex.position[0]+half)/150,vertex.position[1]/120);
    }
   }
  }
 }
 if(rockPositions.length){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(rockPositions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(rockRgb,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(rockUv,2));
  geometry.computeVertexNormals();
  const rockMaps=sharedStoneMaps(lowQuality);
  const material=new THREE.MeshStandardMaterial({
   color:'#ffffff',vertexColors:true,side:THREE.DoubleSide,flatShading:true,
   // Identical PBR atlas to the existing mesas and loose Sandforge stones.
   map:biome==='desert'?rockMaps.map:null,normalMap:rockMaps.normalMap,
   roughnessMap:rockMaps.roughnessMap,
   normalScale:new THREE.Vector2(.38,.38),roughness:.98,metalness:0
  });
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name='procedural-v3-eroded-sandstone';
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.raycast=()=>{};
  mesh.userData={visualOnly:true,physicalCliffPresentation:true,erodedRidge:true};
  scene.add(mesh);meshes.push(mesh);
 }
 return meshes;
}
