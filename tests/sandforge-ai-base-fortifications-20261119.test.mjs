import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {developArmy} from '../dist/src/reborn/army-economy.js';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';
import {distance} from '../dist/src/reborn/config.js';
import {
 planHomeFortification,buildHomeFortification,homeDefenseAxis,
 homeDefenseGate,homeDefenseTowerCount,HOME_TOWER_LIMIT,HOME_WALL_LIMIT
} from '../dist/src/reborn/ai-base-fortifications.js';
import {sitesVisuallyOverlap} from '../dist/src/reborn/construction-spacing.js';

function scene(){
 const g=new Simulation(20261119,24);
 g.status='playing';g.time=650;g.credits[1]=12500;g.aiClock=-1e8;
 for(const territory of g.territories.slice(0,2))territory.owner=1;
 g.world.blocked.fill(0);g.world.opaque.fill(0);g.world.components.fill(0);
 g.world.terrainSlope=()=>0;g.world.terrainHeight=()=>0;
 g.explored[1].fill(1);
 const hq=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 assert.ok(hq);
 for(const [i,kind] of ['barracks','factory'].entries()){
  const spec=BUILDINGS[kind];
  g.bases.push({...hq,id:88010+i,kind,hp:spec.hp,
   x:100+i*180,y:100,buildRemaining:0,radius:spec.radius,
   queue:[],queueTypes:[],production:0,queueCosts:[]});
 }
 const worker=g.units.find(u=>u.owner===1&&u.kind==='engineer');
 assert.ok(worker);
 worker.x=hq.x+110;worker.y=hq.y+120;worker.orders=[];worker.defendUntil=0;
 return {g,hq,worker};
}
const options={underAttack:false,fighters:18,reserve:285};
function finish(g,worker,kind){
 const site=g.bases.filter(b=>b.owner===1&&b.kind===kind&&b.buildRemaining>0).at(-1);
 assert.ok(site,kind+' construction site not found');
 site.buildRemaining=0;site.hp=BUILDINGS[kind].hp;
 worker.orders=[];worker.workingTarget=null;worker.path=[];
 g.time+=24;return site;
}
test('first HQ defense is a paid turret and a REAL 2x steel gate before any walls',()=>{
 const {g,hq,worker}=scene();
 const axis=homeDefenseAxis(g,hq);
 assert.equal(Math.abs(axis.x)+Math.abs(axis.y),1,
  'approach derives from public owned/unowned territory');
 let prior=g.credits[1];
 const first=buildHomeFortification(g,[worker],options,()=>0);
 assert.equal(first?.kind,'turret');
 assert.equal(g.credits[1],prior-BUILDINGS.turret.cost);
 const turret=finish(g,worker,'turret');
 assert.ok(distance(turret,hq)<760);
 prior=g.credits[1];
 const second=buildHomeFortification(g,[worker],options,()=>0);
 assert.equal(second?.kind,'wallGate');
 assert.equal(g.credits[1],prior-BUILDINGS.wallGate.cost);
 const gate=finish(g,worker,'wallGate');
 assert.equal(gate.gateSpan,2);
 assert.ok(homeDefenseGate(g,hq)?.id===gate.id);
 assert.ok(!g.navigationBases(1).includes(gate),'owned HQ gate is drivable');
 assert.ok(g.navigationBases(0).includes(gate),'human attackers cannot enter');
 assert.equal(g.bases.filter(b=>b.owner===1&&b.kind==='wall').length,0,
  'never close the perimeter before the exit exists');
});

test('engineer joins wall segments to both sides of the same 218-unit opening',()=>{
 const {g,hq,worker}=scene();
 let projects=[];
 for(let i=0;i<12;i++){
  const site=buildHomeFortification(g,[worker],options,()=>0);
  if(!site)break;
  projects.push(site);
  finish(g,worker,site.kind);
 }
 const gate=homeDefenseGate(g,hq);
 assert.ok(gate,'gateway installed and retained');
 const walls=g.bases.filter(b=>b.owner===1&&b.kind==='wall');
 const towers=g.bases.filter(b=>b.owner===1&&b.kind==='turret'&&distance(b,hq)<760);
 assert.equal(walls.length,HOME_WALL_LIMIT,
  'defense actually continues with four wall pieces, not only a tower');
 assert.equal(towers.length,HOME_TOWER_LIMIT,'additional HQ guns');
 assert.deepEqual(projects.map(p=>p.kind).slice(0,3),['turret','wallGate','turret']);
 const tangent=(gate.facing===2||gate.facing===3)
  ?{x:0,y:1}:{x:1,y:0};
 const deviations=walls.map(b=>(b.x-gate.x)*tangent.x+(b.y-gate.y)*tangent.y);
 for(const n of [-272.5,-163.5,163.5,272.5])
  assert.ok(deviations.some(x=>Math.abs(x-n)<2),'wall segment at offset '+n);
 for(const w of walls){
  assert.equal(w.facing??0,gate.facing??0);
  assert.equal(sitesVisuallyOverlap('wallGate',gate,gate.facing??0,'wall',w,w.facing??0),false,
   'walls touch the gate without extending into the drivable lane');
 }
 assert.equal(planHomeFortification(g,options),null,
  'fully built home perimeter does not spam additional construction');
});

test('no building without an idle paid pioneer, credits, viable terrain or army readiness',()=>{
 const {g,worker}=scene();
 const before=g.credits[1];
 assert.equal(buildHomeFortification(g,[],options,()=>0),null);
 assert.equal(g.credits[1],before);
 assert.equal(buildHomeFortification(g,[worker],{...options,fighters:1},()=>0),null);
 assert.equal(g.credits[1],before);
 g.time=40;
 assert.equal(buildHomeFortification(g,[worker],options,()=>0),null);
 g.time=210;g.credits[1]=BUILDINGS.turret.cost+120;
 assert.equal(planHomeFortification(g,options),null,
  'emergency-low budgets are protected');
 g.credits[1]=12500;
 assert.equal(buildHomeFortification(g,[worker],options,()=>4),null,
  'do not order pioneers into actual visible combat danger');
 assert.equal(g.bases.filter(b=>b.owner===1&&b.kind==='turret').length,0);
});

test('the project survives save/reload using the real gate as the anchor',()=>{
 const {g,hq,worker}=scene();
 const first=buildHomeFortification(g,[worker],options,()=>0);
 assert.equal(first?.kind,'turret');finish(g,worker,'turret');
 const second=buildHomeFortification(g,[worker],options,()=>0);
 assert.equal(second?.kind,'wallGate');const gate=finish(g,worker,'wallGate');
 const save=g.save(),after=Simulation.load(save);
 const restored=homeDefenseGate(after,after.bases.find(b=>b.id===hq.id));
 assert.ok(restored);
 assert.equal(restored.id,gate.id);
 assert.equal(restored.gateSpan,2);
 assert.notEqual(planHomeFortification(after,options)?.kind,'wallGate',
  'never double purchase a gateway after loading');
});

test('the real AI economy executes a paid HQ turret project without sacrificing core army production',()=>{
 const {g,hq,worker}=scene();
 g.tactical.mode='director';
 // Complete the full generator quota so the base is no longer saving its
 // first economy structures. This verifies the actual macro controller.
 for(let i=0;i<3;i++){
  const spec=BUILDINGS.generator;
  g.bases.push({...hq,id:89010+i,kind:'generator',hp:spec.hp,
   radius:spec.radius,x:150+i*170,y:130,buildRemaining:0,
   queue:[],queueTypes:[],production:0});
 }
 for(let i=0;i<7;i++){
  const u=g.spawn(1,{x:hq.x-80+(i%4)*35,
   y:hq.y-200+Math.floor(i/4)*36},i<3?'heavy':'infantry');
  u.orders=[];
 }
 g.spatial.rebuild(g.units);
 g.credits[1]=12500;
 const before=g.credits[1],army=g.units.filter(u=>u.owner===1);
 developArmy(g,g.tactical.state,army,()=>0);
 const towers=g.bases.filter(b=>b.owner===1&&b.kind==='turret');
 assert.ok(towers.length>=1,'macro scheduler, not just isolated helper, orders a real HQ gun');
 assert.ok(towers.some(b=>distance(b,hq)<760));
 assert.ok(g.credits[1]<=before-BUILDINGS.turret.cost,
  'paid construction, never free defensive towers');
 assert.ok(g.tactical.state.economy?.baseFortificationAttemptAt>=650);
 assert.ok(g.tactical.state.economy?.built.turret>=1);
 assert.ok(worker.orders.some(o=>o.kind==='build'),
  'normal engineer receives a construction order');
});
