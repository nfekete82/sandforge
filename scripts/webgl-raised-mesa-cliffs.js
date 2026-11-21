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
 const sampleCount=lowQuality?112:176;
 const radial=[-.06,.045,.15,.29,.45,.63,.81,1,1.08];
 const stone=[
  new THREE.Color('#a38160'),new THREE.Color('#594635'),
  new THREE.Color('#c7a37a'),new THREE.Color('#715a48')
 ];
 for(const mesa of plateaus){
  const sections=[];
  for(let k=0;k<=sampleCount;k++){
   const theta=k/sampleCount*Math.PI*2;
   const factor=mesaRadiusFactor(theta,mesa);
   const c=Math.cos(theta),s=Math.sin(theta);
   sections.push(radial.map((t,j)=>{
    const r=mesa.topRadius+t*(mesa.footRadius-mesa.topRadius);
    const x=mesa.center.x+c*r*factor,z=mesa.center.y+s*r*factor;
    const y=heightAt(x,z)+.29;
    const inRamp=mesaRampCoverage({x,y:z},mesa)>.70;
    const band=.5+.5*Math.sin(y*.097+theta*1.7+t*7.9);
    const shade=(.24+.51*band+.09*Math.cos(theta*14+mesa.seed*.001));
    const base=stone[j%2?0:2].clone()
     .lerp(stone[1],shade*.44+.19*Math.abs(s))
     .lerp(stone[3],.18+.12*Math.sin(t*17+theta*5));
    return {
     p:[x-half,y,z-half],
     c:[base.r,base.g,base.b],
     uv:[x/160,y/88],
     inRamp,
     radius:r
    };
   }));
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
  raisedMesa:true,plateauCount:plateaus.length};
 mesh.raycast=()=>{};mesh.castShadow=false;mesh.receiveShadow=true;
 scene.add(mesh);meshes.push(mesh);
 return meshes;
}
