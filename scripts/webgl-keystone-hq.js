/** Opt-in preview of the supplied commercial Keystone HQ; never replace the shipped building. */
export const KEYSTONE_HQ_URL='/src/assets/reborn/local-keystone/A_hq_KEYSTONE.glb';
export function keystonePreviewEnabled(){
 return typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('keystone')==='1';
}
/** The vendor glb contains three co-located LOD meshes; rendering all three causes z-fighting. */
export function prepareKeystoneHQ(scene){
 const lods=[0,1,2].map(index=>scene.getObjectByName('LOD'+index));
 if(!lods[0])throw new Error('Keystone HQ: LOD0 node missing');
 for(let i=0;i<lods.length;i++)if(lods[i])lods[i].visible=i===0;
 scene.userData.sandforgeKeystoneLods=lods;
 scene.userData.sandforgeKeystoneLOD=0;
 return scene;
}
/** Distance is measured in Sandforge world units after actor placement. */
export function updateKeystoneHQLOD(scene,distance){
 const lods=scene?.userData?.sandforgeKeystoneLods;
 if(!lods?.[0])return 0;
 const preferred=distance<700?0:distance<1450?1:2;
 const next=lods[preferred]?preferred:lods[1]?1:0;
 if(scene.userData.sandforgeKeystoneLOD===next)return next;
 for(let i=0;i<lods.length;i++)if(lods[i])lods[i].visible=i===next;
 scene.userData.sandforgeKeystoneLOD=next;
 return next;
}
