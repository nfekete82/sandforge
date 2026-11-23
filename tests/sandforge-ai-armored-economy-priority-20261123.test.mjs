import test from 'node:test';
import assert from 'node:assert/strict';
import {urgentlyNeedsInfantryScreen}
 from '../dist/src/reborn/director-production.js';

const input={time:120,fighters:7,infantry:5,factoryReady:true,
 contested:true,underAttack:false,finishing:false};
test('an operational factory no longer loses priority to an existing rifle screen',()=>{
 assert.equal(urgentlyNeedsInfantryScreen(input),false);
 assert.equal(urgentlyNeedsInfantryScreen({...input,fighters:13}),false);
});
test('an understrength infantry front may still be reinforced',()=>{
 assert.equal(urgentlyNeedsInfantryScreen({...input,infantry:2}),true);
 assert.equal(urgentlyNeedsInfantryScreen({...input,factoryReady:false}),true);
});
test('do not spend on nonurgent infantry before opening or after victory',()=>{
 for(const change of [{time:60},{underAttack:true},{finishing:true},{contested:false}])
  assert.equal(urgentlyNeedsInfantryScreen({...input,...change,infantry:1}),false);
});
