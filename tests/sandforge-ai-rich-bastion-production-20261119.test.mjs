import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {developArmy,directorArmyTarget} from '../dist/src/reborn/army-economy.js';
import {bastionSurplusArmyStage} from '../dist/src/reborn/director-production.js';
import {addProducer,seedCompletedGenerators} from './fixtures/reborn-production.mjs';

const pulse=g=>developArmy(g,g.tactical.state,
 g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier),()=>0);

function richBastions(){
 const g=new Simulation(20261119,24);
 g.status='playing';g.time=300;g.aiClock=-1e9;
 const hq=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 assert.ok(hq);
 const barracks=addProducer(g,'barracks',1);
 const factory=addProducer(g,'factory',1);
 addProducer(g,'airfield',1);
 seedCompletedGenerators(g);
 const territories=g.territories.filter(t=>t.owner!==0);
 assert.ok(territories.length>=5);
 for(const territory of territories.slice(0,6))territory.owner=1;
 const spawn=(kind,i)=>g.spawn(1,{
  x:hq.x+70+(i%5)*23,y:hq.y+135+Math.floor(i/5)*20
 },kind);
 let i=0;
 for(const [kind,count] of [
  ['infantry',5],['heavy',4],['rover',2],['tank',6],
  ['artillery',2],['medic',1],['scout',1],['bomber',1],
  ['rocket',1]
 ])for(let k=0;k<count;k++)spawn(kind,i++);
 g.credits[1]=16000;
 assert.ok(g.income(1)>=90,'fixture really owns profitable Bastions');
 assert.ok(g.territories.filter(t=>t.owner===1).length>=
  Math.ceil(g.territories.length*.6));
 return {g,factory,barracks,hq};
}

test('income expansion has a predictable public majority threshold',()=>{
 assert.equal(bastionSurplusArmyStage({
  time:100,income:180,ownedBastions:7,totalBastions:8
 }),0);
 assert.equal(bastionSurplusArmyStage({
  time:350,income:180,ownedBastions:3,totalBastions:8
 }),0);
 assert.equal(bastionSurplusArmyStage({
  time:350,income:40,ownedBastions:7,totalBastions:8
 }),0);
 assert.equal(bastionSurplusArmyStage({
  time:350,income:70,ownedBastions:6,totalBastions:8
 }),1);
 assert.equal(bastionSurplusArmyStage({
  time:350,income:120,ownedBastions:6,totalBastions:8
 }),2);
});

test('wealthy Bastion AI continues to buy real artillery beyond the old 2-unit cap',()=>{
 const {g,factory}=richBastions();
 const before=g.credits[1],oldCount=g.count(1);
 pulse(g);
 assert.equal(factory.queueTypes[0],'artillery',
  'the most underrepresented vehicle now starts a fully paid new artillery');
 assert.equal(factory.queueCosts[0],UNITS.artillery.cost);
 assert.equal(before-g.credits[1],
  g.bases.filter(b=>b.owner===1)
   .flatMap(b=>b.queueCosts??[]).reduce((n,v)=>n+v,0),
  'all AI units must be bought from actual credits');
 assert.equal(g.count(1),oldCount,'planning never spawns free vehicles');
 assert.equal(g.tactical.state.economy?.production?.facilities[factory.id]?.reason,
  'produced');
});

test('strong-income factory buys repeated mixed vehicles, not one of each',()=>{
 const {g,factory}=richBastions();
 const home=g.bases.find(b=>b.kind==='headquarters'&&b.owner===1);
 const produced=[];
 for(let pulseIndex=0;pulseIndex<10;pulseIndex++){
  if(g.count(1)+g.queued(1)>=directorArmyTarget(g.income(1)))break;
  pulse(g);
  const queued=factory.queueTypes.slice();
  produced.push(...queued);
  // Advance the paid order to a finished roster for isolated composition
  // testing. Production itself has already been charged and queued by
  // Simulation.recruit, rather than artificially changing the score state.
  factory.queue=[];factory.queueTypes=[];factory.queueCosts=[];
  factory.production=0;
  for(const kind of queued)g.spawn(1,{
   x:home.x+410+pulseIndex*8,y:home.y+220+pulseIndex*7
  },kind);
  g.time+=4;
 }
 const roster=kind=>g.units.filter(u=>u.owner===1&&u.kind===kind).length;
 assert.ok(produced.length>=4,'high income must trigger continuous actual orders');
 assert.ok(roster('rover')>2,'more than old two Humvees');
 assert.ok(roster('tank')>6,'more than old six heavy tanks');
 assert.ok(roster('artillery')>2,'more than old two artillery vehicles');
 assert.ok(new Set(produced).size===3,'the mix contains all three ground vehicles');
 assert.ok(g.credits[1]>=0);
 assert.ok(g.count(1)<=directorArmyTarget(g.income(1)));
});

test('limited-income AI keeps old production ceilings and does not reveal fog',()=>{
 const g=new Simulation(20261119,24);
 assert.equal(bastionSurplusArmyStage({
  time:350,income:45,ownedBastions:1,totalBastions:8
 }),0);
 assert.ok(g.explored[1]&&g.explored[0]);
 assert.equal(directorArmyTarget(160),42,
  'even abundant credits respect the paid 48-unit engine limit');
});
