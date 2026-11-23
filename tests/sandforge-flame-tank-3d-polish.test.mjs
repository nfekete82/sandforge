import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {polishFlameTank} from '../scripts/webgl-flame-tank-polish.js';

test('flame tank retrofit: front tracks exist on BOTH sides and share only two tread draw calls',()=>{
  const model=new THREE.Group(),kinds=[
    'rubber','steel','metal','graphite','sandDark','bronze','black',
    'amber','sand','sandLight','olive','oliveLight'
  ];
  const original=new Map();
  for(const kind of kinds){
    const material=new THREE.MeshStandardMaterial({name:'SF_Flamer_'+kind});
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.5),material);
    mesh.name='Fixture_'+kind;model.add(mesh);
    original.set(kind,material);
  }
  assert.equal(polishFlameTank(model),true);
  assert.equal(polishFlameTank(model),false,'repeated dressing must be idempotent');
  const retrofit=model.getObjectByName('SF_Flamer_FrontTrack_v2');
  assert.ok(retrofit);
  const links=retrofit.children.filter(c=>c.isInstancedMesh);
  assert.equal(links.length,2,'only rubber and metal tread instance draw calls');
  assert.ok(links.every(c=>c.count>=70),'both complete forward track loops');
  assert.ok(retrofit.getObjectByName('Flamer_FrontSprocket_-1'));
  assert.ok(retrofit.getObjectByName('Flamer_FrontSprocket_1'));
  const bounds=new THREE.Box3().setFromObject(retrofit);
  assert.ok(bounds.min.x< -3.9,'flame nozzles extend forward');
  const sand=model.getObjectByName('Fixture_sand').material;
  assert.notEqual(sand,original.get('sand'),'cached GLB material is not mutated');
  assert.equal(sand.map.image.width,256);
  assert.equal(sand.map.colorSpace,THREE.SRGBColorSpace);
  assert.equal(sand.map.generateMipmaps,true);
  assert.equal(original.get('sand').map,null);
});
