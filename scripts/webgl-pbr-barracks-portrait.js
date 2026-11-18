/**
 * The hand-authored barracks from the PBR worktree already has desert camo,
 * UV textures, front double leaves and roof detail. The old HUD path applied
 * legacy faction tint + extra "desert" paint over those materials and made
 * the tile orange, unlike the actual building in the battlefield.
 * This module only runs on an isolated miniature clone.
 */
export const FINAL_BARRACKS_PORTRAIT_REVISION='authored-barracks-hud-pbr-v1';
export function hasFinalBarracksPBR(model){
 return Boolean(model?.getObjectByName?.('door_leaf_L')&&
  model.getObjectByName('door_leaf_R')&&
  model.getObjectByName('door_recess_back')&&
  model.getObjectByName('door_panel_-1_0')&&
  model.getObjectByName('roof_top_center'));
}
export function prepareFinalBarracksPortrait(model){
 if(!hasFinalBarracksPBR(model))return 0;
 const visited=new Set();let adjusted=0;
 model.traverse(node=>{
  if(!node.isMesh)return;
  for(const material of Array.isArray(node.material)?node.material:[node.material]){
   if(!material?.isMeshStandardMaterial||visited.has(material))continue;
   visited.add(material);
   if(material.userData?.sandforgeBarracksPortrait===FINAL_BARRACKS_PORTRAIT_REVISION)continue;
   const name=(node.name+' '+material.name).toLowerCase();
   // Do not make the black doors, glass, radar, vents or steel fixtures beige.
   if(/door|gate|leaf|panel_-?1_|window|glass|vent|grill|radar|lamp|light|steel|metal|antenna|handle/.test(name))continue;
   if(!/wall|roof|camo|plaster|concrete|trim|canvas|sandbag|crate|stucco|fabric|sandstone/.test(name))continue;
   material.metalness=Math.min(material.metalness,.14);
   material.roughness=Math.max(material.roughness,.77);
   if(material.map){
    // Tiny bounced fill, based on the ORIGINAL albedo; never repaint or tint.
    material.emissiveMap=material.map;
    material.emissive.set('#fff1dd');
    material.emissiveIntensity=.11;
   }
   material.userData={...material.userData,sandforgeBarracksPortrait:FINAL_BARRACKS_PORTRAIT_REVISION};
   material.needsUpdate=true;adjusted++;
  }
 });
 return adjusted;
}
