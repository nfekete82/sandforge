import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {MEDIC_ART_REVISION,polishMedicModel} from '../scripts/webgl-medic-polish.js';
import {DESERT_SURFACE_DETAIL,createDesertSurfaceDetail} from '../scripts/webgl-sand-surface-detail.js';
import {generateMap} from '../dist/src/reborn/world-generation.js';

const txt=p=>readFileSync(p,'utf8');
test('authored medic kit follows existing animated Atlas bones without glow',()=>{
 const model=new THREE.Group();
 const pack=new THREE.Group();pack.name='Atlas_PowerPack';model.add(pack);
 const cap=new THREE.Mesh(new THREE.BoxGeometry(.01,.01,.01));
 cap.name='Atlas_AntennaCap';pack.add(cap);
 const oldCross=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1));
 oldCross.name='Atlas_MedicalCrossVertical';pack.add(oldCross);
 for(const name of ['Atlas_Helmet','Atlas_UpperArmL','Atlas_UpperArmR']){
  const joint=new THREE.Group();joint.name=name;model.add(joint);
 }
 assert.equal(polishMedicModel(model),true);
 assert.equal(model.userData.medicArtRevision,MEDIC_ART_REVISION);
 assert.equal(cap.visible,false,'emissive backpack cap is hidden');
 assert.equal(oldCross.visible,false,'no z-fighting with the new medical cross');
 assert.ok(pack.getObjectByName('SF_Medic_BackpackCrossVertical'));
 assert.ok(pack.getObjectByName('SF_Medic_MatteZipLid'));
 assert.ok(pack.getObjectByName('SF_Medic_BandageRoll'));
 assert.ok(model.getObjectByName('SF_Medic_HelmetCross1Vertical'));
 assert.ok(model.getObjectByName('SF_Medic_ArmbandL'));
 assert.ok(model.getObjectByName('SF_Medic_ArmbandR'));
 const added=[];model.traverse(n=>{if(n.userData?.medicArt)added.push(n)});
 assert.ok(added.length>=22);
 for(const mesh of added)if(mesh.material){
  assert.equal(mesh.material.emissive?.getHex?.()??0,0);
  assert.ok(mesh.material.roughness>=.9);
  assert.equal(mesh.userData.factionAccent,true);
 }
 const count=added.length;assert.equal(polishMedicModel(model),false);
 const after=[];model.traverse(n=>{if(n.userData?.medicArt)after.push(n)});
 assert.equal(after.length,count,'no duplicate cosmetics on re-stream');
 const empty=new THREE.Group();assert.equal(polishMedicModel(empty),false);
});
test('medic kit is shipped and applied only to streamed medic, not infantry or engineers',()=>{
 const battle=txt('scripts/webgl-battlefield.js');
 const build=txt('scripts/build.mjs');
 assert.match(battle,/if\(type==='unit'&&entry\.kind==='medic'\)\s*polishMedicModel\(model\)/);
 assert.match(build,/cpSync\('scripts\/webgl-medic-polish\.js','dist\/webgl-medic-polish\.js'\)/);
});
test('seamless wind-ripple PBR remains on one terrain mesh and has bounded costs',()=>{
 const renderer={capabilities:{getMaxAnisotropy:()=>8}};
 assert.ok(DESERT_SURFACE_DETAIL.rippleTileMetres>=170);
 assert.ok(DESERT_SURFACE_DETAIL.rippleTileMetres<=400);
 assert.ok(DESERT_SURFACE_DETAIL.rippleStrength>.12);
 const maps=createDesertSurfaceDetail(renderer);
 assert.equal(maps.ripples.image.data.length,DESERT_SURFACE_DETAIL.size**2*4);
 const p=maps.ripples.image.data;
 let minimum=255,maximum=0;
 for(let i=0;i<p.length;i+=4){minimum=Math.min(minimum,p[i]);maximum=Math.max(maximum,p[i]);}
 assert.ok(maximum-minimum>32,'real wind-sculpted tonal ripples, not a flat tint');
 Object.values(maps).forEach(m=>m.dispose());
 const shader=txt('scripts/webgl-sand-surface-detail.js');
 assert.match(shader,/sfDesertRipples/);
 assert.doesNotMatch(shader,/new THREE\.Mesh\(/);
 assert.match(txt('scripts/webgl-preview.js'),/installDesertSandPBR\(material,renderer\)/);
});
test('extra small dunes use the authoritative navigation heightfield, stay reproducible and walkable',()=>{
 const a=generateMap(82314,23,'dunes').battlefield;
 const b=generateMap(82314,23,'dunes').battlefield;
 assert.ok(a&&b);
 assert.equal(a.heights.length,b.heights.length);
 let highest=0;
 for(let i=0;i<a.heights.length;i++){
  assert.equal(a.heights[i],b.heights[i]);
  highest=Math.max(highest,a.heights[i]);
 }
 assert.ok(highest>30);
 const n=a.segments+1,step=a.size/a.segments;
 for(let j=0;j<a.segments;j++)for(let i=0;i<a.segments;i++){
  const k=j*n+i;
  assert.ok(Math.abs(a.heights[k+1]-a.heights[k])/step<.221);
  assert.ok(Math.abs(a.heights[k+n]-a.heights[k])/step<.221);
 }
});
