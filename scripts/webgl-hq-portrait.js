/** HUD-only exposure correction for the final PBR command centre.
 * The authored HQ material atlas is exported with metallicFactor=1 even for
 * plaster, canvas and concrete. With no IBL in the small transparent portrait
 * scene those regions render almost black. Gameplay must remain untouched.
 *
 * Input MUST be a throwaway GLB clone (webgl-portraits.js clones all meshes
 * and materials before calling this helper).
 */
export const HQ_PORTRAIT_REVISION='hq-authored-pbr-hud-lighting-v1-20261116';
export function hasAuthoredHeadquartersPBR(model){
 return Boolean(model?.getObjectByName?.('HQ_Static_SF_OriginalPBR_walls')&&
  model.getObjectByName('HQ_Radar_01_LargeDish_Rotor'));
}
export function prepareAuthoredHeadquartersPortrait(model){
 if(!hasAuthoredHeadquartersPBR(model))return 0;
 const visited=new Set();let adjusted=0;
 model.traverse(node=>{
  if(!node.isMesh)return;
  for(const material of Array.isArray(node.material)?node.material:[node.material]){
   if(!material?.isMeshStandardMaterial||visited.has(material))continue;
   visited.add(material);
   if(material.userData?.sandforgeHQPortrait===HQ_PORTRAIT_REVISION)continue;
   const name=String(material.name||'').toLowerCase();
   // The GLB's actual embedded base-color, normal and roughness maps are kept.
   // Don't apply world-position camouflage, shader overlays or a global image
   // brightness filter that would turn its black metal doors light grey.
   const structural=/^sf_originalpbr_(walls|roof|concrete|trim|canvas|sandbags|crates)$/.test(name);
   const steel=/^sf_originalpbr_steel$/.test(name);
   const equipment=/^hq_pbr_(radar_steel|radar_reflector|phased_array)$/.test(name);
   if(!structural&&!steel&&!equipment)continue;
   if(structural){
    material.metalness=Math.min(material.metalness,.13);
    material.roughness=Math.max(material.roughness,.76);
    if(material.map){
     material.emissiveMap=material.map;
     material.emissive.set('#fff0d5');
     material.emissiveIntensity=.16;
    }
   }else{
    material.metalness=Math.min(material.metalness,steel?.56:.58);
    material.roughness=Math.max(material.roughness,.52);
   }
   material.userData={...material.userData,sandforgeHQPortrait:HQ_PORTRAIT_REVISION};
   material.needsUpdate=true;
   adjusted++;
  }
 });
 return adjusted;
}
