/** Pure WebGL input helpers for deterministic, rotation-aware maintenance targeting.
 * Gameplay owns repairs; this module only routes player clicks to a site.
 */
const kinds=Object.freeze({airfield:new Set(['bomber','scout'])});
const headings=[0,Math.PI,Math.PI/2,Math.PI*1.5];
export function selectedMaintenanceKind(units,selected){
 const picked=units.filter(u=>selected.has(u.id)&&u.owner===0&&u.hp>0&&!u.carrier);
 const planes=picked.some(u=>kinds.airfield.has(u.kind));
 return planes?'airfield':null;
}
export function serviceFootprintContains(base,point){
 if(!base||!point||!kinds[base.kind]||!Number.isFinite(point.x)||!Number.isFinite(point.y))return false;
 const angle=headings[base.facing??0]??0,c=Math.cos(angle),s=Math.sin(angle);
 const dx=point.x-base.x,dz=point.y-base.y;
 const localX=dx*c-dz*s,localZ=dx*s+dz*c;
 // Only the hangar can provide automated service. Factory clicks are moves.
 return localX>=-200&&localX<=181&&localZ>=-153&&localZ<=209;
}

/** Right-click targeting precedence. Ground-based enemies standing on a
 * friendly airport runway are still ATTACK TARGETS, not repair
 * facility clicks. This decision only routes input; Simulation.command()
 * authoritatively validates ownership, weapon and attack range. */
export function maintenanceClickAllowed({enemy=null,attackMode=false,rallyMode=false,
 strategicTargetMode=false,building=false,hasSelectedUnits=false,
 hasSelectedBase=false}={}){
 return !enemy&&!attackMode&&!rallyMode&&!strategicTargetMode&&
  !building&&hasSelectedUnits&&!hasSelectedBase;
}
