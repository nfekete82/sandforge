import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {RULES} from '../dist/src/reborn/config.js';

const TICK=RULES.tick;
function fixture(version=24,seed=2026){
 const game=Simulation.campaign(seed,version,'dunes');
 // No strategic AI orders or troop production can interfere with the physical
 // capture check. Capture itself still runs in the regular 20 Hz simulation.
 game.tactical.plan=()=>{};
 game.aiClock=-1e8;
 const sector=game.territories.find(t=>t.owner===-1);
 assert.ok(sector,'a neutral Bastion exists');
 const obstacles=[...game.obstacles(),...game.bastionColliders()];
 function at(radius){
  for(let a=0;a<24;a++){
   const angle=a*Math.PI/12;
   const p={x:sector.point.x+radius*Math.cos(angle),
    y:sector.point.y+radius*Math.sin(angle)};
   if(game.world.walkable(p,obstacles))return p;
  }
  assert.fail('no accessible position at radius '+radius);
 }
 return {game,sector,at};
}
function advance(game,seconds){
 for(let i=0;i<Math.ceil(seconds/TICK);i++)game.step(TICK);
}

test('a stationary infantry unit standing visibly beside a Bastion captures without any click',()=>{
 assert.equal(RULES.captureRadius,155,'nearby physical capture radius');
 for(const version of [24,25,26]){
  const {game,sector,at}=fixture(version);
  const soldier=game.spawn(0,at(128),'infantry');
  game.stop([soldier.id],true);
  assert.equal(soldier.orders.length,0,'unit has no capture/move order');
  assert.equal(game.captureReadiness(sector,0),'capturing',
   'idle soldier inside the enlarged circle is already eligible');
  advance(game,TICK);
  assert.ok(sector.progress>0,'capture begins during the next fixed tick');
  advance(game,RULES.captureTime+.5);
  assert.equal(sector.owner,0,'standing near the Bastion is enough to own it');
  assert.equal(soldier.orders.length,0,'no repeated right-click required');
 }
});

test('a stopped squad just outside 155 units does not capture without moving closer',()=>{
 const {game,sector,at}=fixture();
 const soldier=game.spawn(0,at(RULES.captureRadius+32),'infantry');
 game.stop([soldier.id],true);
 assert.equal(game.captureReadiness(sector,0),'out-of-range');
 advance(game,RULES.captureTime+1);
 assert.equal(sector.owner,-1);
 assert.equal(sector.progress,0);
});

test('a contested nearby Bastion cannot silently flip while opposing infantry stands next to it',()=>{
 const {game,sector,at}=fixture();
 const blue=game.spawn(0,at(116),'infantry');
 const red=game.spawn(1,at(130),'infantry');
 game.stop([blue.id,red.id],true);
 // Prevent combat from removing the deliberate second claimant while
 // proving both remain physically in the capture circle.
 game.tactical.plan=()=>{};
 assert.equal(game.captureReadiness(sector,0),'contested');
 // Ordinary damage may kill a claimant if both are close. Check that there
 // is no progress before combat has time to kill anyone.
 game.step(TICK);
 assert.equal(sector.progress,0);
 assert.equal(sector.owner,-1);
});

test('a living enemy headquarters still blocks automatic nearby capture',()=>{
 // The campaign bootstrap starts without an HQ; use the completed-base
 // simulation fixture to test the actual living HQ capture lock.
 const game=new Simulation(2026,24);
 game.tactical.plan=()=>{};game.aiClock=-1e8;
 const enemyHQ=game.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 assert.ok(enemyHQ);
 const sector=game.territories[enemyHQ.territory];
 const player=game.spawn(0,{x:sector.point.x+112,y:sector.point.y},'infantry');
 game.stop([player.id],true);
 assert.equal(game.captureReadiness(sector,0),'enemy-hq');
 advance(game,RULES.captureTime+1);
 assert.equal(sector.owner,1,'HQ lock remains intact');
});

test('move into nearby ground without targeting the Bastion centre auto-captures',()=>{
 const {game,sector,at}=fixture();
 const soldier=game.spawn(0,at(214),'infantry');
 const destination=at(125);
 assert.ok(game.command([soldier.id],{...destination,kind:'move'})>0);
 let sawProgress=false;
 for(let i=0;i<410&&sector.owner!==0;i++){
  game.step(TICK);
  sawProgress||=sector.progress>0;
 }
 assert.ok(sawProgress,'walking to nearby ground begins capture automatically');
 assert.equal(sector.owner,0,'no additional Bastion click needed');
});
