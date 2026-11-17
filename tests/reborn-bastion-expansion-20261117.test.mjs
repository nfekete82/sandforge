import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {blueContest} from '../scripts/benchmark-ai-opponent.mjs';

test('AI sends only two unassigned paid fighters to an unblocked Bastion during buildup',()=>{
 const g=new Simulation(2026,4);
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 assert.ok(home);
 g.time=80;
 g.tactical.state.phase='gather';
 g.tactical.state.group=[];
 const fighters=[];
 for(let i=0;i<10;i++)fighters.push(g.spawn(1,{x:home.x+75+i*4,y:home.y+90},'infantry'));
 const issued=[];
 const oldRoute=g.tactical.route,oldSample=g.tactical.sampleRoute,oldIssue=g.tactical.issue;
 try{
  g.tactical.route=(_unit,point)=>[point];
  g.tactical.sampleRoute=()=>({risk:0,length:100});
  g.tactical.issue=(units,p,mode)=>{
   issued.push({ids:units.map(u=>u.id),point:p,mode});return true;
  };
  const active=g.tactical.expansionRaid(fighters,home);
  assert.equal(active.size,2);
  assert.equal(issued.length,1);
  assert.equal(issued[0].mode,'assault');
  assert.equal(issued[0].ids.length,2);
  assert.ok(issued[0].ids.every(id=>active.has(id)));
  const target=g.tactical.state.battle.squads.find(s=>s.role==='raid')?.target;
  assert.ok(Number.isInteger(target));
  const bastion=g.territories[target];
  assert.equal(bastion.owner,-1,'only neutral, not a defended hostile sector during buildup');
  assert.ok(bastion.neighbors.some(id=>g.territories[id].owner===1));
  assert.equal(g.units.filter(u=>u.owner===1&&u.hp>0).length>=10,true,
   'two borrowed soldiers must already exist; no free spawns');
 }finally{
  g.tactical.route=oldRoute;
  g.tactical.sampleRoute=oldSample;
  g.tactical.issue=oldIssue;
 }
});

test('buildup raiders never borrow the operational assault group',()=>{
 const g=new Simulation(2026,4),home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 g.time=80;
 g.tactical.state.phase='gather';
 const fighters=Array.from({length:10},(_,i)=>g.spawn(1,{x:home.x+60+i*4,y:home.y+120},'infantry'));
 g.tactical.state.group=fighters.slice(0,9).map(u=>u.id);
 const original=g.tactical.issue;
 const oldRoute=g.tactical.route,oldSample=g.tactical.sampleRoute;
 try{
  g.tactical.issue=()=>true;g.tactical.route=(_unit,p)=>[p];g.tactical.sampleRoute=()=>({risk:0,length:100});
  const raid=g.tactical.expansionRaid(fighters,home);
  assert.equal(raid.size,0,'one spare fighter is not sufficient for a parallel raid');
 }finally{g.tactical.issue=original;g.tactical.route=oldRoute;g.tactical.sampleRoute=oldSample;}
});

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
 const scouts=orders.filter(o=>o.order.kind==='attackMove');
 assert.ok(scouts.length>=1,'blue contestant should actually leave HQ for a Bastion');
 assert.ok(scouts.every(o=>o.ids.length===1));
 assert.ok(scouts.every(o=>g.territories.some(t=>t.owner!==0&&
  Math.hypot(t.point.x-o.order.x,t.point.y-o.order.y)<1)));
});
