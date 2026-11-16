import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const DIR='src/assets/reborn/buildings-3d/';

function parse(owner){
 const bytes=readFileSync(DIR+'bastion-'+owner+'.glb');
 assert.equal(bytes.toString('ascii',0,4),'glTF');
 assert.equal(bytes.readUInt32LE(4),2);
 assert.equal(bytes.readUInt32LE(8),bytes.length);
 const length=bytes.readUInt32LE(12);
 assert.equal(bytes.toString('ascii',16,20),'JSON');
 const doc=JSON.parse(bytes.toString('utf8',20,20+length));
 return {doc,bytes};
}

test('the three PBR Bastions retain neutral/blue/red assets and real RadarSpin animation',()=>{
 const neutral=parse(-1).doc;
 assert.equal(neutral.asset.generator,'sandforge-bastion-radar-v2',
  'ALTE Bastion geladen. npm run build muss die neuen GLBs generieren.');
 for(const owner of [-1,0,1]){
  const {doc,bytes}=parse(owner);
  assert.equal(doc.asset.generator,'sandforge-bastion-radar-v2',
   'Bastion '+owner+' ist noch der alte Rundturm');
  const pivot=doc.nodes.findIndex(n=>n.name==='BastionRadarRotor');
  const camo=doc.nodes.find(n=>n.name==='BastionStatic_camo');
  const primitive=doc.meshes[camo?.mesh]?.primitives?.[0];
  const accessor=doc.accessors[primitive?.attributes?.POSITION];
  assert.ok(accessor?.max?.[1]>=5&&accessor?.min?.[1]<=1.3,
   'expected tapered desert-colour bastion, not the original black stacked tower');
  assert.ok(pivot>=0,'missing radar pivot '+owner);
  const clip=doc.animations?.find(a=>a.name==='RadarSpin');
  assert.ok(clip,'GLTFLoader must play the real radar clip '+owner);
  assert.ok(clip.channels.some(c=>c.target?.node===pivot&&c.target.path==='rotation'));
  assert.equal(doc.meshes.length,19,'keep FPS budget small');
  assert.ok(doc.images.length>=14,'PBR color textures must be embedded');
  assert.ok(doc.materials.some(m=>m.name==='Sandforge_Bastion_camo'));
  assert.ok(doc.materials.some(m=>m.name==='Sandforge_Bastion_fabric'));
  assert.ok(doc.nodes.some(n=>n.name==='BastionStatic_camo'));
  assert.ok(doc.nodes.some(n=>n.name==='BastionRadar_gunmetal'));
  assert.ok(bytes.length<2_500_000,'compact GLB should stay under 2.5 MB');
  const positions=doc.accessors.filter(a=>a.type==='VEC3'&&a.min&&a.max);
  assert.ok(positions.length>5,'real mesh geometry expected');
 }
});

test('build must generate actual new GLBs before copying assets to dist',()=>{
 const build=readFileSync('scripts/build.mjs','utf8');
 const generator=readFileSync('scripts/generate-bastion-radar.mjs','utf8');
 const generate=build.indexOf('scripts/generate-bastion-radar.mjs');
 const copy=build.indexOf("cpSync('src/assets', 'dist/src/assets'");
 assert.ok(generate>=0&&copy>generate,
  'normal Sandforge build must overwrite the old models before shipping');
 assert.match(generator,/sandforge-bastion-radar-v2/);
 assert.match(generator,/for\(const owner of \[-1,0,1\]\)exportTeam\(owner\)/);
 assert.match(generator,/BastionRadarRotor/);
 assert.match(generator,/RadarSpin/);
});

test('Bastion capture, team ownership, fog and animation remain separate from 3D art',()=>{
 const src=readFileSync('scripts/webgl-battlefield.js','utf8');
 const capture=readFileSync('scripts/webgl-bastion-capture.js','utf8');
 const lifecycle=readFileSync('scripts/webgl-bastion-lifecycle.js','utf8');
 assert.match(src,/\/src\/assets\/reborn\/buildings-3d\/bastion-'\+owner\+'\.glb'/);
 assert.match(src,/data\.animations\?\.find\(c=>c\.name==='RadarSpin'\)/);
 assert.match(src,/const mixer=new THREE\.AnimationMixer\(detail\)/);
 assert.match(src,/entry\.owner=territory\.owner/);
 assert.match(src,/updateBastionCaptureBar\(entry\.captureBar,territory,this\.game,this\.fogEnabled\)/);
 assert.match(capture,/fogEnabled\|\|game\.canSee/);
 assert.match(lifecycle,/releaseBastionRevision/);
 assert.match(lifecycle,/mixer\.stopAllAction\(\)/);
});
