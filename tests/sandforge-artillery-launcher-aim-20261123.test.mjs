import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Exercise the real method directly: the WebGL battlefield cannot be imported
// by Node because its runtime imports are absolute browser module URLs.
// The method deliberately has no DOM, canvas or THREE dependencies.
const source=readFileSync('scripts/webgl-battlefield.js','utf8');
const match=source.match(/^ orientTankRig\(entry,unit\)\{[\s\S]*?^ \}/m);
assert.ok(match,'rocket/tank rig orientation must remain in the live renderer');
const orient=new Function('return ({'+match[0]+'}).orientTankRig;')();

function rig(kind='artillery',nested=false){
 const turret={rotation:{y:1}},gun={rotation:{y:1}};
 return {kind,tankRig:{turret,gun,gunNested:nested,turretRest:.15,gunRest:-.2}};
}
const artillery=(overrides={})=>({
 kind:'artillery',angle:1.35,hullAngle:.4,moving:false,
 orders:[],combatTarget:null,fire:0,...overrides
});
const neutral=entry=>{
 assert.equal(entry.tankRig.turret.rotation.y,.15);
 assert.equal(entry.tankRig.gun.rotation.y,-.2);
};
const aimed=(entry,diff=.4-1.35)=>{
 assert.ok(Math.abs(entry.tankRig.turret.rotation.y-(.15+diff))<1e-12);
 assert.ok(Math.abs(entry.tankRig.gun.rotation.y-(-.2+diff))<1e-12);
};

test('rocket launcher stays aligned with 6x6 during movement even with stale target',()=>{
 const entry=rig();
 orient.call({},entry,artillery({moving:true,orders:[{kind:'attackMove'}],combatTarget:72}));
 neutral(entry);
 orient.call({},entry,artillery({moving:true,orders:[{kind:'move'}]}));
 neutral(entry);
});

test('new route and turn-in-place never traverse launcher at zero physical speed',()=>{
 const entry=rig();
 orient.call({},entry,artillery({moving:false,orders:[{kind:'move',x:150,y:280}]}));
 neutral(entry);
 orient.call({},entry,artillery({moving:false,orders:[],combatTarget:null,fire:0}));
 neutral(entry);
});

test('active stationary target acquisition aims the real launcher without altering simulation',()=>{
 const entry=rig(),u=artillery({orders:[{kind:'attackMove'}],combatTarget:72});
 const original=structuredClone(u);
 orient.call({},entry,u);
 aimed(entry);
 assert.deepEqual(u,original,'weapon yaw must not change authoritative unit or orders');
});

test('actual rocket discharge aligns launcher; ending combat resets authored neutral pose',()=>{
 const entry=rig();
 orient.call({},entry,artillery({fire:.18}));
 aimed(entry);
 orient.call({},entry,artillery({fire:0,combatTarget:null}));
 neutral(entry);
});

test('a new explicit move wins over residual fire pulses and old target locks',()=>{
 const entry=rig();
 orient.call({},entry,artillery({orders:[{kind:'move'}],fire:.1,combatTarget:15}));
 neutral(entry);
});

test('guarded rocket artillery can aim while stationary when a defender appears',()=>{
 const entry=rig();
 orient.call({},entry,artillery({hold:true,guardArea:true,combatTarget:8}));
 aimed(entry);
});

test('tank turret remains free to rotate independently of the hull when driving',()=>{
 const entry=rig('tank');
 orient.call({},entry,{kind:'tank',angle:1.35,hullAngle:.4,moving:true,orders:[{kind:'move'}]});
 aimed(entry);
});

test('nested authored gun is never double-rotated',()=>{
 const entry=rig('artillery',true);
 const gunBefore=entry.tankRig.gun.rotation.y;
 orient.call({},entry,artillery({combatTarget:77}));
 assert.ok(Math.abs(entry.tankRig.turret.rotation.y-(.15+(.4-1.35)))<1e-12);
 assert.equal(entry.tankRig.gun.rotation.y,gunBefore);
 orient.call({},entry,artillery({moving:true}));
 assert.equal(entry.tankRig.turret.rotation.y,.15);
});
