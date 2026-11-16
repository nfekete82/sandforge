import * as THREE from 'three';
import {airfieldPoint} from '/src/reborn/airfield-maintenance.js';
import {unitVisualYaw} from '/webgl-scale.js';
import {airfieldLaunchPose,airfieldLaunchLeg,airfieldLaunchDuration} from '/webgl-airfield-launch-path.js';

const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
const length=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const flightKinds=new Set(['scout','bomber']);

/** One paid real unit per release. A visual-only presenter controls no
 * simulation coordinates or physics; the real actor waits at a lawful
 * exterior point and resumes its original rally after exact handoff.
 * Helicopters lift off from the front apron; bombers taxi to the runway.
 */
export class SandforgeAirfieldLaunch {
 constructor(battlefield){
  this.battlefield=battlefield;
  this.game=battlefield.game;
  this.seen=new WeakSet(this.game.productionReleases);
  this.active=new Map();
  this.lastTime=this.game.time;
 }
 release(baseId,state,{restore=true}={}){
  this.active.delete(baseId);
  const entry=this.battlefield.bases.get(baseId);
  if(entry?.airfieldServiceYard)
   entry.airfieldServiceYard.userData.airfieldProductionOpen=0;
  const actor=this.battlefield.units.get(state.event.unitId);
  const u=this.game.units.find(u=>u.id===state.event.unitId);
  if(actor){
   actor.productionMotion=null;
   if(u&&restore){
    actor.node.position.copy(this.battlefield.entityPosition(u));
    actor.node.visible=u.owner===0||this.game.canSee(0,u);
   }
  }
  this.game.cancelProductionDeparture?.(state.event.unitId);
 }
 update(active=true){
  const bf=this.battlefield,game=this.game,time=game.time;
  if(time<this.lastTime){
   for(const [id,state] of this.active)this.release(id,state);
   this.seen=new WeakSet(game.productionReleases);
  }
  this.lastTime=time;
  // Paused RAF still refreshes model positions. Reapply the frozen rollout
  // pose or the actor would briefly teleport to its real runway handoff.
  // Only receipt of NEW release events pauses; existing animations remain
  // displayed at the same Simulation time.
  const entities=new Map(game.units.map(u=>[u.id,u]));
  const bases=new Map(game.bases.map(b=>[b.id,b]));
  for(const event of active?game.productionReleases:[]){
   if(this.seen.has(event)||!flightKinds.has(event.kind))continue;
   const base=bases.get(event.baseId);
   if(!base||base.kind!=='airfield'){this.seen.add(event);continue;}
   const u=entities.get(event.unitId);
   const entry=bf.bases.get(base.id);
   const actor=bf.units.get(event.unitId);
   const yard=entry?.airfieldServiceYard;
   const ready=Boolean(game.stageWebGLProduction&&u?.hp>0&&base.hp>0&&
    base.buildRemaining<=0&&entry?.node.visible&&actor&&yard);
   // Only staged lawful exits may be animated. If a factory was built near a
   // map edge, Simulation uses the original safe fallback instead.
   const finish=airfieldPoint(base,event.kind==='bomber'?'departure':'lineup');
   const lawful=Boolean(u&&length(u,finish)<2);
   if(!ready||!lawful){
    this.seen.add(event);
    game.cancelProductionDeparture?.(event.unitId);
    continue;
   }
   if(this.active.has(base.id)){
    // One hangar, one pair of doors. Queue the next real unit, do not spawn
    // a second fake bomber on top of the first one's taxi animation.
    game.extendProductionDeparture?.(event.unitId,time+.4);
    actor.node.visible=false;
    continue;
   }
   this.seen.add(event);
   const state={event,at:time,duration:airfieldLaunchDuration(event.kind)};
   this.active.set(base.id,state);
   game.extendProductionDeparture?.(event.unitId,time+state.duration+.1);
  }
  for(const [baseId,state] of this.active){
   const {event}=state,base=bases.get(baseId),unit=entities.get(event.unitId);
   const entry=bf.bases.get(baseId),actor=bf.units.get(event.unitId);
   const yard=entry?.airfieldServiceYard;
   if(!base||base.hp<=0||!unit||unit.hp<=0||!actor||!yard||
       !entry.node.visible||unit.airfieldService||unit.carrier){
    this.release(baseId,state);continue;
   }
   const pose=airfieldLaunchPose(event.kind,time-state.at);
   if(!pose||pose.done){this.release(baseId,state);continue;}
   game.extendProductionDeparture?.(unit.id,time+.35);
   yard.userData.airfieldProductionOpen=pose.open;
   // No teleport: same local flightline as arrival/repair, same building
   // facing and exact post-launch Simulation position on the final frame.
   const leg=airfieldLaunchLeg(event.kind,pose);
   const p0=airfieldPoint(base,leg.from),p1=airfieldPoint(base,leg.to);
   const point={x:p0.x+(p1.x-p0.x)*leg.t,y:p0.y+(p1.y-p0.y)*leg.t};
   const at=bf.heightAt(base.x,base.y);
   const surface=Math.max(at,bf.heightAt(point.x,point.y));
   const height=surface+7+168*pose.lift;
   const worldPoint=bf.pos(point.x,point.y,height);
   actor.node.position.copy(worldPoint);
   const dx=p1.x-p0.x,dy=p1.y-p0.y;
   const forward=dx*dx+dy*dy>.5?
    Math.atan2(dy,dx):[Math.PI/2,-Math.PI/2,0,Math.PI][base.facing??0];
   actor.node.rotation.y=unitVisualYaw(unit.kind,forward);
   actor.node.visible=pose.visible&&(unit.owner===0||game.canSee(0,unit));
   actor.productionMotion={
    moving:pose.stage==='taxi'||pose.stage==='takeoff',hideHealth:!pose.visible,
    angle:forward,flightHeight:pose.lift,driveSpeed:pose.stage==='taxi'?90:180
   };
  }
 }
 dispose(){
  for(const [id,state] of this.active)this.release(id,state);
  this.active.clear();
 }
}
