import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {World} from '../dist/src/reborn/world.js';
import {BUILDINGS,UNITS} from '../dist/src/reborn/catalog.js';
import {airfieldPoint,airfieldGroundStructureColliders} from '../dist/src/reborn/airfield-maintenance.js';
import {infantryStructureColliders} from '../dist/src/reborn/infantry-structure-collision.js';
import {vehicleStructureColliders} from '../dist/src/reborn/vehicle-structure-collision.js';
import {HELICOPTER_LOADING_TIMEOUT} from '../dist/src/reborn/transports.js';
import {BOARDABLE_INFANTRY,selectedInfantryForTransport,selectedCarrierForPickup,selectedTransportManifest}
 from '../scripts/webgl-transport-controls.js';

function arena(){
 const g=new Simulation(261116,4);
 g.aiClock=1e8;g.units=[];g.bases=[];
 // This synthetic transport arena has NEVER had buildings. The constructor
 // started with real HQs; clearing those fixtures must also clear the new
 // persistent 'ever built' flags, otherwise both factions lose on tick one.
 g.hadBuildings=[false,false];
 g.world.blocked.fill(0);g.world.opaque.fill(0);
 g.world.components.fill(0);g.status='playing';g.paused=false;
 g.tactical.plan=()=>{};
 const observer=g.spawn(1,{x:310,y:300},'infantry');
 g.stop([observer.id],true);
 return g;
}

test('structure-free transport test arena remains playable for both surviving armies',()=>{
 const g=arena(),blue=g.spawn(0,{x:1800,y:2000},'infantry');
 assert.deepEqual(g.hadBuildings,[false,false]);
 for(let i=0;i<15;i++)g.step(.05);
 assert.equal(g.status,'playing','HQ-less transport arena cannot finish before boarding');
 assert.ok(g.units.some(u=>u.id===blue.id&&u.hp>0));
 assert.ok(g.units.some(u=>u.owner===1&&u.hp>0));
});
test('rocket soldiers have the same helicopter eligibility as other ground infantry',()=>{
 assert.equal(BOARDABLE_INFANTRY.has('rocket'),true);
 const h={id:80,kind:'scout',owner:0,hp:360};
 const units=[
  {id:1,kind:'rocket',owner:0,hp:90},
  {id:2,kind:'infantry',owner:0,hp:100},
  {id:3,kind:'rocket',owner:1,hp:90},
  {id:4,kind:'tank',owner:0,hp:1000}
 ];
 assert.deepEqual(selectedInfantryForTransport(units,new Set([1,2,3,4]),h),[1,2]);
 assert.ok(HELICOPTER_LOADING_TIMEOUT>12,'a loaded helicopter waits for troops routing around walls');
});

test('manifest distinguishes occupied, reserved and genuinely available seats',()=>{
 const h={id:70,kind:'scout',owner:0,hp:360,
  transport:{cargo:[1,2],pickup:[3,4,5],phase:'loading',task:'load'}};
 const u=[h,
  {id:1,kind:'infantry',owner:0,hp:90,carrier:70},
  {id:2,kind:'rocket',owner:0,hp:95,carrier:70},
  {id:3,kind:'infantry',owner:0,hp:100}];
 const m=selectedTransportManifest(u,new Set([70]));
 assert.equal(m.capacity,10);assert.equal(m.occupied,2);
 assert.equal(m.pending,3);assert.equal(m.available,5);
 assert.equal(m.slots[0].id,1);assert.equal(m.slots[1].kind,'rocket');
 assert.ok(m.slots.slice(2).every(s=>s===null));
 const ui=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(ui,/manifest.pending\?' · '/);
 assert.match(ui,/manifest.available\+' FREI/);
 assert.match(ui,/rocket:'RAK'/);
});

test('partial helicopter load accepts more rocket soldiers in a second boarding round',()=>{
 const g=arena();
 const h=g.spawn(0,{x:1800,y:2000},'scout');
 const troops=Array.from({length:3},(_,i)=>g.spawn(0,
  {x:1730+i*18,y:1970+i*9},i===0?'rocket':'infantry'));
 const order={kind:'board',target:h.id,x:h.x,y:h.y};
 assert.equal(g.command(troops.map(u=>u.id),order),3);
 for(let i=0;i<670&&(h.transport?.cargo.length??0)<3;i++)g.step(.05);
 assert.equal(h.transport?.cargo.length,3,'initial rocket soldier and two rifles board');
 for(let i=0;i<100&&h.transport?.phase!=='cruise';i++)g.step(.05);
 const fresh=Array.from({length:2},(_,i)=>g.spawn(0,
  {x:h.x+70+i*17,y:h.y+35},i===0?'rocket':'medic'));
 assert.equal(g.command(fresh.map(u=>u.id),order),2,
  'seven genuinely free seats accept another boarding order');
 for(let i=0;i<670&&(h.transport?.cargo.length??0)<5;i++)g.step(.05);
 assert.equal(h.transport?.cargo.length,5,
  'a second boarding cycle must retain the three previous passengers');
 assert.equal(g.units.filter(u=>u.carrier===h.id).length,5);
 assert.ok(h.transport.cargo.includes(troops[0].id));
 assert.ok(h.transport.cargo.includes(fresh[0].id));
});

test('helicopter parked for airfield maintenance departs safely before a new pickup',()=>{
 const g=arena();
 const original=new Simulation(261116,4).bases[0];
 const hangar={...original,id:8900,kind:'airfield',owner:0,
  x:1900,y:2000,facing:0,radius:BUILDINGS.airfield.radius,
  hp:BUILDINGS.airfield.hp,buildRemaining:0,queue:[],queueTypes:[],
  queueCosts:[],production:0,rally:null};
 g.bases.push(hangar);
 const dock=airfieldPoint(hangar,'dock');
 const h=g.spawn(0,dock,'scout');
 h.airfieldService={baseId:hangar.id,bay:0,phase:'ready',
  elapsed:0,paidHp:0};
 h.flightHeight=0;
 const trooper=g.spawn(0,{x:hangar.x+260,y:hangar.y+160},'rocket');
 const boarded=g.command([trooper.id],{kind:'board',target:h.id,x:h.x,y:h.y});
 assert.equal(boarded,1,'free helicopter seat accepts rocket soldier while parked');
 assert.equal(h.airfieldService.phase,'takeoff',
  'flightline departure must finish before boarding takes control');
 assert.equal(h.transport.task,'load');
 for(let i=0;i<190&&h.airfieldService;i++)g.step(.05);
 assert.equal(h.airfieldService,undefined,'actual authored takeoff completes');
 assert.equal(h.transport.task,'load','pickup resumes after hangar departure');
});

test('right-click infantry with selected carrier picks the passenger, not the transport',()=>{
 const h={id:30,kind:'scout',owner:0,hp:360};
 const jeep={id:31,kind:'rover',owner:0,hp:295};
 const soldier={id:32,kind:'rocket',owner:0,hp:95};
 const enemy={...soldier,id:33,owner:1};
 assert.equal(selectedCarrierForPickup([h,jeep,soldier],new Set([h.id]),soldier),h);
 assert.equal(selectedCarrierForPickup([h,jeep,soldier],new Set([jeep.id]),soldier),jeep);
 assert.equal(selectedCarrierForPickup([h,jeep,soldier],new Set([h.id,jeep.id]),soldier),null);
 assert.equal(selectedCarrierForPickup([h,jeep,enemy],new Set([h.id]),enemy),null);
 assert.equal(selectedCarrierForPickup([h,jeep,soldier],new Set([h.id]),
  {...soldier,carrier:50}),null);
 assert.equal(selectedCarrierForPickup([h,jeep,soldier],new Set([h.id]),
  {...soldier,kind:'tank'}),null);
 const ui=readFileSync('scripts/webgl-battlefield.js','utf8');
 const pickup=ui.indexOf('selectedCarrierForPickup(this.game.units,this.selected,passenger)');
 const normal=ui.indexOf('const clickedEnemy=event.button===2');
 assert.ok(normal>=0&&pickup>normal,
  'visible enemy detection must precede friendly pickup');
 const pickupBlock=ui.slice(normal,pickup);
 assert.match(pickupBlock,/!clickedEnemy/);
 assert.match(ui,/this\.game\.transports\.collect\(carrier\.id,\[passenger\.id\]\)/);
});

test('carrier travels to clicked rocket soldier, lands/stops and takes him aboard',()=>{
 for(const kind of ['scout','rover']){
  const g=arena();
  const carrier=g.spawn(0,{x:1600,y:1800},kind);
  const soldier=g.spawn(0,{x:2180,y:2030},'rocket');
  const start={x:carrier.x,y:carrier.y};
  assert.equal(g.transports.collect(carrier.id,[soldier.id]),1,
   kind+' must accept a carrier-initiated pickup');
  assert.equal(carrier.transport.task,'load');
  assert.equal(carrier.transport.phase,'approach',
   kind+' must travel toward soldier instead of loading at its origin');
  assert.equal(soldier.orders[0].kind,'board');
  assert.equal(soldier.orders[0].target,carrier.id);
  assert.ok(Math.hypot(carrier.transport.site.x-soldier.x,
    carrier.transport.site.y-soldier.y)<120,
   'pickup site should be near clicked passenger, not the carrier');
  for(let i=0;i<1200&&!soldier.carrier;i++)g.step(.05);
  assert.equal(soldier.carrier,carrier.id,kind+' actually collects passenger');
  assert.ok(carrier.transport.cargo.includes(soldier.id));
  assert.ok(Math.hypot(carrier.x-start.x,carrier.y-start.y)>180,
   kind+' must move significantly towards the passenger');
 }
});

test('helicopter cruises 10 percent faster without changing bomber or Humvee speeds',()=>{
 assert.equal(UNITS.scout.speed,220);
 assert.equal(UNITS.bomber.speed,350);
 assert.equal(UNITS.rover.speed,235);
});

test('all four rotated hangars block walking through roof, while runway remains traversable',()=>{
 const world=new World(261116,4);
 world.blocked.fill(0);world.components.fill(0);
 for(const facing of [0,1,2,3]){
  const b={id:33000+facing,kind:'airfield',owner:0,x:2100,y:2150,
   facing,radius:BUILDINGS.airfield.radius,hp:1200,buildRemaining:0};
  const infantry=infantryStructureColliders([b]);
  const vehicles=vehicleStructureColliders([b]);
  assert.equal(infantry.length,4);assert.equal(vehicles.length,4);
  const dock=airfieldPoint(b,'dock');
  assert.equal(world.walkable(dock,infantry,0),false,
   'roof/interior is not a legal infantry destination at facing '+facing);
  assert.equal(world.walkable(dock,vehicles,12),false,
   'vehicles must not clip through the hangar at facing '+facing);
  const runway=airfieldPoint(b,'approach');
  assert.equal(world.walkable(runway,infantry,0),true,
   'painted runway remains walkable despite solid hangar at facing '+facing);
  const solid=airfieldGroundStructureColliders(b)[0];
  const a={x:solid.x-210,y:solid.y},z={x:solid.x+210,y:solid.y};
  const obstacles=[b,...infantry];
  assert.equal(world.line(a,z,obstacles),false,
   'a straight shortcut across the hangar must be blocked');
  const path=world.path(a,z,obstacles,0,undefined,false,true);
  assert.ok(path.length>0,'pathfinder finds a detour for orientation '+facing);
  let from=a;
  for(const p of path){
   assert.ok(world.line(from,p,obstacles),
    'path segment must go around solid facade (orientation '+facing+')');
   from=p;
  }
 }
});
