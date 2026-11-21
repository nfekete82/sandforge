import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {airfieldPoint,airfieldTaxiPoint,AIRFIELD_REPAIR_HP_PER_CREDIT,AIRFIELD_TAKEOFF_SECONDS} from '../dist/src/reborn/airfield-maintenance.js';
import {factoryRepairPoint,FACTORY_REPAIR_HP_PER_CREDIT} from '../dist/src/reborn/factory-maintenance.js';
import {unitRenderAltitude} from '../scripts/webgl-scale.js';
import {createAirfieldServiceYard,updateAirfieldServiceYard,disposeAirfieldServiceYard} from '../scripts/webgl-airfield-service.js';
import {createFactoryServiceYard,updateFactoryServiceYard,disposeFactoryServiceYard} from '../scripts/webgl-factory-service.js';
import {createBuildingYard,YARD_DECOR_KINDS} from '../scripts/webgl-building-yard.js';
import {serviceVisualGround,approachGroundHeight,AIRFIELD_HANGAR_FLOOR_HEIGHT,FACTORY_LIFT_HEIGHT} from '../scripts/webgl-service-grounding.js';
import {selectedMaintenanceKind,serviceFootprintContains} from '../scripts/webgl-maintenance-input.js';

const base=(game,kind,id,x,y,facing=0)=>{
 const b={id,kind,owner:0,x,y,facing,territory:0,hp:kind==='airfield'?1200:1100,
  buildRemaining:0,queue:[],queueTypes:[],production:0,cooldown:0,rally:null,
  radius:kind==='airfield'?116:70};
 game.bases.push(b);return b;
};
function setup(){
 const g=new Simulation(2074,4);
 g.aiClock=1e8;g.tactical.plan=()=>{};
 g.world.blocked.fill(0);g.world.opaque.fill(0);
 g.credits[0]=10000;
 // Isolate repair movement from enemy gunfire without serializing dead
 // units: a save/load regression below requires a valid living unit roster.
 const hostile=g.units.filter(u=>u.owner===1);
 for(const u of hostile)g.unitById.delete(u.id);
 g.units=g.units.filter(u=>u.owner===0);
 g.spatial.rebuild(g.units);
 const airport=base(g,'airfield',31110,2000,2000);
 // Keep the compact annex well clear of the enemy HQ collider. Real
 // modern-map placement rejects overlapping service sites automatically.
 const garage=base(g,'factory',31111,2400,2000);
 return {g,airport,garage};
}
const advance=(game,seconds)=>{for(let n=0;n<Math.round(seconds/.05);n++)game.step(.05);};

test('compact airfield with single hangar and runway/landing points',()=>{
 const b={x:2000,y:2100,facing:2};
 assert.deepEqual(airfieldPoint(b,'dock',0),airfieldPoint(b,'dock',1),'legacy bay maps to one physical hangar');
 assert.deepEqual(airfieldTaxiPoint(b,0,0),airfieldPoint(b,'touchdown',0));
 assert.deepEqual(airfieldTaxiPoint(b,1,1),airfieldPoint(b,'dock',1));
 assert.deepEqual(factoryRepairPoint(b,0),{x:2045,y:1908});
 assert.deepEqual(factoryRepairPoint(b,1),{x:2045,y:1908},'legacy service bay shares new platform');
 assert.equal(unitRenderAltitude('bomber',1),175);
 assert.equal(unitRenderAltitude('bomber',0),0);
});

test('aircraft can reserve exactly one bay and must pay for hangar repair',()=>{
 const {g,airport}=setup(),planes=[0,1,2].map(n=>g.spawn(0,{x:1750+n*14,y:1990},'bomber'));
 for(const p of planes)p.hp=350;
 assert.equal(g.requestAirfieldRepair(planes.map(p=>p.id)),1);
 assert.deepEqual(planes.slice(0,1).map(p=>p.airfieldService.bay),[0]);
 assert.equal(planes[1].airfieldService,undefined);
 assert.equal(planes[2].airfieldService,undefined);
 assert.equal(g.requestAirfieldRepair([planes[0].id]),0,'service cannot be reserved twice');
 const aircraft=planes[0];
 aircraft.airfieldService.phase='repair';
 const dock=airfieldPoint(airport,'dock',0);aircraft.x=dock.x;aircraft.y=dock.y;
 const credits=g.credits[0];advance(g,1);
 assert.ok(aircraft.hp>350,'aircraft health increases in the hangar');
 assert.ok(g.credits[0]<credits,'repair consumes player credits');
 assert.ok(g.credits[0]>=credits-Math.ceil((aircraft.hp-350)/AIRFIELD_REPAIR_HP_PER_CREDIT)-1);
 g.credits[0]=0;const before=aircraft.hp;advance(g,1);
 assert.ok(aircraft.hp>=before,'already-paid fractional HP may be consumed');
 advance(g,2);assert.ok(aircraft.hp-before<=AIRFIELD_REPAIR_HP_PER_CREDIT+.01);
});

test('finished bomber remains docked until an explicit launch, then actually takes off',()=>{
 const {g,airport}=setup(),plane=g.spawn(0,{x:1500,y:2050},'bomber');
 plane.hp=699;assert.equal(g.requestAirfieldRepair([plane.id]),1);
 plane.airfieldService.phase='repair';Object.assign(plane,airfieldPoint(airport,'dock',0));
 advance(g,.5);assert.equal(plane.airfieldService.phase,'ready');
 const stationary={x:plane.x,y:plane.y};advance(g,.5);
 assert.deepEqual({x:plane.x,y:plane.y},stationary);
 assert.equal(g.launchRepairedAircraft([plane.id]),1);
 advance(g,AIRFIELD_TAKEOFF_SECONDS+.1);
 assert.equal(plane.airfieldService,undefined);
 assert.equal(plane.flightHeight,1);
 assert.ok(Math.hypot(plane.x-stationary.x,plane.y-stationary.y)>100);
});

test('factory servicing is disabled: Pioniere now repair vehicles',()=>{
 const {g}=setup();
 const tank=g.spawn(0,{x:2530,y:2320},'tank');
 tank.hp=600;
 const credits=g.credits[0];
 assert.equal(g.requestFactoryRepair([tank.id]),0);
 assert.equal(g.setAutoFactoryRepair([tank.id],true),0);
 advance(g,.5);
 assert.equal(tank.hp,600);
 assert.equal(tank.factoryService,undefined);
 assert.equal(g.credits[0],credits);
});
test('old vehicle repair states are cleared on load; hangar state still persists',()=>{
 const {g,garage}=setup();
 const bomber=g.spawn(0,{x:1850,y:1980},'bomber');bomber.hp=400;
 const tank=g.spawn(0,{x:2600,y:2200},'tank');tank.hp=500;
 assert.equal(g.requestAirfieldRepair([bomber.id]),1);
 tank.factoryService={baseId:garage.id,bay:0,phase:'repair',paidHp:0};
 tank.autoFactoryRepair=true;
 g.setAutoAirfieldRepair([bomber.id],true);
 const stored=g.save(),restored=Simulation.load(stored);
 assert.deepEqual(restored.units.find(u=>u.id===bomber.id).airfieldService,bomber.airfieldService);
 assert.equal(restored.units.find(u=>u.id===tank.id).factoryService,undefined);
 assert.equal(restored.units.find(u=>u.id===tank.id).autoFactoryRepair,undefined);
 assert.equal(restored.units.find(u=>u.id===tank.id).hp,500);
 assert.equal(restored.units.find(u=>u.id===bomber.id).autoAirfieldRepair,true);
 const broken=structuredClone(stored);
 broken.units.find(u=>u.id===tank.id).factoryService.bay=99;
 assert.throws(()=>Simulation.load(broken),/beschädigt/);
});
test('only hangar service is wired into the live scene and HUD',()=>{
 const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
 const build=read('scripts/build.mjs'),battlefield=read('scripts/webgl-battlefield.js');
 const airfield=read('scripts/webgl-airfield-service.js');
 assert.ok(build.includes('webgl-airfield-service.js'));
 for(const phrase of ['createAirfieldServiceYard','updateAirfieldServiceYard','disposeAirfieldServiceYard',
   'hangar-repair','hangar-auto'])assert.ok(battlefield.includes(phrase),phrase);
 for(const phrase of ['createFactoryServiceYard(','updateFactoryServiceYard(','factory-repair','factory-auto'])
  assert.ok(!battlefield.includes(phrase),'legacy garage must not be used: '+phrase);
 for(const phrase of ['HangarDoorLeft_','AirfieldExtendedRunway','HangarCamoArch_'])
  assert.ok(airfield.includes(phrase));
});
test('Three.js service yards create, animate and dispose with no DOM or WebGL context',()=>{
 const airfield=createAirfieldServiceYard();
 assert.ok(airfield.getObjectByName('AirfieldExtendedRunway'));
 assert.ok(airfield.getObjectByName('HangarDoorLeft_0'));
 assert.ok(airfield.getObjectByName('HangarDoorRight_0'));
 assert.equal(airfield.getObjectByName('HangarDoorRight_1'),undefined);
 const aircraft={id:80,hp:200,airfieldService:{baseId:900,bay:0,phase:'repair'}};
 const airEntry={airfieldServiceYard:airfield};
 updateAirfieldServiceYard(airEntry,{id:900},[aircraft],2,.2);
 assert.equal(airfield.userData.bay0.sparks.visible,true);
 assert.ok(airfield.userData.bay0.open>0);
 updateAirfieldServiceYard(airEntry,{id:900},[],3,.2);
 assert.equal(airfield.userData.bay0.sparks.visible,false);
 disposeAirfieldServiceYard(airEntry);
 assert.equal(airEntry.airfieldServiceYard,null);

 const factory=createFactoryServiceYard();
 assert.equal(factory.name,'FactoryOpenAirRepairPlatform');
 assert.ok(factory.getObjectByName('VehicleRepairBaySurface_0'));
 assert.equal(factory.getObjectByName('VehicleRepairBaySurface_1'),undefined);
 const truck={id:81,hp:100,factoryService:{baseId:901,bay:0,phase:'repair'}};
 const garageEntry={factoryServiceYard:factory};
 updateFactoryServiceYard(garageEntry,{id:901},[truck],Math.PI/2);
 assert.equal(factory.userData.bay0.indicator.visible,true);
 updateFactoryServiceYard(garageEntry,{id:901},[],0);
 assert.equal(factory.userData.bay0.indicator.visible,false);
 disposeFactoryServiceYard(garageEntry);
 assert.equal(garageEntry.factoryServiceYard,null);
});

test('end-to-end: real bomber lands and taxis into its assigned hangar',()=>{
 const {g,airport}=setup();
 const bomber=g.spawn(0,{x:1680,y:1900},'bomber');
 bomber.hp=600;
 assert.equal(g.requestAirfieldRepair([bomber.id]),1);
 let touchedDown=false,enteredTaxi=false,repaired=false;
 for(let i=0;i<1000;i++){
  g.step(.05);
  if(!bomber.airfieldService)break;
  if(bomber.airfieldService.phase==='landing')touchedDown=true;
  if(bomber.airfieldService.phase==='taxi')enteredTaxi=true;
  if(bomber.airfieldService.phase==='repair'){repaired=true;break;}
 }
 assert.ok(touchedDown,'bomber must reach approach waypoint without teleport');
 assert.ok(enteredTaxi,'real bomber must land, not switch straight to repair');
 assert.ok(repaired,'real bomber must drive to hangar');
 assert.ok(Math.hypot(bomber.x-airfieldPoint(airport,'dock',0).x,
  bomber.y-airfieldPoint(airport,'dock',0).y)<3,'hangar station must be at actual final taxi position');
 assert.equal(bomber.flightHeight,0,'bomber must actually touch ground');
});

test('end-to-end: Pionier repairs a damaged tank without factory docking',()=>{
 const {g}=setup(),tank=g.spawn(0,{x:2580,y:2330},'tank');
 const engineer=g.spawn(0,{x:2600,y:2330},'engineer');
 tank.hp=600;
 assert.equal(g.requestFactoryRepair([tank.id]),0);
 g.spatial.rebuild(g.units);
 engineer.orders=[{kind:'repair',target:tank.id,x:tank.x,y:tank.y}];
 advance(g,1);
 assert.ok(tank.hp>600,'Pionier must restore real tank HP');
 assert.equal(tank.factoryService,undefined);
});
test('ground vehicles obey direct orders; aircraft take off rather than teleport',()=>{
 const {g,airport}=setup();
 const rover=g.spawn(0,{x:2680,y:2390},'rover');rover.hp=180;
 assert.equal(g.requestFactoryRepair([rover.id]),0);
 const before={x:rover.x,y:rover.y};
 assert.equal(g.command([rover.id],{x:2590,y:2370,kind:'move'}),1);
 assert.equal(rover.factoryService,undefined);
 assert.deepEqual({x:rover.x,y:rover.y},before);
 assert.equal(rover.orders[0]?.kind,'move');
 const bomber=g.spawn(0,{x:1640,y:2050},'bomber');bomber.hp=500;
 assert.equal(g.requestAirfieldRepair([bomber.id]),1);
 g.setAutoAirfieldRepair([bomber.id],true);
 bomber.airfieldService.phase='repair';Object.assign(bomber,airfieldPoint(airport,'dock',0));
 bomber.flightHeight=0;
 const dock={x:bomber.x,y:bomber.y};
 assert.equal(g.command([bomber.id],{x:2300,y:2380,kind:'move'}),1);
 assert.equal(bomber.airfieldService.phase,'takeoff');
 assert.equal(bomber.autoAirfieldRepair,false);
 assert.deepEqual({x:bomber.x,y:bomber.y},dock);
 assert.equal(bomber.flightHeight,0);
 assert.equal(bomber.orders[0]?.kind,'move');
 advance(g,AIRFIELD_TAKEOFF_SECONDS+.05);
 assert.equal(bomber.airfieldService,undefined);
 assert.equal(bomber.flightHeight,1);
});
test('aircraft diverted before landing can change orders immediately and release the bay',()=>{
 const {g}=setup(),bomber=g.spawn(0,{x:1800,y:2000},'bomber');bomber.hp=400;
 assert.equal(g.requestAirfieldRepair([bomber.id]),1);
 assert.equal(bomber.airfieldService?.phase,'approach');
 assert.equal(g.command([bomber.id],{x:1600,y:1900,kind:'move'}),1);
 assert.equal(bomber.airfieldService,undefined);
 assert.equal(bomber.orders[0]?.kind,'move');
 assert.equal(bomber.flightHeight,1);
 assert.equal(g.requestAirfieldRepair([bomber.id]),1,'slot is no longer occupied');
});

test('loaded tank can resume gameplay instead of remaining trapped on removed garage lift',()=>{
 const {g,garage}=setup(),tank=g.spawn(0,{x:2690,y:2360},'tank');
 tank.hp=600;
 tank.factoryService={baseId:garage.id,bay:0,phase:'ready',paidHp:0};
 tank.autoFactoryRepair=true;
 const saved=g.save(),restored=Simulation.load(saved);
 const unit=restored.units.find(u=>u.id===tank.id);
 assert.ok(unit);
 assert.equal(unit.factoryService,undefined);
 assert.equal(unit.autoFactoryRepair,undefined);
 assert.equal(unit.hp,600);
 assert.ok(Number.isFinite(unit.x)&&Number.isFinite(unit.y));
});
test('uneven terrain: maintenance altitude meets flat workshop floors without visual popping',()=>{
 const ground=24,building=12;
 const plane={flightHeight:1,airfieldService:{phase:'approach'}};
 assert.equal(serviceVisualGround(plane,ground,building),ground);
 plane.airfieldService.phase='landing';plane.flightHeight=.5;
 assert.equal(serviceVisualGround(plane,ground,building),
  (ground+building+AIRFIELD_HANGAR_FLOOR_HEIGHT)/2);
 plane.airfieldService.phase='repair';plane.flightHeight=0;
 assert.equal(serviceVisualGround(plane,ground,building),
  building+AIRFIELD_HANGAR_FLOOR_HEIGHT);
 plane.airfieldService.phase='takeoff';plane.flightHeight=1;
 assert.equal(serviceVisualGround(plane,ground,building),ground);

 const tank={factoryService:{phase:'approach'}};
 assert.equal(serviceVisualGround(tank,ground,building),ground);
 tank.factoryService.phase='parking';
 assert.equal(serviceVisualGround(tank,ground,building,85),ground);
 assert.equal(serviceVisualGround(tank,ground,building,42.5),
  (ground+building+FACTORY_LIFT_HEIGHT)/2);
 tank.factoryService.phase='repair';
 assert.equal(serviceVisualGround(tank,ground,building),
  building+FACTORY_LIFT_HEIGHT);
 assert.equal(approachGroundHeight(24,12,.1),20.4);
 assert.equal(approachGroundHeight(24,12,0),24);
});

test('workshop provides actual raised hydraulic service decks and ramps',()=>{
 const factory=createFactoryServiceYard();
 for(const bay of [0]){
  assert.ok(factory.getObjectByName('VehicleLiftPlatform_'+bay));
  assert.ok(factory.getObjectByName('VehicleDriveOnRamp_'+bay));
 }
 assert.equal(factory.getObjectByName('VehicleLiftPlatform_1'),undefined);
 const mesh=factory.getObjectByName('VehicleLiftPlatform_0');
 assert.equal(mesh.position.y+mesh.geometry.parameters.height/2,FACTORY_LIFT_HEIGHT);
 const entry={factoryServiceYard:factory};
 disposeFactoryServiceYard(entry);
});

test('airfield HUD retains hangar controls; factory HUD has no repair buttons',()=>{
 const source=readFileSync(new URL('../scripts/webgl-battlefield.js',import.meta.url),'utf8');
 for(const command of ['hangar-repair-all','hangar-launch-ready'])
  assert.match(source,new RegExp(command));
 for(const command of ['factory-repair-all','factory-release-ready','factory-auto'])
  assert.doesNotMatch(source,new RegExp(command));
 assert.match(source,/WARTUNGSPLÄTZE/);
});
test('only aircraft can be routed to clicked hangar for maintenance',()=>{
 const {g,airport,garage}=setup();
 const tank=g.spawn(0,{x:2530,y:2110},'tank');
 const bomber=g.spawn(0,{x:1850,y:2020},'bomber');
 tank.hp=600;bomber.hp=400;
 assert.equal(g.requestFactoryRepair([tank.id],garage.id),0);
 assert.equal(g.requestAirfieldRepair([bomber.id],garage.id),0);
 assert.equal(g.requestAirfieldRepair([bomber.id],airport.id),1);
 assert.equal(tank.factoryService,undefined);
 assert.equal(bomber.airfieldService.baseId,airport.id);
});
test('repair right-click recognizes hangar, not factory or infantry',()=>{
 const units=[{id:1,kind:'tank',owner:0,hp:300},
  {id:2,kind:'scout',owner:0,hp:100},{id:3,kind:'infantry',owner:0,hp:50}];
 assert.equal(selectedMaintenanceKind(units,new Set([1])),null);
 assert.equal(selectedMaintenanceKind(units,new Set([2])),'airfield');
 assert.equal(selectedMaintenanceKind(units,new Set([3])),null);
 const garage={kind:'factory',x:400,y:500,facing:0};
 const airfield={kind:'airfield',x:800,y:900,facing:2};
 assert.equal(serviceFootprintContains(garage,{x:476,y:672}),false);
 assert.equal(serviceFootprintContains(airfield,{x:975,y:900}),true);
 assert.equal(serviceFootprintContains(airfield,{x:1530,y:900}),false);
 const source=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(source,/this\.maintenanceFacilityAtPointer\(event,serviceKind\)/);
 assert.match(source,/this\.game\.requestAirfieldRepair\(ids,facility\.id\)/);
 assert.doesNotMatch(source,/this\.game\.requestFactoryRepair\(ids,facility\.id\)/);
});
test('damaged vehicles display a distinct service cross and animated welding sparks',()=>{
 const yard=createFactoryServiceYard();
 const base={id:910,kind:'factory',x:1200,y:1200,facing:0};
 const entry={factoryServiceYard:yard};
 const state=yard.userData.bay0;
 assert.ok(yard.getObjectByName('FactoryRepairIcon_0'));
 assert.ok(yard.getObjectByName('FactoryRepairCircle_0'));
 assert.ok(yard.getObjectByName('FactoryWeldingSparks_0'));
 assert.equal(state.icon.visible,false);
 assert.equal(state.sparks.visible,false);
 const vehicle={id:8,hp:500,factoryService:{baseId:910,bay:0,phase:'repair'}};
 updateFactoryServiceYard(entry,base,[vehicle],1.8);
 assert.equal(state.icon.visible,true);
 assert.equal(state.sparks.visible,true);
 assert.equal(state.indicator.visible,true);
 const before=state.sparks.rotation.y;
 updateFactoryServiceYard(entry,base,[vehicle],2.2);
 assert.notEqual(state.sparks.rotation.y,before);
 vehicle.factoryService.phase='ready';
 updateFactoryServiceYard(entry,base,[vehicle],3);
 assert.equal(state.icon.visible,true);
 assert.equal(state.sparks.visible,false);
 updateFactoryServiceYard(entry,base,[],4);
 assert.equal(state.icon.visible,false);
 assert.equal(state.sparks.visible,false);
 disposeFactoryServiceYard(entry);
});

test('factory and airfield use real PBR camouflage/data textures, roof details and weathering',async()=>{
 const {servicePaint}=await import('../scripts/webgl-service-materials.js');
 const material=servicePaint(['#727a5e','#a79976','#bdac88'],{seed:7});
 assert.ok(material.map?.isDataTexture);
 assert.equal(material.map.image.data.length,256*256*4);
 assert.equal(material.map.colorSpace,'srgb');
 material.map.dispose();material.dispose();
 const yard=createFactoryServiceYard(),hangar=createAirfieldServiceYard();
 for(const name of ['VehicleLiftPlatform_0','VehicleDriveOnRamp_0',
   'FactoryRepairToolTray_0','FactoryPlatformEdgeMarker_0'])
  assert.ok(yard.getObjectByName(name),name);
 for(const name of ['HangarRoofVent_0','HangarDoorCorrugation_0_0',
   'HangarRearVent_0','AirfieldTouchdownRubber'])
  assert.ok(hangar.getObjectByName(name),name);
 for(const root of [yard,hangar]){
  let textureCount=0;
  root.traverse(mesh=>{if(mesh.isMesh&&mesh.material.map?.isDataTexture)textureCount++;});
  assert.ok(textureCount>=(root===yard?5:11),'service deck and metal use PBR textures');
 }
 disposeFactoryServiceYard({factoryServiceYard:yard});
 disposeAirfieldServiceYard({airfieldServiceYard:hangar});
});

test('WebGL airfield runway has no generic crates/lamp posts and has low-profile off-pavement edge lights',()=>{
 assert.equal(YARD_DECOR_KINDS.includes('airfield'),false,
  'generic SiteSupplyCache and SecurityLamp overlap the working runway');
 assert.equal(createBuildingYard('airfield',218),null,
  'airfield service yard is the single authority for its visual apron');
 assert.ok(createBuildingYard('barracks',158),'other building yards must stay intact');
 const airfield=createAirfieldServiceYard();
 const runway=airfield.getObjectByName('AirfieldExtendedRunway');
 assert.ok(runway);
 const runwayCenter=airfield.position.x+airfield.scale.x*runway.position.x;
 const runwayHalfWidth=runway.geometry.parameters.width*airfield.scale.x*.5;
 const lamps=airfield.children.filter(x=>x.name==='AirfieldRunwayLamp');
 assert.equal(lamps.length,24,'retain all 24 symmetric low-profile landing-zone markers');
 for(const lamp of lamps){
  const wx=airfield.position.x+airfield.scale.x*lamp.position.x;
  const lampHalf=lamp.geometry.parameters.width*airfield.scale.x*.5;
  assert.ok(Math.abs(wx-runwayCenter)-lampHalf>runwayHalfWidth,
   'light must sit fully outside the aircraft runway');
  assert.ok(lamp.geometry.parameters.height<=.3,
   'flush taxi/landing light must not become a physical obstacle');
 }
 assert.ok(airfield.getObjectByName('HangarDoorLeft_0'),'hangar door still exists');
 disposeAirfieldServiceYard({airfieldServiceYard:airfield});
});
