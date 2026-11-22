import * as THREE from 'three';

/** Modern-map visual replacements for the old identical box-shaped ruin GLTFs.
 * The source ruin continues to own the exact same navigation and save footprint.
 * Real openings, missing wall sections and a damaged roof are geometric, not
 * dark decals painted on a solid wall. Everything is static and visual-only.
 */
export const DESERT_RUIN_HOUSE_ART='damaged-adobe-v2-20261122';
const randomFrom=seed=>{let s=seed>>>0;return ()=>((s=Math.imul(s,1664525)+1013904223>>>0)/4294967296);};
const shared=new Map();
function texture(kind){
 if(shared.has(kind))return shared.get(kind);
 const n=256,p=new Uint8Array(n*n*4),base={
  wall:[172,138,100],edge:[129,102,72],roof:[113,91,69],
  beam:[68,53,43],dark:[40,35,31],debris:[151,119,84]
 }[kind];
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const h=(Math.imul(x+31,73856093)^Math.imul(y+79,19349663))>>>0;
  const grit=((h^(h>>>13))&63)-31;
  const strata=10*Math.sin(y*.11+Math.sin(x*.045)*1.4);
  const seam=kind==='wall'&&((y%59)<2)?-18:0;
  const wear=grit*.44+strata+seam;
  const i=(y*n+x)*4;
  for(let k=0;k<3;k++)p[i+k]=Math.max(0,Math.min(255,base[k]+wear));
  p[i+3]=255;
 }
 const tex=new THREE.DataTexture(p,n,n,THREE.RGBAFormat);
 tex.colorSpace=THREE.SRGBColorSpace;
 tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
 tex.repeat.set(2,1.5);
 tex.magFilter=THREE.LinearFilter;tex.minFilter=THREE.LinearMipmapLinearFilter;
 tex.generateMipmaps=true;tex.needsUpdate=true;
 shared.set(kind,tex);return tex;
}
const materials=new Map();
function mat(kind){
 if(!materials.has(kind))materials.set(kind,new THREE.MeshStandardMaterial({
  map:texture(kind),roughness:kind==='beam'?.84:.98,
  metalness:kind==='beam'?.18:0,side:THREE.DoubleSide
 }));
 return materials.get(kind);
}
function add(parent,geometry,material,name,x=0,y=0,z=0,ry=0){
 const mesh=new THREE.Mesh(geometry,mat(material));
 mesh.name=name;mesh.position.set(x,y,z);mesh.rotation.y=ry;
 mesh.castShadow=true;mesh.receiveShadow=true;mesh.raycast=()=>{};
 mesh.userData={visualOnly:true,nonPlayable:true,desertRuinHouse:true};
 parent.add(mesh);return mesh;
}
function block(parent,kind,name,w,h,d,x,y,z,ry=0){
 return add(parent,new THREE.BoxGeometry(w,h,d),kind,name,x,y,z,ry);
}
// An irregular, solid wall with no straight rectangular upper silhouette.
// Local horizontal runs can be interrupted to leave actual holes.
function brokenWall(parent,{x,z,span,height,depth,axis='x',seed,kind='wall'}){
 const rand=randomFrom(seed),positions=[],uv=[],indices=[];
 const cuts=6,low=height*(.59+rand()*.14);
 const left=[];
 for(let j=0;j<=cuts;j++){
  const t=j/cuts,xx=(t-.5)*span;
  const top=j===0||j===cuts?low:height*(.64+rand()*.34);
  left.push({xx,top});
 }
 for(let j=0;j<cuts;j++){
  const a=left[j],b=left[j+1],start=positions.length/3;
  // Each segment is a real thickness wall with a weathered jagged ridge.
  const q=(u,v,w)=>{positions.push(u,v,w);uv.push(u*.025,v*.025);};
  const h0=Math.max(3,a.top),h1=Math.max(3,b.top),d=depth*.5;
  for(const zz of [-d,d]){q(a.xx,0,zz);q(b.xx,0,zz);q(b.xx,h1,zz);q(a.xx,h0,zz);}
  for(const face of [[0,1,2,3],[5,4,7,6],[4,5,1,0],[3,2,6,7],[0,3,7,4],[1,5,6,2]])
   {indices.push(start+face[0],start+face[1],start+face[2],
    start+face[0],start+face[2],start+face[3]);}
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.setIndex(indices);geo.computeVertexNormals();
 const mesh=add(parent,geo,kind,'JaggedAdobeWall',x,0,z,axis==='z'?Math.PI/2:0);
 return mesh;
}
export function createDetailedDesertRuinHouse(ruin,seed=0,index=0){
 const rng=randomFrom((seed^Math.imul(index+1,2654435761))>>>0);
 const root=new THREE.Group();
 root.name='visual-detailed-desert-ruin-'+index;
 root.userData={visualOnly:true,nonPlayable:true,desertRuinHouse:true,
  version:DESERT_RUIN_HOUSE_ART};
 const w=ruin.width*.80,d=ruin.depth*.78,h=Math.max(24,Math.min(ruin.height*.83,65));
 const wall=3.8,front=d*.5;
 const form=index%3;
 // A sunken foundation and three different floor plans instead of repeated cubes.
 block(root,'edge','StoneFooting',w+4,2.2,d+4,0,1,0);
 block(root,'debris','DustyInteriorFloor',w-3,.7,d-3,0,2.3,0);
 const wing=form===1;
 const sideW=wing?w*.37:0;
 if(wing){
  block(root,'edge','SideRoomFooting',sideW+3,1.3,d*.55, w*.43,1,d*.19);
  brokenWall(root,{x:w*.43,z:d*.47,span:sideW,height:h*.65,depth:wall,seed:seed+index+14});
  brokenWall(root,{x:w*.43+sideW*.5,z:d*.19,span:d*.55,height:h*.52,depth:wall,axis:'z',seed:seed+index+15});
 }
 // Back and right walls retain physical volume but have uneven broken crowns.
 brokenWall(root,{x:0,z:-d*.5,span:w,height:h*.96,depth:wall,seed:seed+index*7+1});
 brokenWall(root,{x:w*.5,z:0,span:d,height:h*.88,depth:wall,axis:'z',seed:seed+index*7+2});
 // The left wall has a real gap for a collapsed corner.
 brokenWall(root,{x:-w*.5,z:-d*.30,span:d*.43,height:h*.65,depth:wall,axis:'z',seed:seed+index*7+3});
 if(form!==2)
  brokenWall(root,{x:-w*.5,z:d*.34,span:d*.24,height:h*.43,depth:wall,axis:'z',seed:seed+index*7+4});
 // Front facade: actual doorway and window gaps, never solid wall behind them.
 const doorway=w*(form===2?-.24:.07),doorW=w*.20;
 const windowX=w*.32,windowW=w*.17;
 const intervals=[[-w*.5,doorway-doorW*.5],
  [doorway+doorW*.5,windowX-windowW*.5],
  [windowX+windowW*.5,w*.5]];
 for(let j=0;j<intervals.length;j++){
  const [a,b]=intervals[j];if(b-a<4)continue;
  brokenWall(root,{x:(a+b)*.5,z:front,span:b-a,height:h*(.8-j*.08),
   depth:wall,seed:seed+index*7+8+j});
 }
 block(root,'edge','DoorHead',doorW+4,3.3,wall+1,doorway,h*.71,front);
 block(root,'edge','WindowLintel',windowW+5,3.1,wall+1,windowX,h*.72,front);
 block(root,'beam','WindowFrameLeft',1.7,h*.33,1.7,windowX-windowW*.5,h*.52,front+1.1);
 block(root,'beam','WindowFrameRight',1.7,h*.33,1.7,windowX+windowW*.5,h*.52,front+1.1);
 block(root,'dark','WindowRecessShadow',windowW-3,h*.13,.5,windowX,h*.77,front-1.9);
 // Remains of the two wooden ceiling members, no intact roof box.
 for(let i=0;i<2+form;i++){
  const x=-w*.28+i*w*.24;
  const timber=block(root,'beam','CollapsedRoofTimber',2.8,3,d*.70,x,
   h*(.77-rng()*.16),-d*.08);
  timber.rotation.set((rng()-.5)*.16,(rng()-.5)*.12,(rng()-.5)*.17);
 }
 if(form===0){
  const awning=block(root,'roof','BrokenFrontAwning',w*.48,2,d*.26,-w*.17,h*.70,front+d*.12);
  awning.rotation.z=-.13;
  for(const x of [-w*.36,w*.04])
   block(root,'beam','AwningBrace',2.3,h*.46,2.3,x,h*.44,front+d*.24);
 }
 if(form===2)
  block(root,'edge','ChimneyRemnant',w*.12,h*.31,d*.11,-w*.22,h*.93,-d*.27);
 // Deterministic sand-coloured fallen masonry; capped geometry and no collisions.
 for(let i=0;i<9;i++){
  const x=(rng()-.5)*w*1.09,z=(rng()-.5)*d*1.15;
  const s=2.3+rng()*4.7;
  const piece=add(root,new THREE.DodecahedronGeometry(s,0),
   i%4===0?'roof':i%3===0?'edge':'debris','FallenAdobe',x,s*.38,z);
  piece.rotation.set(rng(),rng()*Math.PI,rng());
  piece.scale.set(1.2,.42,.9);
 }
 return root;
}
