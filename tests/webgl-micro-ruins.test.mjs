import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {generateCanyonFeatures,canyonRuinBlocked}
 from '../dist/src/reborn/canyon-front.js';
import {isSmallRuin,makeSmallRuinFragments,SMALL_RUIN_REVISION}
 from '../scripts/webgl-ruin-fragments.js';

const file=p=>readFileSync(p,'utf8');
const modern=seed=>generateCanyonFeatures(seed,9200,8,4,[],[]);

test('spacious desert maps are less cluttered and keep large ruins recognizable',()=>{
 for(const seed of [11,2074,3622192284]){
  const ruins=modern(seed).ruins;
  assert.ok(ruins.length>0&&ruins.length<=10,
   'one visual ruin per sector, not multiple houses side by side');
  const large=ruins.filter(r=>r.variant===1);
  const small=ruins.filter(r=>isSmallRuin(r));
  assert.equal(large.length+small.length,ruins.length);
  assert.ok(large.length>0,'large POIs still exist');
  for(const r of small){
   assert.ok(r.width>=59&&r.width<79);
   assert.ok(r.depth>=45&&r.depth<61);
   assert.ok(r.height>=14&&r.height<23);
  }
  for(const r of large){
   assert.equal(r.width,162);
   assert.equal(r.depth,119);
   assert.equal(r.height,75.6);
  }
  for(let i=0;i<ruins.length;i++)for(let j=i+1;j<ruins.length;j++){
   const a=ruins[i],b=ruins[j];
   const gap=Math.hypot(a.x-b.x,a.y-b.y);
   const radius=Math.hypot(a.width,a.depth)*.65;
   assert.ok(gap>Math.max(b.width,b.depth)+radius+260,
    'decorative ruin sites must keep substantial empty sand between them');
  }
 }
});

test('legacy maps retain their full-height glTF ruins and original footprints',()=>{
 const ruins=generateCanyonFeatures(2074,4500,4,4,[],[]).ruins;
 assert.ok(ruins.length>0&&ruins.length<=24);
 assert.ok(ruins.every(r=>r.height>=39));
 assert.ok(ruins.every(r=>r.width>=80));
 assert.ok(ruins.every(r=>!isSmallRuin(r)),
  'new fragments must be opt-in for modern spacious maps');
});

test('small variants are just two or three jagged LOW walls and sparse rubble',()=>{
 const samples=[
  {x:300,y:400,width:72,depth:55,height:17,rotation:.35,variant:0},
  {x:800,y:800,width:61,depth:46,height:20,rotation:1.4,variant:2}
 ];
 for(let i=0;i<samples.length;i++){
  const group=makeSmallRuinFragments(samples[i],3622192284,i);
  assert.equal(group.userData.smallRuin,true);
  assert.equal(group.userData.nonPlayable,true);
  assert.equal(group.userData.roofless,true);
  assert.equal(group.userData.revision,SMALL_RUIN_REVISION);
  const walls=group.children.filter(m=>m.userData.ruinWall);
  const rubble=group.children.filter(m=>m.userData.ruinRubble);
  assert.ok(walls.length>=2&&walls.length<=3);
  assert.equal(rubble.length,1,'one instanced rubble draw call');
  assert.ok(group.userData.rubbleCount>=2&&group.userData.rubbleCount<=4);
  assert.ok(group.userData.maximumHeight<19);
  assert.ok(!group.children.some(child=>/roof|house|door|window|depot/i.test(child.name)));
  assert.ok(group.children.length<=4,'avoid dozens of separate drawcalls');
  for(const mesh of walls){
   assert.ok(mesh.geometry instanceof THREE.ExtrudeGeometry,
    'jagged, open masonry instead of boxed house geometry');
   assert.equal(mesh.castShadow,true);
   assert.equal(mesh.userData.nonPlayable,true);
  }
  assert.equal(rubble[0].isInstancedMesh,true);
  assert.equal(rubble[0].raycast({}),undefined,'non-interactive rubble');
 }
});

test('tiny collision footprints match the reduced ruins, not a hidden full house',()=>{
 const small=modern(2074).ruins.find(isSmallRuin);
 assert.ok(small);
 assert.equal(canyonRuinBlocked({x:small.x,y:small.y},small,0),true);
 const c=Math.cos(small.rotation),s=Math.sin(small.rotation);
 const outside=small.width*.5+8;
 const p={x:small.x+c*outside,y:small.y+s*outside};
 assert.equal(canyonRuinBlocked(p,small,0),false,
  'infantry should be able to walk beside the visibly tiny fragments');
});

test('3D/2D render paths choose rubble for small, full authored glTF for large',()=>{
 const preview=file('scripts/webgl-preview.js');
 const classic=file('src/reborn/canyon-front.ts');
 const build=file('scripts/build.mjs');
 assert.match(preview,/import \{makeSmallRuinFragments,isSmallRuin\} from '\/webgl-ruin-fragments\.js'/);
 assert.match(preview,/const micro=spacious&&isSmallRuin\(ruin\)/);
 assert.match(preview,/anchor\.add\(makeSmallRuinFragments\(ruin,seed,i,/);
 assert.match(preview,/if\(micro\)\{[\s\S]*?\}else\{\s*const source=data\[ruin\.variant===1\?1:0\]\.scene\.clone\(true\)/);
 assert.match(preview,/if\(spacious\)\{dressRuinDamage\(anchor,ruin,i\);addBuriedRuinRoad\(anchor,ruin,i\);\}/);
 assert.match(classic,/if\(r\.height<30\)\{/);
 assert.match(classic,/c\.restore\(\);continue;/);
 assert.match(build,/cpSync\('scripts\/webgl-ruin-fragments\.js','dist\/webgl-ruin-fragments\.js'\)/);
 assert.match(preview,/3D-Ruinen/);
});

test('small sites remain clean of full-size supply clutter and stone carpets',()=>{
 const art=file('scripts/webgl-environment.js');
 assert.match(art,/rubbleAt=ruin=>.*ruin\.height<30\?1:/);
 assert.match(art,/const micro=this\.world\.mapVersion>=19&&ruin\.height<30/);
 assert.match(art,/micro\?\(random\(\)<\.25\?1:0\)/);
 assert.match(art,/available\.filter\(a=>a\.kind==='sandbags'\)/);
 const canyon=file('src/reborn/canyon-front.ts');
 assert.match(canyon,/for\(let n=0;n<\(spacious\?1:3\);n\+\+\)/);
 assert.match(canyon,/spacious\?265:55/);
 assert.match(canyon,/variant===1\?162:59\+random\(\)\*19/);
});
