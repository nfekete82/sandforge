/** Render-only dimensions calibrated against the original 2D unit widths.
 * Gameplay radius, map collision, selection and saved game values stay intact.
 *
 * GLB model dimensions vary significantly because their authored transforms
 * include weapons and equipment. Normalize infantry by standing height, not
 * rifle/helmet width, so all four roles occupy the same apparent human scale.
 */
export const MODEL_HEIGHTS=Object.freeze({
 infantry:61,medic:61,engineer:61,heavy:65,rocket:61,
 rover:42,supply:49,tank:46,artillery:51,scout:48,bomber:51,drone:14,
 headquarters:158,barracks:119,factory:125,airfield:137,generator:79,turret:95
});
export const DIMENSIONS_VERSION=3;

// Visual-only: the defensive tower was about 12% too massive next to infantry.
// The authored model, streaming fallback and construction ghost share this.
// Do NOT change BUILDINGS.turret radius/width or weapon range.
export const TURRET_VISUAL_SCALE=0.88;
export function visualBuildingScale(kind){
 return kind==='turret'?TURRET_VISUAL_SCALE:1;
}

/** Wider selection footprint at tactical zoom. Render-only: never changes
 * unit collision, targeting, squad formation or the saved simulation state.
 * Keep rings outside visual hulls for tanks, helicopters and infantry. */
export function selectionRingRadius(spec){
 const collision=Number.isFinite(spec?.radius)?spec.radius:12;
 const width=Number.isFinite(spec?.width)?spec.width:36;
 return Math.max(collision*1.55+13,width*.39);
}

// Historically facing=1 meant 180 degrees. Preserve that meaning in old
// saves while allowing all four cardinal orientations in the WebGL builder:
// R cycles 0 -> 90 -> 180 -> 270 -> 0 degrees (stored as 0,2,1,3).
export const buildingFacingAngle=facing=>
 [0,Math.PI,Math.PI/2,Math.PI*1.5][facing??0]??0;
export const nextBuildingFacing=facing=>
 [2,3,1,0][facing??0]??0;
export const buildingFacingDegrees=facing=>
 [0,180,90,270][facing??0]??0;

// Simulation uses atan2(worldZ,worldX). The ACTUAL imported TurretHead
// points down local +Z (see TurretMuzzleL/R in atlas-buildings.js), NOT +X.
// Three.js Y+ turns +Z toward +X. Subtract the building's own facing to
// keep a rotating head independent from 0/90/180/270 degree placements.
// Only the old procedural fallback points toward local -Z.
export function turretAimLocalYaw(angle,facing=0,procedural=false){
 return (procedural?-Math.PI/2:Math.PI/2)-angle-buildingFacingAngle(facing);
}

// Two independent world-space muzzle positions. Gameplay still owns the
// authoritative source and barrel indices; this is a presentation offset.
export function turretMuzzleOffset(angle,barrel){
 const reach=37,side=(barrel===1?1:-1)*5.5;
 return {
  x:Math.cos(angle)*reach-Math.sin(angle)*side,
  z:Math.sin(angle)*reach+Math.cos(angle)*side
 };
}
// Presentation-only scale: keep gameplay collision, reach, selection,
// spacing and saved dimensions unchanged. Infantry read as humans beside
// larger real structures, rather than as toy-sized buildings.
export function visualUnitScale(kind){
 // The final PBR barracks' double door is shorter than the former Atlas
 // doorway. With .56/.58 scaling, soldiers are taller than its opening and
 // appear to bump their heads during the production exit.
 // Target ~26 visual world units for every foot soldier at normal RTS zoom.
 // Render-only: collision, navigation, weapon range and save data stay intact.
 if(['infantry','medic','engineer','rocket'].includes(kind))return .42;
 if(kind==='heavy')return .40;
 // Humvee needs a substantial visual presence beside full-scale buildings.
 // Only the rendered mesh changes; navigation/collision/save width stays 76.
 if(kind==='rover'||kind==='supply')return 1.34;
 if(kind==='artillery')return 1.42; // +7.6% for the 6x6 rocket launcher, render-only
 if(kind==='tank')return 1.44;
 if(kind==='scout')return 1.34;
 if(kind==='bomber')return 1.03;
 return .94;
}

/** The imported bomber GLB faces the opposite local longitudinal axis.
 * Flip only its visual node; world movement, heading, combat and saves remain untouched. */
export function unitVisualYaw(kind,heading){
 return Math.PI*.5-heading+(kind==='bomber'?Math.PI:0);
}

/** Authoritative flightHeight [0..1] drives visible altitude. The helicopter
 * really touches the ground at 0, rather than hovering 75 world units above it.
 * The bomber remains in continuous flight at the existing cruise height. */
export function unitRenderAltitude(kind,flightHeight=1){
 if(kind==='drone')return 142;
 if(kind==='scout')return 3+172*Math.max(0,Math.min(1,flightHeight));
 if(kind==='bomber')return 175*Math.max(0,Math.min(1,flightHeight));
 return 0;
}
const infantry=new Set(['infantry','medic','engineer','heavy','rocket']);
const valid=n=>typeof n==='number'&&Number.isFinite(n)&&n>.00001;
export function calibratedScale(kind,type,bounds,targetWidth){
 const width=Math.max(bounds?.x??0,bounds?.z??0);
 const height=bounds?.y??0;
 if(!valid(width)||!valid(height)||!valid(targetWidth))return 1;
 const byWidth=targetWidth/width;
 if(type==='unit'&&infantry.has(kind)){
  const humanHeight=MODEL_HEIGHTS[kind]??55;
  // Outstretched guns and equipment must not shrink the soldier itself.
  // The gameplay footprint is still provided by the original World object.
  return humanHeight/height;
 }
 if(type==='unit')return Math.min(byWidth,(MODEL_HEIGHTS[kind]??50)/height);
 // Energiekern V2 is intentionally ~40% NARROWER in actual gameplay render,
 // not just in the authored GLB: the normal width calibration used to blow
 // every small generator back up to its old 112-unit presentation width.
 // This changes the mesh and construction ghost only. Its original 38-unit
 // collision radius, income, build placement and saved games are untouched.
 if(kind==='generator'&&type==='building')
  return Math.min(byWidth*.63,MODEL_HEIGHTS.generator/height);
 // Defense turrets are visually 12% smaller than their old calibrated
 // dimensions, while their gameplay collision/placement footprint is intact.
 // Keeping this after width/height normalization avoids it being cancelled by
 // the GLB calibration for large authored turret meshes.
 // Other buildings retain their previous visual size.
 return Math.min(byWidth,(MODEL_HEIGHTS[kind]??135)/height)*
  (type==='building'?visualBuildingScale(kind):1);
}
