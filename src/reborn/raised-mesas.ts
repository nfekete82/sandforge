import type {Point} from './config.js';

/** New, opt-in v7 physical mesas. Old maps and save geometry never use these. */
export interface RaisedMesa {
 center:Point; topRadius:number; footRadius:number;
 height:number; rampEnd:number; rampWidth:number;
 direction:Point; seed:number; siteIndex:number;
}
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};

/** Shared 9/5-fold eroded outline for the actual heightfield AND cliff facade. */
export function mesaRadiusFactor(theta:number,mesa:RaisedMesa):number{
 const phase=mesa.seed*.00047+mesa.siteIndex*1.7;
 return 1+.045*Math.sin(theta*5+phase)+.025*Math.cos(theta*9-phase*.8);
}
export function mesaLocation(p:Point,mesa:RaisedMesa){
 const dx=p.x-mesa.center.x,dy=p.y-mesa.center.y;
 const angle=Math.atan2(dy,dx);
 const radius=Math.hypot(dx,dy)/mesaRadiusFactor(angle,mesa);
 const along=dx*mesa.direction.x+dy*mesa.direction.y;
 const lateral=Math.abs(dx*mesa.direction.y-dy*mesa.direction.x);
 return {radius,along,lateral,angle};
}
export function mesaRampCoverage(p:Point,mesa:RaisedMesa):number{
 const {along,lateral}=mesaLocation(p,mesa);
 if(along<mesa.topRadius-80||along>mesa.rampEnd+80)return 0;
 return 1-smooth((lateral-mesa.rampWidth*.56)/(mesa.rampWidth*.36));
}
export function raisedMesaHeight(base:number,p:Point,mesa:RaisedMesa):number{
 const {radius,along}=mesaLocation(p,mesa);
 if(radius>mesa.rampEnd+100)return base;
 const cliff=1-smooth((radius-mesa.topRadius)/(mesa.footRadius-mesa.topRadius));
 // The single motorable slope descends over nearly a kilometre. The other
 // sides remain steep cliffs, with a naturally varied eroded outline.
 const ramp=clamp((mesa.rampEnd-along)/(mesa.rampEnd-mesa.topRadius));
 const coverage=mesaRampCoverage(p,mesa);
 const lift=cliff*(1-coverage)+ramp*coverage;
 // The top is a real LEVEL gameplay surface; the ramp merges continuously
 // with the already-graded world ground at its bottom.
 return base+(mesa.height-base)*lift;
}
/** Physically impassable cliff band surrounding an otherwise buildable top.
 * Never gate cliff collision on sampled per-triangle slope: that created
 * unblocked single cells *inside* the steep rocky wall, which were cut off
 * from the entire battlefield and failed the isolated-ground validation.
 *
 * The only opening is the same authored, wide downhill vehicle ramp whose
 * physical height profile is shared with WebGL. No invisible new shortcuts.
 */
export function raisedMesaCliffBlocked(p:Point,mesa:RaisedMesa,_slope:number):boolean{
 const {radius}=mesaLocation(p,mesa);
 if(radius<mesa.topRadius-45||radius>mesa.footRadius+55)return false;
 if(mesaRampCoverage(p,mesa)>.72)return false;
 return true;
}
