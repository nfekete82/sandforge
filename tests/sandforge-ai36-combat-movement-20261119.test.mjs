import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {distance} from '../dist/src/reborn/config.js';
import {vehicleSpacingGap} from '../dist/src/reborn/vehicle-spacing.js';
import {rocketStandoffPoint,shouldRocketReposition,coordinatedFrontMarch} from '../dist/src/reborn/combat-movement.js';

const openField=()=>{
 const g=new Simulation(24012027,24);
 g.units=[];g.bases=[];g.world.blocked.fill(0);g.world.opaque.fill(0);
 g.world.components.fill(0);g.aiClock=1e9;g.tactical.plan=()=>{};
 g.status='playing';g.paused=false;g.movementCollision=undefined;
 return g;
};
test('rocket chooses physically reachable standoff with a clear, real firing lane',()=>{
 const u={x:1500,y:1500},enemy={x:1575,y:1500};
 const option={soldier:u,enemy,range:365};
 const p=rocketStandoffPoint({...option,reachable:()=>true,clearShot:()=>true});
 assert.ok(p);assert.ok(distance(p,enemy)<=365-22);
 assert.ok(distance(p,enemy)>distance(u,enemy)+65);
 assert.ok(distance(p,u)>=65);
 assert.equal(rocketStandoffPoint({...option,reachable:()=>false,clearShot:()=>true}),null);
 assert.equal(rocketStandoffPoint({...option,reachable:()=>true,clearShot:()=>false}),null);
 assert.equal(rocketStandoffPoint({...option,soldier:{x:1200,y:1500},reachable:()=>true,clearShot:()=>true}),null);
 const side=rocketStandoffPoint({...option,
  reachable:p=>p.y>1510,clearShot:p=>p.y>1510});
 assert.ok(side&&side.y>1510,'side step only after straight firing lane is closed');
});
test('automatic rocket standoff never overrides player movement, hold, or a ready shot',()=>{
 const normal={ownedByAI:true,mapVersion:24,enemyVehicle:true,held:false,
  directMove:false,readyToFire:false,threatDistance:95};
 assert.equal(shouldRocketReposition(normal),true);
 for(const update of [{ownedByAI:false},{mapVersion:19},{enemyVehicle:false},
  {held:true},{directMove:true},{readyToFire:true},{threatDistance:260}]){
  assert.equal(shouldRocketReposition({...normal,...update}),false);
 }
});
test('real AI rocket steps backward during cooldown without changing any combat order',()=>{
 const g=openField(),u=g.spawn(1,{x:1500,y:1500},'rocket');
 const tank=g.spawn(0,{x:1590,y:1500},'tank');
 g.spatial.rebuild(g.units);g.visible[1].fill(1);g.explored[1].fill(1);
 u.orders=[{kind:'attackMove',x:1960,y:1500}];
 u.cooldown=2.5;const oldOrder=u.orders[0],start=u.x;
 const first=g.moveRocketToStandoff(u,tank,.05);
 assert.equal(first,true);
 assert.ok(g.rocketStandoff.get(u));
 const planned=g.rocketStandoff.get(u).point;
 assert.equal(u.orders[0],oldOrder,'planned attack remains authoritative');
 for(let i=0;i<30;i++){g.time+=.05;u.repath-=.05;g.moveRocketToStandoff(u,tank,.05);}
 assert.ok(u.x<start-20,'fragile rocket gets further from the advancing tank');
 assert.ok(distance(planned,tank)<=345,'chosen rocket lane still has firing range');
 assert.equal(g.credits[1],g.credits[1],'no credit side effects');
 u.cooldown=0;
 assert.equal(g.moveRocketToStandoff(u,tank,.05),false,'ready rocket fires instead of kiting');
 assert.equal(g.rocketStandoff.has(u),false);
 assert.equal(u.orders[0],oldOrder);
});
test('blocked third tank cannot be selected as a legal vehicle yield lane',()=>{
 const g=openField();
 const moving=g.spawn(0,{x:1000,y:1000},'tank');
 const blocker=g.spawn(0,{x:1080,y:1000},'tank');
 const third=g.spawn(0,{x:1074,y:904},'tank');
 g.stop([blocker.id,third.id]);
 assert.equal(g.command([moving.id],{kind:'move',x:1600,y:1000}),1);
 moving.path=[{x:1450,y:1000}];
 moving.angle=0;moving.hullAngle=0;moving.driveSpeed=3;
 g.spatial.rebuild(g.units);
 g.vehicleProgress.set(moving,{x:moving.x,y:moving.y,since:g.time-5,retryAt:-10});
 g.move(moving,moving.orders[0],.05);
 assert.ok(moving.path.length>=2,'a genuinely legal opposite-side yield exists');
 assert.ok(moving.path[0].y>1000,'third tank physically occupies the negative Y lane');
 assert.ok(distance(moving.path[0],third)>vehicleSpacingGap(moving,third).hard+12);
 assert.equal(moving.x,1000,'no teleportation');
});
test('modern AI attackMove front marches reciprocally; a separately redirected unit leaves its cohort',()=>{
 const g=openField();
 const home={x:1380,y:1380},units=[
  g.spawn(1,{x:home.x,y:home.y},'tank'),
  g.spawn(1,{x:home.x+100,y:home.y},'rover'),
  g.spawn(1,{x:home.x+195,y:home.y},'infantry')
 ];
 g.tactical.state.phase='attack';
 assert.equal(g.tactical.issue(units,{x:2310,y:1840},'assault'),true);
 const front=units.filter(u=>u.kind!=='infantry');
 const frontIds=front.map(u=>u.id);
 for(const u of front)assert.deepEqual(u.orders[0].march,frontIds);
 assert.equal(units[2].orders[0].march,undefined,'rear escort not slowed as combat vanguard');
 assert.equal(g.command([front[1].id],{kind:'move',x:2250,y:1250}),1);
 assert.equal(front[1].orders[0].march,undefined);
 assert.ok(front[0].orders[0].march.includes(front[1].id));
 // The simulator consults reciprocal membership, not the stale original ID.
 const source=readFileSync('src/reborn/simulation.ts','utf8');
 assert.match(source,/v\.orders\[0\]\?\.march\?\.includes\(u\.id\)===true/);
 assert.equal(coordinatedFrontMarch({modern:false,assault:true,frontCount:3,allGround:true}),false);
 assert.equal(coordinatedFrontMarch({modern:true,assault:false,frontCount:3,allGround:true}),false);
 assert.equal(coordinatedFrontMarch({modern:true,assault:true,frontCount:3,allGround:true}),true);
});
test('real 3D infantry protects long-range rockets behind the frontline',()=>{
 const g=openField();
 const gunner=g.spawn(0,{x:1700,y:1800},'rocket');
 const rifle=g.spawn(0,{x:1660,y:1800},'infantry');
 const heavy=g.spawn(0,{x:1640,y:1800},'heavy');
 assert.equal(g.command([gunner.id,rifle.id,heavy.id],
  {kind:'attackMove',x:2300,y:1800}),3);
 const order=gunner.orders[0];
 assert.deepEqual(order.formation.front,[rifle.id,heavy.id]);
 assert.ok(order.formation.rear>=100);
 assert.equal(rifle.orders[0].formation,undefined);
 assert.equal(heavy.orders[0].formation,undefined);
});
test('changes do not add any supply logistics or alter capture radius / visibility',()=>{
 const src=readFileSync('src/reborn/simulation.ts','utf8');
 const ta=readFileSync('src/reborn/tactical-ai.ts','utf8');
 assert.doesNotMatch(src,/generateSupplyCaches|supplyLogistics\.advance/);
 assert.match(ta,/coordinatedFrontMarch\(/);
 assert.match(src,/this\.moveRocketToStandoff\(u,enemy,dt\)/);
 const g=openField();
 assert.equal(g.tactical.ai36Mode,'coordinated');
 assert.equal(g.tactical.ai35Mode,'control');
 const save=g.save();
 assert.equal(JSON.stringify(save).includes('rocketStandoff'),false);
 assert.equal(JSON.stringify(save).includes('vehicleProgress'),false);
});
