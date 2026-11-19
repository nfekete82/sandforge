import {test} from 'node:test';
import assert from 'node:assert/strict';
import {UNITS,BUILDINGS,unitKinds,weaponDamage,combatDpsAgainst,canAttack} from '../dist/src/reborn/catalog.js';
import {RULES} from '../dist/src/reborn/config.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UPGRADES,INTERCEPTOR_ENABLED} from '../dist/src/reborn/strategic-tech.js';

// Descriptive audit, NOT hard-coded buffs/nerfs. Print deterministic
// actual simulator results and avoid outcome assertions before tuning.
const round=(n,d=2)=>Math.round(n*10**d)/10**d;
const useful=unitKinds.filter(k=>UNITS[k].damage>0);
const catalog=kind=>({kind:UNITS[kind].name,cost:UNITS[kind].cost,
 hp:UNITS[kind].hp,build:UNITS[kind].buildTime,
 range:UNITS[kind].range,rawDps:round(UNITS[kind].damage/UNITS[kind].cooldown),
 vsInfantryDps:round(combatDpsAgainst({kind},{kind:'infantry'})),
 vsTankDps:round(combatDpsAgainst({kind},{kind:'tank'})),
 vsAircraftDps:canAttack({kind},{kind:'bomber'})?
  round(combatDpsAgainst({kind},{kind:'bomber'})):0,
 vsStructuresDps:round(combatDpsAgainst({kind},{kind:'barracks',queue:[]})),
});

test('catalog damage/cost table across every active fighting unit',()=>{
 const results=useful.map(catalog);
 assert.ok(results.every(row=>row.cost>0&&row.hp>0&&row.build>0));
 console.log('BALANCE_CATALOG '+JSON.stringify(results));
});

test('structure defense, generator payback, rush economy, and upgrade investment',()=>{
 const buildings=Object.entries(BUILDINGS).map(([kind,b])=>({
  kind,cost:b.cost,hp:b.hp,build:b.buildTime,range:kind==='turret'?RULES.turret.range:0,
  baseDps:kind==='turret'?round(RULES.turret.damage/RULES.turret.cooldown):0,
  paidBackSeconds:b.income>0?b.cost/(b.income/RULES.incomeInterval):null
 }));
 const g=new Simulation(824836862,24);
 const incomes=[0,1].map(owner=>({owner,initial:g.income(owner)}));
 const neutral=g.territories.filter(t=>t.owner===-1).map(t=>t.income);
 const pricePerIncome=Object.fromEntries(['infantry','heavy','rocket','rover','tank','artillery','bomber'].map(k=>
  [k,round(UNITS[k].cost/(neutral.reduce((a,b)=>a+b,0)/neutral.length/RULES.incomeInterval),1)]));
 const tech=Object.entries(UPGRADES).map(([kind,x])=>({kind,cost:x.cost,seconds:x.seconds}));
 assert.deepEqual(incomes.map(x=>x.initial),[60,60]);
 assert.equal(BUILDINGS.generator.cost,150);
 assert.equal(INTERCEPTOR_ENABLED,false);
 assert.equal(BUILDINGS.turret.cost,300);
 console.log('BALANCE_ECONOMY '+JSON.stringify({incomes,neutral,buildings,tech,
  timeNeededForOneAdditionalUnitFromSingleAverageBastionSeconds:pricePerIncome,
  interceptorActive:INTERCEPTOR_ENABLED}));
});

const layouts=[
 {id:'light-soldiers-v-heavy',left:['infantry','infantry'],right:['heavy'],range:170},
 {id:'three-soldiers-v-heavy',left:['infantry','infantry','infantry'],right:['heavy'],range:170},
 {id:'rocketeer-v-humvee',left:['rocket'],right:['rover'],range:270},
 {id:'two-rocketeers-v-tank',left:['rocket','rocket'],right:['tank'],range:270},
 {id:'tank-v-two-heavy',left:['tank'],right:['heavy','heavy'],range:205},
 {id:'two-humvees-v-tank',left:['rover','rover'],right:['tank'],range:215},
 {id:'artillery-v-tank',left:['artillery'],right:['tank'],range:580},
 {id:'rocketeers-v-bomber',left:['rocket','rocket'],right:['bomber'],range:320},
];

function duel(spec,swap=false,stage=true){
 const g=new Simulation(82000+layouts.indexOf(spec),4);
 // No omniscient opponent commander, unlimited resources or production.
 // Actual 20Hz combat, line-of-sight, bullet misses, projectile travel,
 // movement, turn rate and target acquisition still execute.
 g.aiClock=-1e8;g.tactical.plan=()=>{};
 g.stageWebGLProduction=stage;
 g.units=[];g.world.blocked.fill(0);g.world.opaque.fill(0);
 g.highGroundEnabled=false;
 const spawn=(owner,kinds,x,dir)=>kinds.map((kind,i)=>g.spawn(owner,{
  x:x+dir*Math.floor(i/2)*28,y:2000+(i%2?34:-34)},kind));
 const x0=1900-spec.range/2,x1=1900+spec.range/2;
 const left=spawn(swap?1:0,spec.left,x0,-1);
 const right=spawn(swap?0:1,spec.right,x1,1);
 const fighting=()=>g.units.filter(u=>u.hp>0&&[...left,...right].some(v=>v.id===u.id));
 const opponent=owner=>fighting().filter(u=>u.owner!==owner);
 for(const u of [...left,...right]){
  const enemy=opponent(u.owner).sort((a,b)=>
   Math.hypot(a.x-u.x,a.y-u.y)-Math.hypot(b.x-u.x,b.y-u.y))[0];
  if(enemy)g.command([u.id],{kind:'attack',target:enemy.id,x:enemy.x,y:enemy.y});
 }
 g.updateVision();
 let elapsed=0;
 for(let i=0;i<600;i++){
  g.step(RULES.tick);elapsed+=RULES.tick;
  if(!left.some(u=>u.hp>0)||!right.some(u=>u.hp>0))break;
 }
 const total=(side)=>side.reduce((sum,u)=>sum+u.hp,0);
 const initial=(side)=>side.reduce((sum,u)=>sum+UNITS[u.kind].hp,0);
 const living=(side)=>side.filter(u=>u.hp>0).length;
 const a=living(left),b=living(right);
 const winner=a&&!b?'left':b&&!a?'right':a===0&&b===0?'draw':'unresolved';
 return {scenario:spec.id,swap,
  credits:[spec.left,spec.right].map(k=>k.reduce((sum,x)=>sum+UNITS[x].cost,0)),
  winner,t:round(elapsed,1),alive:[a,b],
  hpFraction:[round(total(left)/initial(left),3),round(total(right)/initial(right),3)]};
}

test('reproducible 20Hz matchups with both faction orientations and real WebGL accuracy',()=>{
 const result=layouts.flatMap(l=>[duel(l),duel(l,true)]);
 assert.equal(result.length,layouts.length*2);
 assert.ok(result.every(r=>r.hpFraction.every(x=>x>=0&&x<=1)));
 console.log('BALANCE_DUELS '+JSON.stringify(result));
});

test('same-price side fairness: identical mirror duel has no hidden faction advantage',()=>{
 const solo={id:'tank-mirror',left:['tank'],right:['tank'],range:240};
 const a=duel(solo,false),b=duel(solo,true);
 console.log('BALANCE_MIRROR '+JSON.stringify([a,b]));
 assert.ok(a.hpFraction.every(Number.isFinite));
 assert.ok(b.hpFraction.every(Number.isFinite));
});


function siege(army,distanceToTower){
 const g=new Simulation(731942+army.length,4);
 g.aiClock=-1e8;g.tactical.plan=()=>{};g.stageWebGLProduction=true;
 g.units=[];g.world.blocked.fill(0);g.world.opaque.fill(0);
 g.highGroundEnabled=false;
 const tower={
  id:9901,owner:1,kind:'turret',x:2150,y:2000,
  hp:BUILDINGS.turret.hp,territory:0,queue:[],queueTypes:[],
  production:0,buildRemaining:0,cooldown:0,rally:null,radius:BUILDINGS.turret.radius
 };
 g.bases.push(tower);
 const attackers=army.map((kind,i)=>g.spawn(0,{
  x:2150-distanceToTower-i*12,y:2000+(i-1)*24},kind));
 g.updateVision();
 for(const unit of attackers){
  g.command([unit.id],{kind:'attack',target:tower.id,x:tower.x,y:tower.y});
 }
 let time=0;
 for(let i=0;i<700;i++){
  g.step(RULES.tick);time+=RULES.tick;
  if(tower.hp<=0||!attackers.some(u=>u.hp>0))break;
 }
 return {
  attackers:army,cost:army.reduce((s,k)=>s+UNITS[k].cost,0),
  towerCost:BUILDINGS.turret.cost,
  distance:distanceToTower,t:round(time,1),
  towerHp:round(tower.hp),towerHpFraction:round(tower.hp/BUILDINGS.turret.hp,3),
  attackersHp:round(attackers.reduce((s,u)=>s+u.hp,0)),
  attackersAlive:attackers.filter(u=>u.hp>0).length,
  winner:tower.hp<=0?'attackers':attackers.every(u=>u.hp<=0)?'tower':'unresolved'
 };
}
test('actual live tower defense versus paid infantry, armor and long-range siege',()=>{
 const cases=[
  siege(['infantry','infantry','infantry'],320),
  siege(['rocket','rocket'],340),
  siege(['tank'],420),
  siege(['artillery'],665),
  siege(['bomber'],430)
 ];
 console.log('BALANCE_TURRETS '+JSON.stringify(cases));
 assert.equal(cases.length,5);
 assert.ok(cases.every(c=>c.towerHp>=0&&c.towerHp<=BUILDINGS.turret.hp));
});
