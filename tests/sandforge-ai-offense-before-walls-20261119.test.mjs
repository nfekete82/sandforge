import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';
import {planHomeFortification,HOME_FORTIFICATION_MIN_TIME,
 HOME_FORTIFICATION_MIN_FIGHTERS,HOME_FORTIFICATION_SURPLUS}
 from '../dist/src/reborn/ai-base-fortifications.js';
import {developArmy} from '../dist/src/reborn/army-economy.js';
import {addProducer,seedCompletedGenerators}
 from './fixtures/reborn-production.mjs';

test('HQ walls and gate remain LATE surplus purchases after the field army grows',()=>{
 const g=new Simulation(20261119,24);
 const hq=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 assert.ok(hq);
 g.status='playing';g.time=HOME_FORTIFICATION_MIN_TIME-1;
 g.credits[1]=12000;
 addProducer(g,'barracks',1);addProducer(g,'factory',1);
 for(const t of g.territories.slice(0,2))t.owner=1;
 const sufficient={fighters:HOME_FORTIFICATION_MIN_FIGHTERS,underAttack:false,reserve:300};
 assert.equal(planHomeFortification(g,sufficient),null,
  'do not pay for even one turret before late game');
 g.time=HOME_FORTIFICATION_MIN_TIME+5;
 assert.equal(planHomeFortification(g,{...sufficient,fighters:8}),null);
 g.credits[1]=HOME_FORTIFICATION_SURPLUS-1;
 assert.equal(planHomeFortification(g,sufficient),null);
 g.credits[1]=12000;for(const t of g.territories)t.owner=-1;
 assert.equal(planHomeFortification(g,sufficient),null,
  'never turtle without actually holding Bastions');
 for(const t of g.territories.slice(0,2))t.owner=1;
 assert.equal(planHomeFortification(g,sufficient)?.kind,'turret');
});

test('the real director buys affordable soldiers before reserving entire factory tank cost',()=>{
 const g=new Simulation(20261119,24);
 g.status='playing';g.time=155;g.aiClock=-1e9;g.credits[1]=320;
 const hq=g.bases.find(b=>b.kind==='headquarters'&&b.owner===1);
 assert.ok(hq);
 const barracks=addProducer(g,'barracks',1),factory=addProducer(g,'factory',1);
 seedCompletedGenerators(g);
 g.units=g.units.filter(u=>u.owner===0||u.kind==='engineer');
 for(let i=0;i<5;i++)g.spawn(1,{x:hq.x+75+(i%3)*22,y:hq.y+120+Math.floor(i/3)*27},'infantry');
 const army=g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier);
 developArmy(g,g.tactical.state,army,()=>0);
 assert.ok(barracks.queueTypes.some(kind=>kind==='infantry'||kind==='heavy'),
  'affordable frontline soldier must not be blocked by first expensive vehicle');
 assert.ok(g.credits[1]>=0,'all reinforcements are paid');
 assert.equal(factory.queueTypes.includes('tank'),false);
 assert.equal(g.tactical.state.economy?.production?.facilities[barracks.id]?.reason,'produced');
});
