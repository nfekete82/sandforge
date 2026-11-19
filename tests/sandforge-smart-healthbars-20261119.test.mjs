import test from 'node:test';
import assert from 'node:assert/strict';
import {showHealthBar,healthColor,healthFraction} from '../scripts/webgl-health.js';
import {readFileSync} from 'node:fs';

test('smart UI hides healthy idle unselected actors by default',()=>{
 assert.equal(showHealthBar({mode:'smart',visible:true,fraction:1}),false);
 assert.equal(showHealthBar({mode:'smart',visible:true,selected:true,fraction:1}),true);
 assert.equal(showHealthBar({mode:'smart',visible:true,fraction:.86}),true);
 assert.equal(showHealthBar({mode:'smart',visible:true,fraction:1,combatActive:true}),true);
 assert.equal(showHealthBar({mode:'smart',visible:true,fraction:1,combatActive:false}),false);
});
test('fog never leaks health information, even for selected or damaged enemies',()=>{
 for(const mode of ['smart','all','selected','damaged','off'])
  assert.equal(showHealthBar({mode,visible:false,selected:true,fraction:.1,combatActive:true}),false);
});
test('manual health HUD override modes work exactly as before',()=>{
 assert.equal(showHealthBar({mode:'all',visible:true,fraction:1}),true);
 assert.equal(showHealthBar({mode:'selected',visible:true,fraction:.2}),false);
 assert.equal(showHealthBar({mode:'selected',visible:true,fraction:1,selected:true}),true);
 assert.equal(showHealthBar({mode:'damaged',visible:true,fraction:.5}),true);
 assert.equal(showHealthBar({mode:'damaged',visible:true,fraction:1}),false);
 assert.equal(showHealthBar({mode:'off',visible:true,selected:true,fraction:.3}),false);
});
test('the existing green/yellow/red HP scale remains driven by REAL HP',()=>{
 assert.equal(healthFraction(25,100),.25);
 assert.equal(healthColor(1),'#24e568');
 assert.equal(healthColor(.65),'#f6d44b');
 assert.equal(healthColor(.15),'#ed5146');
});
test('browser presentation owns visibility, not simulation data',()=>{
 const source=readFileSync('scripts/webgl-actor-presentation.js','utf8');
 assert.match(source,/this\.showHealth='smart'/);
 assert.match(source,/showHealthBar\(\{mode:this\.showHealth,visible,selected,/);
 assert.match(source,/state\.healthCombatUntil/);
 const hud=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(hud,/const modes=\['smart','all','selected','off','damaged'\]/);
});
