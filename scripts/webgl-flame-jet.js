import * as THREE from 'three';

// Visual only. The authoritative 20 Hz simulation owns damage, visibility,
// target acquisition and range; this module adds no gameplay state.
export const FLAME_JET_LIFETIME=.34;
export const FLAME_JET_NOZZLE_OFFSET=42;

export function flameJetEndpoints(from,to,groundFrom,groundTo,worldSize){
  const dx=to.x-from.x,dz=to.y-from.y,d=Math.hypot(dx,dz);
  if(!Number.isFinite(d)||d<=1)return null;
  const offset=Math.min(FLAME_JET_NOZZLE_OFFSET,d*.28);
  const nx=dx/d,nz=dz/d;
  const x0=from.x+nx*offset-worldSize*.5;
  const z0=from.y+nz*offset-worldSize*.5;
  return {
    x0,z0,y0:groundFrom+29,
    x1:to.x-worldSize*.5,z1:to.y-worldSize*.5,y1:groundTo+18,
    range:d,offset
  };
}

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,t)=>{
 const v=clamp((t-a)/(b-a),0,1);
 return v*v*(3-2*v);
};

// Paint a genuinely continuous, ragged fire flow — no repeating vertical
// tongue sprites or discrete circular impacts along the trajectory.
function fireRibbonTexture(core=false){
 const canvas=document.createElement('canvas');
 canvas.width=128;canvas.height=384;
 const ctx=canvas.getContext('2d');
 const pixels=ctx.createImageData(canvas.width,canvas.height);
 const W=canvas.width,H=canvas.height;
 for(let y=0;y<H;y++){
  const t=1-y/(H-1);
  const tip=smooth(0,.045,t)*(1-smooth(.965,1,t));
  const width=(core?.075:.17)+(core?.25:.56)*t;
  for(let x=0;x<W;x++){
   const u=(x+0.5-W*.5)/(W*.5);
   const wave=.034*Math.sin(t*68+u*14)+.028*Math.sin(t*121-u*25);
   const edge=Math.abs(u-wave)/width;
   const feather=1-smooth(core?.45:.62,1,edge);
   const flow=.88+.12*Math.sin(t*197+u*8)*Math.sin(t*91-u*17);
   const roll=.85+.15*Math.sin(t*42+u*11);
   const opacity=tip*feather*flow*roll;
   const i=(y*W+x)*4;
   const hot=1-smooth(.10,.74,Math.abs(u-wave)/width);
   const heat=core?hot*.8+.2:hot*.66+.25;
   pixels.data[i]=255;
   pixels.data[i+1]=Math.round(core?205+50*heat:65+135*heat);
   pixels.data[i+2]=Math.round(core?92+151*heat:8+53*heat);
   pixels.data[i+3]=Math.round(clamp(opacity*(core?210:193),0,255));
  }
 }
 ctx.putImageData(pixels,0,0);
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.minFilter=THREE.LinearMipmapLinearFilter;
 texture.magFilter=THREE.LinearFilter;
 texture.generateMipmaps=true;
 texture.anisotropy=4;
 return texture;
}

function ribbonMesh(scene,capacity,core=false){
 const texture=fireRibbonTexture(core);
 const material=new THREE.MeshBasicMaterial({
  map:texture,transparent:true,opacity:core?.84:.72,
  blending:THREE.AdditiveBlending,depthWrite:false,depthTest:true,
  side:THREE.DoubleSide,toneMapped:false
 });
 const mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),material,capacity);
 mesh.count=0;
 mesh.name=core?'visual-flame-jet-hot-core':'visual-flame-jet-envelope';
 mesh.userData={visualOnly:true,nonPlayable:true,flameJet:true};
 mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
 mesh.frustumCulled=false;mesh.raycast=()=>{};
 mesh.renderOrder=core?18:17;
 scene.add(mesh);
 return mesh;
}

const dummy=new THREE.Object3D();
const cameraRight=new THREE.Vector3(),cameraUp=new THREE.Vector3();
const spin=new THREE.Quaternion(),zAxis=new THREE.Vector3(0,0,1);

export class SandforgeFlameJet {
 constructor(scene,lowQuality=false){
  this.capacity=lowQuality?24:64;
  this.outer=ribbonMesh(scene,this.capacity,false);
  this.inner=ribbonMesh(scene,this.capacity,true);
  this.jets=[];
 }
 add(from,to,groundFrom,groundTo,worldSize){
  const endpoints=flameJetEndpoints(from,to,groundFrom,groundTo,worldSize);
  if(!endpoints)return false;
  if(this.jets.length>=this.capacity)this.jets.shift();
  this.jets.push({...endpoints,age:0,ttl:FLAME_JET_LIFETIME});
  return true;
 }
 update(dt,camera){
  cameraRight.set(1,0,0).applyQuaternion(camera.quaternion);
  cameraUp.set(0,1,0).applyQuaternion(camera.quaternion);
  let n=0;
  for(const jet of this.jets){
   jet.age+=Math.max(0,dt);
   if(jet.age>=jet.ttl)continue;
   const dx=jet.x1-jet.x0,dy=jet.y1-jet.y0,dz=jet.z1-jet.z0;
   const screenX=dx*cameraRight.x+dy*cameraRight.y+dz*cameraRight.z;
   const screenY=dx*cameraUp.x+dy*cameraUp.y+dz*cameraUp.z;
   const length=Math.max(2,Math.hypot(screenX,screenY));
   const angle=Math.atan2(-screenX,screenY);
   const life=1-jet.age/jet.ttl;
   // Soft ignition and fade-out. The next volley overlaps rather than making
   // a dotted gap (shots occur every .25 s).
   const fade=smooth(0,.10,jet.age/jet.ttl)*
    (1-smooth(.75,1,jet.age/jet.ttl));
   const width=(15+Math.min(17,jet.range*.075))*(.95+Math.sin(jet.age*48)*.045);
   dummy.position.set((jet.x0+jet.x1)*.5,(jet.y0+jet.y1)*.5,(jet.z0+jet.z1)*.5);
   spin.setFromAxisAngle(zAxis,angle);
   dummy.quaternion.copy(camera.quaternion).multiply(spin);
   for(const [mesh,ratio] of [[this.outer,1],[this.inner,.47]]){
    dummy.scale.set(width*ratio*Math.max(.04,fade),length*1.045,1);
    dummy.updateMatrix();
    mesh.setMatrixAt(n,dummy.matrix);
   }
   this.jets[n++]=jet;
  }
  this.jets.length=n;
  for(const mesh of [this.outer,this.inner]){
   mesh.count=n;
   if(n)mesh.instanceMatrix.needsUpdate=true;
  }
 }
 dispose(){
  for(const mesh of [this.outer,this.inner]){
   mesh.parent?.remove(mesh);
   mesh.geometry.dispose();
   mesh.material.map?.dispose();
   mesh.material.dispose();
  }
  this.jets.length=0;
 }
}
