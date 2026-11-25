import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {paintFactionRoofStripes,ROOF_STRIPE_COLORS} from '../scripts/webgl-building-roof-stripes.js';
import {keepPlacementAfterBuild} from '../scripts/webgl-builder-input.js';

function building(kind){
 const root=new THREE.Group();
 const roofMaterial=new THREE.MeshStandardMaterial({color:'#c9bd93',roughness:.83});
 const roof=new THREE.Mesh(new THREE.BoxGeometry(12,.2,14),roofMaterial);
 roof.name=kind==='headquarters'?'HQ_Static_SF_OriginalPBR_roof':'roof_top_center';
 roof.position.y=4;root.add(roof);
 const marker=new THREE.Group();
 marker.name=kind==='headquarters'?'HQ_Radar_01_LargeDish_Rotor':'door_leaf_L';
 root.add(marker);
 return {root,roof,roofMaterial};
}
test('authored HQ roof gets exactly two low-profile blue surface stripes',()=>{
 const {root,roof,roofMaterial}=building('headquarters');
 const original=roofMaterial.color.getHex();
 assert.equal(paintFactionRoofStripes(root,'headquarters',0),2);
 const stripes=root.getObjectByName('SF_FactionRoofStripes');
 assert.ok(stripes?.isMesh);
 assert.equal(stripes.material.color.getHex(),new THREE.Color(ROOF_STRIPE_COLORS[0]).getHex());
 assert.equal(stripes.userData.stripes,2);
 assert.ok(stripes.geometry.index.count>0);
 assert.equal(stripes.raycast instanceof Function,true);
 assert.equal(stripes.castShadow,false);
 assert.equal(stripes.receiveShadow,false);
 assert.equal(roofMaterial.side,THREE.FrontSide,'roof material remains double-side free');
 assert.equal(roofMaterial.color.getHex(),original,'original sand PBR preserved');
 const top=roof.position.y+.1;
 const y=stripes.geometry.getAttribute('position');
 for(let i=0;i<y.count;i++)assert.ok(Math.abs(y.getY(i)-top)<.04,
  'stripes must follow the physical roof rather than float');
 assert.equal(paintFactionRoofStripes(root,'headquarters',0),2,'idempotent');
 assert.equal(root.children.filter(x=>x.name==='SF_FactionRoofStripes').length,1);
});
test('authored PBR barracks markings switch to red without rebuilding geometry',()=>{
 const {root}=building('barracks');
 assert.equal(paintFactionRoofStripes(root,'barracks',0),2);
 const mark=root.getObjectByName('SF_FactionRoofStripes'),geometry=mark.geometry;
 assert.equal(paintFactionRoofStripes(root,'barracks',1),2);
 assert.equal(mark.geometry,geometry);
 assert.equal(mark.material.color.getHex(),new THREE.Color(ROOF_STRIPE_COLORS[1]).getHex());
 assert.equal(mark.userData.owner,1);
});
test('legacy building meshes do not get arbitrary painted roofs',()=>{
 const {root}=building('barracks');
 assert.equal(paintFactionRoofStripes(root,'factory',0),0);
 root.getObjectByName('door_leaf_L').removeFromParent();
 assert.equal(paintFactionRoofStripes(root,'barracks',0),0);
 assert.equal(root.getObjectByName('SF_FactionRoofStripes'),undefined);
});
test('wall placement remains armed, ordinary buildings disarm unless Shift is held',()=>{
 assert.equal(keepPlacementAfterBuild('wall',false),true);
 assert.equal(keepPlacementAfterBuild('wall',true),true);
 for(const kind of ['barracks','headquarters','factory','airfield','turret']){
  assert.equal(keepPlacementAfterBuild(kind,false),false,kind);
  assert.equal(keepPlacementAfterBuild(kind,true),true,kind);
 }
});
test('gameplay, placement ghost, HUD, and the deployed build share roof markers',()=>{
 const battlefield=readFileSync('scripts/webgl-battlefield.js','utf8');
 const portrait=readFileSync('scripts/webgl-portraits.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(battlefield,/paintFactionRoofStripes\(model,entry\.kind,entry\.owner\)/);
 assert.match(battlefield,/paintFactionRoofStripes\(model,kind,0\)/);
 assert.match(battlefield,/paintFactionRoofStripes\(entry\.detail,b\.kind,b\.owner\)/);
 assert.match(portrait,/if\(authoredHQ\|\|authoredBarracks\)\s*\{\s*paintFactionRoofStripes\(model,kind,0\);\s*paintFactionEntranceBanners\(model,kind,0\);/);
 assert.match(build,/cpSync\('scripts\/webgl-building-roof-stripes\.js','dist\/webgl-building-roof-stripes\.js'\)/);
 const policy=readFileSync('scripts/webgl-builder-input.js','utf8');
 assert.match(policy,/kind==='wall'\|\|Boolean\(shift\)/);
 assert.match(battlefield,/if\(!keepPlacementAfterBuild\(kind,event\.shiftKey\)\)this\.clearPlacement\(\)/);
 assert.match(battlefield,/this\.panel\.dataset\.tab='buildings'/);
 assert.match(battlefield,/Nächstes Mauersegment platzieren/);
});
test('rocket portrait receives neutral light while all original PBR unit rigs remain intact',()=>{
 const portrait=readFileSync('scripts/webgl-portraits.js','utf8');
 assert.match(portrait,/infantryCard\?'#f8fbfd'/);
 assert.match(portrait,/infantryCard\?'#f6faff'/);
 assert.match(portrait,/infantryCard\?'#d5e8f4'/);
 assert.match(portrait,/kind==='rocket'\)attachRocketLauncherToInfantry\(model,owner\)/);
 assert.match(portrait,/renderModelPortrait\(model,renderer,\{width:192,height:132,infantryCard:true\}\)/);
 const battlefield=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(battlefield,/attachRocketLauncherToInfantry\(model,entry\.owner\)/);
});
