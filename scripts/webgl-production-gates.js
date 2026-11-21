import * as THREE from 'three';
import {buildingFacingAngle} from './webgl-scale.js';
import {rolloutWheelsShouldRoll} from './webgl-wheel-motion.js';
import {meshyFactoryPortal} from './webgl-meshy-factory-team.js';
import {prepareBarracksPortal,updateBarracksPortalPlanes,setBarracksDoorOpen,disposeBarracksPortal} from './webgl-barracks-portal.js';
import {prepareHeadquartersPortal,setHeadquartersDoorOpen,disposeHeadquartersPortal} from './webgl-headquarters-portal.js';

export const GATE_TIMING=Object.freeze({warning:.25,opening:1,drive:3.6,closing:1});
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
export function productionGatePose(age,driveDuration=GATE_TIMING.drive){
 const {warning:w,opening:o,closing:c}=GATE_TIMING,d=driveDuration;
 const start=w+o,end=start+d;
 return {open:age<w?0:age<start?smooth((age-w)/o):age<end?1:1-smooth((age-end)/c),
  drive:smooth((age-start)/d),moving:age>start&&age<end,done:age+1e-8>=end+c};
}
const box=new THREE.BoxGeometry(1,1,1);
const hallMaterial=new THREE.MeshStandardMaterial({color:'#242b29',roughness:.94,side:THREE.DoubleSide});
const floorMaterial=new THREE.MeshStandardMaterial({color:'#635e4e',roughness:.96});
const dustMaterial=new THREE.MeshBasicMaterial({color:'#bda984',transparent:true,opacity:.12,depthWrite:false});
const bulbGeometry=new THREE.SphereGeometry(.047,8,6);
const orderKey=u=>JSON.stringify(u.orders??[]);

/** Operates on the real actor node, never creates an actor or modifies Simulation.
 * State is ephemeral: loading a save creates a fresh presenter and closed gates.
 */
export class SandforgeProductionGates {
 constructor(battlefield){
  this.battlefield=battlefield;this.game=battlefield.game;
  this.seen=new WeakSet(this.game.productionReleases);this.active=new Map();
  this.lastTime=this.game.time;
 }
 prepare(entry){
  if(entry.gate||!entry.detail)return entry.gate;
  // A Meshy visual shell does not yet carry authored hinge nodes. Treat its
  // main frontage as an open infantry exit rather than waiting on a missing rig.
  if(entry.detail.userData.sandforgeMeshyStructure&&
     ['barracks','headquarters'].includes(entry.kind)){
   const meshyStart=entry.detail.getObjectByName('SF_Meshy_InfantryRolloutStart');
   const meshyExit=entry.detail.getObjectByName('SF_Meshy_InfantryRolloutExit');
   if(!meshyStart||!meshyExit)return null;
   entry.gate={kind:entry.kind,root:entry.detail,openBay:true,meshyInfantry:true,
    meshyStart,meshyExit,portal:null,door:null,hall:null,lamp:null,dust:null,ramp:null};
   return entry.gate;
  }
  if(entry.kind==='barracks'){
   const portal=prepareBarracksPortal(entry,this.battlefield.renderer);
   if(!portal)return null;
   const root=portal.root;
   const lampMaterial=new THREE.MeshStandardMaterial({color:'#7d3913',emissive:'#ff9f2a',emissiveIntensity:0});
   const lamp=new THREE.Mesh(bulbGeometry,lampMaterial);
   lamp.position.set(...(portal.pbrDoor?[0,3.01,4.20]:[-.18,1.42,1.65]));
   lamp.visible=false;root.add(lamp);
   entry.gate={kind:'barracks',root,portal,door:null,hall:portal.hall,lamp,dust:null,ramp:null};
   setBarracksDoorOpen(portal,0);
   return entry.gate;
  }
  if(entry.kind==='headquarters'){
   const portal=prepareHeadquartersPortal(entry);
   if(!portal)return null; // Old HQ GLBs keep ordinary immediate fallback spawns.
   const root=portal.root;
   const lampMaterial=new THREE.MeshStandardMaterial({
    color:'#7d3913',emissive:'#ff9f2a',emissiveIntensity:0
   });
   const lamp=new THREE.Mesh(bulbGeometry,lampMaterial);
   lamp.position.set(0,3.20,5.10);lamp.visible=false;root.add(lamp);
   entry.gate={kind:'headquarters',root,portal,door:null,
    hall:portal.hall,lamp,dust:null,ramp:null};
   setHeadquartersDoorOpen(portal,0);
   return entry.gate;
  }
  // Split from original Meshy PBR triangles at GLB export. Keep this actual
  // corrugated door on its original geometry, animate to roll above the bay.
  const meshy=entry.kind==='factory'?meshyFactoryPortal(entry.detail):null;
  if(meshy){
   const {door,start,exit}=meshy,hall=new THREE.Group();
   hall.name='MeshyFactoryWorkshopInterior';
   const floor=new THREE.Mesh(new THREE.BoxGeometry(.47,.013,.85),floorMaterial);
   floor.name='MeshyFactoryInteriorFloor';floor.position.set(-.425,-.345,.02);
   floor.receiveShadow=true;hall.add(floor);
   const back=new THREE.Mesh(new THREE.BoxGeometry(.49,.31,.012),hallMaterial);
   back.name='MeshyFactoryRearBay';back.position.set(-.425,-.178,-.39);
   back.receiveShadow=true;hall.add(back);
   // The auxiliary side tracks looked like two swinging garage doors when
   // the actual roll-up shutter opened. The genuine Meshy shutter is the
   // ONLY animated door; do not generate those two rectangular side panels.
   entry.detail.add(hall);hall.visible=false;
   entry.gate={kind:'factory',root:entry.detail,meshyShutter:true,
    door,rolloutStart:start,rolloutExit:exit,hall,lamp:null,dust:null,ramp:null,
    doorClosedY:door.position.y,doorScaleY:door.scale.y,doorLiftHeight:.330};
   return entry.gate;
  }
  // New authored vehicle factory has a broad permanently OPEN workshop.
  // There is no shutter, warning lamp, opening sound, or closing pause.
  const openBay=entry.detail.getObjectByName('SF_Factory_PBR_OpenBay');
  if(openBay&&(!entry.kind||entry.kind==='factory')){
   entry.gate={kind:'factory',root:entry.detail,openBay:true,
    door:null,hall:null,lamp:null,dust:null,ramp:null};
   return entry.gate;
  }
  // Legacy factory model retains its old rollup-shutter presenter.
  // HQ and barracks have their own portal branches above.
  if(entry.kind&&entry.kind!=='factory')return null;
  const door=entry.detail.getObjectByName('FactoryRollupDoor');
  if(!door)return null;
  const root=door.parent,hall=new THREE.Group();hall.name='FactoryInterior';root.add(hall);
  const finalFactory=Boolean(entry.detail.getObjectByName('SF_Factory_PBR_roof'));
  const doorLiftHeight=finalFactory?1.70:1.48;
  const garageWidth=finalFactory?2.20:1.52;
  const centerX=finalFactory?.198:.18;
  const piece=(name,size,at,material=hallMaterial)=>{
   const mesh=new THREE.Mesh(box,material);mesh.name=name;mesh.scale.set(...size);mesh.position.set(...at);
   mesh.castShadow=true;mesh.receiveShadow=true;hall.add(mesh);return mesh;
  };
  piece('HallFloor',[garageWidth,.03,2.50],[centerX,.245,.30],floorMaterial);
  piece('HallBack',[garageWidth,finalFactory?1.45:1.21,.025],[centerX,finalFactory?.975:.855,-.94]);
  for(const x of [centerX-garageWidth/2,centerX+garageWidth/2])
   piece('HallSide',[.025,finalFactory?1.45:1.21,2.52],[x,finalFactory?.975:.855,.32]);
  piece('HallCeiling',[garageWidth,.025,2.52],[centerX,finalFactory?1.71:1.46,.32]);
  const ramp=piece('ThresholdRamp',[garageWidth,.035,1.35],[centerX,.14,2.16],floorMaterial);ramp.rotation.x=.18;root.add(ramp);
  const dust=piece('RolloutDust',[garageWidth*.80,.025,.55],[centerX,.035,2.3],dustMaterial);dust.castShadow=false;dust.receiveShadow=false;
  const lampMaterial=new THREE.MeshStandardMaterial({color:'#6a2d0c',emissive:'#ff6a13',emissiveIntensity:0});
  const lamp=new THREE.Mesh(bulbGeometry,lampMaterial);lamp.position.set(centerX,finalFactory?1.78:1.53,1.67);root.add(lamp);lamp.visible=false;
  hall.visible=false;
  entry.gate={kind:'factory',root,door,hall,lamp,dust,ramp,doorLiftHeight};return entry.gate;
 }
 reset(entry){
  const gate=entry?.gate;if(!gate)return;
  if(gate.openBay)return; // Nothing on the open factory to close.
  if(gate.meshyShutter){
   gate.door.position.y=gate.doorClosedY;
   gate.door.scale.y=gate.doorScaleY;
   if(gate.hall)gate.hall.visible=false;
   return;
  }
  if(gate.kind==='barracks')setBarracksDoorOpen(gate.portal,0);
  else if(gate.kind==='headquarters')setHeadquartersDoorOpen(gate.portal,0);
  else {gate.door.position.y=0;gate.door.scale.y=1;}
  gate.hall.visible=false;gate.lamp.visible=false;
 }
 update(active=true,alpha=1){
  const bf=this.battlefield,game=this.game;
  // Match the actor renderer's interpolation between 20 Hz snapshots.
  const time=game.time-(active?.05*(1-clamp(alpha)):0);
  if(game.time<this.lastTime){for(const e of bf.bases.values())this.reset(e);this.active.clear();this.seen=new WeakSet(game.productionReleases);}
  this.lastTime=game.time;
  if(!this.active.size&&game.productionReleases.every(event=>this.seen.has(event)))return;
  const entities=new Map(game.units.map(u=>[u.id,u]));
  const bases=new Map(game.bases.map(b=>[b.id,b]));
  for(const event of game.productionReleases){
   if(this.seen.has(event))continue;
   const base=bases.get(event.baseId),entry=bf.bases.get(event.baseId),unit=entities.get(event.unitId);
   const actor=bf.units.get(event.unitId);
   // Airborne departures have their OWN staged flightline presenter.
   // Never cancel its production hold or reveal the parked aircraft here.
   if(base?.kind==='airfield'&&['bomber','scout'].includes(event.kind)){
    this.seen.add(event);
    continue;
   }
   const age=time-event.at;
   // A factory GLB can finish streaming after the real unit was produced.
   // Briefly hold that single authoritative unit while its actual shutter
   // loads, rather than letting it materialize outside the closed door.
   const eligible=Boolean(base&&(['factory','barracks'].includes(base.kind)||
    (base.kind==='headquarters'&&event.kind==='engineer'))&&
    unit&&unit.hp>0&&entry?.node.visible&&actor);
   // Factory production is already supported for tanks, Humvees (rover)
   // and rocket trucks (artillery). A single physical garage has ONE door:
   // serialize their visual departures instead of letting the second unit
   // materialize outside when the first rollout exceeds 5.5 seconds.
   const busy=eligible&&this.active.has(base.id);
   const ready=eligible&&!busy&&this.prepare(entry);
   if(!ready){
    // The 5.5-second bound applies only to a BROKEN / unloaded gate. Never
    // expire a valid vehicle queued behind another live garage departure.
    // The held unit keeps its original paid rally order and legal spawn.
    if(eligible&&game.stageWebGLProduction===true&&age>=0&&
       (busy||age<5.5)){
     game.extendProductionDeparture?.(event.unitId,game.time+.2);
     actor.node.visible=false;
     continue;
    }
    this.seen.add(event);
    game.cancelProductionDeparture?.(event.unitId);
    if(actor)actor.node.visible=true;
    continue;
   }
   // The classic presentation still ignores events that arrive late.
   if(age>.15&&game.stageWebGLProduction!==true){
    this.seen.add(event);game.cancelProductionDeparture?.(event.unitId);
    continue;
   }
   this.seen.add(event);
   entry.node.updateWorldMatrix(true,true);
   const barracks=base.kind==='barracks',headquarters=base.kind==='headquarters';
   const infantry=barracks||headquarters,root=entry.gate.root;
   const pbrBarracks=barracks&&entry.gate.portal?.pbrDoor===true;
   // New PBR gate sits at z≈4.0; Atlas legacy gate sat at z≈1.5.
   const exit=entry.gate.meshyShutter?
    entry.gate.rolloutExit.getWorldPosition(new THREE.Vector3()):
    entry.gate.meshyInfantry?entry.gate.meshyExit.getWorldPosition(new THREE.Vector3()):
    root.localToWorld(entry.gate.openBay?new THREE.Vector3(.18,.16,3.45):
    headquarters?new THREE.Vector3(0,.14,6.35):barracks?
    (pbrBarracks?new THREE.Vector3(0,.55,5.20):new THREE.Vector3(-.18,0,2.10)):
    new THREE.Vector3(.18,0,2.9));
   const start=entry.gate.meshyShutter?
    entry.gate.rolloutStart.getWorldPosition(new THREE.Vector3()):
    entry.gate.meshyInfantry?entry.gate.meshyStart.getWorldPosition(new THREE.Vector3()):
    root.localToWorld(entry.gate.openBay?new THREE.Vector3(.18,.26,-.24):
    headquarters?new THREE.Vector3(0,.61,4.12):barracks?
    (pbrBarracks?new THREE.Vector3(0,.58,3.23):new THREE.Vector3(-.18,.275,.9)):
    new THREE.Vector3(.18,.265,-.03));
   const target=bf.entityPosition(unit),center=entry.node.position;
   const exitAngle=Math.atan2(exit.x-center.x,exit.z-center.z);
   const targetAngle=Math.atan2(target.x-center.x,target.z-center.z);
   const turn=Math.abs(Math.atan2(Math.sin(targetAngle-exitAngle),Math.cos(targetAngle-exitAngle)));
   const radius=Math.max(headquarters?145:barracks?90:160,Math.hypot(exit.x-center.x,exit.z-center.z));
   const frontRadius=Math.hypot(exit.x-center.x,exit.z-center.z);
   const targetRadius=Math.hypot(target.x-center.x,target.z-center.z);
   // For real frontal infantry exits travel exactly along the physical
   // doorway and then the lawful simulation point, at constant foot speed.
   const directFoot=infantry&&turn<.72&&targetRadius>=frontRadius-8;
   const doorLength=start.distanceTo(exit);
   const exteriorLength=exit.distanceTo(target);
   // Ordinary garage exits should be a continuous forward drive, not an
   // easing turn around the whole factory courtyard with two stops.
   const directRollout=!infantry&&turn<.78&&targetRadius>=frontRadius-8;
   const length=directFoot||directRollout?doorLength+exteriorLength:
    doorLength+turn*radius+Math.abs(radius-targetRadius);
   // Rear-facing exits need more travel time around the footprint, rather
   // than accelerating a tank to Humvee speed to meet a fixed deadline.
   const footSpeed=unit.kind==='heavy'?78:unit.kind==='rocket'?92:105;
   const vehicleSpeed=unit.kind==='tank'?74:unit.kind==='artillery'?80:98;
   const duration=directFoot?Math.max(.30,length/footSpeed):
    directRollout?Math.max(2.0,length/vehicleSpeed):
    Math.max(infantry?2.8:GATE_TIMING.drive,length/(infantry?footSpeed:vehicleSpeed));
   // Freeze only the real simulation actor's departure, NOT production or
   // its paid rally order. At the exact portal hand-off it resumes ordinary
   // 20 Hz movement from the same lawful spawn with no visual teleport.
   const visualAt=age>.15&&game.stageWebGLProduction===true?game.time:event.at;
   const openBay=entry.gate.openBay===true;
   game.extendProductionDeparture?.(unit.id,visualAt+
    (openBay?0:GATE_TIMING.warning+GATE_TIMING.opening)+duration+.05);
   this.active.set(base.id,{event,visualAt,duration,openBay,directFoot,directRollout,doorLength,
    exteriorLength,target:target.clone(),walkStart:start.clone(),walkExit:exit.clone(),
    hasRally:unit.orders?.some(o=>o.kind==='move'||o.kind==='attackMove')===true,
    orders:orderKey(unit),hp:unit.hp,baseHp:base.hp});
  }
  for(const [id,state] of this.active){
   const {event}=state,base=bases.get(id),entry=bf.bases.get(id),u=entities.get(event.unitId),actor=bf.units.get(event.unitId);
   const age=Math.max(0,time-(state.visualAt??event.at));
   const pose=state.openBay?{
    open:1,drive:smooth(age/state.duration),
    moving:age<state.duration,done:age>=state.duration+.05
   }:productionGatePose(age,state.duration);
   // The actor is intentionally invisible before the shutter opens; hiding
   // it must NOT abort its own departure on the following render frame.
   if(!base||base.hp<=0||!u||u.hp<=0||!actor||!entry?.node.visible||
      u.hp<state.hp||base.hp<state.baseHp||u.fire>0||u.combatTarget||orderKey(u)!==state.orders||pose.done){
    this.reset(entry);if(actor)actor.productionMotion=null;
    game.cancelProductionDeparture?.(event.unitId);
    this.active.delete(id);continue;
   }
   const gate=entry.gate;
   if(gate.kind==='barracks'&&!gate.openBay){
    updateBarracksPortalPlanes(gate.portal);
    setBarracksDoorOpen(gate.portal,pose.open);
   }else if(gate.kind==='headquarters'&&!gate.openBay)setHeadquartersDoorOpen(gate.portal,pose.open);
   else if(gate.meshyShutter){
    // Collapse the real shutter into a narrow stripe under its lintel;
    // do not float a solid slab through the roof or discard PBR maps.
    gate.door.position.y=gate.doorClosedY+gate.doorLiftHeight*pose.open;
    gate.door.scale.y=gate.doorScaleY*(1-pose.open*.94);
   }else if(!gate.openBay){
    gate.door.scale.y=1-pose.open*.96;
    gate.door.position.y=(gate.doorLiftHeight??1.48)*pose.open*.96;
   }
   if(gate.hall)gate.hall.visible=gate.meshyShutter?pose.open>.015:
    age>=GATE_TIMING.warning&&pose.open>.01;
   if(gate.lamp){
    gate.lamp.visible=true;
    gate.lamp.material.emissiveIntensity=(Math.sin(age*22)>0?3:.25);
   }
   if(gate.dust){gate.dust.visible=pose.moving;gate.dust.scale.x=1.2+pose.drive*.4;}
   if(!gate.openBay&&!state.sounded&&age>=GATE_TIMING.warning){
    if(entry.node.visible)bf.sound?.productionGate?.(gate.kind);state.sounded=true;
   }
   const driveStart=gate.openBay?0:GATE_TIMING.warning+GATE_TIMING.opening;
   const fraction=clamp((age-driveStart)/state.duration);
   if(fraction>=1){
    // Finish at the exact Simulation spawn and release the paid rally
    // immediately, while the doors close independently in the background.
    // Previously one extra stationary second caused an obvious stop/start.
    if(!state.released){
     // The last cosmetic frame lands exactly at the already paid exterior
     // spawn; the next Simulation tick can continue to the rally without
     // any pop-back or an extra stationary second.
     actor.node.position.copy(state.target);
     actor.node.visible=true;
     game.cancelProductionDeparture?.(event.unitId);
     state.released=true;
     state.releaseTime=game.time;
    }
    // The authoritative rally starts on the next 20Hz tick. Keep the
    // SAME foot walk clip for at most two ticks, instead of flashing idle
    // between visual clearance and the first real path step.
    const keepWalking=Boolean(state.released&&state.hasRally&&!u.moving&&
     game.time-(state.releaseTime??game.time)<.12);
    actor.productionMotion=keepWalking&&state.lastMotion?
     {...state.lastMotion,moving:true,hideHealth:false}:null;
    continue;
   }
   entry.node.updateWorldMatrix(true,true);
   // First clear the entire hull and barrel past the real threshold. Only
   // outside the gate may the actor turn toward Simulation's actual exit.
   const headquarters=gate.kind==='headquarters';
   const infantry=gate.kind==='barracks'||headquarters;
   const pbrBarracks=gate.kind==='barracks'&&gate.portal?.pbrDoor===true;
   const outside=gate.meshyShutter?
    gate.rolloutExit.getWorldPosition(new THREE.Vector3()):
    gate.openBay?new THREE.Vector3(.18,.16,3.45):
    headquarters?new THREE.Vector3(0,.14,6.35):infantry?
    (pbrBarracks?new THREE.Vector3(0,.55,5.20):new THREE.Vector3(-.18,0,2.10)):
    new THREE.Vector3(.18,0,2.9);
   const root=gate.root;
   if(!gate.meshyShutter)root.localToWorld(outside);
   // Stable AUTHORITATIVE release point. Reading actor.node.position here
   // used our *previous animated frame* as the next target and produced the
   // observed jerking/fast-then-slow feedback loop.
   const target=state.target.clone();
   // Infantry should leave at a believable running pace, not spend 1.65s
   // taking two short steps and abruptly accelerate after the threshold.
   // Vehicle rollouts keep their original smooth clearance.
   const clearFraction=state.directFoot||state.directRollout?
    clamp(state.doorLength/Math.max(.001,state.doorLength+state.exteriorLength)):
    Math.min(.95,(infantry ? 0.50 : GATE_TIMING.drive*.62)/state.duration);
   let p,yaw;
   const facing=buildingFacingAngle(base.facing);
   if(fraction<clearFraction){
    if(state.directFoot||gate.openBay||gate.meshyShutter){
     // Physical distance divided by authoritative foot speed, without
     // the previous acceleration/deceleration at the portal.
     p=state.walkStart.clone().lerp(state.walkExit,clamp(fraction/clearFraction));
    }else{
     const t=clamp(fraction/clearFraction);
     const z=headquarters?4.12+2.23*t:infantry?(pbrBarracks?3.23+1.97*t:.9+1.20*t):-.03+2.93*t;
     const y=headquarters?(.61-.47*t):infantry?(pbrBarracks?(0.58-0.03*t):(0.275*(1-t))):
      (z<=1.5?0.265:Math.max(0,0.265*(2.9-z)/1.4));
     p=root.localToWorld(new THREE.Vector3(headquarters?0:infantry?(pbrBarracks?0:-.18):.18,y,z));
    }
    yaw=facing;
   }else if(state.directFoot||state.directRollout){
    const t=clamp((fraction-clearFraction)/Math.max(.00001,1-clearFraction));
    p=state.walkExit.clone().lerp(target,t);
    const tangent=target.clone().sub(state.walkExit);tangent.y=0;
    const goalYaw=tangent.lengthSq()>.0001?Math.atan2(tangent.x,tangent.z):facing;
    // Let vehicle steering turn smoothly OUTSIDE the entrance, without
    // reversing or snapping as soon as its hull clears the shutter.
    yaw=facing+Math.atan2(Math.sin(goalYaw-facing),
     Math.cos(goalYaw-facing))*(state.directRollout?smooth(t/.25):1);
    if(state.hasRally){
     const heading=Math.PI/2-(u.hullAngle??u.angle);
     const blend=smooth((fraction-.72)/.28);
     yaw+=Math.atan2(Math.sin(heading-yaw),Math.cos(heading-yaw))*blend;
    }
   }else{
    // Route around the footprint for every cardinal facing. The simulation's
    // legacy spawn search is independent of building rotation, so a direct
    // chord to its destination could otherwise cross the hall a second time.
    const t=clamp((fraction-clearFraction)/(1-clearFraction));
    const center=entry.node.position;
    const startAngle=Math.atan2(outside.x-center.x,outside.z-center.z);
    const endAngle=Math.atan2(target.x-center.x,target.z-center.z);
    const turn=Math.atan2(Math.sin(endAngle-startAngle),Math.cos(endAngle-startAngle));
    const startRadius=Math.hypot(outside.x-center.x,outside.z-center.z);
    const endRadius=Math.hypot(target.x-center.x,target.z-center.z);
    const radius=Math.max(startRadius,headquarters?145:infantry?90:160);
    const path=q=>{
     const angle=startAngle+turn*clamp(q/.76);
     const r=q<.76?startRadius+(radius-startRadius)*smooth(q/.22):radius+(endRadius-radius)*smooth((q-.76)/.24);
     return new THREE.Vector3(center.x+Math.sin(angle)*r,target.y,center.z+Math.cos(angle)*r);
    };
    p=path(t);
    const tangent=path(Math.min(1,t+.001)).sub(path(Math.max(0,t-.001)));
    yaw=tangent.lengthSq()>.00001?Math.atan2(tangent.x,tangent.z):facing;
    const heading=Math.PI/2-(u.hullAngle??u.angle);
    const blend=smooth((t-.90)/.10);
    yaw+=Math.atan2(Math.sin(heading-yaw),Math.cos(heading-yaw))*blend;
   }
   p.y=Math.max(p.y,bf.heightAt(p.x+bf.world.size/2,p.z+bf.world.size/2));
   // Avoid a purely visual collision with an authoritative neighboring actor.
   // An interrupted rollout reveals the real node at its real position.
   const worldPoint={x:p.x+bf.world.size/2,y:p.z+bf.world.size/2};
   const obstacles=game.obstacles?.().filter(b=>b.id!==id)??[];
   // The door starts INSIDE its own collision footprint. Check ordinary
   // walkability only after the unit's hull clears the threshold; player
   // actors blocking the visible route remain genuine abort conditions.
   let blocked=pose.moving&&fraction>=clearFraction&&
    bf.world.walkable?.(worldPoint,obstacles,24)===false;
   if(pose.moving)for(const [otherId,other] of bf.units){
    if(otherId===u.id||!other.node.visible)continue;
    // Use real infantry spacing instead of vehicle-sized 48-unit aborts,
    // which made freshly produced soldiers pop near the default idle spot.
    const safeDistance=infantry?24:48;
    if(Math.hypot(p.x-other.node.position.x,p.z-other.node.position.z)<safeDistance){blocked=true;break;}
   }
   if(blocked){
    this.reset(entry);actor.productionMotion=null;
    game.cancelProductionDeparture?.(event.unitId);
    this.active.delete(id);continue;
   }
   actor.node.position.copy(p);actor.node.rotation.y=yaw;
   const moving=pose.moving;
   const distance=(state.distance??0)+(state.position?p.distanceTo(state.position):0);
   const elapsed=time-(state.motionTime??time);
   const speed=elapsed>0&&state.position?p.distanceTo(state.position)/elapsed:0;
   state.distance=distance;state.position=p;state.motionTime=time;
   // The shutter may still be animating while the vehicle is motionless.
   // Gate state does not imply physical wheel rotation.
   const actuallyRolling=infantry?moving&&speed>.25:rolloutWheelsShouldRoll(moving,speed);
   actor.productionMotion={moving:actuallyRolling,hideHealth:fraction<clearFraction*.64,driveSpeed:speed,walkDistance:distance,angle:Math.PI/2-yaw,hullAngle:Math.PI/2-yaw};
   // Keep the rolling wheels/track clip for the first 0.12 s of the
   // authoritative rally transition, preventing an idle-frame flicker.
   if(state.hasRally)state.lastMotion=actor.productionMotion;
   actor.node.visible=gate.openBay||age>=GATE_TIMING.warning;
   // Never hide a vehicle while waiting for a shutter that no longer exists.
  }
 }
 detach(entry){
  this.reset(entry);
  if(entry?.gate){
   if(entry.gate.lamp){
    entry.gate.lamp.material.dispose();entry.gate.lamp.removeFromParent();
   }
   entry.gate.ramp?.removeFromParent();
   if(entry.gate.kind==='barracks')disposeBarracksPortal(entry);
   else if(entry.gate.kind==='headquarters')disposeHeadquartersPortal(entry);
   else{
    entry.gate.hall?.removeFromParent();
    if(entry.gate.meshyShutter&&entry.gate.hall)
     entry.gate.hall.traverse(m=>{if(m.isMesh&&m.geometry!==box)m.geometry.dispose();});
   }
   delete entry.gate;
  }
 }
 dispose(){
  for(const entry of this.battlefield.bases.values()){
   this.detach(entry);
  }
  this.active.clear();
 }
}
