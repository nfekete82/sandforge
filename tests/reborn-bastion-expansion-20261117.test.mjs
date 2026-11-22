import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {blueContest} from '../scripts/benchmark-ai-opponent.mjs';

test('active BLUE contesting benchmark uses real paid rosters and does not mint money',()=>{
 const g=new Simulation(2026,4),hq=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 assert.ok(hq);
 const toHave=5-g.units.filter(u=>u.owner===0&&u.hp>0&&['infantry','heavy'].includes(u.kind)).length;
 for(let i=0;i<toHave;i++)g.spawn(0,{x:hq.x+70+i*9,y:hq.y+80},'infantry');
 g.credits[0]=0;
 g.time=100;
 const beforeIds=new Set(g.units.map(u=>u.id));
 const oldCommand=g.command;
 const orders=[];
 try{
  g.command=(ids,order,...rest)=>{orders.push({ids,order});return 1;};
  blueContest(g);
 }finally{g.command=oldCommand;}
 assert.equal(g.credits[0],0,'contesting enemy must not acquire free credits');
 assert.deepEqual(new Set(g.units.map(u=>u.id)),beforeIds,'no units may be created by opponent script');
 // blueDefense itself may first order some IDLE soldiers to guard their
 // own HQ Bastion. Count only the NEW, enemy/neutral-sector attack orders.
 const scouts=orders.filter(o=>o.order.kind==='attackMove'&&
  g.territories.some(t=>t.owner!==0&&
   Math.hypot(t.point.x-o.order.x,t.point.y-o.order.y)<1));
 assert.ok(scouts.length>=1,'blue contestant should actually leave HQ for a Bastion');
 assert.ok(scouts.every(o=>o.ids.length===1));
 assert.ok(new Set(scouts.map(o=>o.ids[0])).size<=3,
  'no more than three paid infantry may leave the home defense');
});

test('remote Bastion defense uses only nearby paid troops; main offensive stays intact',()=>{
 const g=new Simulation(2026,23);
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 assert.ok(home);
 const size=g.world.size;
 const remote={x:home.x<size/2?size-200:200,y:home.y<size/2?size-200:200};
 assert.ok(Math.hypot(remote.x-home.x,remote.y-home.y)>1200);
 const sector=g.territories.find(t=>t.owner!==1);
 assert.ok(sector);sector.owner=1;sector.point={...remote};
 const main=Array.from({length:6},(_,i)=>g.spawn(1,{x:home.x+80+i*5,y:home.y+100},'infantry'));
 const guards=Array.from({length:2},(_,i)=>g.spawn(1,{x:remote.x+30+i*10,y:remote.y+40},'infantry'));
 const intruder=g.spawn(0,{x:remote.x+50,y:remote.y+60},'infantry');
 g.tactical.state.group=main.map(u=>u.id);
 const issued=[],oldIssue=g.tactical.issue;
 try{
  g.tactical.issue=(units,point,mode)=>{
   issued.push({ids:units.map(u=>u.id),point,mode});return true;
  };
  const responders=g.tactical.localDefense([...main,...guards],[],[intruder],home);
  assert.ok(responders.size>0,'local defenders should respond to observed Bastion attack');
  assert.ok([...responders].every(id=>guards.some(u=>u.id===id)),
   'distant troops already committed to the offensive must not be recalled');
  assert.ok(issued.some(o=>o.mode==='defend'&&o.ids.some(id=>responders.has(id))));
 }finally{g.tactical.issue=oldIssue;}
});

test('base invasion still mobilizes paid soldiers, irrespective of main offensive grouping',()=>{
 const g=new Simulation(2026,23);
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 const main=Array.from({length:5},(_,i)=>g.spawn(1,{x:home.x+110+i*12,y:home.y+115},'infantry'));
 const intruder=g.spawn(0,{x:home.x+125,y:home.y+130},'infantry');
 g.tactical.state.group=main.map(u=>u.id);
 const oldIssue=g.tactical.issue;
 try{
  g.tactical.issue=()=>true;
  const response=g.tactical.localDefense(main,[],[intruder],home);
  assert.ok(response.size>0);
  assert.ok([...response].some(id=>main.some(u=>u.id===id)),
   'a real assault on the HQ still overrides routine offensive commitments');
 }finally{g.tactical.issue=oldIssue;}
});
