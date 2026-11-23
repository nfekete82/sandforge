import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {mapWorldSize,campaignLayout,mapLayout} from '../dist/src/reborn/config.js';
import {bastionEffectiveIncome} from '../dist/src/reborn/bastion-upgrades.js';

for(const [version,count,seed,terrain] of [
 [27,3,9999,'oasis'],[28,5,2026,'rocky'],[29,7,1907,'dunes']
]){
 test(`new ${count}-Bastion match is symmetrical, traversable and saveable`,()=>{
  const g=Simulation.campaign(seed,version,terrain,10);
  assert.equal(g.territories.length,count);
  assert.equal(mapLayout(version).columns*mapLayout(version).rows,count);
  assert.equal(g.world.validation?.valid,true,JSON.stringify(g.world.validation?.errors));
  assert.ok(g.world.size>=4500);
  const home=campaignLayout(version,seed).headquarters;
  assert.deepEqual([...home].sort((a,b)=>a-b),[0,count-1]);
  const center=g.territories[(count-1)/2];
  assert.ok(Math.abs(center.point.x-mapWorldSize(version)/2)<1e-5);
  assert.ok(Math.abs(center.point.y-mapWorldSize(version)/2)<1e-5);
  assert.equal(center.owner,-1);
  const amount=90/(count-1.5);
  assert.ok(Math.abs(center.income-amount*1.5)<1e-10);
  const neutral=g.territories.filter(t=>t.owner===-1);
  assert.ok(Math.abs(neutral.reduce((n,t)=>n+bastionEffectiveIncome(t),0)-90)<1e-8);
  assert.ok(!g.hasExplored(1,center.point),
   'AI must not start with the unseen central Bastion revealed in fog');
  assert.ok(!g.hasExplored(0,center.point),
   'human must not begin with the central Bastion explored');
  assert.equal(g.income(0),g.income(1),'home incomes are symmetric');
  assert.ok(g.world.walkable(center.point,g.obstacles(),5),
   'central Bastion requires a real playable clearing');
  const positions=g.territories.map(t=>[t.point.x,t.point.y]);
  for(let i=0;i<count;i++){
   assert.ok(Math.abs(positions[i][0]+positions[count-i-1][0]-g.world.size)<1e-5);
   assert.ok(Math.abs(positions[i][1]+positions[count-i-1][1]-g.world.size)<1e-5);
  }
  for(let i=0;i<80;i++)g.step(.05);
  const re=Simulation.load(g.save());
  assert.equal(re.territories.length,count);
  // Save migration normalizes absent tier-1 markers to upgradeLevel:1.
  const canonical=ts=>ts.map(t=>({...t,upgradeLevel:t.upgradeLevel??1}));
  assert.deepEqual(canonical(re.territories),canonical(g.territories),
   'odd Bastion income and state survives save/load');
  assert.equal(re.world.size,g.world.size);
 });
}

test('old 4/8/12/16-Bastion maps retain exact historical version layouts',()=>{
 for(const [v,c] of [[23,4],[24,8],[25,12],[26,16]]){
  assert.equal(mapLayout(v).columns*mapLayout(v).rows,c);
 }
});
