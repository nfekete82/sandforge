import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {BUILDINGS,UNITS} from '../dist/src/reborn/catalog.js';
import {visualBuildingScale,FACTORY_VISUAL_SCALE} from '../scripts/webgl-scale.js';
import {selectedMaintenanceKind,serviceFootprintContains}
 from '../scripts/webgl-maintenance-input.js';

function noEnemies(){
 const game=new Simulation(2074,4);
 game.aiClock=1e8;
 game.tactical.plan=()=>{};
 game.world.blocked.fill(0);game.world.opaque.fill(0);
 const hostile=game.units.filter(u=>u.owner===1);
 for(const u of hostile)game.unitById.delete(u.id);
 game.units=game.units.filter(u=>u.owner===0);
 game.spatial.rebuild(game.units);
 game.credits[0]=10000;
 return game;
}
const step=(game,seconds)=>{for(let i=0;i<Math.round(seconds/.05);i++)game.step(.05);};

test('smaller factory uses rendering scale only, never changes gameplay radius or build width',()=>{
 assert.equal(FACTORY_VISUAL_SCALE,.92);
 assert.equal(visualBuildingScale('factory'),.92);
 assert.equal(visualBuildingScale('headquarters'),.92);
 assert.equal(visualBuildingScale('airfield'),1);
 assert.equal(BUILDINGS.factory.width,200);
 assert.equal(BUILDINGS.factory.radius,70);
 const field=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(field,/calibratedScale\(entry\.kind,type,dims,desired\)/);
 assert.match(field,/calibratedScale\(kind,'building',size,spec\.width\)/);
});
test('garage lift and factory repair controls are absent from game and construction ghost',()=>{
 const field=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.doesNotMatch(field,/createFactoryServiceYard\(/);
 assert.doesNotMatch(field,/updateFactoryServiceYard\(/);
 assert.doesNotMatch(field,/data-action="factory-(?:repair|release|auto)/);
 assert.doesNotMatch(field,/action==='factory-(?:repair|release|auto)/);
 assert.match(field,/disposeFactoryServiceYard/);
 assert.match(field,/data-action="hangar-repair-all"/);
});
test('ground vehicles cannot return to factory for free or paid healing',()=>{
 const game=noEnemies();
 const factory={id:37190,kind:'factory',owner:0,x:2400,y:2100,
  territory:0,hp:1100,buildRemaining:0,queue:[],queueTypes:[],
  production:0,cooldown:0,radius:70};
 game.bases.push(factory);
 const tank=game.spawn(0,{x:2370,y:2140},'tank');
 tank.hp=UNITS.tank.hp*.4;
 const hp=tank.hp,credits=game.credits[0];
 assert.equal(game.requestFactoryRepair([tank.id]),0);
 assert.equal(game.setAutoFactoryRepair([tank.id],true),0);
 assert.equal(tank.factoryService,undefined);
 step(game,.5);
 assert.equal(tank.hp,hp,'factory must not heal any HP');
 assert.equal(game.credits[0],credits,'factory repair cannot consume credits');
 assert.equal(tank.autoFactoryRepair,undefined);
});
test('engineer repairs ground vehicles directly on battlefield, without factory service',()=>{
 const game=noEnemies();
 const tank=game.spawn(0,{x:2300,y:2100},'tank');
 const pioneer=game.spawn(0,{x:2314,y:2100},'engineer');
 tank.hp=UNITS.tank.hp*.45;
 const before=tank.hp;
 game.spatial.rebuild(game.units);
 pioneer.orders=[{kind:'repair',target:tank.id,x:tank.x,y:tank.y}];
 step(game,1);
 assert.ok(tank.hp>before,'Pionier must heal tank');
 assert.equal(tank.factoryService,undefined);
 assert.equal(tank.autoFactoryRepair,undefined);
});
test('old save games release already parked vehicles without regenerating repair platform',()=>{
 const game=noEnemies();
 const tank=game.spawn(0,{x:2300,y:2150},'tank');
 tank.hp=500;
 tank.factoryService={baseId:111,bay:0,phase:'repair',paidHp:0};
 tank.autoFactoryRepair=true;
 const loaded=Simulation.load(game.save());
 const restored=loaded.units.find(u=>u.id===tank.id);
 assert.ok(restored);
 assert.equal(restored.factoryService,undefined);
 assert.equal(restored.autoFactoryRepair,undefined);
 assert.equal(restored.hp,500);
});
test('vehicle right click is normal order, airfield service remains supported',()=>{
 const vehicle={id:11,kind:'tank',owner:0,hp:100};
 const plane={id:12,kind:'bomber',owner:0,hp:100};
 assert.equal(selectedMaintenanceKind([vehicle],new Set([11])),null);
 assert.equal(selectedMaintenanceKind([plane],new Set([12])),'airfield');
 assert.equal(serviceFootprintContains({kind:'factory',x:300,y:300},{x:300,y:300}),false);
 assert.equal(serviceFootprintContains({kind:'airfield',x:300,y:300},{x:300,y:300}),true);
});
