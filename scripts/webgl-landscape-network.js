import * as THREE from 'three';

/** Procedural v3 presentation. The Simulation owns all passability: these
 * meshes are raycast-inert and conform to the exact same authoritative height
 * sampler as the game's units, buildings and ground triangles. */
export function createLandscapeMeshes({scene,size,heightAt,roads=[],ridges=[],biome='desert'}){
 const half=size/2,added=[];
 const clearings=ridges.flatMap(ridge=>ridge.clearings??[]);
 const insidePad=(x,z,margin=0)=>clearings.some(zone=>
  Math.hypot(x-zone.point.x,z-zone.point.y)<zone.radius+margin);
 const terrainPoint=(x,z,offset=.8)=>[x-half,heightAt(x,z)+offset,z-half];
 const append=(into,a,b,c)=>{into.push(...a,...b,...c);};
 const bands=[{width:87,color:biome==='snow'?'#89949c':'#8b7254',opacity:.38,offset:.52},
              {width:49,color:biome==='snow'?'#c5bdaf':'#ae966c',opacity:.82,offset:.78}];
 for(const band of bands){
  const vertices=[];
  for(const road of roads)for(let i=1;i<road.length;i++){
   const a=road[i-1],b=road[i],dx=b.x-a.x,dz=b.y-a.y,len=Math.hypot(dx,dz);
   if(len<1)continue;
   const nx=-dz/len*band.width*.5,nz=dx/len*band.width*.5;
   const steps=Math.ceil(len/32);
   for(let k=0;k<steps;k++){
    const t=k/steps,u=(k+1)/steps;
    const x=a.x+dx*t,z=a.y+dz*t,xx=a.x+dx*u,zz=a.y+dz*u;
    // No painted road across the build pads: leave a clean sand apron.
    if(insidePad((x+xx)*.5,(z+zz)*.5,band.width*.65))continue;
    const a1=terrainPoint(x+nx,z+nz,band.offset),a2=terrainPoint(x-nx,z-nz,band.offset);
    const b1=terrainPoint(xx+nx,zz+nz,band.offset),b2=terrainPoint(xx-nx,zz-nz,band.offset);
    append(vertices,a1,a2,b1);append(vertices,b1,a2,b2);
   }
  }
  if(!vertices.length)continue;
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({color:band.color,roughness:1,metalness:0,
    side:THREE.DoubleSide,transparent:true,opacity:band.opacity,depthWrite:false,
    polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name='procedural-v3-sand-roads';mesh.renderOrder=2;
  mesh.receiveShadow=true;mesh.raycast=()=>{};
  mesh.userData={visualOnly:true,roadNetwork:true};
  scene.add(mesh);added.push(mesh);
 }
 const vertices=[],colors=[];
 const palette={
  desert:['#cbb18a','#9a7755','#e2c59c'],
  snow:['#a8a8a6','#7c878c','#d7d4c9'],
  jungle:['#99916e','#646d4c','#b5aa7d']
 }[biome]??['#cbb18a','#9a7755','#e2c59c'];
 const hues=palette.map(color=>new THREE.Color(color));
 const face=(a,b,c,color)=>{
  append(vertices,a,b,c);
  for(let i=0;i<3;i++)colors.push(color.r,color.g,color.b);
 };
 for(const ridge of ridges){
  for(let i=1;i<ridge.spine.length;i++){
   const a=ridge.spine[i-1],b=ridge.spine[i],dx=b.x-a.x,dz=b.y-a.y;
   const len=Math.hypot(dx,dz);if(len<1)continue;
   const nx=-dz/len*ridge.width*.48,nz=dx/len*ridge.width*.48;
   const steps=Math.ceil(len/23);
   for(let k=0;k<steps;k++){
    const t=k/steps,u=(k+1)/steps,cx=a.x+dx*(t+u)*.5;
    // The exact same x-based pass predicate is used by World.blocked.
    if(ridge.ramps.some(p=>Math.abs(cx-p.x)<=p.width*.5))continue;
    const p={x:a.x+dx*t,z:a.y+dz*t},q={x:a.x+dx*u,z:a.y+dz*u};
    // The 3D rock face must respect the exact same protected build areas
    // as the authoritative collision grid, including the edge of the wall.
    if(insidePad((p.x+q.x)*.5,(p.z+q.z)*.5,ridge.width*.6))continue;
    const l0=terrainPoint(p.x+nx,p.z+nz,.2),r0=terrainPoint(p.x-nx,p.z-nz,.2);
    const l1=terrainPoint(q.x+nx,q.z+nz,.2),r1=terrainPoint(q.x-nx,q.z-nz,.2);
    const rise=ridge.height*(.83+.13*Math.sin((i*steps+k)*1.91));
    const lt0=[l0[0],l0[1]+rise,l0[2]],rt0=[r0[0],r0[1]+rise*.83,r0[2]];
    const lt1=[l1[0],l1[1]+rise,l1[2]],rt1=[r1[0],r1[1]+rise*.83,r1[2]];
    face(l0,l1,lt0,hues[1]);face(l1,lt1,lt0,hues[1]);
    face(rt0,rt1,r0,hues[0]);face(rt1,r1,r0,hues[0]);
    face(lt0,lt1,rt0,hues[2]);face(lt1,rt1,rt0,hues[2]);
   }
  }
 }
 if(vertices.length){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({
    color:'#ffffff',roughness:.98,metalness:0,vertexColors:true,side:THREE.DoubleSide,
    flatShading:true}));
  mesh.name='procedural-v3-physical-mountain-passes';
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.raycast=()=>{};
  mesh.userData={visualOnly:true,physicalCliffPresentation:true};
  scene.add(mesh);added.push(mesh);
 }
 return added;
}
