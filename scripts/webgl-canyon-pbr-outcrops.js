import * as THREE from 'three';

/** Add the ACTUAL UV/PBR sandstone GLB used for the small rocks to the
 * large blocked canyon faces. The same BufferGeometry and real material
 * are shared with authentic 3D small stones. Only new instance matrices:
 * no dummy boulders, physics, map edits, or extra texture allocations.
 */
const randomSeed=seed=>{
 let x=(seed^0x43d7f186)>>>0;
 return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};
};
const distance=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y);
export function planCanyonPbrOutcrops({world,terrain=world?.generated,
 seed=world?.seed??0,mapId='burning-horizon',lowQuality=false}={}){
 // Modern terrain uses one continuous UV/PBR cliff mesh. Spawning smaller
 // authored boulders directly inside it produced the visible rock-in-rock bug.
 // Keep the legacy helper only for old non-modern maps.
 if(!world||world.mapVersion>=23||!terrain||
    !['burning-horizon','last-stronghold'].includes(mapId))return [];
 const random=randomSeed(seed^mapId.length*0x9e3779b9),out=[];
 const ridges=terrain.ridges??[],roads=terrain.roads??[];
 const step=lowQuality?230:135;
 for(const [ridgeId,ridge] of ridges.entries()){
  const spine=ridge.spine??[];
  if(spine.length<2)continue;
  let traveled=0,next=step*.6;
  for(let j=1;j<spine.length;j++){
   const a=spine[j-1],b=spine[j],dx=b.x-a.x,dz=b.y-a.y;
   const length=Math.hypot(dx,dz);
   if(length<.01)continue;
   const nx=-dz/length,nz=dx/length;
   while(next<=traveled+length){
    const t=(next-traveled)/length;
    const baseX=a.x+dx*t,baseY=a.y+dz*t;
    const side=[-.58,-.29,.10,.34,.61][Math.floor(random()*5)];
    const lateral=side*ridge.width;
    const x=baseX+nx*lateral,y=baseY+nz*lateral,p={x,y};
    next+=step*(.72+random()*.60);
    if(x<210||y<210||x>world.size-210||y>world.size-210)continue;
    if(terrain.sites.some(s=>distance(p,s)<600))continue;
    if(terrain.ruins?.some(s=>distance(p,s)<Math.max(s.width,s.depth)*.55+95))continue;
    if((ridge.ramps??[]).some(r=>Math.hypot(p.x-r.x,p.y-r.y)<r.width*.7+ridge.width+85))continue;
    // Existing blocked mountain only: no new object on traversable slopes
    // or previously designated route and protected HQ/Bastion pads.
    if(world.walkable(p,[],28))continue;
    const clearance=side?125:150;
    if(roads.some(road=>road.slice(1).some((b,i)=>{
     const a=road[i],vx=b.x-a.x,vy=b.y-a.y,
      t=Math.max(0,Math.min(1,((x-a.x)*vx+(y-a.y)*vy)/(vx*vx+vy*vy||1)));
     return Math.hypot(x-a.x-vx*t,y-a.y-vy*t)<clearance;
    })))continue;
    if(out.some(o=>distance(o,p)<85))continue;
    out.push(Object.freeze({
     x,y,ridgeId,angle:random()*Math.PI*2,
     tilt:(random()-.5)*.27,roll:(random()-.5)*.21,
     scale:.82+random()*.85,
     // Place the original real PBR rocks halfway into the stratified cliff,
     // not on the flat ground or hovering high over the crest.
     lift:ridge.height*(.38+.38*(1-Math.abs(side)))
    }));
   }
   traveled+=length;
  }
 }
 return Object.freeze(out);
}
export function createCanyonPbrOutcrops({
 scene,world,terrain=world?.generated,seed=world?.seed??0,
 mapId,sourceScenery,heightAt,lowQuality=false
}={}){
 const placements=planCanyonPbrOutcrops({world,terrain,seed,mapId,lowQuality});
 const sourceMeshes=(sourceScenery?.meshes??[]).filter(m=>
  m.userData?.model==='sandstone'&&m.geometry&&m.material);
 const root=new THREE.Group();root.name='visual-authentic-canyon-glb-outcrops';
 root.userData={visualOnly:true,nonPlayable:true,nonBlocking:true,realPbr:true};
 const meshes=[];
 if(placements.length&&sourceMeshes.length){
  const dummy=new THREE.Object3D(),half=world.size/2;
  for(const source of sourceMeshes){
   const mesh=new THREE.InstancedMesh(source.geometry,source.material,placements.length);
   mesh.name='real-pbr-canyon-rock-'+source.name;
   mesh.userData={visualOnly:true,nonPlayable:true,nonBlocking:true,
    canyonOutcrop:true,realPbrMaterialShared:true};
   mesh.castShadow=!lowQuality;mesh.receiveShadow=true;mesh.raycast=()=>{};
   for(const [i,p] of placements.entries()){
    dummy.position.set(p.x-half,heightAt(p.x,p.y)+p.lift,p.y-half);
    dummy.rotation.set(p.tilt,p.angle,p.roll);
    dummy.scale.setScalar(p.scale);
    dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
   }
   mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
   root.add(mesh);meshes.push(mesh);
  }
 }
 scene.add(root);
 let disposed=false;
 return {root,placements,meshes,drawCalls:meshes.length,
  dispose(){if(disposed)return;disposed=true;root.removeFromParent();
   // The authored GLB geometry and materials remain owned by
   // loadAuthenticDesertScenery; never double-dispose those PBR resources.
   for(const mesh of meshes)mesh.dispose();root.clear();
  }
 };
}
