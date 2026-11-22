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
   height,lastLabel:-1,finished:false};
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
  // The previous regression made the finished GLB fully visible at 0%,
  // with only scaffolding layered on top. Instead assemble REAL building
  // components in stages. No clipping planes: no bisected or floating facades.
  const model=entry.detail??entry.placeholder;
  const stageMesh=(mesh,threshold)=>{
   if(!mesh?.isMesh)return;
   if(mesh.userData.constructionOriginalVisible===undefined)
    mesh.userData.constructionOriginalVisible=mesh.visible;
   const originallyVisible=mesh.userData.constructionOriginalVisible;
   mesh.visible=originallyVisible&&progress>=threshold;
  };
  const stageGroup=(root,mode)=>{
   if(!root)return;
   root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const name=mesh.name.toLowerCase();
    // Airfield legacy components were permanently hidden by the renderer:
    // never resurrect an old crossing, duplicate tower or hangar.
    if(mesh.userData.airfieldLegacyHidden)return;
    let threshold;
    if(mode==='yard')threshold=/perimeter|lamp|wheel|pallet|crat|barrel|decor|equipment/.test(name)?.86:.23;
    else if(mode==='service'){
     threshold=/runway|apron|taxis|parkingpad|bayfloor|platform|ramp|foundation|surface|centerline|edge|joint|threshold|stripe|track/.test(name)?.16:
      /roof|antenna|vent|glass|tower|duct|signal|floodlight/.test(name)?.88:
      /door|wall|column|arch|fascia|buttress|gate|garage|structure/.test(name)?.62:.75;
    }else{
     threshold=/roof|antenna|turret|vent|dish|top/.test(name)?.89:
      /foundation|floor|pad|plinth|base/.test(name)?.22:
      /wall|hull|frame|panel|armor|armour|door|pillar|column|body|facade/.test(name)?.58:.76;
    }
    // Stage individual real meshes by their measured local elevation. Lower
    // structural pieces appear before the upper walls and roof parts.
    if(mesh.userData.sandforgeConstructionHeight===undefined){
     if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
     const center=mesh.geometry.boundingBox.getCenter(new THREE.Vector3());
     mesh.updateWorldMatrix(true,false);
     const worldCenter=mesh.localToWorld(center);
     const baseCenter=entry.node.worldToLocal(worldCenter);
     mesh.userData.sandforgeConstructionHeight=THREE.MathUtils.clamp(
      baseCenter.y/Math.max(1,state.height),0,1);
    }
    const stagger=(mode==='yard'||mode==='service'?.12:.20)*
     mesh.userData.sandforgeConstructionHeight;
    stageMesh(mesh,Math.min(.98,threshold+stagger));
   });
  };
  stageGroup(model,'building');
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
