/** AI 3.5: protect earned Bastion income with real, locally reachable troops.
 * Only public Bastion ownership/capture state and visible enemy contacts are
 * inputs. No hidden enemy reads, extra money or free reinforcements.
 */
export interface GuardFront {
 id:number;income:number;capturing:number;progress:number;
 enemyAdjacent:boolean;visibleRaiders:number;
}
/** Higher priority means more urgent to garrison. */
export function bastionGuardPriority(x:GuardFront):number{
 const capture=x.capturing===0?1100+Math.min(8,Math.max(0,x.progress))*65:0;
 return capture+Math.min(4,Math.max(0,x.visibleRaiders))*210+
  (x.enemyAdjacent?220:0)+Math.max(0,x.income)*9;
}
/** Only when enough PAID forces exist, reserve a small Bastion garrison.
 * Eight-Bastion battles need 1 frontier + >=2 HQ guards; sixteen-Bastion
 * battles need 1 frontier + >=3 HQ guards. Never strip a tiny army. */
export function bastionGarrisonReserve(mapVersion:number,owned:number,available:number):number{
 if(owned<2)return 0;
 if(mapVersion===24&&available>=8)return 3;
 if(mapVersion===26&&available>=10)return 4;
 return 0;
}
export interface VisibleThreat {
 distanceToAsset:number;distanceToHQ:number;kind:string;
 endangeredIncome:number;insideCaptureRing:boolean;
}
/** Lower score means defend sooner. A genuine HQ attack still beats a
 * diversion at the edge of the map. The enemy must be actually visible. */
export function observedDefensePriority(x:VisibleThreat):number{
 const weapon=x.kind==='artillery'?250:x.kind==='heavy'?100:x.kind==='bomber'?120:0;
 const hq=x.distanceToHQ<240?1600:0;
 const capture=x.insideCaptureRing?650+Math.min(35,Math.max(0,x.endangeredIncome))*12:0;
 return x.distanceToAsset-weapon-hq-capture;
}
/** Only this opt-in experiment changes modern 8/16 Bastion missions. */
export function publicBastionDeficit(mapVersion:number,blue:number,red:number):boolean{
 if(mapVersion!==24&&mapVersion!==26)return false;
 return blue>=3&&blue-red>=2;
}
