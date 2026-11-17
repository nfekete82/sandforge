/** Identify ONLY player units actually rendered inside the current camera:
 * no fog-hidden soldiers, offscreen units, dead actors or embarked passengers.
 * Both double-click and the compact ALLE button share the exact same policy.
 */
export function visibleFriendlyUnits(units,entries,{kind=null,project,isVisible=()=>true}={}){
 if(typeof project!=='function')return [];
 const matching=[];
 for(const unit of units){
  if(unit.owner!==0||(kind&&unit.kind!==kind)||unit.hp<=0||unit.carrier)continue;
  const entry=entries.get(unit.id);
  if(!entry||entry.node?.visible===false||!entry.node)continue;
  const ndc=project(entry.node,unit);
  if(!ndc||![ndc.x,ndc.y,ndc.z].every(Number.isFinite))continue;
  if(ndc.x<-1||ndc.x>1||ndc.y<-1||ndc.y>1||ndc.z<-1||ndc.z>1)continue;
  if(!isVisible(ndc,unit))continue;
  matching.push(unit.id);
 }
 return matching;
}
export function sameKindVisibleUnits(units,entries,kind,options={}){
 if(!kind)return [];
 return visibleFriendlyUnits(units,entries,{...options,kind});
}
