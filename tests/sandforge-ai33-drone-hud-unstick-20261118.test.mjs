import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {createReconDrone} from '../dist/webgl-recon-drone.js';

test('R-01 HUD renders actual detailed 3D model, centred with generous rotor margins',()=>{
 const src=readFileSync('scripts/webgl-portraits.js','utf8');
 assert.match(src,/import \{createReconDrone\} from '.\/webgl-recon-drone\.js'/);
 assert.match(src,/renderModelPortrait\(createReconDrone\(0\),renderer,/);
 assert.match(src,/\{width:192,height:132,droneCard:true\}/);
 assert.match(src,/Math\.min\(width\*\.76\/w,height\*\.80\/h\)/);
 assert.match(src,/droneUnitIconFallback\(\)/);
 const drone=createReconDrone(0);
 assert.ok(drone.getObjectByName('R01_Hull'));
 assert.ok(drone.getObjectByName('R01_Camera_Gimbal'));
 assert.equal(drone.userData.rotors.length,4);
});
const scene=()=>{
 const g=new Simulation(20261118,24);
 g.aiClock=-1e8;g.world.blocked.fill(0);g.world.opaque.fill(0);
 const hq=g.bases.find(b=>b.owner===1&&b.kind==='headquarters'&&b.hp>0);
 assert.ok(hq,'AI headquarters available');
 const worker=g.units.find(u=>u.owner===1&&u.kind==='engineer'&&u.hp>0);
 assert.ok(worker,'AI engineer available');
 const site={...hq,buildRemaining:22};
 return {g,worker,site};
};
test('AI pioneer recovers a stalled build approach; no teleport, credit or site changes',()=>{
 const {g,worker,site}=scene();
 const order={kind:'build',target:site.id,x:site.x,y:site.y,
  approach:{x:site.x,y:site.y}};
 worker.orders=[order];worker.x=site.x+site.radius+240;worker.y=site.y+40;
 const pos={x:worker.x,y:worker.y},credits=[...g.credits];
 g.time=0;assert.equal(g.recoverStalledAiBuilder(worker,site,order),false);
 g.time=6;assert.equal(g.recoverStalledAiBuilder(worker,site,order),false);
 assert.equal(worker.orders[0],order);
 assert.equal(worker.repath,0);
 assert.equal(worker.exactPath,true);
 assert.notDeepEqual(order.approach,{x:site.x,y:site.y});
 assert.deepEqual({x:worker.x,y:worker.y},pos);
 assert.deepEqual(g.credits,credits);
 assert.equal(site.buildRemaining,22);
});
test('AI construction watchdog never interrupts work, recent combat or player workers',()=>{
 const {g,worker,site}=scene(),order={kind:'build',target:site.id,x:site.x,y:site.y};
 worker.orders=[order];worker.x=site.x+site.radius+5;worker.y=site.y;
 g.time=12;
 assert.equal(g.recoverStalledAiBuilder(worker,site,order),false);
 assert.equal(worker.orders[0],order);
 worker.x=site.x+site.radius+240;worker.defendUntil=100;
 g.time=70;assert.equal(g.recoverStalledAiBuilder(worker,site,order),false);
 assert.equal(worker.orders[0],order);
 const player={...worker,owner:0,orders:[{...order}]};
 assert.equal(g.recoverStalledAiBuilder(player,site,player.orders[0]),false);
});
test('AI attackMove watchdog repaths before abandoning an unreachable stale order',()=>{
 const {g,worker}=scene();
 const fighter=g.spawn(1,{x:worker.x+100,y:worker.y+100},'infantry');
 const order={kind:'attackMove',x:Math.min(g.world.size-200,fighter.x+650),
  y:Math.min(g.world.size-200,fighter.y+650)};
 fighter.orders=[order];
 const before={x:fighter.x,y:fighter.y};g.time=0;
 assert.equal(g.recoverStalledAiRoute(fighter,order),false);
 g.time=7;assert.equal(g.recoverStalledAiRoute(fighter,order),false);
 assert.equal(fighter.orders.length,1,'first recovery never cancels a combat mission');
 assert.equal(fighter.exactPath,true);assert.equal(fighter.repath,0);
 g.time=14;assert.equal(g.recoverStalledAiRoute(fighter,order),false);
 g.time=21;assert.equal(g.recoverStalledAiRoute(fighter,order),true);
 assert.equal(fighter.orders.length,0,'after 18 seconds unblocked orders can be replanned');
 assert.deepEqual({x:fighter.x,y:fighter.y},before);
});
test('movement watchdog skips drones, active skirmishes and deliberately held troops',()=>{
 const {g,worker}=scene(),fighter=g.spawn(1,{x:worker.x+100,y:worker.y+100},'infantry');
 const order={kind:'attackMove',x:fighter.x+400,y:fighter.y};
 fighter.orders=[order];fighter.hold=true;
 g.time=80;assert.equal(g.recoverStalledAiRoute(fighter,order),false);
 fighter.hold=false;fighter.combatTarget=1234;
 assert.equal(g.recoverStalledAiRoute(fighter,order),false);
 fighter.combatTarget=null;fighter.defendUntil=100;
 assert.equal(g.recoverStalledAiRoute(fighter,order),false);
});
