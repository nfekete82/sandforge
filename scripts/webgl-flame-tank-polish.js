import * as THREE from 'three';

// Visual-only, deterministic retrofit for the authored Sandforge flame-tank GLB.
// Source art is not mutated, and gameplay collision remains Simulation-owned.
const TAU=Math.PI*2, CAMO_SIZE=256;
const camoCache=new Map();
const smooth=t=>t*t*(3-2*t);
const mix=(a,b,t)=>a+(b-a)*t;
const hash=(x,y)=>{
  let n=Math.imul(x,374761393)+Math.imul(y,668265263);
  n=Math.imul(n^(n>>>13),1274126177);
  return ((n^(n>>>16))>>>0)/4294967295;
};
function noise(x,y,scale){
  const X=Math.floor(x/scale),Y=Math.floor(y/scale);
  const u=smooth(x/scale-X),v=smooth(y/scale-Y);
  return mix(mix(hash(X,Y),hash(X+1,Y),u),
    mix(hash(X,Y+1),hash(X+1,Y+1),u),v);
}
const PAINT=Object.freeze({
  sand:[195,177,142],sandLight:[215,198,165],
  sandDark:[147,131,104],olive:[107,115,88],oliveLight:[135,137,102]
});
function camoMap(kind){
  if(camoCache.has(kind))return camoCache.get(kind);
  const data=new Uint8Array(CAMO_SIZE*CAMO_SIZE*4);
  for(let y=0;y<CAMO_SIZE;y++)for(let x=0;x<CAMO_SIZE;x++){
    const area=noise(x+100,y-80,42)*.52+noise(x-60,y+120,78)*.48;
    let paint=PAINT[kind];
    if(area>.60)paint=[107,115,89];
    else if(area>.52)paint=[145,145,115];
    else if(area<.34)paint=[200,178,139];
    const lift=kind==='sandLight'?1.045:kind==='sandDark'?.84:kind==='olive'?.9:1;
    const grain=(noise(x+41,y-29,4)-.5)*.046+(hash(x*13+7,y*17+11)-.5)*.043;
    const i=(y*CAMO_SIZE+x)*4,fade=lift*(1+grain);
    for(let channel=0;channel<3;channel++)
      data[i+channel]=Math.max(0,Math.min(255,Math.round(paint[channel]*fade)));
    data[i+3]=255;
  }
  const map=new THREE.DataTexture(data,CAMO_SIZE,CAMO_SIZE,THREE.RGBAFormat);
  map.colorSpace=THREE.SRGBColorSpace;
  map.wrapS=map.wrapT=THREE.RepeatWrapping;
  map.magFilter=THREE.LinearFilter;
  map.minFilter=THREE.LinearMipmapLinearFilter;
  map.generateMipmaps=true;
  map.anisotropy=8;
  map.flipY=false;
  map.needsUpdate=true;
  camoCache.set(kind,map);
  return map;
}
function surfaceMaterials(model){
  const materials=new Map(),clones=new Map();
  model.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const update=original=>{
      if(!original?.name?.startsWith('SF_Flamer_'))return original;
      const name=original.name.slice('SF_Flamer_'.length);
      if(!clones.has(original)){
        const material=original.clone();
        if(Object.hasOwn(PAINT,name)){
          // Keep the original GLB normal/roughness/metallic PBR maps.
          material.map=camoMap(name);
          material.roughness=Math.max(.76,material.roughness);
          material.needsUpdate=true;
        }
        clones.set(original,material);
        materials.set(name,material);
      }
      return clones.get(original);
    };
    mesh.material=Array.isArray(mesh.material)?
      mesh.material.map(update):update(mesh.material);
  });
  return materials;
}
export function polishFlameTank(model){
  if(!model||model.getObjectByName('SF_Flamer_FrontTrack_v2'))return false;
  const materials=surfaceMaterials(model),get=(name)=>materials.get(name);
  if(!get('rubber')||!get('steel')||!get('metal'))return false;
  const parts=new THREE.Group();
  parts.name='SF_Flamer_FrontTrack_v2';
  model.add(parts);
  const add=(geometry,material,x,y,z,name,rotation=0)=>{
    const mesh=new THREE.Mesh(geometry,get(material));
    mesh.name=name;
    mesh.position.set(x,y,z);
    mesh.rotation.z=rotation;
    mesh.castShadow=true;mesh.receiveShadow=true;
    parts.add(mesh);
    return mesh;
  };
  const belt=(side)=>{
    const z=-side*1.17,front=-2.42,h=.49,r=.43;
    // Both belt loops extend ahead of the front glacis rather than ending
    // under the armor. Front wheels have genuinely connected top/bottom treads.
    const points=[];
    for(let i=10;i>=0;i--)points.push([front+i*.076,h+r]);
    for(let i=0;i<=18;i++){
      const a=Math.PI/2+Math.PI*i/18;
      points.push([front+r*Math.cos(a),h+r*Math.sin(a)]);
    }
    for(let i=0;i<=10;i++)points.push([front+i*.076,h-r]);
    for(let i=0;i<points.length-1;i++){
      const [x,y]=points[i],[nx,ny]=points[i+1];
      const length=Math.hypot(nx-x,ny-y);
      if(length<.002)continue;
      const angle=Math.atan2(ny-y,nx-x),cx=(x+nx)/2,cy=(y+ny)/2;
      add(new THREE.BoxGeometry(length*1.04,.14,.39),'rubber',cx,cy,z,
        'Flamer_Front_TrackLink_'+side+'_'+i,angle);
      add(new THREE.BoxGeometry(length*.77,.037,.412),'steel',cx,cy,z,
        'Flamer_Front_Tread_'+side+'_'+i,angle);
    }
    const wheel=add(new THREE.CylinderGeometry(.43,.43,.29,24),'rubber',
      front,h,z,'Flamer_FrontSprocket_'+side);
    wheel.rotation.x=Math.PI/2;
    for(const [radius,depth,material] of [[.34,.035,'graphite'],[.15,.045,'steel']]){
      const disc=add(new THREE.CylinderGeometry(radius,radius,depth,24),
        material,front,h,z-side*(.15+depth/2),
        'Flamer_SprocketHub_'+side+'_'+material);
      disc.rotation.x=Math.PI/2;
    }
    add(new THREE.BoxGeometry(1.05,.15,.15),'sandDark',
      -2.13,1.015,z-side*.07,'Flamer_FrontMudguard_'+side,-.055);
  };
  belt(-1);belt(1);
  for(const side of [-1,1]){
    const z=-side*.23;
    const cylinder=(x,length,radius,material,name,segments=20)=>{
      const mesh=add(new THREE.CylinderGeometry(radius,radius,length,segments),
        material,x,1.42,z,name+'_'+side);
      mesh.rotation.z=Math.PI/2;
      return mesh;
    };
    cylinder(-3.56,.58,.18,'metal','Flamer_ForwardBarrel');
    cylinder(-3.84,.16,.205,'bronze','Flamer_MuzzleCollar');
    cylinder(-3.93,.07,.163,'graphite','Flamer_MuzzleRim');
    cylinder(-3.97,.022,.107,'black','Flamer_DarkNozzle');
    cylinder(-3.986,.013,.064,'amber','Flamer_IgnitionCore');
    for(let i=0;i<6;i++)
      cylinder(-3.74+i*.09,.025,.218,'steel','Flamer_HeatShield_'+i,16);
    add(new THREE.BoxGeometry(.89,.12,.075),'sandDark',
      -3.5,1.72,z-side*.19,'Flamer_BarrelGuard_'+side);
  }
  return true;
}