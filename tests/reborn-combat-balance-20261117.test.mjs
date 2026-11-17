import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS,BUILDINGS,TANK_MG,weaponDamage,combatDpsAgainst} from '../dist/src/reborn/catalog.js';

const unit=kind=>({kind});
const structure=kind=>({kind,queue:[]});
const close=(actual,expected,msg)=>assert.ok(Math.abs(actual-expected)<1e-6,
 `${msg}: expected ${expected}, got ${actual}`);

test('combat balance: elite rifle squad no longer one-bursts a healthy infantryman',()=>{
 close(weaponDamage(unit('infantry'),unit('infantry')),17,'normal rifle');
 close(weaponDamage(unit('heavy'),unit('infantry')),90,'heavy vs regular infantry');
 assert.ok(weaponDamage(unit('heavy'),unit('infantry'))<UNITS.infantry.hp,
  'a full 3-round heavy burst must not instantly delete a full-health rifleman');
 // Stay elite against soldiers but retain the separate anti-armor and bunker tuning.
 const ratio=combatDpsAgainst(unit('heavy'),unit('infantry'))/
  combatDpsAgainst(unit('infantry'),unit('infantry'));
 assert.ok(ratio>3.5&&ratio<4.1,'elite troop DPS is strong but not fivefold');
 close(weaponDamage(unit('heavy'),unit('tank')),24,'heavy vs armor unchanged');
 close(weaponDamage(unit('heavy'),unit('scout')),15,'heavy vs air unchanged');
 close(weaponDamage(unit('heavy'),structure('barracks')),54,
  'heavy vs buildings unchanged');
 close(weaponDamage(unit('heavy'),structure('wall')),26.4,
  'heavy vs defensive walls unchanged');
});

test('combat balance: rockets retain clear anti-armor/anti-air dominance and weak direct infantry hits',()=>{
 close(weaponDamage(unit('rocket'),unit('infantry')),14.5,
  'single rocket-vs-infantry reduction at firing');
 close(weaponDamage(unit('rocket'),unit('tank')),145,'rocket vs tank');
 close(weaponDamage(unit('rocket'),unit('scout')),174,'rocket vs helicopter');
 close(weaponDamage(unit('rocket'),structure('headquarters')),101.5,
  'rocket vs structures');
 assert.ok(combatDpsAgainst(unit('rocket'),unit('tank'))>=
  combatDpsAgainst(unit('rocket'),unit('infantry'))*9);
});

test('combat balance: a real guided rocket direct hit is not penalized TWICE on impact',()=>{
 const g=new Simulation(20261117,4);
 g.aiClock=-1e8;
 g.units=[];
 g.highGroundEnabled=false;
 const shooter=g.spawn(1,{x:950,y:950},'rocket');
 const target=g.spawn(0,{x:1900,y:1900},'infantry');
 const other=g.spawn(0,{x:1912,y:1900},'infantry');
 // Inject exactly the ordinary legal projectile created by Simulation.launch.
 // No missed shot, upgrades, hill bonus, hostile AI or automatic weapon fire.
 const damage=weaponDamage(shooter,target);
 g.missiles.push({
  id:790001,source:shooter.id,owner:1,
  from:{x:shooter.x,y:shooter.y},
  to:{x:target.x,y:target.y},
  angle:0,at:g.time,impactAt:g.time+.02,
  damage,type:'antiArmor',target:target.id,miss:false
 });
 g.step(.05);
 close(UNITS.infantry.hp-target.hp,damage,
  'a tracked primary infantry target takes the full already-reduced 14.5 HP');
 assert.ok(other.hp<UNITS.infantry.hp,
  'a nearby enemy is still inside the small 32m blast');
 assert.ok(UNITS.infantry.hp-other.hp<1,
  'surrounding infantry take only tiny secondary splash, not main rocket damage');
});

test('combat balance: tank MG, artillery standoff and turret remain distinct counters',()=>{
 close(combatDpsAgainst(unit('tank'),unit('infantry')),
  TANK_MG.damage/TANK_MG.cooldown,'tank roof MG is the infantry weapon');
 close(combatDpsAgainst(unit('tank'),unit('tank')),
  UNITS.tank.damage/UNITS.tank.cooldown,'tank main gun is anti-armor');
 assert.ok(UNITS.artillery.range>BUILDINGS.turret.sight-151,
  'artillery should have its original range advantage over the defense turret');
 assert.equal(UNITS.artillery.range,680);
 assert.equal(BUILDINGS.turret.sight,750);
 assert.equal(BUILDINGS.turret.hp,650);
 // Building mortar/turret balance and all prices remain the same for both teams.
 assert.equal(UNITS.bomber.cost,1000);
 assert.equal(UNITS.rover.cost,350);
 assert.equal(UNITS.heavy.cost,250);
});
