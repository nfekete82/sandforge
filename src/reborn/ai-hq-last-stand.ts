/** Last-stand doctrine for a genuinely observed attack on the AI HQ.
 * No player roster queries: caller supplies only actually visible hostiles,
 * plus public damage to the AI's own building. Positions are never inferred.
 */
export interface ObservedHomeThreat {
 id:number;kind:string;distance:number;
}
export interface HqLastStandDecision {
 emergency:boolean;focus:number|null;observedCount:number;
}
export function hqLastStandDecision(x:{
 mapVersion:number;hqDamaged:boolean;observed:ObservedHomeThreat[];
}):HqLastStandDecision{
 if(x.mapVersion<23)return {emergency:false,focus:null,observedCount:0};
 const threats=x.observed.filter(t=>t.distance<=920)
  .sort((a,b)=>
   (a.distance-(a.kind==='tank'?180:a.kind==='artillery'?145:0))-
   (b.distance-(b.kind==='tank'?180:b.kind==='artillery'?145:0))||
   a.id-b.id);
 const armored=threats.filter(t=>t.kind==='tank'||t.kind==='artillery').length;
 const emergency=x.hqDamaged||
  threats.some(t=>t.distance<=580)||
  armored>=3&&threats.some(t=>t.distance<920);
 return {emergency,focus:threats[0]?.id??null,observedCount:threats.length};
}
