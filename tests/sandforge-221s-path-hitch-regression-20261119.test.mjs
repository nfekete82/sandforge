import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {readFileSync} from 'node:fs';

const spawnSquad=()=>{
 const g=new Simulation(20261119,24);
 g.status='playing';g.aiClock=-1e8;g.world.blocked.fill(0);
 const home=g.bases.find(b=>b.owner===0);
 assert.ok(home,'test requires playable HQ');
 const actors=Array.from({length:12},(_,i)=>g.spawn(0,{
  x:home.x+120+(i%4)*38,y:home.y+110+Math.floor(i/4)*41
 },'rover'));
 return {g,actors,target:{x:home.x+760,y:home.y+720}};
};

test('12 catch-up physics ticks in one RAF submit at most two movement route attempts',()=>{
 const {g,actors,target}=spawnSquad();
 const calls=[];
 g.world.path=(start,end)=>{calls.push([start.x,start.y,end.x,end.y]);return [end];};
 g.time=196;
 g.beginRenderFrame();
 try{
  for(let step=0;step<12;step++){
   g.time+=.05;
   // Force many new dynamic orders to compete for the same frame budget.
   for(const u of actors){
    u.path=[];u.repath=0;
    g.move(u,target,.05);
   }
  }
 }finally{g.endRenderFrame();}
 assert.equal(calls.length,2,
  '4x catchup must never run 16-35 expensive route searches in one rendered frame');
 assert.ok(actors.filter(u=>u.repath>.09).length>=10,
  'unserved units retain a retry deadline instead of racing every tick');
 g.time+=.05;
 g.beginRenderFrame();
 try{
  for(const u of actors.slice(2)){u.path=[];u.repath=0;g.move(u,target,.05);}
 }finally{g.endRenderFrame();}
 assert.equal(calls.length,4,'subsequent rendered frame gets a fresh two-route budget');
});

test('physical obstruction cannot retrigger a 4200-node route every physics tick',()=>{
 const {g,actors,target}=spawnSquad();
 const u=actors[0];
 let pathCalls=0;
 g.world.path=(_start,end)=>{pathCalls++;return [end];};
 // An invisible rock/vehicle just in front of this actual unit refuses
 // each physical movement step, even though the route finder says "clear".
 const position={x:u.x,y:u.y};
 g.world.walkable=(p)=>p.x<=position.x+1e-7;
 g.time=196;u.path=[];u.repath=0;
 g.move(u,target,.05);
 assert.equal(pathCalls,1);
 assert.equal(u.path.length,0,'blocked path cleared for a future valid retry');
 assert.ok(u.repath>=1,'collision now uses positive retry delay');
 const firstCooldown=u.repath;
 for(let i=0;i<15;i++){
  g.time+=.05;u.repath-=.05;g.move(u,target,.05);
 }
 assert.equal(pathCalls,1,'no repeated A* while immobile');
 for(let i=0;i<25;i++){
  g.time+=.05;u.repath-=.05;g.move(u,target,.05);
 }
 assert.ok(pathCalls<=2,
  'backoff is amortized, not one path search per 50ms step');
 if(pathCalls===2)assert.ok(u.repath>.25,
  'a second blocked attempt must receive a real positive backoff');
});

test('stuck-route escalation resets for a different player order',()=>{
 const {g,actors,target}=spawnSquad(),u=actors[0];
 g.world.path=(_start,to)=>[to];
 const x=u.x;
 g.world.walkable=(p)=>p.x<=x+1e-7;
 g.time=196;
 for(let i=0;i<5;i++){
  u.repath=0;u.path=[];
  g.move(u,target,.05);
  g.time+=.05;
 }
 assert.ok(u.repath>2.5,'repeated identical blocked routes back off');
 u.repath=0;u.path=[];
 g.move(u,{x:target.x+190,y:target.y},.05);
 assert.ok(u.repath<1.7,'explicit changed destination must not inherit old stuck count');
});

test('browser RAF loop actually brackets all fast-forward physics steps',()=>{
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 assert.match(preview,/game\.beginRenderFrame\(\);/);
 assert.match(preview,/for\(let i=0;i<budget\.steps;i\+\+\)\{game\.step\(\.05\)/);
 assert.match(preview,/finally\{game\.endRenderFrame\(\);\}/);
});
