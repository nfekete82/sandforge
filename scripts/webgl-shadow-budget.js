/** Preserve authored GLB textures, animations and full normal render detail.
 * Only limit how many tiny submeshes receive their OWN shadow draw call.
 *
 * In an RTS match with 40+ actors, dozens of small bolts/vents per imported
 * GLB were each rendered into shadow maps every frame. Keep the dominant
 * hull, body, roof and weapon silhouette, not every small screw. This must
 * run once after authored/detail finishing, NEVER inside the animation loop.
 */
export function limitModelShadowCasters(root,budget=16){
 if(!root?.traverse)return {total:0,selected:0};
 const ranked=[];
 root.updateMatrixWorld(true);
 root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  const transparent=materials.some(m=>m?.transparent&&m.opacity<.98);
  const previouslyEnabled=mesh.castShadow===true;
  if(!previouslyEnabled)return;
  // Translucent windows and lights cannot cast a solid body shadow.
  if(transparent){mesh.castShadow=false;return;}
  const geo=mesh.geometry;
  if(!geo?.boundingSphere)geo?.computeBoundingSphere?.();
  const radius=geo?.boundingSphere?.radius??0;
  const scale=mesh.matrixWorld.getMaxScaleOnAxis();
  // Deterministic ordering breaks ties without random or actor IDs.
  ranked.push({mesh,importance:radius*scale,order:ranked.length});
 });
 ranked.sort((a,b)=>b.importance-a.importance||a.order-b.order);
 const count=Math.max(1,Math.floor(budget));
 for(let i=count;i<ranked.length;i++)ranked[i].mesh.castShadow=false;
 return {total:ranked.length,selected:Math.min(count,ranked.length)};
}
