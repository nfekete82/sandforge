import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BUILDINGS,UNITS,TANK_MG,weaponDamage,combatDpsAgainst} from '../dist/src/reborn/catalog.js';
import {createAirfieldServiceYard,disposeAirfieldServiceYard} from '../scripts/webgl-airfield-service.js';
import {createFactoryServiceYard,updateFactoryServiceYard,disposeFactoryServiceYard} from '../scripts/webgl-factory-service.js';
import {serviceFootprintContains} from '../scripts/webgl-maintenance-input.js';
import {airfieldPoint} from '../dist/src/reborn/airfield-maintenance.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {globalCatalogAvailability} from '../scripts/webgl-global-catalog.js';
import * as THREE from 'three';
import {servicePaint,previewServiceMaterial,disposeServicePaint} from '../scripts/webgl-service-materials.js';

const unit=kind=>({kind});
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('small arms remain lethal to infantry but weak against vehicles and airframes',()=>{
 for(const gun of ['infantry','medic','engineer','heavy','rover','scout']){
  const infantryDamage=weaponDamage(unit(gun),unit('infantry'));
  for(const armor of ['rover','tank','artillery']){
   const hit=weaponDamage(unit(gun),unit(armor));
   assert.ok(hit<=UNITS[gun].damage*.20+1e-8,gun+' too strong versus '+armor);
   assert.ok(hit<infantryDamage,gun+' must favor infantry');
  }
  for(const aircraft of ['scout','bomber']){
   const hit=weaponDamage(unit(gun),unit(aircraft));
   assert.ok(hit<=UNITS[gun].damage*.15+1e-8,gun+' too strong versus '+aircraft);
   assert.ok(hit<infantryDamage,gun+' must favor infantry');
  }
 }
 assert.equal(weaponDamage(unit('rocket'),unit('bomber')),UNITS.rocket.damage*1.2);
 assert.equal(weaponDamage(unit('rocket'),unit('scout')),UNITS.rocket.damage*1.2);
 assert.equal(combatDpsAgainst(unit('tank'),unit('infantry')),TANK_MG.damage/TANK_MG.cooldown);
 assert.equal(weaponDamage(unit('heavy'),{kind:'factory',queue:[]}),UNITS.heavy.damage*.45,
  'retain pre-existing building balance');
});

test('single compact hangar and runway contain all real aircraft waypoints',()=>{
 const airport=createAirfieldServiceYard();
 const runway=airport.getObjectByName('AirfieldExtendedRunway');
 const hangar=airport.getObjectByName('HangarBayFloor_0');
 assert.ok(runway&&hangar);
 airport.updateMatrixWorld(true);
 const strip=new THREE.Box3().setFromObject(runway);
 const bay=new THREE.Box3().setFromObject(hangar);
 const length=strip.max.z-strip.min.z;
 assert.ok(length>=380&&length<=420,'compact runway stays around 400 world units');
 assert.ok(length>2.5*(bay.max.z-bay.min.z));
 const base={x:2000,y:2000,facing:0};
 for(const waypoint of ['approach','touchdown','taxi','departure']){
  const point=airfieldPoint(base,waypoint);
  assert.ok(point.x-base.x>=strip.min.x&&point.x-base.x<=strip.max.x,waypoint+' runway width');
  assert.ok(point.y-base.y>=strip.min.z&&point.y-base.y<=strip.max.z,waypoint+' runway length');
  assert.ok(serviceFootprintContains({kind:'airfield',...base},point));
 }
 const dock=airfieldPoint(base,'dock');
 assert.ok(dock.x-base.x>=bay.min.x&&dock.x-base.x<=bay.max.x);
 assert.ok(dock.y-base.y>=bay.min.z&&dock.y-base.y<=bay.max.z);
 assert.ok(airport.getObjectByName('AirfieldAircraftParkingPad_0'));
 assert.equal(airport.getObjectByName('AirfieldAircraftParkingPad_1'),undefined);
 assert.equal(airport.getObjectByName('HangarBayFloor_1'),undefined);
 assert.equal(airport.getObjectByName('AirfieldCrossTaxiLane'),undefined);
 const tower=airport.getObjectByName('AirfieldLeftControlTowerShaft');
 const fuel=airport.getObjectByName('AirfieldFuelServiceContainer');
 assert.ok(tower&&fuel);
 assert.ok(tower.position.x<hangar.position.x&&fuel.position.x<hangar.position.x);
 assert.ok(airport.getObjectByName('AirfieldLeftControlTowerGlazing'));
 assert.ok(!airport.getObjectByName('AirfieldRightControlTowerShaft'));
 assert.ok(airport.getObjectByName('HangarRoofSpine_0'));
 assert.ok(serviceFootprintContains({kind:'airfield',...base},{x:base.x+(strip.min.x+strip.max.x)/2,y:base.y+strip.max.z-1}));
 disposeAirfieldServiceYard({airfieldServiceYard:airport});
});

test('factory has one compact OPEN repair platform with no enclosing garage',()=>{
 const factory=createFactoryServiceYard(),deck=factory.getObjectByName('VehicleLiftPlatform_0');
 assert.ok(deck&&deck.position.x>140);
 assert.ok(deck.geometry.parameters.width<=100&&deck.geometry.parameters.depth<=100);
 for(const name of ['FactoryRepairGarageRoof_0','FactorySideWorkshopWallLeft','FactoryServiceDoorLeft_0','VehicleLiftPlatform_1','FactoryServiceWing'])
  assert.equal(factory.getObjectByName(name),undefined,name+' must not block the open platform');
 assert.ok(factory.getObjectByName('VehicleDriveOnRamp_0'));
 const entry={factoryServiceYard:factory};
 const vehicle={id:901,hp:700,factoryService:{baseId:1,bay:0,phase:'parking'}};
 updateFactoryServiceYard(entry,{id:1},[vehicle],1);
 assert.equal(factory.userData.bay0.indicator.visible,true);
 assert.equal(factory.userData.bay0.icon.visible,false);
 vehicle.factoryService.phase='repair';
 updateFactoryServiceYard(entry,{id:1},[vehicle],1.2);
 assert.equal(factory.userData.bay0.icon.visible,true);
 assert.equal(factory.userData.bay0.sparks.visible,true);
 updateFactoryServiceYard(entry,{id:1},[],1.4);
 assert.equal(factory.userData.bay0.indicator.visible,false);
 assert.equal(factory.userData.bay0.sparks.visible,false);
 assert.equal(deck.position.y+deck.geometry.parameters.height/2,9.5);
 disposeFactoryServiceYard({factoryServiceYard:factory});
});

test('placement ghost displays actual finished building at 50% with visible door and facing marker',()=>{
 const battlefield=source('scripts/webgl-battlefield.js');
 const begin=battlefield.slice(battlefield.indexOf(' beginPlacement(kind){'),
  battlefield.indexOf(' clearPlacement(){'));
 assert.ok(begin.includes("this.getModel(this.asset(kind,0,'building'))"));
 assert.ok(begin.includes('createBuildingYard(kind,spec.width)'));
 assert.ok(begin.includes("kind==='airfield'?createAirfieldServiceYard(0,{ghost:true}):null"));
 assert.ok(!begin.includes('createFactoryServiceYard()'),'open repair platform is not part of the factory placement ghost');
 assert.ok(begin.includes("hideOldAirfieldHangar({detail:model})"),
  'legacy overlapping airfield structures are still hidden');
 assert.ok(begin.includes('const tint=(root,ownSource=false,opacity=.50)'),'the actual building ghost uses 50% transparency');
 assert.ok(begin.includes('previewServiceMaterial(mat,{opacity})'));
 const materialHelper=source('scripts/webgl-service-materials.js');
 assert.ok(materialHelper.includes('clone.opacity=Math.min(source.opacity??1,opacity)'));
 assert.ok(materialHelper.includes('clone.depthWrite=false;clone.depthTest=true'));
 assert.ok(begin.includes('placeholder.visible=true'),
  'temporary model is a 50%-opaque ghost until the GLB resolves');
 assert.ok(begin.includes("model.visible=kind!=='airfield'"),
  'ordinary finished GLB is visible; only the duplicate airfield asset stays hidden');
 assert.ok(begin.includes('tint(yard,false,.34)'));
 assert.ok(begin.includes('tint(service,true,.38)'));
 assert.ok(!begin.includes('mesh.position.y>5||mesh.geometry?.parameters?.height>7'),
  'the hangar service model is now shown instead of hiding every visible wall');
 assert.ok(begin.includes('BuildingFrontArrow'));
 assert.ok(begin.includes("kind==='barracks'?spec.width*.12:0"),
  'front arrow aligns with offset barracks entrance');
 assert.ok(begin.includes('guides.visible=false'),
  'the old tall scaffold must not obscure the entrance');
 assert.ok(begin.includes('group.userData.previewFrontMarker=frontMarker'));
 assert.ok(battlefield.includes("disposeOwnedMeshes(preview.userData.previewFrontMarker)"));
 assert.ok(battlefield.includes('sandforgePreviewInvalidColor'));
 assert.ok(battlefield.includes('sandforgePreviewValidColor'));
 assert.ok(battlefield.includes("frontArrow.material.color.set(valid?'#9ef5d9':'#ff9a87')"));
 assert.ok(battlefield.includes('conformAirfieldSurface(ghost.userData.previewService'));
 assert.ok(battlefield.includes('conformAirfieldSurface(entry.airfieldServiceYard'));
 assert.ok(battlefield.includes("if(b.kind==='airfield'){"),
  'finished construction still uses the genuine airfield 3D geometry');
});

test('construction reveals real combined meshes from bottom to top and restores materials',()=>{
 const construction=source('scripts/webgl-construction.js');
 const body=construction.slice(construction.indexOf('export class ')).replace('export class ','class ');
 const fakeDocument={createElement(){return {getContext(){return {clearRect(){},fillRect(){},strokeRect(){},fillText(){}}}}}};
 const Presentation=new Function('THREE','BUILDINGS','document','disposeOwnedMeshes',body+';return SandforgeConstructionPresentation;')(THREE,BUILDINGS,fakeDocument,()=>{});
 const renderer={},presentation=new Presentation(renderer);
 assert.equal(renderer.localClippingEnabled,true);
 const node=new THREE.Group(),detail=new THREE.Group();
 node.add(detail);
 const material=new THREE.MeshStandardMaterial();
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(10,80,10),material);
 mesh.position.y=40;detail.add(mesh);
 const hidden=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material);hidden.visible=false;detail.add(hidden);
 const base={id:8,kind:'barracks',buildRemaining:BUILDINGS.barracks.buildTime};
 const entry={node,detail};
 presentation.update(entry,base);
 assert.equal(mesh.visible,false);
 base.buildRemaining=BUILDINGS.barracks.buildTime*.65;presentation.update(entry,base);
 assert.equal(mesh.visible,true);assert.equal(hidden.visible,false);
 assert.notEqual(mesh.material,material);
 const plane=mesh.material.clippingPlanes[0],first=plane.constant;
 assert.deepEqual(plane.normal.toArray(),[0,-1,0]);
 assert.ok(first>0&&first<80);
 base.buildRemaining=BUILDINGS.barracks.buildTime*.25;presentation.update(entry,base);
 assert.ok(plane.constant>first&&plane.constant<80);
 let disposed=0;mesh.material.addEventListener('dispose',()=>disposed++);
 base.buildRemaining=0;presentation.update(entry,base);
 assert.equal(entry.construction,null);assert.equal(mesh.material,material);
 assert.equal(mesh.visible,true);assert.equal(hidden.visible,false);assert.equal(disposed,1);
 mesh.geometry.dispose();hidden.geometry.dispose();material.dispose();
 assert.ok(construction.includes("stageGroup(entry.yard,'yard')"));
 assert.ok(construction.includes("stageGroup(entry.airfieldServiceYard??entry.factoryServiceYard,'service')"));
});

test('airfield selection no longer hides the building catalogue if a pioneer survives',()=>{
 const src=source('scripts/webgl-battlefield.js');
 assert.match(src,/const canBuild=game\.units\.some\(u=>u\.owner===0&&u\.kind==='engineer'/);
 assert.match(src,/const available=globalCatalogAvailability\(g\)/,
  'real completed player buildings determine available production tabs');
 assert.match(src,/Unit\/structure selection has NO effect/,
  'a selected unit does not hide unlocked menus');
 assert.ok(src.includes('const available=globalCatalogAvailability(this.game)'));
 assert.ok(src.includes('const available=globalCatalogAvailability(g)'));
 // The compact 600-unit strip has a matching rotated construction footprint.
 const game=new Simulation(2074,4);
 game.aiClock=1e8;game.credits[0]=10000;game.explored[0].fill(1);
 const air={id:31110,kind:'airfield',owner:0,x:2000,y:2000,hp:1200,
  radius:116,buildRemaining:0,territory:0,queue:[],queueTypes:[],production:0,cooldown:0,rally:null};
 game.bases.push(air);
 let spot=null;
 for(let x=900;x<3500&&!spot;x+=220)
  for(let y=900;y<3500&&!spot;y+=220)
   if(game.buildError(0,'generator',{x,y})===null)spot={x,y};
 assert.ok(spot,'a generator remains buildable after constructing an airfield');
});


test('fuel drums, loading ramps and desert service paving use modeled geometry and real albedo',()=>{
 const airport=createAirfieldServiceYard();
 const expected=[
  ['AirfieldFuelServiceTank','CylinderGeometry'],
  ['AirfieldFuelTankSteelBand','CylinderGeometry'],
  ['AirfieldFuelValve','CylinderGeometry'],
  ['AirfieldFuelServiceContainer','BoxGeometry'],
  ['AirfieldFuelServicePad','BoxGeometry'],
  ['AirfieldParkingRampGrip_0','BoxGeometry'],
  ['AirfieldParkingRampTread_0','BoxGeometry'],
  ['AirfieldAircraftParkingPad_0','BoxGeometry']
 ];
 for(const [name,type] of expected){
  const mesh=airport.getObjectByName(name);
  assert.ok(mesh,'missing textured fuel/apron detail: '+name);
  assert.equal(mesh.geometry.type,type,name+' needs actual modeled geometry');
  assert.ok(mesh.material.map?.isDataTexture,name+' still has placeholder solid paint');
  assert.ok(mesh.material.userData.sandforgeServiceTexture,
   name+' texture must be tracked for GPU cleanup');
 }
 assert.ok(airport.getObjectByName('AirfieldFuelTankEndCap'));
 assert.ok(airport.getObjectByName('AirfieldFuelPumpDisplay'));
 assert.ok(airport.getObjectByName('AirfieldFuelPipeManifold'));
 disposeAirfieldServiceYard({airfieldServiceYard:airport});
});

test('actual HUD factory selection cannot prevent later building card clicks',()=>{
 const src=source('scripts/webgl-battlefield.js');
 const start=src.indexOf(' buildInterface(){'),end=src.indexOf('\n saveGame(){',start);
 assert.ok(start>0&&end>start);
 const listeners=new Map(),actions={scrollTop:40},detail={textContent:''};
 const mini={addEventListener(){}};
 const panel={dataset:{tab:'units'},addEventListener:(name,fn)=>listeners.set(name,fn),
  querySelector(selector){
   if(selector==='#sf-map')return mini;
   if(selector==='#sf-actions')return actions;
   if(selector==='#sf-catalog-detail')return detail;
   throw Error('unexpected HUD selector '+selector);
  }};
 const BUILDINGS={barracks:{name:'Kaserne'},generator:{name:'Energiekern'}};
 const fakeCtor=new Function('installClassicHud','BUILDINGS','INTERCEPTOR_ENABLED',
  'globalCatalogAvailability','createSandforgeResearchDeck','UPGRADES','UPGRADE_KINDS','researchIconMarkup','createSandforgeConfirmDialog',
  'return class TestHUD {'+src.slice(start,end)+'}');
 const Fake=fakeCtor(()=>panel,BUILDINGS,true,globalCatalogAvailability,()=>({}),{},[],()=>'',()=>({}));
 const ui=new Fake();
 const calls=[];
 ui.game={bases:[]};
 ui.sound={enabled:false,select(){}};
 ui.selectedBase=100; // The user has selected the completed factory.
 ui.selected=new Set();
 ui.catalogContext=()=>({engineer:false,canBuild:true,producer:{id:100,kind:'factory'}});
 ui.selectEngineer=()=>{calls.push('engineer');ui.selectedBase=null;return {id:12}};
 ui.beginPlacement=kind=>{calls.push('placement:'+kind);ui.buildKind=kind};
 ui.drawInterface=()=>{calls.push('draw')};
 ui.message=message=>{calls.push('message:'+message)};
 ui.buildInterface();
 assert.ok(listeners.has('sandforge-tabchange'));
 assert.ok(listeners.has('click'));
 panel.dataset.tab='buildings';
 listeners.get('sandforge-tabchange')({detail:{tab:'buildings'}});
 assert.ok(calls.includes('draw'),'tab switch must repaint immediately');
 assert.equal(actions.scrollTop,0);
 const click=kind=>listeners.get('click')({
  target:{closest:()=>({dataset:{build:kind}})}
 });
 click('generator');
 assert.equal(ui.buildKind,'generator');
 assert.equal(panel.dataset.tab,'buildings');
 assert.equal(ui.selectedBase,null);
 assert.ok(calls.includes('engineer'));
 assert.ok(calls.includes('placement:generator'));
 // The second card must replace the first placement, even if a factory was
 // reselected in between. No change to the producer's unit queue.
 ui.selectedBase=100;click('barracks');
 assert.equal(ui.buildKind,'barracks');
 assert.equal(panel.dataset.tab,'buildings');
 assert.ok(calls.includes('placement:barracks'));
 assert.match(src,/const available=globalCatalogAvailability\(g\)/,
  'real completed player buildings determine available production tabs');
 assert.ok(!src.includes(':!context.canBuild||g.credits[0]<spec.cost'),
  'missing pioneer must never disable every building tile');
});


test('ACTUAL REGRESSION: after factory/airfield preview, next building selection never crashes on map.dispose',()=>{
 for(const site of [createFactoryServiceYard(),createAirfieldServiceYard()]){
  const original=site.getObjectByName(site.name==='FactoryOpenAirRepairPlatform'
   ?'VehicleLiftPlatform_0':'AirfieldExtendedRunway');
  assert.ok(original?.material?.map?.isTexture,'real service material owns DataTexture');
  const ownedTexture=original.material.userData.sandforgeServiceTexture;
  assert.ok(ownedTexture?.isTexture);
  const preview=previewServiceMaterial(original.material,{opacity:.5});
  const view=new THREE.Group();
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),preview);
  view.add(mesh);
  assert.ok(preview.map?.isTexture,'transparent building retains real image texture');
  assert.equal(preview.userData.sandforgeServiceTexture,undefined,
   'ghost materials must NOT inherit serialized DataTexture ownership metadata');
  assert.doesNotThrow(()=>disposeServicePaint(view),
   'the prior browser crash was map.dispose is not a function');
  // Reproduce old, already-cloned material metadata from an existing preview;
  // cleanup must ignore the object, rather than breaking ALL subsequent clicks.
  const obsolete=original.material.clone();
  const legacyPreview=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),obsolete);
  view.add(legacyPreview);
  assert.ok(obsolete.userData.sandforgeServiceTexture);
  assert.equal(typeof obsolete.userData.sandforgeServiceTexture.dispose,'undefined');
  assert.doesNotThrow(()=>disposeServicePaint(view));
  preview.dispose();mesh.geometry.dispose();
  obsolete.dispose();legacyPreview.geometry.dispose();
  if(site.name==='FactoryOpenAirRepairPlatform')
   disposeFactoryServiceYard({factoryServiceYard:site});
  else disposeAirfieldServiceYard({airfieldServiceYard:site});
 }
});
