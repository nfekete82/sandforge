import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {newSupplyJob,SUPPLY_LOAD,SUPPLY_STOCK} from '../dist/src/reborn/supply-logistics.js';

const make=(seed=2026)=>new Simulation(seed,23);
const disableAi=g=>{g.aiClock=0;g.tactical.plan=()=>{};};
test('modern 4-Bastion map has finite, reproducible and visible-to-both supply sites',()=>{
 const a=make(),b=make();
 assert.ok(a.supplyCaches.length>=4,'must place several independent stockpiles');
 assert.deepEqual(a.supplyCaches,b.supplyCaches);
 assert.ok(a.supplyCaches.every(c=>c.remaining===SUPPLY_STOCK&&
  a.world.walkable(c,[],20)&&a.territories.every(t=>Math.hypot(c.x-t.point.x,c.y-t.point.y)>=430)));
 assert.ok(new Simulation(2026,11).supplyCaches.length===0,'legacy maps keep old economy');
});
test('three Bastions cannot dominate passive income after 5-credit rebalance',()=>{
 const g=make(),old=g.territories.filter(t=>t.owner===0).length;
 assert.equal(g.territories.length,4);
 assert.ok(g.territories.every(t=>t.income===5));
 assert.equal(g.income(0),20+old*5);
 g.territories.forEach((t,i)=>t.owner=i===0?1:0);
 assert.equal(g.income(0),20+15,'three sectors only give 15 credits per 10 seconds');
});
test('physical supply cargo pays only after a complete trip to a living HQ',()=>{
 const g=make(),hq=g.bases.find(b=>b.kind==='headquarters'&&b.owner===0);
 assert.ok(hq);
 disableAi(g);
 const truck=g.spawn(0,{x:hq.x+220,y:hq.y+165},'supply');
 assert.deepEqual(truck.supply,newSupplyJob());
 const funds=g.credits[0];
 let charged=false,delivered=false,spent=0;
 for(let i=0;i<3200&&g.status==='playing';i++){
  g.step(.05);spent+=.05;
  if(truck.supply.cargo>0){
   charged=true;
   assert.ok(g.credits[0]<=funds+Math.floor(g.time/10+1e-7)*g.income(0),
    'loading a truck never directly increases available credits');
  }
  if(g.notices.some(s=>s.startsWith('Nachschub geliefert:'))){delivered=true;break;}
 }
 assert.ok(charged,'real truck reaches an accessible public supply node');
 assert.ok(delivered,'real truck drives all the way back to HQ');
 const passive=Math.floor(g.time/10+1e-7)*g.income(0);
 assert.ok(g.credits[0]>=funds+passive+SUPPLY_LOAD,'only the delivered cargo is added');
 assert.ok(g.supplyCaches.some(c=>c.remaining<SUPPLY_STOCK));
 assert.equal(g.stats.factions[0].earnedCredits>=SUPPLY_LOAD,true);
 assert.ok(spent<160);
});
test('destroying a supply truck destroys its cargo and never pays extra credits',()=>{
 const g=make();disableAi(g);
 const hq=g.bases.find(b=>b.kind==='headquarters'&&b.owner===0);
 const truck=g.spawn(0,{x:hq.x+200,y:hq.y+100},'supply');
 truck.supply.cargo=SUPPLY_LOAD;truck.supply.phase='to-hq';
 const before=g.credits[0];
 truck.hp=0;
 for(let i=0;i<150;i++)g.step(.05);
 assert.equal(g.credits[0],before,'no bounty or deposit when truck dies');
});
test('manual movement pauses the route; the supply button restarts it',()=>{
 const g=make(),hq=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 const u=g.spawn(0,{x:hq.x+180,y:hq.y+150},'supply');
 assert.equal(g.command([u.id],{kind:'move',x:u.x+75,y:u.y+75}),1);
 assert.equal(u.supply.auto,false);
 assert.equal(g.setSupplyAuto([u.id]),1);
 assert.equal(u.supply.auto,true);
 assert.equal(u.supply.phase,'seek');
});
test('supply stocks and in-flight cargo persist; old saves migrate deterministically',()=>{
 const g=make(),unit=g.spawn(0,{x:g.bases[0].x+150,y:g.bases[0].y+150},'supply');
 unit.supply.cargo=18;unit.supply.phase='to-hq';unit.supply.cacheId=0;
 g.supplyCaches[0].remaining-=73;
 const loaded=Simulation.load(g.save());
 assert.equal(loaded.supplyCaches[0].remaining,SUPPLY_STOCK-73);
 const counterpart=loaded.units.find(u=>u.id===unit.id);
 assert.equal(counterpart.supply.cargo,18);
 const old=g.save();delete old.supplyCaches;
 const oldLoaded=Simulation.load(old);
 assert.equal(oldLoaded.supplyCaches[0].remaining,SUPPLY_STOCK);
 assert.throws(()=>Simulation.load({...g.save(),supplyCaches:[{id:0,x:1,y:1,capacity:100,remaining:100}]}));
});
test('AI logistics purchases a real truck and preserves the HQ and roster cost',async()=>{
 const g=make();
 const hq=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 const barracks=g.bases.find(b=>b.owner===1&&b.kind==='barracks');
 assert.ok(hq);
 // Add a fully paid facility to exercise the production planner.
 g.bases.push({...hq,id:9002,kind:'barracks',x:hq.x+270,y:hq.y+100,
  radius:53,hp:800,buildRemaining:0,queue:[],queueTypes:[],queueCosts:[],production:0});
 g.time=35;g.credits[1]=900;
 const before=g.credits[1];
 const army=g.units.filter(u=>u.owner===1&&u.hp>0);
 const {developArmy}=await import('../dist/src/reborn/army-economy.js');
 developArmy(g,g.tactical.state,army,()=>0);
 assert.ok(hq.queueTypes.includes('supply'),'AI paid headquarters queues first supply truck');
 assert.equal(before-g.credits[1]>=275,true,'credits are deducted from the actual red wallet');
});
