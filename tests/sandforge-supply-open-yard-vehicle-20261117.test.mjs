import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {vehicleDustEligible} from '../scripts/webgl-vehicle-dust.js';
import {vehicleSoundMix} from '../dist/src/reborn/vehicle-soundscape.js';

const script=name=>readFileSync('scripts/'+name,'utf8');
const dir=process.env.SANDFORGE_SUPPLY_GLB_TEST_DIR??'dist/supply-pbr-qa';
const readGlb=path=>{
 const b=readFileSync(path);
 assert.equal(b.toString('ascii',0,4),'glTF');
 assert.equal(b.readUInt32LE(4),2);
 assert.equal(b.readUInt32LE(8),b.length);
 return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString('utf8').trim());
};

test('the open concrete yard exposes 18 individually depleting pallets, with no roof',()=>{
 const data=readGlb(join(dir,'supply-depot-neutral.glb'));
 const names=data.nodes.map(n=>n.name);
 assert.ok(names.includes('SF_DepotConcretePad'));
 assert.ok(!names.includes('SF_DepotLoadingRamp'),'yard no longer has a ramp');
 assert.ok(!data.animations?.some(a=>a.name==='DepotRampLower'));
 const stacks=names.filter(n=>/^SF_DepotStock_\d{2}$/.test(n));
 assert.equal(stacks.length,18);
 for(const name of stacks){
  const node=data.nodes.find(n=>n.name===name);
  assert.ok(node?.children?.length>0,'pallet is a real separate GLB node: '+name);
 }
 const top=Math.max(...data.meshes.flatMap(m=>m.primitives.map(p=>
  data.accessors[p.attributes.POSITION].max?.[1]??0)));
 assert.ok(top<70,'no 70+ high hall, roof, canopy or tall walls: '+top);
 const generator=script('generate-supply-pbr.mjs');
 assert.doesNotMatch(generator,/SF_DepotRoof|SF_DepotCanopy/);
});

test('the imported truck retains six hard-surface wheels and the PBR repair',()=>{
 const file='src/assets/reborn/supply-custom/supply-0.glb';
 assert.ok(existsSync(file),'the actual user-provided GLB is checked in');
 const gltf=readGlb(file);
 const nodes=new Set(gltf.nodes.map(n=>n.name));
 for(const axle of ['FRONT','MID','REAR'])for(const side of ['L','R'])
  assert.ok(nodes.has('wheel_'+axle+'_'+side));
 for(let i=0;i<8;i++)assert.ok(nodes.has('cargo_stack_'+i));
 for(const name of ['Desert_Camouflage_PBR','Wooden_Crate_PBR']){
  const mat=gltf.materials.find(m=>m.name===name);
  assert.ok(mat?.pbrMetallicRoughness?.baseColorTexture);
 }
 const adapter=script('webgl-supply-custom.js');
 assert.match(adapter,/mat\.color\.setRGB\(1,1,1\)/,'repair source 1\/255 tint');
 assert.match(adapter,/mat\.opacity=1/,'repair source alpha');
 assert.match(adapter,/wheel\.scale\.setScalar\(\.87\)/,'smaller tyres');
 assert.match(adapter,/wheel\.position\.y=-3\.13/,'rear axle spacing');
 assert.match(adapter,/animateCustomSupplyTruck/);
});

test('supply appears only under vehicle production and leaves tyre tracks',()=>{
 const stage=script('webgl-battlefield.js');
 const catalog=readFileSync('src/reborn/catalog.ts','utf8');
 const availability=script('webgl-global-catalog.js');
 const marks=script('webgl-ground-tracks.js');
 assert.match(catalog,/supply:\{name:'Nachschubtransporter',group:'Fahrzeuge'/);
 assert.match(stage,/\['headquarters','KOMMANDOZENTRALE · NACHSCHUB'\]/);
 assert.match(stage,/UNITS\[k\]\.group===group/);
 assert.match(stage,/\],'Fahrzeuge'\)/);
 assert.match(availability,/vehicles:finished\('headquarters'\)\|\|finished\('factory'\)/);
 assert.match(marks,/\['rover','supply','tank','artillery'\]/);
 assert.ok(vehicleDustEligible({kind:'supply',moving:true,dx:8,dz:0,tick:0,id:0}));
 assert.equal(vehicleDustEligible({kind:'supply',moving:false,dx:0,dz:0}),false);
});

test('driving logistics truck uses vehicle engine, not a footstep synthesizer',()=>{
 const unit={kind:'supply',hp:260,moving:true,carrier:undefined,
  x:100,y:100,previousX:99,previousY:100};
 const mix=vehicleSoundMix({units:[unit]},{x:100,y:100},()=>true);
 assert.equal(mix.rover.count,1,'supply shares light vehicle engine');
 assert.ok(mix.rover.level>0);
 assert.equal(mix.tank.count,0);
 const audio=readFileSync('src/reborn/audio.ts','utf8');
 assert.match(audio,/Infantry movement\s*\n\s*\/\/ intentionally has no step sounds/);
});
