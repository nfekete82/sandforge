/** Presentation only: cached transforms, no simulation writes, geometry or textures. */
export const GROUND_VEHICLES=new Set(['tank','rover','artillery','supply']);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
export function easeAngle(current,target,dt,response=16){
 return current+angleDelta(current,target)*(1-Math.exp(-response*Math.max(0,dt)));
}
/** Fast mechanical kick followed by a slower return, in authored model metres. */
export function cannonKick(remaining){
 if(!(remaining>0))return 0;
 const age=.20-clamp(remaining,0,.20);
 return .10*(age<.025?age/.025:((.20-age)/.175)**2);
}
export function vehiclePose(entry,unit,{x,z,heightAt,time,dt,active,lite=false}){
 const yaw=Math.PI*.5-(Number.isFinite(unit.hullAngle)?unit.hullAngle:unit.angle);
 const travel=Math.hypot(unit.x-unit.previousX,unit.y-unit.previousY);
 const valid=Number.isFinite(travel)&&travel<180;
 let p=entry.vehiclePose;
 if(!p||!valid){
  p=entry.vehiclePose={yaw,aim:unit.angle,speed:0,pitch:0,roll:0,
   terrainPitch:0,terrainRoll:0,sampleAt:-Infinity,nextSampleAt:-Infinity,sampleX:NaN,sampleZ:NaN,sampleYaw:NaN};
 }
 if(!active||!(dt>0))return p;
 const step=Math.min(.08,dt),weight=1-Math.exp(-step*12);
 const oldSpeed=p.speed,oldYaw=p.yaw;
 p.yaw=easeAngle(p.yaw,yaw,step);
 p.aim=easeAngle(p.aim,unit.angle,step,20);
 p.speed+=(valid?travel/.05-p.speed:-p.speed)*weight;
 // Four support points, at most 10 Hz per visible moving actor. A parked
 // actor and lite mode require no extra terrain queries. Service platforms
 // remain level and use the existing service-ground transition.
 const service=unit.factoryService||unit.airfieldService||entry.productionMotion;
 const moved=Math.hypot(x-p.sampleX,z-p.sampleZ);
 if(!lite&&!service&&time+1e-9>=p.nextSampleAt&&(!Number.isFinite(p.sampleX)||moved>2||Math.abs(angleDelta(p.sampleYaw,p.yaw))>.06)){
  const length=clamp((entry.modelFootprint??76)*.32,15,34),width=length*.62;
  const sx=Math.sin(p.yaw),cz=Math.cos(p.yaw);
  p.terrainPitch=clamp(-Math.atan2(heightAt(x+sx*length,z+cz*length)-heightAt(x-sx*length,z-cz*length),2*length),-.30,.30);
  p.terrainRoll=clamp(Math.atan2(heightAt(x+cz*width,z-sx*width)-heightAt(x-cz*width,z+sx*width),2*width),-.24,.24);
  // Spread the first resample over two 20-Hz ticks instead of making an
  // entire convoy evaluate its support points on the same simulation tick.
  p.nextSampleAt=time+.10+(!Number.isFinite(p.sampleX)?((unit.id??0)&1)*.05:0);
  p.sampleAt=time;p.sampleX=x;p.sampleZ=z;p.sampleYaw=p.yaw;
 }
 const ride=unit.kind==='tank'?.48:unit.kind==='artillery'?.75:1;
 const brake=clamp((oldSpeed-p.speed)*.0005,-.012,.012)*ride;
 const bank=clamp(angleDelta(oldYaw,p.yaw)*p.speed*.002,-.016,.016)*ride;
 p.pitch+=((service?0:p.terrainPitch)+brake-p.pitch)*weight;
 p.roll+=((service?0:p.terrainRoll)+bank-p.roll)*weight;
 // Keep the actor's centre on the interpolated authoritative ground. Only
 // the tiny sprung motion changes height; selection/collision stays 2D.
 p.heave=lite||service?0:Math.sin((unit.walkDistance??0)*.16)*.26*ride*clamp(p.speed/90,0,1);
 return p;
}
