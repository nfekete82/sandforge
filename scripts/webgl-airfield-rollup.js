// One vertical, segmented industrial shutter: 16 full-width panels wind into
// the overhead drum instead of sliding sideways or deforming whole door meshes.
// Presentation-only; all aircraft pathing, bay timing and collision are unchanged.
export const AIRFIELD_ROLLUP_VERSION='segmented-vertical-shutter-v2-20261116';
export const AIRFIELD_ROLLUP_SLATS=16;
export const AIRFIELD_ROLLUP_FIRST_Y=6;
export const AIRFIELD_ROLLUP_STEP=4;
export const AIRFIELD_ROLLUP_TRAVEL=64;
export function applyAirfieldRollup(gate,progress=gate?.open??0){
 if(!gate)return;
 const p=Math.min(1,Math.max(0,Number(progress)||0));
 // Use exact Simulation-timed pose. Top slats roll away first as the
 // remaining shutter rises without stretching its physical metal ribs.
 for(const [i,slat] of (gate.slats??[]).entries()){
  if(!slat)continue;
  const rest=AIRFIELD_ROLLUP_FIRST_Y+i*AIRFIELD_ROLLUP_STEP;
  const y=rest+AIRFIELD_ROLLUP_TRAVEL*p;
  slat.position.y=Math.min(y,69);
  slat.visible=y<69;
  // The entrance stays centered; neither jamb nor panel moves sideways.
  slat.position.x=gate.cx;
  slat.scale.y=1;
 }
 // The roller follows the precise amount of curtain fed into the fascia.
 if(gate.drum)gate.drum.rotation.x=p===0?0:-p*Math.PI*4.4;
 gate.open=p;
}
