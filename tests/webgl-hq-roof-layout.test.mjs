import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,copyFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const DIR='dist/src/assets/reborn/buildings-3d/';
function glb(path){
 const b=readFileSync(path),size=b.readUInt32LE(12);
 assert.equal(b.toString('ascii',0,4),'glTF');assert.equal(b.readUInt32LE(8),b.length);
 return JSON.parse(b.toString('utf8',20,20+size));
}
const pos=(doc,name)=>{
 const n=doc.nodes.find(node=>node.name===name);
 assert.ok(n,'missing '+name);
 return n.matrix?.slice(12,15)??n.translation??[0,0,0];
};
const bounds=(doc,name)=>{
 const node=doc.nodes.find(n=>n.name===name);
 assert.ok(node,'missing '+name);
 const p=doc.meshes[node.mesh].primitives[0],a=doc.accessors[p.attributes.POSITION];
 return {min:a.min,max:a.max};
};
test('both HQs have 64%-larger dome centered on the roof, not on the barracks',()=>{
 for(const owner of [0,1]){
  const doc=glb(DIR+'headquarters-'+owner+'.glb');
  const shell=bounds(doc,'HQ_Dome_Shell');
  assert.ok(shell.max[0]>3.10&&shell.min[0]<-3.10,'large roof dome spans center');
  assert.ok(shell.max[2]>2.95&&shell.min[2]<-3.20,'dome is centered in Z');
  assert.ok(shell.max[1]>=8.10,'dome should tower above the prior 6.63m version');
  assert.equal(doc.meshes.length,43,'43 drawcalls including original vents and centered dome');
  assert.ok(doc.materials.some(m=>m.name==='SF_OriginalPBR_roof'));
  assert.ok(doc.images.length>=40);
 }
});
test('antenna is far right, small rotating mirror front right, awning centered and wider',()=>{
 for(const owner of [0,1]){
  const doc=glb(DIR+'headquarters-'+owner+'.glb');
  assert.equal(doc.asset.extras?.sandforgeHQRoofLayout,'centered-command-dome-roof-v4-canopy-20261116');
  const rotors=[
   ['HQ_Radar_01_LargeDish_Rotor',[-4.90,5.79,-3.15]],
   ['HQ_Radar_02_PhasedArray_Rotor',[5.87,5.23,.20]],
   ['HQ_Radar_03_MiniDish_Rotor',[5.42,5.45,3.08]]
  ];
  for(const [name,expected] of rotors)
   assert.deepEqual(pos(doc,name).map(n=>Math.round(n*100)/100),expected);
  // Material batching names the team lamps differently. Both mast beacons
  // must physically move with the steel structure, not stay at the old roof.
  const beacon=owner===0?'HQ_Static_HQ_PBR_blue_signal':'HQ_Static_HQ_PBR_red_status';
  const mast=bounds(doc,beacon);
  assert.ok(mast.min[0]>5.7&&mast.max[2]<-3.25,
   'team '+owner+' mast beacon must be at the far-right rear roof edge');
  const awning=bounds(doc,'HQ_Static_SF_OriginalPBR_canvas');
  const foot=bounds(doc,'HQ_Static_SF_AwningSteelFoot');
  assert.ok(awning.min[2]<-2&&awning.max[2]>2.3,'side canopy has been centered and widened');
  assert.ok(foot.min[2]<-2&&foot.max[2]>2.2,'awning supports remain aligned');
  for(const name of ['HQ_door_leaf_L','HQ_door_leaf_R','HQ_door_recess_back'])
   assert.ok(doc.nodes.some(n=>n.name===name),'unit production gate preserved');
 }
});
test('steel canopy braces sit below the fabric, never cut black diagonal lines through it',()=>{
 for(const owner of [0,1]){
  const file=DIR+'headquarters-'+owner+'.glb';
  const raw=readFileSync(file);
  const doc=glb(file);
  const jsonLength=raw.readUInt32LE(12);
  const binaryStart=20+jsonLength+8;
  const positions=(name)=>{
   const n=doc.nodes.find(n=>n.name===name);
   assert.ok(n,'missing '+name);
   const primitive=doc.meshes[n.mesh].primitives[0];
   const a=doc.accessors[primitive.attributes.POSITION];
   const v=doc.bufferViews[a.bufferView],start=binaryStart+(v.byteOffset??0)+(a.byteOffset??0);
   const data=[];
   for(let i=0;i<a.count;i++){
    const p=start+i*(v.byteStride??12);
    data.push([raw.readFloatLE(p),raw.readFloatLE(p+4),raw.readFloatLE(p+8)]);
   }
   return data;
  };
  const fabric=positions('HQ_Static_SF_OriginalPBR_canvas');
  assert.equal(fabric.length,6);
  const roofY=x=>3.4542+(x-6.9426)*(2.9184-3.4542)/(8.7318-6.9426);
  const steel=positions('HQ_Static_SF_OriginalPBR_steel');
  const inside=steel.filter(([x,y,z])=>x>=6.91&&x<=8.75&&z>=-2.09&&z<=2.45&&
    y>roofY(x)-.30&&y<roofY(x)+.24);
  assert.ok(inside.length>100,'keep real structural steel below the canopy');
  assert.ok(inside.every(([x,y])=>y<=roofY(x)-.165),
   'steel penetrates the fabric and creates black diagonal line artifacts');
 }
});

test('authored roof rearrangement is idempotent and does not duplicate geometry',()=>{
 const path=DIR+'headquarters-0.glb';
 const dir=mkdtempSync(join(tmpdir(),'sandforge-roof-test-')),tmp=join(dir,'hq.glb');
 try{
  copyFileSync(path,tmp);
  const before=glb(tmp);
  execFileSync(process.execPath,['scripts/upgrade-hq-layout.mjs',tmp]);
  const after=glb(tmp);
  assert.equal(after.meshes.length,before.meshes.length);
  assert.equal(after.images.length,before.images.length);
  assert.equal(after.nodes.length,before.nodes.length);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
