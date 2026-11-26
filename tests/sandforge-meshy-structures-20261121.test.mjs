import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {MESHY_STRUCTURE_ASSETS} from '../scripts/webgl-meshy-asset-flags.js';
import {createBuildingYard,disposeBuildingYard} from '../scripts/webgl-building-yard.js';
import {meshyStructurePath,prepareMeshyStructure,meshyLocalBounds,SANDFORGE_INDUSTRIAL_PALETTE,MESHY_HQ_ENGINEER_DOOR,removeHeadquartersEmblemMeshes,meshHeadquartersDoor,setMeshyHeadquartersDoorOpen,MESHY_HQ_EXPERIMENTAL_SHADER}
 from '../scripts/webgl-meshy-structure.js';

test('missing Meshy binaries never break existing Sandforge PBR buildings',()=>{
 for(const kind of ['barracks','airfield','bastion','bunker','headquarters','generator']){
  assert.equal(MESHY_STRUCTURE_ASSETS[kind],false);
  assert.equal(meshyStructurePath(kind),null);
 }
});
test('Meshy skins preserve the source albedo, normals and metallic roughness',()=>{
 const make=()=>{
  const root=new THREE.Group(),tex=new THREE.DataTexture(new Uint8Array([20,90,170,255]),1,1);
  const normal=new THREE.DataTexture(new Uint8Array([128,128,255,255]),1,1);
  const material=new THREE.MeshStandardMaterial({map:tex,normalMap:normal,
   metalnessMap:tex,roughnessMap:tex,metalness:.5,roughness:.6});
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material);
  root.add(mesh);return {root,mesh,material,tex,normal};
 };
 const blue=make();
 assert.equal(prepareMeshyStructure(blue.root,'generator',0),true);
 assert.notEqual(blue.mesh.material,blue.material);
 assert.equal(blue.mesh.material.map,blue.tex);
 assert.equal(blue.mesh.material.normalMap,blue.normal);
 assert.equal(blue.mesh.material.metalnessMap,blue.tex);
 const red=make();
 assert.equal(prepareMeshyStructure(red.root,'generator',1),true);
 assert.notEqual(red.mesh.material,red.material);
 assert.equal(red.mesh.material.map,red.tex);
 assert.equal(red.mesh.material.normalMap,red.normal);
 assert.equal(red.mesh.material.metalnessMap,red.tex);
 assert.equal(red.mesh.material.roughnessMap,red.tex);
 const shader={fragmentShader:'#include <map_fragment>\n#include <color_fragment>\n#include <roughnessmap_fragment>\n#include <emissivemap_fragment>',vertexShader:'',uniforms:{}};
 red.mesh.material.onBeforeCompile(shader);
 assert.match(shader.fragmentShader,/sfTeamRed/);
 assert.equal(red.root.userData.sandforgeMeshyStructure,'generator');
});
test('factory exposes only the actual roll-up shutter and shrunk tank proportions',()=>{
 const gates=readFileSync('scripts/webgl-production-gates.js','utf8');
 const scale=readFileSync('scripts/webgl-scale.js','utf8');
 assert.doesNotMatch(gates,/new THREE.BoxGeometry\(\.018,\.28,\.57\)/);
 assert.match(gates,/meshyShutter:true/);
 assert.match(scale,/if\(kind==='tank'\)return 1\.16/);
});
test('existing Energiekern income, HP and prices remain untouched',()=>{
 const catalog=readFileSync('src/reborn/catalog.ts','utf8');
 assert.match(catalog,/generator:\{name:'Energiekern',cost:150,buildTime:9,hp:500/);
 assert.match(catalog,/width:112,income:10/);
});

test('measured local infantry exits stay just outside the physical GLB at any scale',()=>{
 const building=new THREE.Group(),wall=new THREE.Mesh(new THREE.BoxGeometry(2,1,4),
  new THREE.MeshStandardMaterial({map:new THREE.DataTexture(new Uint8Array([120,100,80,255]),1,1)}));
 building.add(wall);
 building.position.set(80,12,-24);
 building.scale.setScalar(110);
 const b=meshyLocalBounds(building),size=b.getSize(new THREE.Vector3());
 assert.ok(Math.abs(size.x-2)<.0001);
 assert.ok(Math.abs(size.z-4)<.0001);
 prepareMeshyStructure(building,'headquarters',0);
 const start=building.getObjectByName('SF_Meshy_InfantryRolloutStart');
 const exit=building.getObjectByName('SF_Meshy_InfantryRolloutExit');
 assert.ok(start&&exit);
 // Headquarters engineer starts INSIDE the actual front double doors,
 // then crosses the threshold to the outdoor rally exit; no fake gate.
 const facade=b.min.z+size.z*MESHY_HQ_ENGINEER_DOOR.facadeZFraction;
 assert.ok(start.position.z<facade);
 assert.ok(exit.position.z>facade);
 assert.ok(exit.position.z>start.position.z);
 assert.equal(start.position.x,exit.position.x);
 assert.ok(start.position.x>b.min.x+size.x*.38);
 assert.ok(start.position.x<b.min.x+size.x*.54);
 // The real entrance lies inside the overall HQ bounds: the annex sticks
 // farther forward, but should not dictate where an engineer materializes.
 assert.ok(exit.position.z<b.max.z);
 assert.equal(start.userData.realHeadquartersDoor,true);
 assert.equal(exit.userData.realHeadquartersDoor,true);
 assert.equal(building.getObjectByName('SF_Meshy_HQ_Shutter'),undefined);
 assert.equal(building.getObjectByName('SF_Meshy_HQ_EngineerPortal'),undefined);
 const repeat=prepareMeshyStructure(building,'headquarters',0);
 assert.equal(repeat,true);
 assert.equal(building.children.filter(n=>n.name==='SF_Meshy_InfantryRolloutStart').length,1);
});
test('optional command HQ gallery retains its exact reference and the standard build keeps the approved skins',async()=>{
 assert.equal(SANDFORGE_INDUSTRIAL_PALETTE.blue,'#1b508d');
 const workflow=readFileSync('.github/workflows/meshy-structures-import-20261121.yml','utf8');
 assert.match(workflow,/01a1fd66-536b-71d0-9d5a-74afd948e7f9/);
 const build=readFileSync('scripts/build.mjs','utf8');
 const {MESHY_STRUCTURE_ASSETS:shipped}=await import('../dist/webgl-meshy-asset-flags.js');
 assert.deepEqual(shipped,{barracks:false,airfield:false,bastion:false,bunker:false,headquarters:false,generator:false,airfieldReference:false});
 assert.match(build,/meshy-structures/);
});

test('the restored HQ, barracks and research yards retain their textured camouflage nets',()=>{
 for(const kind of ['headquarters','barracks','research','factory']){
  const yard=createBuildingYard(kind,180);
  try{
   const net=yard.getObjectByName('PartialCamouflageMesh');
   if(kind==='factory')assert.equal(net,undefined);
   else{
    assert.ok(net?.geometry.getAttribute('uv'));
    assert.equal(net.material.map?.colorSpace,THREE.SRGBColorSpace);
    assert.ok(net.material.normalMap?.isTexture);
    assert.ok(net.material.roughnessMap?.isTexture);
   }
  }finally{disposeBuildingYard(yard);}
 }
});
test('vehicle factory and HQ both receive final identical Sandforge PBR-grade shader',()=>{
 const gameplay=readFileSync('scripts/webgl-battlefield.js','utf8');
 const style=readFileSync('scripts/webgl-meshy-structure.js','utf8');
 const viewer=readFileSync('scripts/webgl-meshy-buildings-viewer.js','utf8');
 assert.match(gameplay,/prepareMeshyStructure\(model,'factory',entry\.owner\)/);
 assert.match(gameplay,/prepareMeshyStructure\(model,'factory',0\)/);
 assert.match(viewer,/prepareMeshyStructure\(model,kind,owner\)/);
 assert.match(style,/hq-physical-door-crest-decal-v8/);
 assert.match(style,/sfSandPanel/);
 assert.match(style,/roughnessmap_fragment/);
 const material=new THREE.MeshStandardMaterial({
  map:new THREE.DataTexture(new Uint8Array([170,145,95,255]),1,1),
  roughness:.86,metalness:.22
 });
 for(const kind of ['headquarters','factory']){
  const model=new THREE.Group();
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(2,1,2),material);
  model.add(mesh);
  prepareMeshyStructure(model,kind,0);
  const shader={fragmentShader:'#include <map_fragment>\\n#include <color_fragment>\\n#include <roughnessmap_fragment>\\n#include <emissivemap_fragment>',
   vertexShader:'',uniforms:{}};
  mesh.material.onBeforeCompile(shader);
  assert.match(shader.fragmentShader,/sfSandPanel/);
  assert.match(shader.fragmentShader,/sfPanelTone/);
  assert.equal(mesh.material.map,material.map);
 }
});

test('existing Meshy headquarters door produces infantry without new fake garage',()=>{
 const producer=readFileSync('scripts/webgl-production-gates.js','utf8');
 const structure=readFileSync('scripts/webgl-meshy-structure.js','utf8');
 assert.doesNotMatch(structure,/addHeadquartersEngineerShutter/);
 assert.doesNotMatch(structure,/new THREE\.BoxGeometry\(doorW/);
 assert.doesNotMatch(producer,/meshyHQShutter|SF_Meshy_HQ_Shutter/);
 assert.match(producer,/openBay:!meshHQDoor,meshHQDoor,[\s\S]{0,100}meshyInfantry:true,meshyStart,meshyExit/);
 assert.match(producer,/gate\.meshyInfantry\?gate\.meshyExit\.getWorldPosition/);
 assert.match(producer,/if\(!gate\.meshyShutter&&!gate\.meshyInfantry\)root\.localToWorld\(outside\)/);
 assert.match(structure,/MESHY_HQ_ENGINEER_DOOR/);
 // No changes to real factory roll-up shutter or barracks authored doors.
 assert.match(producer,/meshyShutter:true/);
 assert.match(producer,/prepareBarracksPortal/);
});

test('stable HQ textures never inject unverified badge/door GLSL',()=>{
 assert.equal(MESHY_HQ_EXPERIMENTAL_SHADER,false);
 const model=new THREE.Group();
 const tex=new THREE.DataTexture(new Uint8Array([153,142,115,255]),1,1);
 const original=new THREE.MeshStandardMaterial({map:tex,roughness:.76});
 const left=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),original);
 left.position.set(-4,1,0);
 const right=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),original);
 right.position.set(4,1,0);
 model.add(left,right);
 prepareMeshyStructure(model,'headquarters',0);
 const door=meshHeadquartersDoor(model);
 assert.ok(door);
 assert.equal(door.mode,'hinged-real-entrance');
 assert.ok(model.getObjectByName('SF_HQ_RealEntrance_AnimatedLeaves'));
 const neutralCover=model.getObjectByName('SF_HQ_Annex_UnmarkedMetal');
 assert.ok(neutralCover,'real-geometry decal must cover the baked emblem');
 assert.ok(neutralCover.userData.coveredTriangles>0);
 assert.ok(neutralCover.children.every(x=>x.isMesh));
 assert.equal(model.getObjectByName('SF_Meshy_HQ_OriginalDoor_Interior'),undefined);
 assert.equal(left.material.map,tex);
 assert.equal(right.material.map,tex);
 const shader={uniforms:{},
  vertexShader:'#include <common>\\n#include <begin_vertex>',
  fragmentShader:'#include <common>\\n#include <roughnessmap_fragment>'};
 left.material.onBeforeCompile(shader);
 assert.doesNotMatch(shader.vertexShader,/sfHQMatRootPos|sfHQMeshToRoot/);
 assert.doesNotMatch(shader.fragmentShader,/sfBadgeMask|sfHQDoorOpen|discard;/);
 assert.match(shader.fragmentShader,/sfSandPanel/);
});
test('HQ spawn anchors are on the photographed double-door, not the right-hand annex',()=>{
 const src=readFileSync('scripts/webgl-meshy-structure.js','utf8');
 assert.equal(MESHY_HQ_ENGINEER_DOOR.xFraction,.47);
 assert.ok(MESHY_HQ_ENGINEER_DOOR.outsideOffsetFraction<.1);
 assert.match(src,/findHeadquartersDoorFacadeZ/);
 assert.match(src,/ray\.intersectObject\(model,true\)/);
 assert.match(src,/doorwayZ\+size\.z\*MESHY_HQ_ENGINEER_DOOR\.outsideOffsetFraction/);
 const gates=readFileSync('scripts/webgl-production-gates.js','utf8');
 assert.doesNotMatch(gates,/meshyHQShutter/);
 assert.match(gates,/meshyInfantry:true,meshyStart,meshyExit/);
});

test('any separately modeled HQ crest is removed without touching the real door',()=>{
 const root=new THREE.Group();
 const material=new THREE.MeshStandardMaterial();
 const actualDoor=new THREE.Mesh(new THREE.BoxGeometry(1,2,.15),material);
 actualDoor.name='HQ_Original_Double_Door';
 const crest=new THREE.Mesh(new THREE.BoxGeometry(1,1,.1),material);
 crest.name='Star_Emblem';
 root.add(actualDoor,crest);
 assert.equal(removeHeadquartersEmblemMeshes(root),1);
 assert.equal(root.getObjectByName('Star_Emblem'),undefined);
 assert.equal(root.getObjectByName('HQ_Original_Double_Door'),actualDoor);
});

test('HQ door hinges really open, with no freestanding garage or shader cutout',()=>{
 const root=new THREE.Group();
 const tex=new THREE.DataTexture(new Uint8Array([75,71,61,255]),1,1);
 root.add(new THREE.Mesh(new THREE.BoxGeometry(12,5,9),
  new THREE.MeshStandardMaterial({map:tex,roughness:.86,metalness:.25})));
 prepareMeshyStructure(root,'headquarters',0);
 const door=meshHeadquartersDoor(root);
 assert.ok(door);
 assert.equal(door.mode,'hinged-real-entrance');
 assert.equal(door.open,0);
 assert.equal(door.left.rotation.y,0);
 assert.equal(door.right.rotation.y,0);
 assert.ok(root.getObjectByName('SF_HQ_RealEntrance_AnimatedLeaves'));
 assert.ok(root.getObjectByName('SF_HQ_Annex_UnmarkedMetal'));
 assert.ok(root.getObjectByName('SF_HQ_RealDoubleDoor_left'));
 assert.ok(root.getObjectByName('SF_HQ_RealDoubleDoor_right'));
 assert.equal(root.getObjectByName('SF_Meshy_HQ_Shutter'),undefined);
 assert.equal(root.getObjectByName('SF_Meshy_HQ_OriginalDoor_Interior'),undefined);
 const mesh=root.children.find(x=>x.isMesh);
 assert.equal(mesh.material.map,tex);
 setMeshyHeadquartersDoorOpen(door,.75);
 assert.equal(door.open,.75);
 assert.ok(door.left.rotation.y<-.5);
 assert.ok(door.right.rotation.y>.5);
 setMeshyHeadquartersDoorOpen(door,0);
 assert.equal(door.left.rotation.y,0);
 assert.equal(door.right.rotation.y,0);
 const shader={vertexShader:'#include <common>\\n#include <begin_vertex>',
  fragmentShader:'#include <common>\\n#include <roughnessmap_fragment>',
  uniforms:{}};
 mesh.material.onBeforeCompile(shader);
 assert.doesNotMatch(shader.fragmentShader,/sfDoorAllowed|discard;/);
 assert.doesNotMatch(shader.vertexShader,/sfHQMatRootPos/);
});
test('engineer keeps verified exit while experimental HQ cutout is disabled',()=>{
 const producer=readFileSync('scripts/webgl-production-gates.js','utf8');
 assert.equal(MESHY_HQ_EXPERIMENTAL_SHADER,false);
 assert.match(producer,/meshHeadquartersDoor\(entry\.detail\)/);
 assert.match(producer,/openBay:!meshHQDoor/);
 assert.match(producer,/meshyInfantry:true,meshyStart,meshyExit/);
 assert.match(producer,/gate\.meshyInfantry\?gate\.meshyExit\.getWorldPosition/);
 assert.match(producer,/state\.directFoot\|\|gate\.openBay\|\|gate\.meshyShutter\|\|gate\.meshyInfantry/);
});
test('radar remains independent of HQ shader fallback',()=>{
 const style=readFileSync('scripts/webgl-meshy-structure.js','utf8');
 const radar=readFileSync('scripts/webgl-meshy-hq-radars.js','utf8');
 assert.equal(MESHY_HQ_EXPERIMENTAL_SHADER,false);
 assert.match(style,/MESHY_HQ_EXPERIMENTAL_SHADER/);
 assert.match(radar,/vec3 sfHQRootPos=/);
 assert.match(radar,/MESHY_HQ_RADAR_SPEEDS/);
});

test('HQ decal addon is included in the browser build instead of 404 on WebGL startup',()=>{
 const source=readFileSync('scripts/webgl-meshy-hq-details.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 const graph=readFileSync('scripts/check-webgl-module-graph.mjs','utf8');
 const html=readFileSync('webgl-preview.html','utf8');
 assert.match(source,/from 'three\/addons\/geometries\/DecalGeometry\.js'/);
 assert.match(build,/examples\/jsm\/geometries\/DecalGeometry\.js/);
 assert.match(build,/scripts\/webgl-meshy-hq-details\.js/);
 assert.match(graph,/spec\.startsWith\('three\/addons\/'\)/);
 assert.match(html,/"three\/addons\/":"\/vendor\/three\/addons\/"/);
});
