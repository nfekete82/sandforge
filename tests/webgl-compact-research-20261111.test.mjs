import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';
import {buildingArtScale} from '../dist/src/reborn/visual-scale.js';
import {siteExceedsMap,siteTerrainCompatible,sitesVisuallyOverlap}
 from '../dist/src/reborn/construction-spacing.js';
import {createStrategicBuilding} from '../scripts/webgl-strategic-buildings.js';
test('research lab grows to command-centre scale without changing costs or technology',()=>{
 assert.equal(BUILDINGS.research.cost,950);
 assert.equal(BUILDINGS.research.buildTime,48);
 assert.equal(BUILDINGS.research.width,170);
 assert.equal(BUILDINGS.research.radius,54);
 assert.equal(buildingArtScale('research'),1);
 const model=createStrategicBuilding('research',0);
 const bounds=new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
 assert.ok(bounds.x>150&&bounds.x<170&&bounds.z>120&&bounds.z<145,
  'lab facade has a visibly larger 3D footprint');
 assert.ok(bounds.y<150&&bounds.y>120,'radar keeps a prominent roof profile');
 assert.ok(model.getObjectByName('Research_Radar'));
 assert.ok(model.getObjectByName('Research_SensorArray'));
});
test('research ground validation uses the new compact foundation',()=>{
 const model=createStrategicBuilding('research',0);
 assert.equal(model.userData.compactResearch,true);
 const material=[];
 model.traverse(obj=>{if(obj.isMesh&&obj.material?.name==='SF_researchArmor')
  material.push(obj.material)});
 assert.ok(material.length>0);
 assert.ok(material.every(m=>m.map?.isDataTexture&&m.userData.sandforgeColorMapCamo));
 assert.ok(sitesVisuallyOverlap('research',{x:1000,y:1000},0,
  'research',{x:1080,y:1000},0));
 assert.ok(!sitesVisuallyOverlap('research',{x:1000,y:1000},0,
  'research',{x:1280,y:1000},0));
 assert.equal(siteExceedsMap('research',{x:30,y:30},0,3500),true,
  'enlarged lab foundation must not cross the playable map edge');
 const flat={walkable:()=>true,terrainHeight:()=>0,terrainSlope:()=>0};
 assert.ok(siteTerrainCompatible('research',{x:1000,y:1000},0,flat));
});
