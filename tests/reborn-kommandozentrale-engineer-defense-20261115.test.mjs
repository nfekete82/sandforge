import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {UNITS,BUILDINGS,canAttack,weaponDamage} from '../dist/src/reborn/catalog.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {equipEngineerTools,updateEngineerTools} from '../scripts/webgl-engineer-tools.js';

const advance=(g,seconds)=>{for(let i=0;i<Math.round(seconds/.05);i++)g.step(.05);};
const scene=()=>{
 const g=new Simulation(2074,2);
 g.aiClock=-1e8;
 g.units=[];
 g.world.blocked.fill(0);
 g.world.opaque.fill(0);
 return g;
};

test('Kommandozentrale is the public HQ name; pioneer has effective defensive pistol',()=>{
 assert.equal(BUILDINGS.headquarters.name,'Kommandozentrale');
 assert.equal(BUILDINGS.headquarters.cost,300);
 assert.equal(UNITS.engineer.name,'Pionier');
 assert.equal(UNITS.engineer.cost,200);
 assert.equal(UNITS.engineer.hp,110);
 assert.equal(UNITS.engineer.damage,8);
 assert.equal(UNITS.engineer.range,145);
 assert.equal(canAttack({kind:'engineer'},{kind:'infantry',orders:[]}),true);
 assert.ok(weaponDamage({kind:'engineer'},{kind:'infantry',orders:[]})>0);
 assert.match(UNITS.engineer.description,/Schraubenschlüssel.*Pistole/);
});

test('pioneer shoots under a direct attack order; target takes real damage',()=>{
 const g=scene(),worker=g.spawn(0,{x:1900,y:2100},'engineer'),
  target=g.spawn(1,{x:1980,y:2100},'infantry');
 target.cooldown=10000;
 g.updateVision();
 assert.equal(g.command([worker.id],{kind:'attack',target:target.id,x:target.x,y:target.y}),1);
 assert.equal(worker.orders[0].kind,'attack');
 advance(g,2);
 assert.ok(target.hp<UNITS.infantry.hp,'pioneer must fire the pistol at ordered target');
 assert.ok(worker.fire>=0);
});

test('pioneer returns fire at enemy attacker instead of staying defenceless',()=>{
 const g=scene(),worker=g.spawn(0,{x:1900,y:2100},'engineer'),
  attacker=g.spawn(1,{x:1970,y:2100},'infantry');
 g.updateVision();
 advance(g,.3);
 assert.equal(worker.lastAttacker,attacker.id,'hostile attack must register');
 const oldHp=attacker.hp;
 advance(g,1.5);
 assert.ok(attacker.hp<oldHp,'pioneer must retaliate with a visible pistol shot');
 assert.ok(worker.hp>0);
});

test('pioneer still builds, repairs and may be saved without new gameplay IDs',()=>{
 const g=scene(),worker=g.spawn(0,{x:1900,y:2100},'engineer'),
  rover=g.spawn(0,{x:1945,y:2100},'rover');
 rover.cooldown=10000;rover.hp=UNITS.rover.hp-60;
 const old=rover.hp;
 assert.equal(g.command([worker.id],{kind:'repair',x:rover.x,y:rover.y,target:rover.id}),1);
 advance(g,.5);
 assert.ok(rover.hp>old);
 assert.equal(worker.orders[0]?.kind,'repair');
 const loaded=Simulation.load(g.save());
 assert.equal(loaded.units.find(u=>u.id===worker.id).kind,'engineer');
 assert.equal(loaded.units.find(u=>u.id===worker.id).orders[0]?.kind,'repair');
});

test('Atlas pistol stays available during danger; wrench replaces it only while working',()=>{
 const root=new THREE.Group(),socket=new THREE.Group(),pistol=new THREE.Group(),shotgun=new THREE.Group(),duplicate=new THREE.Group();
 socket.name='Atlas_WeaponSocket';pistol.name='Atlas_Rifle';
 shotgun.name='Shotgun';duplicate.name='Pistol';
 root.add(socket,pistol,shotgun,duplicate);
 const equipment=equipEngineerTools(root);
 assert.ok(equipment);
 assert.equal(equipment.wrench.parent,socket,'repair tool must follow the animated hand socket');
 assert.equal(equipment.pistol,pistol);
 assert.equal(equipment.wrench.visible,false);
 assert.equal(pistol.visible,true,'pistol must remain ready for self defence');
 assert.equal(shotgun.visible,false);
 assert.equal(duplicate.visible,false);
 assert.equal(equipEngineerTools(root).wrench,equipment.wrench);
 const baseRotation=equipment.wrench.rotation.z;
 updateEngineerTools(equipment,true,.15);
 assert.equal(equipment.wrench.visible,true);
 assert.equal(pistol.visible,false);
 assert.notEqual(equipment.wrench.rotation.z,baseRotation);
 updateEngineerTools(equipment,false,0);
 assert.equal(equipment.wrench.visible,false);
 assert.equal(pistol.visible,true);
 assert.equal(equipment.wrench.rotation.z,baseRotation);
 const placeholder=new THREE.Group();
 const fallbackGun=new THREE.Mesh(new THREE.BoxGeometry(1,1,1));
 fallbackGun.name='Sandforge_Engineer_Pistol_Fallback';
 placeholder.add(fallbackGun);
 const fallback=equipEngineerTools(placeholder,{fallback:true});
 assert.ok(fallback.wrench&&fallback.pistol===fallbackGun);
 updateEngineerTools(fallback,true,0);
 assert.equal(fallbackGun.visible,false);
 updateEngineerTools(fallback,false,0);
 assert.equal(fallbackGun.visible,true);
});

test('both November 11 pioneer GLBs contain animated right hand and pistol mesh',()=>{
 for(const team of [0,1]){
  const bytes=readFileSync('src/assets/reborn/prototype/engineer-'+team+'.glb');
  assert.equal(bytes.toString('ascii',0,4),'glTF');
  const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  const nodes=new Set(gltf.nodes.map(x=>x.name));
  for(const name of ['Atlas_WeaponSocket','Atlas_Rifle','Pistol','Shotgun'])
   assert.ok(nodes.has(name),team+' missing '+name);
  assert.ok(gltf.animations.some(x=>x.name==='Idle'));
  assert.ok(gltf.animations.some(x=>x.name==='Idle_Shoot'));
 }
});

test('wrench and pistol are wired to WebGL, while model and simulator IDs remain intact',()=>{
 const battlefield=readFileSync('scripts/webgl-battlefield.js','utf8');
 const actor=readFileSync('scripts/webgl-actor-presentation.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(battlefield,/entry\.engineerTools=equipEngineerTools\(model\)/);
 assert.match(battlefield,/Sandforge_Engineer_Pistol_Fallback/);
 assert.match(actor,/updateEngineerTools\(entry\.engineerTools/);
 assert.match(build,/webgl-engineer-tools\.js/);
 assert.doesNotMatch(battlefield,/Feldkommando/);
});


test('despawning one placeholder cannot dispose shared wrench geometry used by other pioneers',async()=>{
 const {disposeOwnedMeshes}=await import('../scripts/webgl-resource-lifecycle.js');
 const root=new THREE.Group();
 const own=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());
 root.add(own);
 const tool=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());
 tool.userData.sandforgeSharedToolMesh=true;
 root.add(tool);
 let ownDisposals=0,toolDisposals=0;
 own.geometry.dispose=()=>ownDisposals++;
 tool.geometry.dispose=()=>toolDisposals++;
 tool.material.dispose=()=>toolDisposals++;
 const count=disposeOwnedMeshes(root);
 assert.equal(count.geometries,1);
 assert.equal(ownDisposals,1);
 assert.equal(toolDisposals,0,'still-active pioneers must keep their shared tool GPU assets');
});
