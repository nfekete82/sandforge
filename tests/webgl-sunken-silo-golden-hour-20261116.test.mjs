import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {createStrategicBuilding,trimSiloRocketForGhost,prepareSiloForPortrait} from '../scripts/webgl-strategic-buildings.js';
import {createBuildingYard,disposeBuildingYard} from '../scripts/webgl-building-yard.js';
import {DESERT_GOLDEN_HOUR,desertGoldenHourEnabled}
 from '../scripts/webgl-golden-hour.js';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';

test('PBR missile silo is a low recessed bunker with only the upper rocket above the hatch',()=>{
 for(const owner of [0,1]){
  const model=createStrategicBuilding('silo',owner);
  const well=model.getObjectByName('Silo_RecessedLaunchWell');
  const lip=model.getObjectByName('Silo_LaunchRim');
  const body=model.getObjectByName('Silo_RocketBody');
  const nose=model.getObjectByName('Silo_RocketNose');
  const deck=model.getObjectByName('Silo_ExcavatedConcreteDeck');
  const interior=model.getObjectByName('Silo_InnerShaftWall');
  assert.ok(well?.isMesh&&lip?.isMesh&&body?.isMesh&&nose?.isMesh);
  assert.ok(deck?.isMesh&&interior?.isMesh,'launch hole must have real cutout and interior walls');
  assert.equal(deck.geometry.type,'ExtrudeGeometry');
  assert.equal(deck.geometry.parameters.shapes.holes.length,1,
   'concrete foundation is actually missing material in the missile shaft');
  assert.equal(interior.material.side,THREE.BackSide,'view the shaft from INSIDE');
  assert.ok(interior.geometry.parameters.height>30,'shaft walls must show real depth');
  assert.ok(well.position.y<-20,'deep floor must not read as a black disk on the roof');
  const occlusion=model.getObjectByName('Silo_TerrainOcclusion');
  assert.ok(occlusion?.isMesh,'underground launch shaft requires a terrain occlusion mask');
  assert.ok(occlusion.material.isShaderMaterial,
   'the underground opening must render perspective-correct wall depth, not a disk');
  assert.equal(occlusion.material.name,'SF_SiloDepthOcclusion');
  assert.ok(occlusion.geometry.parameters.radius>=59);
  assert.ok(occlusion.position.y>1.15&&occlusion.position.y<lip.position.y-5,
   'ground-level mask prevents the terrain from bleeding into the shaft');
  const shader=occlusion.material;
  assert.equal(shader.uniforms.uDepth.value,95,
   'inner wall projection extends 95 world units down');
  const steel=shader.uniforms.uWallTexture.value;
  assert.ok(steel?.isDataTexture,'shaft metal must use an actual texture, not smooth stripes');
  assert.equal(steel.name,'Sandforge silo deep weathered steel shaft wall');
  assert.equal(steel.image.width,256);
  assert.equal(steel.image.height,256);
  assert.equal(steel.wrapS,THREE.RepeatWrapping);
  assert.equal(steel.wrapT,THREE.RepeatWrapping);
  const red=new Set();
  for(let i=0;i<steel.image.data.length;i+=64)
   red.add(steel.image.data[i]);
  assert.ok(red.size>18,'steel albedo must contain uneven wear and panel joints');
  assert.ok(shader.fragmentShader.includes('texture2D(uWallTexture,steelUV)'),
   'metal surface must wrap around real projected cylinder coordinates');
  assert.ok(shader.fragmentShader.includes('float tWall='),
   'ray-marched shaft must intersect its cylindrical back wall');
  assert.ok(shader.fragmentShader.includes('float tFloor='),
   'deep shaft has a separate distant bottom, not a black floor decal');
  for(const height of ['14.0','38.0','67.0'])
   assert.ok(shader.fragmentShader.includes('band(down,'+height),
    'reinforcement collars must be separated at real shaft depths');
  assert.equal(shader.depthWrite,true,'terrain mask must stay opaque');
  assert.equal(shader.transparent,false,'terrain must never bleed through');
  assert.equal(occlusion.userData.visualShaftDepth,95);
  assert.equal(occlusion.userData.hidesUnderlyingTerrain,true);
  // A planar depth mask cannot show real geometry BELOW its surface.
  // Its fragment shader must reconstruct the submerged rocket cylinder and
  // composite it in front of the virtual metal wall, without a hard edge.
  assert.ok(shader.fragmentShader.includes('rocketDelta>0.0'),
   'shader must compute missile ray-cylinder intersection');
  assert.ok(shader.fragmentShader.includes('tRocket<min(tWall,tFloor)'),
   'submerged metal rocket must occlude the projected far wall');
  assert.ok(shader.fragmentShader.includes('rocketZ>uRocketBottom'),
   'rocket is bounded by its real lower stage, not an infinite tube');
  assert.ok(shader.fragmentShader.includes('deepFade'),
   'submerged body must fade into deep shaft shadow');
  assert.equal(shader.uniforms.uRocketRadius.value,body.geometry.parameters.radiusTop);
  assert.equal(body.geometry.parameters.radiusTop,body.geometry.parameters.radiusBottom,
   'real metal hull must be a straight cylinder, not a tapered slanted body');
  assert.ok(shader.uniforms.uRocketColor.value.equals(body.material.color),
   'underwater missile shader must use the exact same alloy albedo as the real upper hull');
  assert.ok(shader.fragmentShader.includes('metal=uRocketColor*'),
   'the submerged missile color may never come from a separate hard-coded grey');
  assert.strictEqual(body.material.map,nose.material.map,
   'nose and straight hull must share the identical metallic grain texture');
  assert.equal(body.material.roughness,nose.material.roughness,
   'nose and hull have exactly the same metal roughness');
  assert.equal(body.material.metalness,nose.material.metalness,
   'nose and hull have exactly the same metalness');
  assert.strictEqual(shader.uniforms.uRocketGrain.value,body.material.map,
   'projected underground hull must use the same grain as the physical rocket');
  assert.ok(shader.fragmentShader.includes('texture2D(uRocketGrain,rocketUV)'),
   'underground rocket samples the actual upper-stage metal texture');
  assert.doesNotMatch(shader.fragmentShader,/float brush=\.004\*sin/,
   'no artificial vertical streaks on the underwater rocket cylinder');
  const stageBottom=body.position.y-body.geometry.parameters.height/2;
  assert.ok(Math.abs(shader.uniforms.uRocketBottom.value-
   (stageBottom-occlusion.position.y))<1e-6,
   'virtual and physical missile must have the SAME underwater endpoint');
  assert.equal(typeof occlusion.onBeforeRender,'function');
  // Only ONE real rocket mesh and ONE ground-level shaft shader.
  // Never render an independent long PBR overlay with depthTest disabled:
  // that caused the rocket to extend outside the silo, across the sand and
  // through the wire fence despite having a seemingly correct clip shader.
  assert.equal(model.getObjectByName('Silo_RocketStencilMask'),undefined);
  assert.equal(model.getObjectByName('Silo_RocketBodyUnderground'),undefined);
  assert.equal(model.children.filter(m=>m.isMesh&&m.material?.depthTest===false).length,0,
   'no underground cylinder is allowed to paint on top of terrain');
  assert.ok(shader.fragmentShader.includes('tRocket<min(tWall,tFloor)'),
   'depth shader itself renders the buried missile ONLY inside the circular opening');
  assert.equal(body.material.depthTest,true,
   'the real metallic hull must obey the game depth buffer');
  assert.equal(deck.material.name,'SF_metal','main launch deck is stamped steel');
  assert.equal(deck.material.map?.name,'Sandforge silo stamped steel maintenance panels');
  assert.ok(deck.material.metalness>.7&&deck.material.roughness<.5);
  assert.ok(lip.geometry.parameters.outerRadius>
   deck.userData.shaftRadius+12,'reinforced steel rim surrounds the full aperture');
  assert.equal(body.geometry.type,'CylinderGeometry');
  assert.ok(body.geometry.parameters.height>=25,'a real metal rocket body is visible');
  assert.equal(nose.geometry.type,'LatheGeometry',
   'missile nose is a short rounded ogive, not a tall sharp cone');
  const profile=nose.geometry.parameters.points;
  assert.ok(profile.at(-1).y<=18&&profile.at(-1).y>=17,
   'rounded nose height must stay compact');
  assert.ok(profile.some(p=>p.x>2&&p.x<7&&p.y>14),
   'curved shoulder softens the missile tip');
  assert.ok(body.material.metalness>.75&&nose.material.metalness>.75,
   'both rocket stages are metallic, not a flat black cone');
  assert.ok(body.position.y<-20&&body.position.y>-35,
   'the complete missile body must descend into the shaft rather than float above it');
  assert.equal(body.geometry.parameters.height,125,
   'the smooth metal shell must extend almost to the 95-unit shaft floor');
  assert.equal(body.geometry.parameters.openEnded,true,
   'no exposed flat bottom cap may hover inside the launch well');
  const cylinderTop=body.position.y+body.geometry.parameters.height/2;
  const cylinderBottom=body.position.y-body.geometry.parameters.height/2;
  assert.ok(cylinderTop>=occlusion.position.y+30,
   'at least 30 model units of cylindrical rocket remain exposed above the hatch');
  assert.ok(cylinderBottom<-80&&cylinderBottom>-(occlusion.userData.visualShaftDepth+5),
   'open-ended missile shell terminates near the unseen deep shaft floor');
  assert.equal(body.material.vertexColors,true,
   'metal hull should naturally darken as it descends into the unlit silo');
  const colors=body.geometry.getAttribute('color');
  const positions=body.geometry.getAttribute('position');
  assert.ok(colors&&colors.count===positions.count);
  let lowest=Infinity,highest=-Infinity;
  for(let i=0;i<positions.count;i++){
   lowest=Math.min(lowest,colors.getX(i));
   highest=Math.max(highest,colors.getX(i));
  }
  assert.ok(lowest<=.20&&highest>=.99,
   'upper hull stays full-strength metal while deep underground shell fades into darkness');
  for(let i=0;i<positions.count;i++){
   const worldY=positions.getY(i)+body.position.y;
   if(worldY>=occlusion.position.y)
    assert.ok(colors.getX(i)>=.999,
     'visible rocket cylinder has precisely the same undimmed PBR metal as its nose');
  }
  assert.equal(nose.position.y,cylinderTop,
   'rounded ogive must connect directly to the cylinder without a floating gap');
  const source=readFileSync('scripts/webgl-strategic-buildings.js','utf8');
  assert.match(source,/const hullHeight=125,hullTopY=35\.5,hullCenterY=hullTopY-hullHeight\/2;/,
   'nose and full-length missile body must share one upper endpoint');
  assert.equal((source.match(/\bhullTopY\s*=/g)||[]).length,1,
   'hullTopY must be declared only once (duplicate const breaks all ES module imports)');
  const code=readFileSync('scripts/webgl-strategic-buildings.js','utf8');
  assert.match(code,/for\(let i=0;i<12;i\+\+\)\{\s*const a=i\*Math\.PI\/6;\s*const bar=box\(3\.5,30,2\.8,'steel'/,
   'twelve physical steel strips remain at the upper shaft wall');
  assert.match(code,/\(shaftRadius-2\.5\),-6\.6/,
   'visible strips meet the upper part of the recessed liner');
  assert.ok(shader.fragmentShader.includes('angle*16.0'),
   'vertical grooves must continue deep down into the projected shaft');
  assert.doesNotMatch(code,/for\(const y of \[7\.2,4\.3,2\.1/,
   'no shallow bright metal hoop stack under the upper hatch rim');
  assert.equal(model.getObjectByName('Silo_RocketStageSeam'),undefined,
   'missile must have no raised circumference groove');
  assert.equal(body.material.color.getHex(),nose.material.color.getHex(),
   'smooth cylinder and nose share one uniform brushed-steel appearance');
  assert.ok(body.geometry.parameters.height>=30);
  const smallRings=model.children.filter(o=>o.isMesh&&
   o.geometry.type==='TorusGeometry'&&o.geometry.parameters.radius<25);
  assert.equal(smallRings.length,0,'rocket body may not carry any decorative rings');
  assert.ok(lip.position.y<11,'hatch ring sits barely above the desert ground');
  assert.ok(well.position.y<lip.position.y-6,'dark shaft floor is visibly lower');
  assert.ok(body.position.y<lip.position.y+5,'only upper stage rises from the hole');
  assert.ok(nose.position.y>lip.position.y+22&&nose.position.y<lip.position.y+32,
   'short rounded nose must sit atop a long visible metal cylinder');
  assert.equal(body.position.x,well.position.x,'rocket is centered in its shaft');
  assert.equal(nose.position.x,well.position.x);
  const bb=new THREE.Box3().setFromObject(model);
  assert.ok(bb.max.y<80,'missile should show only the nose above the low bunker');
  const painted=[];
  model.traverse(o=>{if(o.isMesh&&o.material?.userData?.sandforgeColorMapCamo)
   painted.push(o)});
  assert.ok(painted.some(m=>m.material.name==='SF_base'));
  assert.ok(painted.some(m=>m.material.name==='SF_armor'));
  assert.ok(model.children.filter(o=>o.isMesh).length<=24,
   'static batching remains bounded without any underground rocket overdraw');
 }
 assert.equal(BUILDINGS.silo.cost,5000);
 assert.equal(BUILDINGS.silo.buildTime,100);
 assert.equal(BUILDINGS.silo.radius,91);
});

test('projected silo ray hits submerged rocket ahead of deep shaft wall',()=>{
 // Near side of cylinder is only reached BELOW the masking disk for this
 // camera and disk pixel. If we do not shade the virtual stage there, the
 // physical mesh disappears at the disk plane and looks suspended in air.
 const root=createStrategicBuilding('silo',0);
 const mask=root.getObjectByName('Silo_TerrainOcclusion');
 const material=mask.material;
 const eye=new THREE.Vector3(0,-160,160);
 const pixel=new THREE.Vector3(0,-40,0);
 const dir=pixel.clone().sub(eye).normalize();
 const a=dir.x*dir.x+dir.y*dir.y;
 const b=eye.x*dir.x+eye.y*dir.y;
 const radius=material.uniforms.uRocketRadius.value;
 const c=eye.x*eye.x+eye.y*eye.y-radius*radius;
 const discriminant=b*b-a*c;
 assert.ok(discriminant>0,'camera ray must intersect missile cylinder');
 const tEntry=(-b-Math.sqrt(discriminant))/a;
 const tPlane=-eye.z/dir.z;
 const tFloor=(-material.uniforms.uDepth.value-eye.z)/dir.z;
 const hitZ=eye.z+dir.z*tEntry;
 assert.ok(tEntry>tPlane&&tEntry<tFloor,
  'the ray enters the missile behind the physical masking plane');
 assert.ok(hitZ<0&&hitZ>material.uniforms.uRocketBottom.value,
  'intersected missile segment lies inside the deep steel shaft');
 const wallRadius=material.uniforms.uRadius.value;
 const wallC=eye.x*eye.x+eye.y*eye.y-wallRadius*wallRadius;
 const tWall=(-b+Math.sqrt(b*b-a*wallC))/a;
 assert.ok(tEntry<tWall,'rocket must be in front of the far shaft wall');
});

test('translucent silo building ghost hides the buried rocket without altering gameplay',()=>{
 const live=createStrategicBuilding('silo',0);
 const ghost=createStrategicBuilding('silo',0);
 const liveBody=live.getObjectByName('Silo_RocketBody');
 const ghostBody=ghost.getObjectByName('Silo_RocketBody');
 assert.equal(ghostBody.geometry.drawRange.count,Infinity,
  'new building starts with a complete rocket before ghost conversion');
 assert.equal(trimSiloRocketForGhost(ghost),true);
 assert.ok(ghostBody.userData.sandforgeGhostRocketCut);
 const {radialSegments,heightSegments}=ghostBody.geometry.parameters;
 const visible=ghostBody.userData.sandforgeGhostVisibleSegments;
 assert.ok(visible>0&&visible<heightSegments/2,
  'placement ghost may only show the upper part of the missile');
 assert.equal(ghostBody.geometry.drawRange.count,visible*radialSegments*6);
 assert.equal(ghostBody.geometry.index.count,ghostBody.geometry.drawRange.count,
  'ghost must contain ONLY above-ground triangles, not merely draw a range of the original');
 assert.ok(ghostBody.geometry.index.count<liveBody.geometry.index.count,
  'the hidden underground geometry is removed from the preview index buffer');
 const indices=ghostBody.geometry.index.array;
 const positions=ghostBody.geometry.getAttribute('position');
 let lowest=Infinity;
 for(let i=0;i<ghostBody.geometry.drawRange.count;i++){
  const vertexY=positions.getY(indices[i])+ghostBody.position.y;
  lowest=Math.min(lowest,vertexY);
 }
 assert.ok(lowest>=2.2,
  'preview rocket ends above the basement and cannot protrude below the ghost platform');
 assert.equal(liveBody.geometry.drawRange.count,Infinity,
  'preview clipping must never damage the completed in-game missile');
 assert.equal(live.getObjectByName('Silo_TerrainOcclusion').material.uniforms.uDepth.value,95);
 const scene=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(scene,/trimSiloRocketForGhost\(placeholder\)/,
  'ghost-only trim is called before translucent materials are applied');
 assert.doesNotMatch(scene,/Silo_RocketBodyUnderground/,
  'no extra underground missile renderer is needed in placement previews');
 assert.equal(trimSiloRocketForGhost(new THREE.Group()),false,
  'non-silo buildings should never be modified');
 assert.equal(trimSiloRocketForGhost(ghost),true,
  'repeated ghost conversion must be idempotent');

 // Regression for the original failure: source index buffers can start at
 // the bottom (or change ordering between Three versions). Geometric cut
 // must not depend on whichever triangles happen to come first.
 const reordered=createStrategicBuilding('silo',0);
 const reversedHull=reordered.getObjectByName('Silo_RocketBody');
 const sourceIndex=Array.from(reversedHull.geometry.index.array);
 const reverseTriangles=[];
 for(let i=sourceIndex.length-3;i>=0;i-=3)
  reverseTriangles.push(sourceIndex[i],sourceIndex[i+1],sourceIndex[i+2]);
 reversedHull.geometry.setIndex(reverseTriangles);
 assert.equal(trimSiloRocketForGhost(reordered),true);
 const trimmed=reversedHull.geometry;
 const pos=trimmed.getAttribute('position'),ix=trimmed.index.array;
 let lowestReverse=Infinity;
 for(let i=0;i<ix.length;i++)
  lowestReverse=Math.min(lowestReverse,
   pos.getY(ix[i])+reversedHull.position.y);
 assert.ok(lowestReverse>=2.2,
  'ghost clipping must still work when CylinderGeometry indices run bottom-first');
});

test('HUD silo portrait is framed on the visible rocket and bunker, not a long buried tube',()=>{
 const live=createStrategicBuilding('silo',0);
 const portrait=createStrategicBuilding('silo',0);
 const before=new THREE.Box3().setFromObject(portrait);
 const liveRocket=live.getObjectByName('Silo_RocketBody');
 assert.equal(prepareSiloForPortrait(portrait),true);
 const after=new THREE.Box3().setFromObject(portrait);
 const portraitRocket=portrait.getObjectByName('Silo_RocketBody');
 const nose=portrait.getObjectByName('Silo_RocketNose');
 const mask=portrait.getObjectByName('Silo_TerrainOcclusion');
 assert.ok(after.min.y>before.min.y+40,
  'portrait bounds must not include the hidden missile extending far below the deck');
 assert.ok(after.max.y<=before.max.y+.01);
 assert.ok(portraitRocket.position.y-portraitRocket.geometry.parameters.height/2>mask.position.y,
  'HUD rocket stops at the launch opening rather than hanging underneath it');
 assert.equal(portraitRocket.position.y+portraitRocket.geometry.parameters.height/2,
  nose.position.y,'HUD cylinder still meets the rounded nose without a gap');
 assert.equal(portraitRocket.geometry.getAttribute('color').count,
  portraitRocket.geometry.getAttribute('position').count,
  'portrait metal retains valid full-bright PBR vertex colors');
 assert.equal(liveRocket.geometry.parameters.height,125,
  'HUD edits must not shorten the playable missile');
 assert.equal(portrait.getObjectByName('Silo_InnerShaftWall'),undefined);
 assert.equal(portrait.getObjectByName('Silo_RecessedLaunchWell'),undefined);
 assert.equal(prepareSiloForPortrait(portrait),false,
  'portrait trim is idempotent');
 const script=readFileSync('scripts/webgl-portraits.js','utf8');
 assert.match(script,/if\(kind==='silo'&&!prepareSiloForPortrait\(model\)\)/,
  'real HUD 3D portrait is corrected before its camera bounds are computed');
});

test('silo shares the slim military barbed-wire fence and clears its supply pallets',()=>{
 const yard=createBuildingYard('silo',BUILDINGS.silo.width);
 const perimeter=yard.getObjectByName('BasePerimeter_silo');
 const cache=perimeter?.getObjectByName('BaseSupplyCache');
 const bounds=perimeter?.userData?.siloFenceBounds;
 assert.ok(perimeter&&cache&&bounds);
 assert.equal(perimeter.userData.siloWireFence,true);
 assert.equal(perimeter.userData.fenceRails,0);
 assert.ok(perimeter.getObjectByName('BarracksWireFencePosts')?.isInstancedMesh);
 assert.ok(perimeter.getObjectByName('BarracksWireFenceStrands')?.isInstancedMesh);
 assert.ok(perimeter.getObjectByName('BarracksWireFenceBarbs')?.isInstancedMesh);
 assert.equal(perimeter.getObjectByName('YardFenceMesh'),undefined);
 yard.updateWorldMatrix(true,true);
 const crateBounds=new THREE.Box3().setFromObject(cache)
  .applyMatrix4(perimeter.matrixWorld.clone().invert());
 assert.ok(bounds.rightX>=crateBounds.max.x+19,'right side encloses barrels and crates');
 assert.ok(bounds.rear<=crateBounds.min.z-19,'rear line clears the cache');
 assert.ok(bounds.front>=crateBounds.max.z+19,'front line clears the cache');
 assert.ok(bounds.gateHalf>55&&bounds.gateHalf<70,'entrance is wide enough for vehicles');
 disposeBuildingYard(yard);
});

test('golden hour is the default desert environment with an opt-out daytime view',()=>{
 assert.equal(desertGoldenHourEnabled('desert',null),true);
 assert.equal(desertGoldenHourEnabled('desert','golden'),true);
 assert.equal(desertGoldenHourEnabled('desert','day'),false);
 assert.equal(desertGoldenHourEnabled('snow',null),false);
 assert.equal(desertGoldenHourEnabled('jungle',null),false);
 const [x,y,z]=DESERT_GOLDEN_HOUR.sunOffset;
 const elevation=Math.atan2(y,Math.hypot(x,z))*180/Math.PI;
 assert.ok(elevation>18&&elevation<28,'golden hour needs a genuinely low sun');
 assert.ok(DESERT_GOLDEN_HOUR.sunIntensity>2);
 assert.ok(DESERT_GOLDEN_HOUR.fillIntensity>.3,'units remain readable in shadow');
 assert.ok(DESERT_GOLDEN_HOUR.fogDensity<.00008);
 const scene=readFileSync('scripts/webgl-preview.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(scene,/desertGoldenHourEnabled\(biome,query.get\('lighting'\)\)/);
 assert.match(scene,/new THREE.DirectionalLight\(\s*sunset\?\.sunColor/);
 assert.match(scene,/const sunlightOffset=new THREE.Vector3/);
 assert.match(scene,/sun.position.copy\(cameraTarget\).add\(sunlightOffset\)/);
 assert.match(scene,/scene.background=new THREE.Color\('#000000'\)/);
 assert.match(build,/cpSync\('scripts\/webgl-golden-hour.js','dist\/webgl-golden-hour.js'\)/);
});
