import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS,BUILDINGS,canAttack,weaponDamage,combatDpsAgainst} from '../dist/src/reborn/catalog.js';
import {equipEngineerWrench,updateEngineerWrench} from '../scripts/webgl-engineer-wrench.js';

const tick=(game,seconds)=>{for(let i=0;i<Math.round(seconds/.05);i++)game.step(.05);};
function fixture(){
 const g=new Simulation(2074,2);
 g.aiClock=-1e8;g.world.blocked.fill(0);g.world.opaque.fill(0);
 g.units=[];g.credits[0]=10000;
 return g;
}

test('Kommandozentrale is a display name only; pioneer remains the same unit kind and cost',()=>{
 assert.equal(BUILDINGS.headquarters.name,'Kommandozentrale');
 assert.equal(BUILDINGS.headquarters.cost,300);
 assert.equal(UNITS.engineer.name,'Pionier');
 assert.equal(UNITS.engineer.cost,200);
 assert.equal(UNITS.engineer.hp,110);
 assert.equal(UNITS.engineer.damage,0);
 assert.equal(UNITS.engineer.range,0);
 assert.match(UNITS.engineer.description,/Waffenloser.*Schraubenschlüssel/);
});

test('engineer cannot attack any unit, structure or aircraft and has zero DPS',()=>{
 const worker={kind:'engineer'};
 for(const target of [{kind:'infantry',orders:[]},{kind:'bomber',orders:[]},
  {kind:'tank',orders:[]},{kind:'headquarters',queue:[]},{kind:'wall',queue:[]}]){
  assert.equal(canAttack(worker,target),false);
  assert.equal(weaponDamage(worker,target),0);
  assert.equal(combatDpsAgainst(worker,target),0);
 }
 assert.equal(canAttack({kind:'infantry'},{kind:'headquarters',queue:[]}),true);
});

test('solo pioneers never acquire or fire at nearby enemies, even if attacked or holding position',()=>{
 const g=fixture(),p=g.spawn(0,{x:1900,y:2100},'engineer');
 const enemy=g.spawn(1,{x:1945,y:2100},'infantry');
 enemy.cooldown=100;
 g.updateVision();tick(g,1);
 assert.equal(enemy.hp,UNITS.infantry.hp);
 assert.equal(p.combatTarget,null);
 assert.equal(g.shots.some(s=>s.source===p.id),false);
 // Direct attack and attack-move are not legal worker orders.
 assert.equal(g.command([p.id],{kind:'attack',target:enemy.id,x:enemy.x,y:enemy.y}),1);
 assert.equal(p.orders[0].kind,'move');
 assert.equal(p.orders[0].target,undefined);
 assert.equal(g.command([p.id],{kind:'attackMove',x:1980,y:2150}),1);
 assert.equal(p.orders[0].kind,'move');
 g.stop([p.id],true);
 p.lastAttacker=enemy.id;p.defendUntil=g.time+12;
 tick(g,2);
 assert.equal(enemy.hp,UNITS.infantry.hp);
 assert.equal(p.combatTarget,null);
 assert.equal(p.fire,0);
 assert.equal(g.shots.some(s=>s.source===p.id),false);
});

test('mixed squads keep infantry attack orders while only pioneers receive ordinary move orders',()=>{
 const g=fixture(),p=g.spawn(0,{x:1880,y:2100},'engineer'),
  s=g.spawn(0,{x:1900,y:2100},'infantry');
 assert.equal(g.command([p.id,s.id],{kind:'attackMove',x:2300,y:2100}),2);
 assert.equal(p.orders[0].kind,'move');
 assert.equal(s.orders[0].kind,'attackMove');
 const old=g.save();
 const restored=Simulation.load(old);
 assert.equal(restored.units.find(u=>u.id===p.id).orders[0].kind,'move');
});

test('old save attack orders and old pistol bursts are disabled on first update',()=>{
 const g=fixture(),p=g.spawn(0,{x:1900,y:2100},'engineer'),
  enemy=g.spawn(1,{x:2040,y:2100},'infantry');
 enemy.cooldown=100;
 p.orders=[{kind:'attack',target:enemy.id,x:enemy.x,y:enemy.y}];
 p.burst={target:enemy.id,remaining:1,at:g.time,index:0};
 p.fire=.2;p.combatTarget=enemy.id;
 g.updateVision();g.step(.05);
 assert.equal(p.orders[0].kind,'move');
 assert.equal(p.orders[0].target,undefined);
 assert.equal(p.fire,0);
 assert.equal(p.combatTarget,null);
 assert.equal(p.burst,undefined);
 assert.equal(enemy.hp,UNITS.infantry.hp);
});

test('unarmed pioneers can still repair friendly vehicles while under fire',()=>{
 const g=fixture(),p=g.spawn(0,{x:1900,y:2100},'engineer'),
  tank=g.spawn(0,{x:1940,y:2100},'tank');
 const old=tank.hp; tank.hp=old-85; tank.cooldown=100;
 p.defendUntil=g.time+10;p.lastAttacker=999;
 g.step(.05);
 assert.ok(tank.hp>old-85,'worker should repair and NOT stop to shoot back');
 assert.equal(p.fire,0);
 assert.equal(p.combatTarget,null);
 assert.ok(g.workEffects.some(w=>w.kind==='repair'&&w.source===p.id));
});

test('hand-held wrench replaces every authored weapon socket and animates only during work',()=>{
 const root=new THREE.Group(),socket=new THREE.Group();
 socket.name='Atlas_WeaponSocket';
 root.add(socket);
 for(const name of ['Pistol','Shotgun','Atlas_Rifle']){
  const weapon=new THREE.Group();weapon.name=name;
  root.add(weapon);
 }
 const tool=equipEngineerWrench(root);
 assert.ok(tool&&tool.parent===socket);
 assert.equal(tool.name,'Sandforge_Engineer_Wrench');
 assert.equal(tool.children.filter(x=>x.isMesh).length,2);
 for(const name of ['Pistol','Shotgun','Atlas_Rifle'])
  assert.equal(root.getObjectByName(name).visible,false);
 assert.equal(equipEngineerWrench(root),tool,'a cloned rig is equipped only once');
 const z=tool.rotation.z,y=tool.position.y;
 updateEngineerWrench(tool,true,.15);
 assert.notEqual(tool.rotation.z,z);
 assert.notEqual(tool.position.y,y);
 updateEngineerWrench(tool,false,0);
 assert.equal(tool.rotation.z,z);
 assert.equal(tool.position.y,y);
 const placeholder=new THREE.Group();
 assert.ok(equipEngineerWrench(placeholder,{fallback:true}));
 assert.equal(placeholder.getObjectByName('Sandforge_Engineer_Wrench').scale.x,22);
});

test('both original engineer GLBs retain the same rig and all three weapon nodes to be hidden',()=>{
 for(const team of [0,1]){
  const bytes=readFileSync('src/assets/reborn/prototype/engineer-'+team+'.glb');
  assert.equal(bytes.toString('ascii',0,4),'glTF');
  const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  const names=new Set(gltf.nodes.map(n=>n.name));
  for(const name of ['Atlas_WeaponSocket','Pistol','Shotgun','Atlas_Rifle'])
   assert.ok(names.has(name),team+' missing '+name);
  assert.ok(gltf.animations.some(a=>a.name==='Idle'));
 }
});

test('no engineer muzzle flash; new module is present in WebGL distribution',()=>{
 const actor=readFileSync('scripts/webgl-actor-presentation.js','utf8');
 const battlefield=readFileSync('scripts/webgl-battlefield.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(actor,/entity\.kind==='artillery'\|\|entity\.kind==='engineer'/);
 assert.match(battlefield,/entry\.toolNode=equipEngineerWrench\(model\)/);
 assert.match(build,/webgl-engineer-wrench\.js/);
});
