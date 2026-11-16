import * as THREE from 'three';

/** Rare inhabited-looking but abandoned whitewashed desert houses.
 * A large ruin site is REPLACED, not duplicated: original deterministic
 * obstacle, navigation, and save data remain completely unchanged.
 */
export const SCENIC_DESERT_HOUSE_VERSION='rare-whitewashed-desert-houses-v1';
export function chooseRareScenicHouseIndex(ruins,seed,{modern=false}={}){
 if(!modern||!Array.isArray(ruins)||ruins.length<5)return -1;
 const large=ruins.map((r,i)=>r.variant===1?i:-1).filter(i=>i>=0);
 if(!large.length)return -1;
 // Exactly one house across the entire spacious battlefield, not every ruin.
 return large[((seed>>>3)^0x74cf)%large.length];
}
const paint=(hex,roughness=.97)=>new THREE.MeshStandardMaterial({
 color:hex,roughness,metalness:0,flatShading:false
});
// Baked, seamless material grain and roof weathering: two tiny textures
// reused by every rare house. No external asset, runtime fetch or shader pass.
function makeScenicPBRTexture(kind,size=128){
 const px=new Uint8Array(size*size*4),isRoof=kind==='roof';
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=(y*size+x)*4;
  const n=(Math.imul(x+13,374761393)^Math.imul(y+17,668265263))>>>0;
  const grain=((n^(n>>>13))%27)-13;
  const stains=Math.sin(x*.10+Math.cos(y*.061)*1.9)+Math.cos(y*.064-x*.041);
  const mortar=isRoof&&(x%32<2||y%20<2)?-33:0;
  const fade=isRoof?Math.sin((x+y)*.075)*12:Math.sin(x*.053+y*.029)*6;
  const weather=stains>1.05?-18:stains<-.85?9:0;
  const base=isRoof?[158,141,116]:[226,216,197];
  for(let k=0;k<3;k++)
   px[i+k]=Math.max(0,Math.min(255,base[k]+grain*.65+weather+fade+mortar));
  px[i+3]=255;
 }
 const texture=new THREE.DataTexture(px,size,size,THREE.RGBAFormat);
 texture.name='SandforgeScenicDesert'+(isRoof?'OldRoofTiles':'WeatheredWhitePlaster');
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
 texture.generateMipmaps=true;
 texture.minFilter=THREE.LinearMipmapLinearFilter;
 texture.magFilter=THREE.LinearFilter;
 texture.needsUpdate=true;
 return texture;
}
const MAT={
 plaster:paint('#ffffff'),chalk:paint('#ede6d5'),worn:paint('#c3b49a'),
 trim:paint('#aa987d'),timber:paint('#5c5045'),tile:paint('#ffffff'),
 roof:paint('#b1a28c'),dark:paint('#252c2e'),glass:paint('#303b3a',.47),
 rubble:paint('#c4ad8b')
};
MAT.plaster.map=makeScenicPBRTexture('plaster');
MAT.tile.map=makeScenicPBRTexture('roof');
function box(parent,name,width,height,depth,x,y,z,material,angle=0){
 const obj=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),material);
 obj.name=name;obj.position.set(x,y,z);obj.rotation.z=angle;
 obj.castShadow=true;obj.receiveShadow=true;obj.raycast=()=>{};
 obj.userData={visualOnly:true,nonPlayable:true,scenicHouse:true};
 parent.add(obj);return obj;
}
const noise=(seed,n)=>{
 let k=(Math.imul(seed^n,1664525)+1013904223)>>>0;
 k=Math.imul(k^(k>>>16),2246822519)>>>0;
 return k/4294967296;
};
export function createScenicDesertHouse(ruin,seed=0,index=0){
 const g=new THREE.Group();
 const variant=((seed>>>4)+index)%2; // pitched farmhouse / flat adobe house
 g.name='ScenicWhitewashedDesertHouse_'+index;
 g.userData={visualOnly:true,nonPlayable:true,scenicHouse:true,
  abandoned:true,variant,version:SCENIC_DESERT_HOUSE_VERSION};
 const w=ruin.width*.76,d=ruin.depth*.73;
 const h=Math.min(ruin.height*.72,56),base=1.4;
 // Plaster walls have slight setbacks to suggest weathered old construction.
 box(g,'StoneFoundation',w+7,3,d+7,0,base,0,MAT.trim);
 box(g,'WhitewashedHouseShell',w,h,d,0,base+1.5+h/2,0,MAT.plaster);
 box(g,'WallCornice',w+3,3,d+3,0,base+h+2,0,MAT.chalk);
 for(const sx of [-1,1])for(const sz of [-1,1])
  box(g,'WornCornerStone',5.8,h*.80,5.8,sx*(w/2-2),base+3+h*.4,
   sz*(d/2-2),MAT.worn);
 // Actual low-recessed dark windows, doors and stone reveals: no floating signs.
 const facadeZ=d/2+.7;
 for(const floor of [0,1]){
  const yy=base+h*(floor===0?.34:.73);
  for(const x of [-w*.27,w*.27]){
   box(g,'RecessedWindowVoid',w*.12,h*.19,.9,x,yy,facadeZ,MAT.dark);
   box(g,'WindowSill',w*.15,2,3,x,yy-h*.1,facadeZ+1.2,MAT.chalk);
   box(g,'WindowLintel',w*.15,2.6,2.2,x,yy+h*.1,facadeZ+1.1,MAT.trim);
   box(g,'OldWindowDividingFrame',1.7,h*.18,1.1,x,yy,facadeZ+1.1,MAT.timber);
  }
 }
 box(g,'DesertDoorRecess',w*.18,h*.35,1.2,0,base+h*.18,facadeZ,MAT.dark);
 box(g,'HalfBrokenWoodenDoor',w*.15,h*.30,.85,0,base+h*.16,facadeZ+1.2,MAT.timber);
 for(const s of [-1,1]){
  box(g,'SideWindowVoid',1.1,h*.18,d*.16,s*(w/2+.6),base+h*.65,
   0,MAT.dark);
  box(g,'SideWindowLintel',2.3,2,d*.19,s*(w/2+1.3),base+h*.76,0,MAT.chalk);
 }
 if(variant===0){
  // War-worn terracotta/sand pitched roof, like the white gabled houses
  // in the supplied Defilade desert reference. Real geometric slopes.
  const rise=Math.min(ruin.height*.23,17);
  const slant=Math.atan2(rise,w/2+4);
  const panelW=Math.hypot(w/2+4,rise)+3.5;
  for(const s of [-1,1]){
   box(g,'AgedSlopedTileRoof',panelW,2.3,d+7,s*(w/4+1),
    base+h+4+rise/2,0,MAT.tile,s===-1?slant:-slant);
   // Sparse wooden rafter at the front gable; not a solid roof block.
   box(g,'ExposedRoofEave',panelW,1.7,2,s*(w/4+1),
    base+h+3.2+rise/2,d/2+2.8,MAT.timber,s===-1?slant:-slant);
  }
  // Close triangular front/back gables with weathered plaster instead of
  // leaving unrealistic dark holes beneath the pitched roof.
  const yEave=base+h+3.3,yCrown=base+h+4+rise;
  for(const z of [-d/2-.3,d/2+.3]){
   const geo=new THREE.BufferGeometry();
   geo.setAttribute('position',new THREE.Float32BufferAttribute([
    -w/2,yEave,z,w/2,yEave,z,0,yCrown,z
   ],3));
   geo.setIndex([0,1,2]);geo.computeVertexNormals();
   const gable=new THREE.Mesh(geo,MAT.chalk);
   gable.name='WhitewashedPitchedGable';
   gable.material.side=THREE.DoubleSide;
   gable.castShadow=true;gable.receiveShadow=true;gable.raycast=()=>{};
   g.add(gable);
  }
  box(g,'RoofRidgeCap',3.5,2,d+7,0,base+h+4+rise,0,MAT.worn);
  box(g,'OldStoneChimney',w*.095,rise*.87,w*.085,
   -w*.19,base+h+8+rise*.52,-d*.18,MAT.plaster);
 }else{
  // Alternative abandoned flat-roof house: low, irregular parapet and a
  // visible dusty flat roof, but no sprawling ruined supply camp.
  box(g,'DustyRoofSlab',w+4,3,d+4,0,base+h+5,0,MAT.roof);
  for(const s of [-1,1]){
   box(g,'IncompleteRoofParapet',w*.27,6.5,3.3,s*w*.32,
    base+h+9.2,d/2+1,MAT.plaster);
   box(g,'RoofSideParapet',3.3,5,d*.68,s*(w/2+1),
    base+h+8.5,-d*.12,MAT.worn);
  }
  box(g,'OldRoofVent',w*.12,7,d*.11,w*.24,base+h+10,-d*.24,MAT.trim);
 }
 // Only THREE tiny weathering/rubble accents; no prop spam.
 for(let i=0;i<3;i++){
  const q=noise(seed,index*13+i),r=noise(seed+41,index*19+i);
  const width=3+q*5;
  box(g,'WindblownPlasterChip',width,.9+q*1.2,2+r*5,
   (q-.5)*w*.7,.7,(r-.5)*d*.95,MAT.rubble);
 }
 return g;
}
