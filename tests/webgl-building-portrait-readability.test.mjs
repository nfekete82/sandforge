import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const portrait=readFileSync('scripts/webgl-portraits.js','utf8');
const css=readFileSync('src/reborn/webgl-classic-hud.css','utf8');

test('every 3D building card, not only HQ, uses the brighter isolated studio',()=>{
 assert.match(portrait,/function renderModelPortrait\(model,renderer,\{[^}]*buildingCard=false/);
 assert.match(portrait,/const studioBuilding=buildingCard\|\|headquartersCard/);
 assert.match(portrait,/studioBuilding\?2\.60/,'non-HQ receives hemisphere fill');
 assert.match(portrait,/studioBuilding\?3\.05/,'non-HQ receives warm daylight');
 assert.match(portrait,/studioBuilding\?1\.45/,'non-HQ receives cooler fill');
 assert.match(portrait,/if\(studioBuilding\)scene\.add\(new THREE\.AmbientLight/);
 assert.match(portrait,/return renderModelPortrait\(model,renderer,\{buildingCard:true,headquartersCard:authoredHQ\}\)/);
 assert.match(portrait,/return renderModelPortrait\(model,renderer,\{buildingCard:true\}\)/,
  'procedural strategic buildings also receive the studio');
 assert.ok(portrait.includes('finishDesertBuildingMaterials(model,kind)'),
  'original building PBR/texture pipeline remains intact');
 assert.ok(portrait.includes('prepareAuthoredHeadquartersPortrait(model)'),
  'authored HQ still keeps its own PBR atlas');
});

test('studio exposure is temporary; real terrain and unit/research portraits are unchanged',()=>{
 const before=portrait.indexOf('const oldExposure=renderer.toneMappingExposure;');
 const draw=portrait.indexOf('renderer.render(scene,camera);',before);
 const restore=portrait.indexOf('renderer.toneMappingExposure=oldExposure;',draw);
 assert.ok(before>0&&draw>before&&restore>draw,
  'isolate exposure and restore after drawing each icon');
 assert.match(portrait,/if\(studioBuilding&&Number\.isFinite\(oldExposure\)\)/);
 assert.match(portrait,/renderer\.toneMappingExposure=Math\.max\(oldExposure,1\.28\)/);
 assert.ok(portrait.slice(draw,restore).includes('}finally{'),
  'the restore belongs to finally, including failed WebGL readback');
 assert.ok(portrait.includes('renderModelPortrait(model,renderer,{width:192,height:132,infantryCard:true})'),
  'infantry/rocket thumbnails keep their established size and lighting');
 assert.ok(portrait.includes('renderModelPortrait(model,renderer,{width:256,height:256,research:true})'),
  'research lighting remains untouched');
});

test('disabled buildings stay recognizable; locked state remains visually marked',()=>{
 const marker='Building portraits must remain legible even while a facility is locked.';
 assert.equal(css.split(marker).length-1,1,'one final locked-building visibility override');
 const fix=css.slice(css.indexOf(marker),css.indexOf('/* Compact desktop tactical dock:',css.indexOf(marker)));
 assert.ok(fix.length>0,'locked card styles must be isolated from unrelated HUD/modal CSS');
 assert.match(fix,/button\.catalog-card\[data-build\]:disabled/);
 assert.match(fix,/button\.catalog-card\[data-build\]\.locked/);
 assert.match(fix,/opacity:1!important/,'no double parent-card dimming');
 assert.match(fix,/opacity:\.96!important/,'locked art must remain visible');
 assert.match(fix,/grayscale\(\.26\) brightness\(1\.08\) contrast\(1\.04\)/,
  'muted but recognizable colors, no blur/blackening');
 assert.doesNotMatch(fix,/blur\(/,'remove locked-building blur');
 assert.match(fix,/cursor:not-allowed|border-color:#686b5e|background:linear-gradient/,
  'blocked card remains distinguished by muted container instead of dark artwork');
 assert.ok(css.indexOf(marker)>css.indexOf('brightness(.70)!important'),
  'new style must override previous darkening rules in cascade order');
 assert.ok(css.includes('button.catalog-card:disabled .card-name'),
  'existing German locked-state labels stay visible');
 const game=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(game,/button\.disabled=blocked/,'building must remain genuinely unbuildable');
 assert.match(game,/button\.classList\.toggle\('locked',blocked\)/);
});
