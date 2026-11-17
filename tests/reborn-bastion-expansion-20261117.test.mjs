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
