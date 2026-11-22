import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync,existsSync} from 'node:fs';
import * as THREE from 'three';
import {SANDFORGE_SAND_PBR,createSandNormalAndRoughness,installDesertSandPBR}
 from '../scripts/webgl-sand-pbr.js';
import {DESERT_SCENIC_STYLE} from '../scripts/webgl-desert-style.js';

const asset='src/assets/reborn/terrain/sand-wind-albedo-v1.webp';
test('authored, portable 512² wind-ripple albedo is a genuine WebP binary and ships in dist',()=>{
 assert.ok(existsSync(asset),'the newly created sand photograph is in Git');
 assert.ok(existsSync('dist/'+asset),'web server actually ships the source PBR asset');
 const bytes=readFileSync(asset);
 assert.ok(bytes.length>4000&&bytes.length<100000,'compressed source stays memory efficient');
 assert.equal(bytes.toString('ascii',0,4),'RIFF');
 assert.equal(bytes.toString('ascii',8,12),'WEBP');
 assert.equal(SANDFORGE_SAND_PBR.albedo,'/'+asset);
 assert.equal(SANDFORGE_SAND_PBR.sourceSize,512);
 assert.equal(SANDFORGE_SAND_PBR.generatedMapsSize,1024);
});
test('albedo and derived normal/roughness share one UV orientation and correct color space',()=>{
 const src=readFileSync('scripts/webgl-sand-pbr.js','utf8');
 assert.match(src,/ctx\.drawImage\(image,0,0,size,size\)/);
 assert.match(src,/const phase=t\*\(42\*x\/size\+7\*y\/size\)/);
 assert.match(src,/tex\.wrapS=tex\.wrapT=THREE\.RepeatWrapping/);
 assert.match(src,/albedo\.colorSpace=THREE\.SRGBColorSpace/);
 assert.match(src,/normal:make\(normal,THREE\.NoColorSpace\)/);
 assert.match(src,/roughness:make\(rough,THREE\.NoColorSpace\)/);
 assert.match(src,/const v=Math\.max\(SANDFORGE_SAND_PBR\.roughnessRange\[0\],/);
 assert.equal(SANDFORGE_SAND_PBR.normalStrength,.83);
 assert.deepEqual(SANDFORGE_SAND_PBR.roughnessRange,[.89,.985]);
 assert.equal(typeof createSandNormalAndRoughness,'function');
 assert.equal(typeof installDesertSandPBR,'function');
});
test('3D desert only: same scene material, normal/surface detail, and unmodified gameplay buildings',()=>{
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 const sim=readFileSync('src/reborn/simulation.ts','utf8');
 assert.match(preview,/if\(biome==='desert'&&terrain\.battlefield\)\{\s*installDesertSandPBR\(material,renderer\)/);
 assert.match(preview,/vertexColor\.lerp\(new THREE\.Color\(desertStyle\.authoredSandVertex\),desertStyle\.authoredSandVertexBlend\)/);
 assert.match(preview,/const mesh=new THREE\.Mesh\(geometry,material\)/);
 assert.match(preview,/mesh\.receiveShadow=true;mesh\.userData\.terrain=true/);
 assert.match(build,/cpSync\('scripts\/webgl-sand-pbr\.js','dist\/webgl-sand-pbr\.js'\)/);
 assert.match(build,/cpSync\('src\/assets', 'dist\/src\/assets', \{recursive:true\}\)/);
 assert.doesNotMatch(sim,/installDesertSandPBR|SANDFORGE_SAND_PBR/);
 assert.equal(DESERT_SCENIC_STYLE.authoredSandVertexBlend,.76);
 const col=new THREE.Color(DESERT_SCENIC_STYLE.authoredSandVertex);
 assert.equal(col.getHexString(),'ffffff','the PBR albedo supplies the real warm sand pigment');
});
