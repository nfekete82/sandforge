import test from 'node:test';
import assert from 'node:assert/strict';
import {ai40ClusterRallyRecovery} from '../dist/src/reborn/ai40-rally-recovery.js';

const pack=[
 {id:2,x:640,y:950,hp:100,kind:'infantry'},
 {id:3,x:710,y:950,hp:100,kind:'heavy'},
 {id:4,x:720,y:995,hp:150,kind:'artillery'},
 {id:5,x:770,y:940,hp:100,kind:'tank'},
 {id:6,x:820,y:970,hp:100,kind:'rocket'},
 {id:7,x:1430,y:1940,hp:100,kind:'infantry'},
 {id:8,x:805,y:985,hp:100,kind:'rocket'},
 {id:9,x:850,y:935,hp:100,kind:'heavy'}
];
const base={units:pack,oldRally:{x:3400,y:4100},
 mission:{x:4400,y:2100},stalledSeconds:105,
 trappedMoveOrders:7,siegeRequired:true,viable:()=>true};

test('after a 105s genuinely blocked gather, relocate to REAL friendly artillery cluster',()=>{
 const p=ai40ClusterRallyRecovery(base);
 assert.ok(p);
 assert.ok(pack.slice(0,5).some(u=>u.x===p.x&&u.y===p.y));
 assert.ok(Math.hypot(p.x-720,p.y-995)<330);
});
test('no premature rally relocation, even with many paid units',()=>{
 assert.equal(ai40ClusterRallyRecovery({...base,stalledSeconds:94}),undefined);
});
test('a fully functioning siege with zero blocked movement orders is never rerouted',()=>{
 assert.equal(ai40ClusterRallyRecovery({...base,trappedMoveOrders:0}),undefined);
 assert.equal(ai40ClusterRallyRecovery({...base,trappedMoveOrders:2}),undefined);
});
test('small formations require normal gathering, not a forced rally change',()=>{
 assert.equal(ai40ClusterRallyRecovery({...base,units:pack.slice(0,6)}),undefined);
});
test('existing correctly assembled wave retains original rally',()=>{
 const p=ai40ClusterRallyRecovery({...base,oldRally:{x:720,y:990}});
 assert.equal(p,undefined);
});
test('no unsafe point selected and no teleport across an impassable hill',()=>{
 assert.equal(ai40ClusterRallyRecovery({...base,viable:()=>false}),undefined);
 const safe=ai40ClusterRallyRecovery({...base,viable:p=>p.x<800});
 assert.ok(safe&&safe.x<800);
});
test('order-invariant and deterministic on same real unit positions',()=>{
 const forward=ai40ClusterRallyRecovery(base);
 const backward=ai40ClusterRallyRecovery({...base,units:pack.slice().reverse()});
 assert.deepEqual(backward,forward);
});
test('few scattered soldiers do not trigger suicidal regroup',()=>{
 assert.equal(ai40ClusterRallyRecovery({...base,units:pack.slice(0,3)}),undefined);
 assert.equal(ai40ClusterRallyRecovery({...base,units:pack.map((u,i)=>({
  ...u,x:600+i*600,y:900+i*450
 }))}),undefined);
});
