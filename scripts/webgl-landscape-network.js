import * as THREE from 'three';
import {sharedStoneMaps,stoneMaterial,weatheredStoneGeometry} from './webgl-rock-materials.js';
import {DESERT_SCENIC_STYLE as desertStyle} from './webgl-desert-style.js';
import {CANYON_GEOLOGY} from './webgl-authentic-canyon-geology.js';

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

export function createLandscapeMeshes({scene,size,heightAt,roads=[],ridges=[],plateaus=[],biome='desert',mapId=null,lowQuality=false,showOutcrops=true}){
 const half=size/2,meshes=[];
 const authoredPlateau=biome==='desert'&&(plateaus.some(m=>m.ramps?.length>1)||['plateau-crossroads','mesa-highlands'].includes(mapId));
 const protectedZones=ridges.flatMap(r=>r.clearings??[]);
 const distanceFromBuildPad=(x,z)=>protectedZones.reduce((closest,zone)=>
   Math.min(closest,Math.hypot(x-zone.point.x,z-zone.point.y)-zone.radius),Infinity);
 const point=(x,z,y=.25)=>[x-half,heightAt(x,z)+y,z-half];
 const roadShade=authoredPlateau?'#876447':
  ({desert:'#aa8b61',snow:'#8e8e83',jungle:'#938061'}[biome]??'#aa8b61');
 const geology=biome==='desert'?CANYON_GEOLOGY[mapId]:null;
 const rockColors=geology?[geology.base,geology.dark,geology.accent,geology.base]:
 ({desert:[desertStyle.mesa,desertStyle.mesaShade,desertStyle.looseStones[0],desertStyle.looseStones[2]],
   snow:['#9ca2a0','#707b7e','#c3c6bf','#e1ddd3'],
   jungle:['#9a9871','#64694e','#afa982','#c9b78f']})[biome]??['#b99c75','#8e7153','#d2b38c','#e0c29b'];

 // Use a single ribbon with feathered shoulders and subtle twin wheel ruts.
 // The road may cross another road, but never doubles its own opaque geometry.
 const roadPositions=[],roadColors=[],tireOffsets=[-1,-.83,-.56,-.25,0,.25,.56,.83,1];
 const ruts=authoredPlateau
  ?[0,.13,.33,.52,.41,.52,.33,.13,0]:[0,.045,.17,.26,.135,.26,.17,.045,0];
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
   const width=(authoredPlateau?98:51)*(.95+.045*Math.sin(center.x*.013+center.z*.021));
   const padFade=authoredPlateau
    ?smooth((distanceFromBuildPad(center.x,center.z)+230)/180)
    :smooth((distanceFromBuildPad(center.x,center.z)-15)/118);
   const endFade=smooth(Math.min(i,count-i)/3.5);
   return tireOffsets.map((offset,j)=>{
    const x=center.x+nx*width*.5*offset,z=center.z+nz*width*.5*offset;
    const elevation=point(x,z,.27);
    // On the playable v7 map paint trails on the actual climb only.
    // Never smear dirt straight across a steep, non-traversable cliff.
    const mesaSlope=(mapId==='mesa-highlands'||plateaus.some(m=>m.ramps?.length>1))?
      Math.hypot(heightAt(x+18,z)-heightAt(x-18,z),
       heightAt(x,z+18)-heightAt(x,z-18))/36:0;
    const slopeMask=mesaSlope>.24?0:1;
    const alpha=ruts[j]*padFade*endFade*slopeMask*
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

 // Generals-style escarpment: broad, nearly level upper plateaus and
 // asymmetric, stratified near-vertical cliff faces, never a round dune.
 // The underlying blocked canyon ridge and its real passes remain authoritative.
 const rockPositions=[],rockRgb=[],rockUv=[];
 // Reuse the exact fractured rock geometry used by the existing loose stones.
 const outcropMatrices=[[],[],[]];
 const rockPalette=rockColors.map(c=>new THREE.Color(c));
 // Stratified ledges and asymmetrical fractured crowns, shaped like the
 // existing Sandforge mesas. Keep a broad foot over the physical cliff cells.
 // Uneven shelves form dramatic high cliff faces and natural eroded
 // slot canyons instead of a single round mountain wave. Each sample is
 // confined to the same blocked ridge spine; passes still fade to zero.
 // Contour of a rocky mesa rather than a symmetrical bell/rounded hill.
 // Wide tabletop from -0.78 to +0.76, steep fractured shoulders at +/-1.
 // Use fixed geometry profile so each seeded ridge stays reproducible.
 const offsets=[-1.55,-1.35,-1.22,-1.12,-1.045,-.995,-.94,-.87,
                -.78,-.64,-.47,-.28,-.10,.06,.25,.43,.60,.76,
                .90,1.02,1.12,1.27,1.52];
 const silhouette=[0,.013,.036,.09,.24,.53,.81,.94,
                   .978,.989,.995,1,.998,1,.994,.989,.977,.96,
                   .88,.57,.19,.05,0];
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
   let faceArc=0,lastPoint=null;
   // Geological ledges remain mostly level along the crest; the faces
   // keep enough longitudinal erosion variation to avoid repeated slabs.
   const ridgeRoll=.985+.035*Math.sin(phase*.48+.25)+
     .025*Math.sin(phase*1.14+1.7)+.018*Math.cos(phase*2.3);
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
    // Do not erase the entire mountain between dense Bastion clearings.
    // Outside the authoritative protected circle the rock face quickly
    // becomes visible; inside it stays completely absent.
    const padTaper=smooth(distanceFromBuildPad(x,z)/105);
    // Fractured shelves replace a rounded, uniformly smooth dune.
    const fractures=.89+.12*Math.sin(phase*.88+offset*5.5)+
      .06*Math.sin(phase*2.47-offset*9.4)+
      .038*Math.cos(phase*4.6+offset*17.2);
    const height=ridge.height*1.27*silhouette[j]*ridgeRoll*fractures*
      edgeTaper*passTaper*padTaper;
    const position=point(x,z,.16+Math.max(0,height));
    if(lastPoint)faceArc+=Math.hypot(
      position[0]-lastPoint[0],position[1]-lastPoint[1],
      position[2]-lastPoint[2]);
    lastPoint=position;
    const grains=.13*Math.sin(center.along*.02+offset*7)+
      .055*Math.sin(center.along*.066+offset*13);
    // Layered dark mineral faces, sand-dusted light plateau crowns.
    // Keep variation in vertex tint and actual UV/PBR stone maps.
    const wall=clamp01((1-silhouette[j])*1.65+
      .20*Math.cos((center.along*.014+offset*4.5)*3));
    const shelfBand=.5+.5*Math.sin((heightAt(x,z)+height)*.105+
      center.along*.018+offset*9.2);
    const color=rockPalette[0].clone()
      .lerp(rockPalette[1],clamp01(.20+wall*.55+shelfBand*.20+grains*.25))
      .lerp(rockPalette[2],clamp01(.12+(1-wall)*.38))
      .lerp(rockPalette[3],clamp01(.025+Math.max(0,grains)*.20));
    return {position,color,rise:Math.max(0,height),
     uv:[center.along/150,faceArc/150]};
   });
  });
  // Anchor uneven PBR sandstone fragments into the blocked ridge. These are
  // scene-only, so no extra collision, pathfinding or save data is introduced.
  // The middle of the cliff remains occupied by the authoritative World grid.
  // Only paint cliffs in the modern desert: individual ridge boulders
  // read as dark obstacles and spoil the otherwise open tactical map.
  const sampleStep=lowQuality?6:4;
  if(showOutcrops)for(let i=3;i<line.length-3;i+=sampleStep){
   const p=line[i],before=line[i-1],after=line[i+1];
   const dx=after.x-before.x,dz=after.z-before.z,len=Math.hypot(dx,dz)||1;
   const nx=-dz/len,nz=dx/len;
   const phase=p.along*.014+spine[0].x*.00071+spine[0].y*.00037;
   const ridgeRoll=.73+.19*Math.sin(phase*.48+.25)+
     .12*Math.sin(phase*1.14+1.7)+.045*Math.cos(phase*2.3);
   const endFade=smooth(Math.min(p.along,along-p.along)/105);
   if(endFade<.9)continue;
   if(ridge.ramps.some(pass=>Math.abs(p.x-pass.x)<pass.width*.5+ridge.width+85))continue;
   // Strong safety margin: no decorative outcrop near the construction pads.
   if(distanceFromBuildPad(p.x,p.z)<ridge.width*2+100)continue;
   const sides=[-.26,.29];
   for(let j=0;j<sides.length;j++){
    if(Math.sin(phase*2.18+j*3.7)<-.16)continue;
    const x=p.x+nx*ridge.width*sides[j],z=p.z+nz*ridge.width*sides[j];
    if(x<90||z<90||x>size-90||z>size-90)continue;
    if(distanceFromBuildPad(x,z)<ridge.width+105)continue;
    const width=18+13*(.5+.5*Math.sin(phase*1.71+j*2.1));
    const tall=15+12*(.5+.5*Math.cos(phase*1.28+j*2.8));
    const lift=ridge.height*(.48+.19*Math.sin(phase*.64+j*.8))*ridgeRoll;
    const dummy=new THREE.Object3D();
    dummy.position.set(x-half,heightAt(x,z)+lift,z-half);
    dummy.rotation.set(.06*Math.sin(phase),phase*2.39+j*.78,.07*Math.cos(phase*1.4));
    dummy.scale.set(width,tall,width*(.82+.10*Math.cos(phase*1.3)));
    dummy.updateMatrix();
    outcropMatrices[Math.floor((Math.sin(phase*1.83+j*2.4)+1)*1.49)].push(dummy.matrix.clone());
   }
  }
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
     rockUv.push(...vertex.uv);
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
   color:'#ffffff',vertexColors:true,side:THREE.DoubleSide,flatShading:false,
   // Identical PBR atlas to the existing mesas and loose Sandforge stones.
   map:biome==='desert'?rockMaps.map:null,normalMap:rockMaps.normalMap,
   roughnessMap:rockMaps.roughnessMap,
   normalScale:new THREE.Vector2(geology?.veins??.48,geology?.veins??.48),
   roughness:.98,metalness:0
  });
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name='procedural-v3-eroded-sandstone';
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.raycast=()=>{};
  mesh.userData={visualOnly:true,physicalCliffPresentation:true,erodedRidge:true,
   cliffUvMapping:'shared-sandstone-arc-length-v10'};
  scene.add(mesh);meshes.push(mesh);
 }
 // 1–3 instanced PBR groups for the entire map; no per-rock draw calls.
 // These are the SAME material and authored ledge geometry as Sandforge's
 // existing weathered stones, scaled to read like natural stratified outcrops.
 if(outcropMatrices.some(group=>group.length)){
  const stoneGeometry=weatheredStoneGeometry(lowQuality);
  const palette=geology?[geology.base,geology.accent,geology.dark]:
   biome==='desert'?desertStyle.looseStones:rockColors.slice(0,3);
  for(let group=0;group<outcropMatrices.length;group++){
   const matrices=outcropMatrices[group];
   if(!matrices.length)continue;
   const material=stoneMaterial(palette[group],{
    lowQuality,normalScale:biome==='desert'?.42:.58
   });
   const mesh=new THREE.InstancedMesh(stoneGeometry,material,matrices.length);
   matrices.forEach((matrix,index)=>mesh.setMatrixAt(index,matrix));
   mesh.instanceMatrix.needsUpdate=true;
   mesh.computeBoundingSphere();
   mesh.name='procedural-v3-sandstone-outcrops-'+group;
   mesh.castShadow=true;mesh.receiveShadow=true;mesh.raycast=()=>{};
   mesh.userData={visualOnly:true,rockOutcrops:true,physicalCliffPresentation:true};
   scene.add(mesh);meshes.push(mesh);
  }
 }
 return meshes;
}
