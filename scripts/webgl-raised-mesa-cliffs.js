import * as THREE from 'three';
import {sharedStoneMaps} from './webgl-rock-materials.js';
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
 const along=dx*m.direction.x+dy*m.direction.y;
 const lateral=Math.abs(dx*m.direction.y-dy*m.direction.x);
 if(along<m.topRadius-80||along>m.rampEnd+80)return 0;
 return 1-smooth((lateral-m.rampWidth*.56)/(m.rampWidth*.36));
};

/**
 * A rock-textured SKIN of the real, authoritative WebGL heightfield.
 * Only the sheer slope is clad in sandstone. Summit, ramp and valley stay
 * uncovered and use the ordinary buildable physical ground surface.
 * All positions are sampled from the SAME ground heightAt (no flying slabs).
 */
export function createPlayableMesaCliffs({
 scene,size,heightAt,plateaus=[],lowQuality=false
}={}){
 const meshes=[];
 if(!scene||!heightAt||!plateaus?.length)return meshes;
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
