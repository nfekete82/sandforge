import test from 'node:test';
import assert from 'node:assert/strict';

// Also run the same behavioral probes against the independently compiled
// main revision to establish that these are existing runtime defects.
const moduleURL=process.env.SANDFORGE_TEST_SIM??new URL('../dist/src/reborn/simulation.js',import.meta.url).href;
const {Simulation}=await import(moduleURL);

test('12-Bastion HQ bootstrap sends the existing paid soldier to neutral income',()=>{
 const g=Simulation.campaign(4102,25,'rocky');
 const initial=g.units.map(u=>u.id),credits=[...g.credits];
 g.time=3;g.tactical.plan();
 const assignments=g.tactical.state.openingContests??[];
 assert.equal(assignments.length,1);
 const task=assignments[0],soldier=g.units.find(u=>u.id===task.unitId);
 assert.equal(g.territories[task.sectorId].owner,-1);
 assert.equal(soldier.orders[0]?.kind,'attackMove');
 assert.deepEqual(g.units.map(u=>u.id),initial);
 assert.ok(g.credits[1]<=credits[1]);
});

function defenseFixture(){
 const g=new Simulation(2026,24);g.time=80;g.credits=[0,0];
 g.units=g.units.filter(u=>u.owner===1&&u.kind==='engineer');
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 const soldier=g.spawn(1,{x:home.x+180,y:home.y+180},'infantry');
 return {g,home,soldier};
}

test('a soldier owned by active defense cannot be reassigned as an opening scout',()=>{
 const {g,soldier}=defenseFixture();
 g.tactical.state.battle={version:1,reactions:0,retreats:0,fronts:[],withdrawals:[],
  squads:[{role:'defense',ids:[soldier.id],target:null,since:g.time}]};
 const before=structuredClone(soldier.orders);
 assert.equal(g.tactical.contestOpeningBastions().has(soldier.id),false);
 assert.deepEqual(soldier.orders,before);
});

test('real macro planning removes preempted defenders from the assault roster',()=>{
 const {g,home,soldier}=defenseFixture();
 const site=g.territories.find(t=>t.owner===-1&&Math.hypot(t.point.x-home.x,t.point.y-home.y)>1200);
 assert.ok(site);site.owner=1;
 soldier.x=site.point.x+100;soldier.y=site.point.y;
 g.spawn(0,{x:site.point.x+180,y:site.point.y},'infantry');
 g.tactical.state.group=[soldier.id];
 g.tactical.state.phase='attack';g.updateVision();
 const before=g.units.length,credits=[...g.credits];
 g.tactical.plan();
 const defense=g.tactical.state.battle?.squads.find(q=>q.role==='defense');
 assert.ok(defense?.ids.includes(soldier.id));
 assert.equal(g.tactical.state.group.includes(soldier.id),false);
 assert.equal(soldier.orders[0]?.tactical?.mode,'defend');
 assert.equal(g.units.length,before);assert.deepEqual(g.credits,credits);
});

function securedRecapture(){
 const {g,home,soldier}=defenseFixture();
 const site=g.territories.find(t=>t.owner===1);
 soldier.x=site.point.x+102;soldier.y=site.point.y;
 const second=g.spawn(1,{x:site.point.x+102,y:site.point.y+20},'infantry');
 g.stop([soldier.id,second.id],true,true);
 g.tactical.recaptureMission={sector:site.id,ids:[soldier.id,second.id],since:40,securedAt:60};
 return {g,home,soldier};
}

test('expired capture guard releases its hold and is available for a new army order',()=>{
 const {g,home,soldier}=securedRecapture();
 g.tactical.coordinatedRecapture(g.units.filter(u=>u.owner===1),home);
 assert.equal(g.tactical.recaptureMission,null);
 assert.equal(soldier.hold,false);assert.equal(soldier.guardArea,false);
 assert.equal(g.command([soldier.id],{kind:'attackMove',x:home.x+200,y:home.y+200}),1);
});

test('cancelling recapture frees idle guards but preserves newer repair/retreat orders',()=>{
 const {g,home,soldier}=securedRecapture();
 const other=g.spawn(1,{x:home.x+120,y:home.y+180},'infantry');
 const order={kind:'move',x:home.x,y:home.y};g.command([other.id],order);
 const before=structuredClone(other.orders);
 g.tactical.recaptureMission.ids.push(other.id);
 g.tactical.ai36Mode='off';
 g.tactical.coordinatedRecapture([soldier,other],home);
 assert.equal(soldier.hold,false);
 assert.deepEqual(other.orders,before);
});
