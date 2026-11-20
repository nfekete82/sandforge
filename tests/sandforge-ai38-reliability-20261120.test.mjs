import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {newCampaign,chooseMission} from '../dist/src/reborn/campaign-commander.js';
import {ai38InfrastructurePlan,ai38DecisiveAssault}
 from '../dist/src/reborn/ai38-investment-doctrine.js';
import {ai38VehicleRecoveryWaypoint,ai38CanRecoverVehicle}
 from '../dist/src/reborn/ai38-vehicle-navigation.js';

const macro={
 time:225,income:83,ownedBastions:4,fieldFighters:13,availableInfantry:7,
 headquartersReady:true,barracksReady:true,factoryReady:true,
 bunkerCount:0,hasUpgradeTarget:true,homeThreat:false,finishing:false
};
test('KI 3.8 reserves actual earned credits for ONE paid Bunker',()=>{
 assert.deepEqual(ai38InfrastructurePlan(macro),
  {goal:'bunker',reserve:850,minFreeAfterPurchase:200});
 assert.deepEqual(ai38InfrastructurePlan({...macro,bunkerCount:1}),
  {goal:'bastion-upgrade',reserve:1000,minFreeAfterPurchase:250});
 for(const small of [
  {...macro,fieldFighters:4},{...macro,availableInfantry:1},
  {...macro,ownedBastions:1},{...macro,homeThreat:true},
  {...macro,finishing:true},{...macro,factoryReady:false},
  {...macro,income:39}
 ])assert.equal(ai38InfrastructurePlan(small).reserve,0);
 assert.equal(ai38InfrastructurePlan({...macro,bunkerCount:1,
  hasUpgradeTarget:false}).goal,null);
});

test('KI 3.8 breakthrough requires verified target, 2/3 control and paid siege escorts',()=>{
 const base={
  time:260,totalBastions:12,ownedBastions:8,
  visibleOrRememberedHQ:true,mobileFighters:14,healthyMobile:11,
  artillery:2,homeThreat:false,recentLosses:1
 };
 assert.equal(ai38DecisiveAssault(base),true);
 for(const impossible of [
  {...base,ownedBastions:7},{...base,visibleOrRememberedHQ:false},
  {...base,artillery:0},{...base,mobileFighters:4},
  {...base,homeThreat:true},{...base,recentLosses:6},
  {...base,time:120}
 ])assert.equal(ai38DecisiveAssault(impossible),false);
});

test('KI 3.8 chooses a genuinely remembered HQ rather than blindly finishing neutral sectors',()=>{
 const game=new Simulation(824836862,24);
 const enemy=game.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 assert.ok(enemy);
 for(const t of game.territories)if(t.owner===-1)t.owner=1;
 // Preserve at least one enemy-controlled sector plus one neutral.
 game.territories.find(t=>t.owner===1&&t.id!==game.bases.find(b=>b.owner===1&&b.kind==='headquarters').territory).owner=-1;
 const own=game.territories.filter(t=>t.owner===1).length;
 assert.ok(own>=Math.ceil(game.territories.length*2/3));
 game.memories[1]=[{id:enemy.id,owner:0,kind:'headquarters',
  x:enemy.x,y:enemy.y,hp:enemy.hp,territory:enemy.territory}];
 const c=newCampaign(),origin=game.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 const ctx={strategy:'unknown',force:[],losses:[],fronts:[],
  route:()=>({length:400,risk:0}),breakthrough:true,intelligent:true};
 const attack=chooseMission(game,c,origin,ctx);
 assert.equal(attack?.kind,'structure');
 assert.equal(attack?.objective,enemy.id);
 const noIntel={...ctx,breakthrough:false};
 const ordinary=chooseMission(game,newCampaign(),origin,noIntel);
 assert.equal(ordinary?.kind,'capture',
  'ordinary opening still captures public neutral/enemy Bastions first');
});

test('safe vehicle recovery finds a real collision-free side corridor, never teleports',()=>{
 const from={x:500,y:500},goal={x:750,y:500};
 const allowed=p=>p.x>=20&&p.x<=980&&p.y>=20&&p.y<=980&&
   Math.hypot(p.x-600,p.y-500)>=80; // blocked rock immediately ahead
 const left=ai38VehicleRecoveryWaypoint({from,goal,unitId:12,attempt:2,clear:allowed});
 assert.ok(left);
 assert.ok(allowed(left));
 assert.ok(Math.hypot(left.x-from.x,left.y-from.y)<=196);
 assert.ok(Math.abs(left.y-from.y)>45,'use side corridor, not rock face');
 assert.equal(ai38VehicleRecoveryWaypoint({from,goal,unitId:12,attempt:2,
  clear:()=>false}),undefined);
 const base={ai:true,modernMap:true,orderKind:'attackMove',
  turning:false,hasCargo:false,inCombat:false,sinceProgress:4,attempt:1};
 assert.equal(ai38CanRecoverVehicle(base),true);
 assert.equal(ai38CanRecoverVehicle({...base,turning:true}),false);
 assert.equal(ai38CanRecoverVehicle({...base,ai:false}),false);
 assert.equal(ai38CanRecoverVehicle({...base,hasCargo:true}),false);
 assert.equal(ai38CanRecoverVehicle({...base,orderKind:'build'}),false);
});
