import * as THREE from 'three';
import {sharedStoneMaps,desertStrikeNaturalCliffMaps} from './webgl-rock-materials.js';
// Exact shared v7 polar edge and ramp sector equations, duplicated here
// to keep the standalone JS renderer loadable in Node and WebGL.
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=v=>{const t=clamp(v);return t*t*(3-2*t);};
const mesaRadiusFactor=(theta,m)=>{
 const phase=m.seed*.00047+m.siteIndex*1.7;
 return 1+.045*Math.sin(theta*5+phase)+.025*Math.cos(theta*9-phase*.8);
};
const mesaRampCoverage=(p,m)=>{
 const dx=p.x-m.center.x,dy=p.y-m.center.y;
 let coverage=0;
 for(const d of m.ramps?.length?m.ramps:[m.direction]){
  const along=dx*d.x+dy*d.y;
  const lateral=Math.abs(dx*d.y-dy*d.x);
  if(along<m.topRadius-80||along>m.rampEnd+80)continue;
  coverage=Math.max(coverage,1-smooth(
   (lateral-m.rampWidth*.56)/(m.rampWidth*.36)));
 }
 return coverage;
};

/**
 * A rock-textured SKIN of the real, authoritative WebGL heightfield.
 * Only the sheer slope is clad in sandstone. Summit, ramp and valley stay
 * uncovered and use the ordinary buildable physical ground surface.
 * All positions are sampled from the SAME ground heightAt (no flying slabs).
 */
export function createPlayableMesaCliffs({
 scene,size,heightAt,plateaus=[],lowQuality=false,mapId=null
}={}){
 const meshes=[];
 if(!scene||!heightAt||!plateaus?.length)return meshes;
 // New visual treatment only for the currently selected Desert Strike map.
 // Old saves and every other biome still get their historical geometry.
 if(mapId==='desert-strike')return createNaturalDesertStrikeCliffs({
  scene,size,heightAt,plateaus,lowQuality
 });
 const half=size*.5,positions=[],colors=[],uv=[];
 // More resolution is spent on the visible rock face, not the flat
 // buildable plateau or the valley. Still a SINGLE GPU draw call for all mesas.
 const sampleCount=lowQuality?144:232;
 const radial=[-.09,-.025,.035,.10,.18,.27,.37,.48,.59,.71,.82,.92,1.0,1.08,1.16];
 const stone=[
  new THREE.Color('#a38160'),new THREE.Color('#594635'),
  new THREE.Color('#c7a37a'),new THREE.Color('#715a48')
 ];
 const texelsPerWorldUnit=1/150;
 for(const mesa of plateaus){
  const sections=[];
  const halfSpan=(mesa.topRadius+mesa.footRadius)*.5;
  let pathLength=0,previous=null;
  for(let k=0;k<=sampleCount;k++){
   const theta=k/sampleCount*Math.PI*2;
   const factor=mesaRadiusFactor(theta,mesa);
   const c=Math.cos(theta),s=Math.sin(theta);
   const center=[mesa.center.x+c*halfSpan*factor,
    mesa.center.y+s*halfSpan*factor];
   if(previous)
    pathLength+=Math.hypot(center[0]-previous[0],center[1]-previous[1]);
   previous=center;
   const ring=[];
   let radialLength=0,priorPoint=null;
   for(let j=0;j<radial.length;j++){
    const t=radial[j];
    // Follow the exact terrain surface; subtle irregular seams prevent
    // radial streaking without moving the physically authoritative cliff.
    const naturalFracture=(j===0||j===radial.length-1)?0:
     5.8*Math.sin(theta*13.8+t*17.2+mesa.seed*.0031)*
     Math.sin(Math.PI*Math.max(0,Math.min(1,t)));
    const r=mesa.topRadius+t*(mesa.footRadius-mesa.topRadius)+naturalFracture;
    const x=mesa.center.x+c*r*factor,z=mesa.center.y+s*r*factor;
    const y=heightAt(x,z)+.29;
    if(priorPoint)
     radialLength+=Math.hypot(x-priorPoint[0],y-priorPoint[1],
      z-priorPoint[2]);
    priorPoint=[x,y,z];
    const inRamp=mesaRampCoverage({x,y:z},mesa)>.70;
    // Mineral strata are modulated by actual local elevation. No repeated
    // alternating rings: those made the cliff look like extruded stripes.
    const cap=1-smooth(Math.max(0,Math.min(1,t)));
    const layer=.5+.5*Math.sin(y*.085+theta*1.5+
     .27*Math.sin(theta*11+t*5));
    const shade=.13+.22*layer+.09*Math.cos(theta*7+mesa.seed*.001);
    const pigment=stone[0].clone().lerp(stone[2],.10+.35*cap)
     .lerp(stone[1],Math.max(0,Math.min(.44,shade)))
     .lerp(stone[3],.06+.09*(1-cap));
    ring.push({
     p:[x-half,y,z-half],
     c:[pigment.r,pigment.g,pigment.b],
     // True cylindrical/unwrapped rock-wall coordinates:
     // U = traveled physical wall perimeter, V = actual geodesic distance
     // down the cliff including both rise/fall and horizontal erosion.
     // The atlas already uses RepeatWrapping for all PBR channels.
     uv:[pathLength*texelsPerWorldUnit,
      radialLength*texelsPerWorldUnit],
     inRamp
    });
   }
   sections.push(ring);
  }
  for(let i=1;i<sections.length;i++)for(let j=1;j<radial.length;j++){
   const a=sections[i-1][j-1],b=sections[i-1][j],
    c=sections[i][j-1],d=sections[i][j];
   if([a,b,c,d].some(v=>v.inRamp))continue;
   for(const v of [a,b,c,b,d,c]){
    positions.push(...v.p);colors.push(...v.c);uv.push(...v.uv);
   }
  }
 }

 if(!positions.length)return meshes;
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.computeVertexNormals();
 geometry.computeBoundingSphere();
 const stoneMaps=sharedStoneMaps(lowQuality);
 const material=new THREE.MeshStandardMaterial({
  color:'#ffffff',map:stoneMaps.map,
  normalMap:stoneMaps.normalMap,roughnessMap:stoneMaps.roughnessMap,
  normalScale:new THREE.Vector2(.66,.66),
  vertexColors:true,side:THREE.DoubleSide,metalness:0,roughness:.98,
  polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1
 });
 const mesh=new THREE.Mesh(geometry,material);
 mesh.name='Sandforge-Physical-Playable-Mesa-Cliffs';
 mesh.userData={visualOnly:true,nonPlayable:true,realTerrainFacade:true,
  raisedMesa:true,plateauCount:plateaus.length,
  cliffUvMapping:'unwrapped-arc-length-geodesic-v2',
  cliffTextureWorldTile:150};
 mesh.raycast=()=>{};mesh.castShadow=false;mesh.receiveShadow=true;
 scene.add(mesh);meshes.push(mesh);
 return meshes;
}


/**
 * Desert Strike visual-only sandstone face. Unlike a uniformly extruded
 * circular ribbon, keep only parts of the actual *steep* terrain. Clip each
 * triangle to the four wide vehicle entrances and to the sloping rim; that
 * eliminates the disconnected rock strips seen behind the plateau.
 *
 * All newly cut edge vertices re-sample the authoritative terrain height.
 * No polygon can float above the sand and no physics/AI data is modified.
 */
function createNaturalDesertStrikeCliffs({scene,size,heightAt,plateaus,lowQuality}){
 const half=size*.5,xyz=[],uv=[],colors=[];
 const sampleCount=lowQuality?160:280;
 const radial=[-.13,-.075,-.025,.025,.075,.13,.19,.26,.34,.43,
  .52,.61,.70,.78,.85,.91,.97,1.04,1.12,1.19];
 const pi=Math.PI,stone=[
  new THREE.Color('#d7b482'), // pale dusty, upper rim
  new THREE.Color('#b88d60'), // ochre fractured rock
  new THREE.Color('#a5784e'), // shadowed recesses
  new THREE.Color('#d2aa77')  // sandy foot
 ];
 const lerp=(a,b,t)=>a+(b-a)*t;
 const makeIntersection=(a,b)=>{
  const t=Math.max(0,Math.min(1,a.keep/(a.keep-b.keep)));
  const x=lerp(a.x,b.x,t),z=lerp(a.z,b.z,t);
  return {
   x,z,keep:0,p:[x-half,heightAt(x,z)+.29,z-half],
   uv:[lerp(a.uv[0],b.uv[0],t),lerp(a.uv[1],b.uv[1],t)],
   color:a.color.map((n,i)=>lerp(n,b.color[i],t))
  };
 };
 const emit=(a,b,c)=>{
  const triangle=[a,b,c],poly=[];
  for(let i=0;i<3;i++){
   const p=triangle[(i+2)%3],q=triangle[i],
    wasInside=p.keep>=0,isInside=q.keep>=0;
   if(wasInside!==isInside)poly.push(makeIntersection(p,q));
   if(isInside)poly.push(q);
  }
  if(poly.length<3)return;
  for(let i=1;i<poly.length-1;i++){
   const face=[poly[0],poly[i],poly[i+1]];
   const abx=face[1].x-face[0].x,abz=face[1].z-face[0].z;
   const acx=face[2].x-face[0].x,acz=face[2].z-face[0].z;
   const area=Math.abs(abx*acz-abz*acx);
   if(area<.0001)continue;
   for(const v of face){
    xyz.push(...v.p);uv.push(...v.uv);colors.push(...v.color);
   }
  }
 };
 for(const mesa of plateaus){
  const rings=[],mid=(mesa.topRadius+mesa.footRadius)*.5;
  let arc=0,prev=null;
  for(let k=0;k<=sampleCount;k++){
   const angle=k/sampleCount*pi*2,c=Math.cos(angle),sn=Math.sin(angle);
   const factor=mesaRadiusFactor(angle,mesa);
   const midPoint={x:mesa.center.x+c*mid*factor,
    z:mesa.center.y+sn*mid*factor};
   if(prev)arc+=Math.hypot(midPoint.x-prev.x,midPoint.z-prev.z);
   prev=midPoint;
   const row=[];let faceLength=0,last=null;
   for(let j=0;j<radial.length;j++){
    const t=radial[j],r=mesa.topRadius+
      (mesa.footRadius-mesa.topRadius)*t;
    // Nonuniform stepped rock facets. Wavelengths use integral angular
    // frequencies, so the closed contour never tears at its seam.
    const taper=Math.sin(pi*clamp(t));
    const fracture=taper*(6.5*Math.sin(angle*9+t*18+mesa.seed*.003)
      +3.6*Math.cos(angle*23-t*11)+2.1*Math.sin(angle*41+t*29));
    const radius=r+fracture;
    const x=mesa.center.x+c*radius*factor;
    const z=mesa.center.y+sn*radius*factor;
    const height=heightAt(x,z),y=height+.29;
    if(last)faceLength+=Math.hypot(x-last[0],y-last[1],z-last[2]);
    last=[x,y,z];
    const cover=mesaRampCoverage({x,y:z},mesa);
    // This detects real cliff inclination, independent of the four ramp
    // directions. Motorable inclines (~0.14) are NOT painted as steep rock.
    const near=heightAt(x-c*18,z-sn*18);
    const far=heightAt(x+c*18,z+sn*18);
    const slope=Math.abs(near-far)/36;
    // This score is clipped at triangle edges below (not rounded to the
    // nearest ring cell, which previously caused serrated hanging ribbons).
    const keep=Math.min((slope-.19)*1.7,(.47-cover)*1.4,
      Math.min(x,z,size-x,size-z)-22);
    const top=1-smooth(clamp(t/.27));
    const toe=smooth(clamp((t-.72)/.38));
    const fault=Math.sin(angle*13+t*14+mesa.seed*.0008)*
       Math.sin(angle*29-t*11);
    const largePatch=.5+.5*Math.sin(angle*7+Math.sin(t*8)*1.3);
    // Deep, discontinuous vertical erosion fractures and narrow sandstone
    // ribs. Only PBR vertex pigment changes, never terrain or walkable cells.
    // All angular frequencies close at 2π: no seam across the mesa ring.
    const verticalCut=Math.pow(Math.max(0,Math.cos(
      angle*31+.29*Math.sin(t*9+angle*5)+mesa.seed*.0021)),18)*
      smooth(clamp((t-.06)/.22))*(1-smooth(clamp((t-.86)/.23)));
    const rib=(.5+.5*Math.sin(angle*57+t*6+mesa.seed*.001))*
      Math.sin(pi*clamp(t))**2;
    const c0=stone[1].clone().lerp(stone[2],
      clamp(.11+.13*largePatch+.12*Math.max(0,fault)+.11*verticalCut));
    c0.lerp(stone[0],top*.52).lerp(stone[3],toe*.65);
    c0.multiplyScalar(clamp(.93+.10*Math.sin(angle*5+t*12)+
      .07*largePatch-.19*verticalCut-.04*rib,.61,1.10));
    row.push({
     x,z,keep,p:[x-half,y,z-half],
     color:[c0.r,c0.g,c0.b],
     // Project by actual circumference and down-slope travel distance.
     // Slightly warped UVs break up repeating aligned texture bricks.
     uv:[arc/173+.045*Math.sin(t*8+angle*6),
      faceLength/136+.035*Math.sin(angle*7+t*9)]
    });
   }
   rings.push(row);
  }
  for(let i=1;i<rings.length;i++)for(let j=1;j<radial.length;j++){
   const a=rings[i-1][j-1],b=rings[i-1][j],
    c=rings[i][j-1],d=rings[i][j];
   emit(a,b,c);emit(b,d,c);
  }
 }
 if(!xyz.length)return [];
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(xyz,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.computeVertexNormals();
 geometry.computeBoundingSphere();
 const maps=desertStrikeNaturalCliffMaps(lowQuality);
 const material=new THREE.MeshStandardMaterial({
  color:'#ffffff',vertexColors:true,
  map:maps.map,normalMap:maps.normalMap,
  roughnessMap:maps.roughnessMap,
  normalScale:new THREE.Vector2(.72,.72),
  roughness:.98,metalness:0,side:THREE.DoubleSide,
  polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1
 });
 const mesh=new THREE.Mesh(geometry,material);
 mesh.name='Sandforge-Desert-Strike-Natural-Stratified-Cliffs';
 mesh.userData={
  visualOnly:true,nonPlayable:true,realTerrainFacade:true,
  raisedMesa:true,plateauCount:plateaus.length,
  cliffUvMapping:'desert-strike-sandstone-arc-and-slope-v1',
  cliffTextureWorldTile:150,
  rampCutMethod:'triangle-clipped-physical-slope',
  cliffAtlas:maps.variant
 };
 mesh.raycast=()=>{};mesh.castShadow=false;mesh.receiveShadow=true;
 scene.add(mesh);
 return [mesh];
}
