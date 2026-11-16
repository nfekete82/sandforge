import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {
 paintFactionEntranceBanners,disposeFactionEntranceBanners,ENTRANCE_BANNER_COLORS
} from '../scripts/webgl-entrance-banners.js';
import {createBuildingYard,disposeBuildingYard} from '../scripts/webgl-building-yard.js';

function authoredBuilding(kind){
 const root=new THREE.Group(),wallMaterial=new THREE.MeshStandardMaterial({
  color:'#baac89',roughness:.84
 });
 const wall=new THREE.Mesh(new THREE.BoxGeometry(12,4,.26),wallMaterial);
 wall.name=kind==='headquarters'?'HQ_Static_SF_OriginalPBR_walls':'front_wall_1';
 wall.position.set(0,2,4.10);root.add(wall);
 for(const sign of [-1,1]){
  const leaf=new THREE.Mesh(new THREE.BoxGeometry(1.12,2.4,.14),
   new THREE.MeshStandardMaterial({color:'#323631'}));
  leaf.name=kind==='headquarters'?
   (sign===-1?'HQ_door_leaf_L':'HQ_door_leaf_R'):
   (sign===-1?'door_leaf_L':'door_leaf_R');
  leaf.position.set(sign*.57,1.55,4.33);root.add(leaf);
 }
 if(kind==='headquarters'){
  const rotor=new THREE.Group();rotor.name='HQ_Radar_01_LargeDish_Rotor';root.add(rotor);
 }else{
  const roof=new THREE.Mesh(new THREE.BoxGeometry(12,.2,12),wallMaterial);
  roof.name='roof_top_center';roof.position.set(0,4.3,0);root.add(roof);
 }
 return {root,wall,wallMaterial};
}

for(const kind of ['headquarters','barracks']){
 test(kind+' gets two firmly facade-mounted faction flags beside its stationary doorway',()=>{
  const {root,wall,wallMaterial}=authoredBuilding(kind);
  const wallHex=wallMaterial.color.getHex(),side=wallMaterial.side;
  assert.equal(paintFactionEntranceBanners(root,kind,0),2);
  const group=root.getObjectByName('SF_FactionEntranceBanners');
  assert.equal(group.children.length,2);
  const flags=group.children.map(node=>node.getObjectByName('SF_FactionPennant'));
  assert.ok(flags.every(node=>node?.isMesh),'two actual cloth meshes');
  assert.ok(group.children[0].position.x<0&&group.children[1].position.x>0,
   'left and right of gate, never in front of movable leaves');
  for(const mount of group.children){
   assert.ok(Math.abs(mount.position.z-(wall.position.z+.13))<.08,
    'banner must be attached to the front wall, not floating');
   assert.ok(mount.position.y>=.5&&mount.position.y<=3.4);
   assert.ok(mount.getObjectByName('SF_PennantStar')?.isMesh);
   assert.ok(mount.getObjectByName('SF_FacadeBannerRail')?.isMesh);
   mount.traverse(mesh=>{if(mesh.isMesh){
    assert.equal(mesh.castShadow,false);
    assert.equal(mesh.receiveShadow,false);
    assert.equal(mesh.userData.nonPlayable,undefined);
   }});
  }
  assert.equal(wallMaterial.color.getHex(),wallHex,'source PBR surface unchanged');
  assert.equal(wallMaterial.side,side,'ray probes restore original material side');
  const before=group;
  assert.equal(paintFactionEntranceBanners(root,kind,1),2);
  assert.equal(root.getObjectByName('SF_FactionEntranceBanners'),before,'idempotent');
  assert.equal(flags[0].material.color.getHex(),
   new THREE.Color(ENTRANCE_BANNER_COLORS[1]).getHex(),'red when captured');
  assert.equal(flags[1].material.color.getHex(),flags[0].material.color.getHex());
  assert.equal(disposeFactionEntranceBanners(root),true);
  assert.equal(root.getObjectByName('SF_FactionEntranceBanners'),undefined);
  assert.equal(disposeFactionEntranceBanners(root),false);
 });
}

test('no decorative facade pennants appear on legacy or unsupported buildings',()=>{
 const {root}=authoredBuilding('barracks');
 assert.equal(paintFactionEntranceBanners(root,'factory',0),0);
 root.getObjectByName('roof_top_center').removeFromParent();
 assert.equal(paintFactionEntranceBanners(root,'barracks',0),0);
});

test('banner art is shipped in game, ghost and HUD and cleaned on removal',()=>{
 const game=readFileSync('scripts/webgl-battlefield.js','utf8');
 const hud=readFileSync('scripts/webgl-portraits.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(game,/paintFactionEntranceBanners\(model,entry\.kind,entry\.owner\)/);
 assert.match(game,/paintFactionEntranceBanners\(model,kind,0\)/);
 assert.match(game,/paintFactionEntranceBanners\(entry\.detail,b\.kind,b\.owner\)/);
 assert.match(game,/disposeFactionEntranceBanners\(preview\.userData\.previewDetail\)/);
 assert.match(game,/disposeFactionEntranceBanners\(e\.detail\)/);
 assert.match(hud,/paintFactionEntranceBanners\(model,kind,0\)/);
 assert.match(build,/cpSync\('scripts\/webgl-entrance-banners\.js','dist\/webgl-entrance-banners\.js'\)/);
});

test('compact desktop HUD matches minimap proportions but respects narrow layouts',()=>{
 const css=readFileSync('src/reborn/webgl-classic-hud.css','utf8');
 const marker='Compact desktop tactical dock:';
 const start=css.indexOf(marker);
 assert.ok(start>0,'new compact sizing CSS must be included');
 const block=css.slice(start);
 assert.match(block,/@media \(min-width:901px\)/);
 assert.match(block,/--sf-dock-height:225px!important/);
 assert.match(block,/@media \(min-width:901px\) and \(max-height:620px\)/);
 assert.match(block,/--sf-dock-height:210px!important/);
 assert.doesNotMatch(block,/#sf-classic-root #sidebar\s*\{[^}]*width:/,
  'preserve full-width tactical dock with no fixed right sidebar');
});

test('HQ and barracks now get flush rectangular STAR shields like Energiekern',()=>{
 const source=readFileSync('scripts/webgl-entrance-banners.js','utf8');
 assert.match(source,/facade-faction-star-plaques-v2-20261116/);
 assert.match(source,/function pennantShape\(w,h\)/);
 assert.doesNotMatch(source,/s\.lineTo\(0,-h\*\.52\)/,'no hanging pointed banners');
 for(const kind of ['headquarters','barracks']){
  const {root}=authoredBuilding(kind);
  assert.equal(paintFactionEntranceBanners(root,kind,0),2);
  const group=root.getObjectByName('SF_FactionEntranceBanners');
  for(const mount of group.children){
   const backing=mount.getObjectByName('SF_FactionStarPlaqueBacking');
   assert.ok(backing?.isMesh);
   assert.ok(backing.geometry.parameters.depth<.07);
   assert.ok(mount.getObjectByName('SF_PennantStar')?.isMesh);
   assert.ok(mount.position.z>4.1&&mount.position.z<4.4);
  }
  disposeFactionEntranceBanners(root);
 }
});

test('compact Energiekern has actual barbed wire on three sides, with a clear entrance',()=>{
 const yard=createBuildingYard('generator',112);
 const perimeter=yard.getObjectByName('BasePerimeter_generator');
 assert.ok(perimeter?.userData?.generatorWireFence);
 assert.ok(perimeter.userData.fenceWires>0);
 assert.ok(perimeter.userData.fencePosts>0);
 assert.ok(perimeter.getObjectByName('BarracksWireFenceStrands')?.isInstancedMesh);
 assert.ok(perimeter.getObjectByName('BarracksWireFenceBarbs')?.isInstancedMesh);
 const code=readFileSync('scripts/webgl-building-yard.js','utf8');
 assert.match(code,/const front=width\*\(generator\?\.45:\.28\)/);
 assert.match(code,/const gateHalf=width\*\(generator\?\.28:\.23\)/);
 assert.match(code,/if\(\['barracks','headquarters','factory','generator'\]\.includes\(kind\)\)/);
 disposeBuildingYard(yard);
});
