import * as THREE from 'three';
import {disposeOwnedMeshes} from '/webgl-resource-lifecycle.js';
import {BUILDINGS} from '/src/reborn/catalog.js';

/** Render-only construction states driven by the classic Simulation's
 * buildRemaining / buildTime. No new gameplay timers or construction rules.
 *
 * Assemble actual authored 3D components from ground to roof, no scaffolds.
 * Keep game construction timers and simulation unchanged.
 */
export class SandforgeConstructionPresentation{
 constructor(renderer){this.renderer=renderer;renderer.localClippingEnabled=true;}
 ensure(entry,base){
  if(entry.construction)return entry.construction;
  const spec=BUILDINGS[base.kind];
  const frame=new THREE.Group();frame.name='construction-status-'+base.id;
  // Only the informational label is temporary. There are no scaffolds.
  const height=Math.min(154,Math.max(58,spec.width*.56));
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;
  const texture=new THREE.CanvasTexture(canvas);
  const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,opacity:.86,depthTest:false,depthWrite:false}));
  // The construction text is a separate billboard ABOVE the building HP bar.
  // Its final altitude is recalculated when the authored building model loads.
  label.scale.set(83,21,1);label.position.set(0,height+65,0);frame.add(label);
  entry.node.add(frame);
  const construction={frame,canvas,texture,label,
   height,lastLabel:-1,finished:false,stages:new Map()};
  entry.construction=construction;return construction;
 }
 update(entry,base){
  const spec=BUILDINGS[base.kind],active=base.buildRemaining>0;
  if(!active){
   if(entry.construction)this.finish(entry);
   return;
  }
  const state=this.ensure(entry,base);
  // The HP bar is world-space and can move upward after the detailed GLB
  // streams in. Keep the BAU/PAUSIERT billboard CLEARLY above it rather
  // than using a fixed height that overlaps at tactical camera angles.
  const healthAltitude=entry.presentation?.bar?.altitude??
   Math.max(65,Math.min(144,(spec.width??130)*.55));
  const healthY=entry.modelHeight?
   Math.max(healthAltitude,entry.modelHeight+5):healthAltitude;
  state.label.position.y=Math.max(state.height+65,healthY+45);
  const progress=THREE.MathUtils.clamp(1-base.buildRemaining/spec.buildTime,0,1);
  state.frame.visible=true;
  // All parts of a real GLB share one world-height reveal plane.
  // Unlike per-mesh threshold visibility, a roof or ring CANNOT float above
  // unfinished lower walls. Large combined GLB meshes also build bottom-up.
  const stageGroup=(root,mode)=>{
   if(!root)return;
   let stage=state.stages.get(mode);
   if(!stage||stage.root!==root){
    const bounds=new THREE.Box3().setFromObject(root);
    if(bounds.isEmpty())return;
    const plane=new THREE.Plane(new THREE.Vector3(0,-1,0),bounds.min.y);
    stage={root,plane,bottom:bounds.min.y,top:bounds.max.y};
    state.stages.set(mode,stage);
   }
   // The foundation is laid first. Site furniture and fences remain late.
   const start=mode==='building'?.10:mode==='service'?.04:.03;
   const end=mode==='building'?.97:mode==='service'?.95:.97;
   const fraction=THREE.MathUtils.clamp((progress-start)/(end-start),0,1);
   // Three.js retains the half-space dot(normal, point)+constant>=0:
   // with a downward normal, pixels ABOVE this world Y are discarded.
   stage.plane.constant=stage.bottom+(stage.top-stage.bottom)*fraction;
   root.traverse(mesh=>{
    if(!mesh.isMesh||mesh.userData.airfieldLegacyHidden)return;
    if(mesh.userData.constructionOriginalVisible===undefined)
     mesh.userData.constructionOriginalVisible=mesh.visible;
    const original=mesh.userData.constructionOriginalVisible;
    if(!original){mesh.visible=false;return;}
    const name=mesh.name.toLowerCase();
    const isYardLate=mode==='yard'&&
     /perimeter|fence|post|rail|wire|barb|lamp|crat|barrel|pallet|decor|equipment/.test(name);
    // Fence wires and decorations are last; no fully formed fence around
    // the first unfinished wall. Roofs obey the shared height plane too.
    const partStart=isYardLate?.82:start;
    mesh.visible=progress>=partStart;
    if(!mesh.visible)return;
    if(mesh.userData.sandforgeConstructionOriginalMaterial===undefined){
     mesh.userData.sandforgeConstructionOriginalMaterial=mesh.material;
     const clipMaterial=material=>{
      const clone=material.clone();
      clone.clippingPlanes=[stage.plane];
      clone.clipShadows=true;
      return clone;
     };
     mesh.material=Array.isArray(mesh.material)?
      mesh.material.map(clipMaterial):clipMaterial(mesh.material);
    }
    // Async GLB imports can replace a stage root: rebind the new plane.
    for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
     if(material.clippingPlanes?.[0]!==stage.plane)
      material.clippingPlanes=[stage.plane];
    }
   });
  };
  stageGroup(entry.detail??entry.placeholder,'building');
  stageGroup(entry.yard,'yard');
  stageGroup(entry.airfieldServiceYard??entry.factoryServiceYard,'service');
  const tick=Math.floor(progress*20),working=base.constructionActive!==false;
  if(tick!==state.lastLabel||state.lastWorking!==working){
   state.lastLabel=tick;state.lastWorking=working;
   const c=state.canvas.getContext('2d');
   c.clearRect(0,0,256,64);
   c.fillStyle='rgba(16,28,30,.32)';c.fillRect(3,8,250,48);
   c.strokeStyle='rgba(220,194,148,.25)';c.lineWidth=2;c.strokeRect(3,8,250,48);
   c.fillStyle=working?'rgba(245,223,181,.86)':'rgba(251,181,157,.86)';
   c.font=working?'600 23px system-ui':'600 18px system-ui';
   c.textAlign='center';c.textBaseline='middle';
   c.fillText(working?'BAU '+Math.round(progress*100)+' %':'PAUSIERT · PIONIER',128,32);
   state.texture.needsUpdate=true;
  }
 }
 finish(entry){
  const state=entry.construction;if(!state)return;
  // Restore the original mesh visibility (including permanent GLB-hidden
  // obsolete airfield parts) only after actual build completion.
  for(const root of [entry.detail,entry.placeholder,entry.yard,
   entry.airfieldServiceYard,entry.factoryServiceYard]){
   root?.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const original=mesh.userData.constructionOriginalVisible;
    if(original!==undefined){
     mesh.visible=original&&!mesh.userData.airfieldLegacyHidden;
     delete mesh.userData.constructionOriginalVisible;
     delete mesh.userData.sandforgeConstructionHeight;
     const material=mesh.userData.sandforgeConstructionOriginalMaterial;
     if(material!==undefined){
      const temporary=mesh.material;
      mesh.material=material;
      for(const mat of Array.isArray(temporary)?temporary:[temporary])
       mat.dispose();
      delete mesh.userData.sandforgeConstructionOriginalMaterial;
     }
    }
   });
  }
  entry.node.remove(state.frame);
  // Dispose temporary status label only; authored building parts remain.
  disposeOwnedMeshes(state.frame);
  state.texture.dispose();state.label.material.dispose();
  entry.construction=null;
 }
 dispose(entry){this.finish(entry);}
}
