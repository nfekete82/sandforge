import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {BUILDINGS,UNITS} from '../dist/src/reborn/catalog.js';
import {friendlyGatePostColliders,wallColliderSamples}
 from '../dist/src/reborn/defensive-wall.js';
import {distance} from '../dist/src/reborn/config.js';

function site(id,kind,x,y,facing=0,owner=0){
 return {id,kind,x,y,facing,owner,gateSpan:kind==='wallGate'?2:undefined,
  hp:BUILDINGS[kind].hp,buildRemaining:0,territory:0,radius:24,
  queue:[],queueTypes:[],production:0,cooldown:0,rally:null};
}
function setup(kind='tank',offset=0,facing=0,owner=0){
 const g=new Simulation(20261119,24);
 // Flat, known-open section isolates the gate clearance from random dunes.
 g.world.blocked.fill(0);g.world.components.fill(0);
 g.world.terrainSlope=()=>0;g.world.terrainHeight=()=>0;
 const cx=2400,cy=2400;
 // Gate centre and two walls exactly edge-to-edge; door cuts 2 segments.
 const vertical=facing>=2;
 const along=(v)=>({x:cx+(vertical?0:v),y:cy+(vertical?v:0)});
 const center=along(0);
 const gate=site(90001,'wallGate',center.x,center.y,facing,owner);
 const left=along(-163.5),right=along(163.5);
 const leftWall=site(90002,'wall',left.x,left.y,facing,owner);
 const rightWall=site(90003,'wall',right.x,right.y,facing,owner);
 g.bases=[leftWall,gate,rightWall];
 g.units=[];g.status='playing';g.credits[0]=5000;
 const across=(v)=>({x:center.x+(vertical?v:0),y:center.y+(vertical?0:v)});
 const start=across(-185),goal=across(185);
 if(vertical){start.y+=offset;goal.y+=offset;}
 else {start.x+=offset;goal.x+=offset;}
 const unit=g.spawn(owner,start,kind);
 g.spatial.rebuild(g.units);
 return {g,unit,gate,leftWall,rightWall,start,goal,center};
}

test('owner navigation keeps only real solid gate PYLONS, not the entire door',()=>{
 const {g,gate,leftWall,rightWall,center}=setup('tank',0);
 const posts=friendlyGatePostColliders(g.bases,0);
 assert.equal(posts.length,2);
 assert.deepEqual(posts.map(p=>p.x),[center.x-102,center.x+102]);
 assert.ok(posts.every(p=>p.y===center.y&&p.radius>=7&&p.radius<=12));
 assert.equal(friendlyGatePostColliders(g.bases,1).length,0,
  'enemy never treats an opposing gate as open');
 assert.ok(!g.navigationBases(0).includes(gate));
 assert.ok(g.navigationBases(1).includes(gate));
 const physical=g.movingColliders().byOwner[0];
 assert.ok(posts.every(p=>physical.vehicle.some(o=>distance(o,p)<.001)));
 assert.ok(posts.every(p=>physical.infantry.some(o=>distance(o,p)<.001)));
 assert.ok(wallColliderSamples(leftWall).length===3);
 assert.ok(wallColliderSamples(rightWall).length===3);
 const clearance=UNITS.tank.radius-10;
 assert.ok(g.world.line({x:center.x,y:center.y-140},{x:center.x,y:center.y+140},
  physical.vehicle,clearance),'centre stays safely open for a heavy tank');
 assert.equal(g.world.line({x:center.x+95,y:center.y-140},{x:center.x+95,y:center.y+140},
  physical.vehicle,clearance),false,'heavy vehicle cannot collide with right pylon');
});

for(const facing of [0,2])for(const kind of ['tank','rover','artillery']){
 for(const offset of [0,75,-75]){
 test(kind+' crosses double steel gate facing '+facing+' lane '+offset,()=>{
  const {g,unit,goal,center}=setup(kind,offset,facing);
  const route=g.movingColliders().byOwner[0].vehicle;
  const clearance=UNITS[kind].radius-10;
  const path=g.world.path(unit,goal,route,clearance,undefined,false,true,true,
   kind==='tank'?.215:kind==='artillery'?.185:.195);
  assert.ok(path.length>0,'vehicle must find a legal gate route');
  for(let tick=0;tick<400;tick++){
   g.time=tick*.05;g.move(unit,goal,.05);
   if(distance(unit,goal)<12)break;
  }
  assert.ok(distance(unit,goal)<25,
   kind+' stranded at the gate: '+JSON.stringify({
    from:unit,goal,path,center
   }).slice(0,1400));
 });
 }
}

test('complete friendly gate with no adjacent wall still permits a tank',()=>{
 const {g,unit,gate,goal}=setup('tank',0);
 g.bases=[gate];g.movementCollision=undefined;
 for(let i=0;i<310;i++){g.time=i*.05;g.move(unit,goal,.05);}
 assert.ok(distance(unit,goal)<25,'gate alone does not obstruct the tank');
});

test('unfinished owner gate and complete enemy gate never create an open breach',()=>{
 const {g,gate,unit,goal}=setup('tank',0);
 gate.buildRemaining=3;
 assert.equal(friendlyGatePostColliders(g.bases,0).length,0);
 assert.ok(g.navigationBases(0).includes(gate));
 const physical=g.movingColliders().byOwner[0].vehicle;
 assert.ok(!g.world.line(unit,goal,physical,UNITS.tank.radius-10));
 gate.buildRemaining=0;gate.owner=1;g.movementCollision=undefined;
 assert.ok(g.navigationBases(0).includes(gate));
 assert.ok(!g.world.line(unit,goal,g.movingColliders().byOwner[0].vehicle,
  UNITS.tank.radius-10));
});

test('selected mixed vehicle squad follows real move orders OUT through friendly gate',()=>{
 const {g,unit:lead,center}=setup('tank',-45);
 // Two vehicles and accompanying infantry are selected in the same command.
 const rover=g.spawn(0,{x:center.x+55,y:center.y-225},'rover');
 const artillery=g.spawn(0,{x:center.x+10,y:center.y-290},'artillery');
 const infantry=g.spawn(0,{x:center.x-20,y:center.y-310},'infantry');
 g.spatial.rebuild(g.units);
 const members=[lead,rover,artillery,infantry];
 const count=g.command(members.map(u=>u.id),{
  kind:'move',x:center.x,y:center.y+280
 });
 assert.equal(count,4,'actual multi-selection command accepted');
 assert.ok(members.every(u=>u.orders.length===1));
 for(let i=0;i<540;i++){
  g.time=i*.05;
  for(const u of members){
   if(!u.orders.length)continue;
   u.repath=Math.max(0,u.repath-.05);
   g.move(u,u.orders[0],.05);
  }
  g.spatial.rebuild(g.units);
 }
 for(const u of members)assert.ok(u.y>center.y+40,
  u.kind+' remained behind/open gate after selected move: '+JSON.stringify({
   kind:u.kind,x:u.x,y:u.y,orders:u.orders,path:u.path
  }).slice(0,850));
});
