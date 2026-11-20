import test from 'node:test';
import assert from 'node:assert/strict';
import {ai40ClusterRallyRecovery,ai40CountBlockedRallyOrders,ai40ShouldAttemptRecovery} from '../dist/src/reborn/ai40-rally-recovery.js';

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
 assert.ok(pack.filter(u=>u.id!==7).some(u=>u.x===p.x&&u.y===p.y));
 assert.ok(Math.hypot(p.x-720,p.y-995)<330);
});
test('early recovery requires a majority of truly missing unit paths',()=>{
 assert.equal(ai40ClusterRallyRecovery({...base,stalledSeconds:59}),undefined);
 const rescued=ai40ClusterRallyRecovery({...base,stalledSeconds:60});
 assert.ok(rescued);
 assert.equal(ai40ClusterRallyRecovery({...base,stalledSeconds:85,
  trappedMoveOrders:3}),undefined);
 assert.ok(ai40ClusterRallyRecovery({...base,stalledSeconds:95,
  trappedMoveOrders:3}));
});
test('strict blocked threshold and already assembled safety remain active',()=>{
 assert.equal(ai40ClusterRallyRecovery({...base,stalledSeconds:100,
  trappedMoveOrders:2}),undefined);
 assert.equal(ai40ClusterRallyRecovery({...base,stalledSeconds:60,
  oldRally:{x:720,y:950}}),undefined);
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

test('formation slot offset does not hide a truly blocked rally order',()=>{
 const rally={x:1500,y:1500};
 const units=Array.from({length:8},(_,i)=>({
  id:i+1,x:300+i*12,y:320,hp:120,kind:'tank',
  path:[],repath:2,orders:[{kind:'move',x:1500+i*70,y:1900,
   tactical:{mode:'safe',goal:{...rally}}}]
 }));
 assert.equal(ai40CountBlockedRallyOrders(units,rally),8);
 // A move that is genuinely marching toward a distant point stays untouched.
 const moving=units.map(u=>({...u,path:[{x:700,y:700}]}));
 assert.equal(ai40CountBlockedRallyOrders(moving,rally),0);
});
test('stalled rally ignores unrelated orders, short distances and empty readiness',()=>{
 const rally={x:2000,y:2100};
 const list=[
  {x:50,y:50,path:[],repath:2,
   orders:[{kind:'move',x:1900,y:2000}]},
  {x:50,y:50,path:[],repath:2,
   orders:[{kind:'attack',x:2000,y:2100}]},
  {x:50,y:50,path:[],repath:0,
   orders:[{kind:'move',x:2000,y:2100}]},
  {x:1980,y:2100,path:[],repath:2,
   orders:[{kind:'move',x:2000,y:2100}]},
  {x:50,y:50,path:[],repath:2,
   orders:[{kind:'move',x:7000,y:7100}]}
 ];
 assert.equal(ai40CountBlockedRallyOrders(list,rally),1);
});

test('no rally cooldown is armed for ordinary slow or insufficiently blocked marches',()=>{
 const valid={fighters:22,blockedOrders:11,elapsed:92,readyAtRally:2};
 assert.equal(ai40ShouldAttemptRecovery(valid),true);
 assert.equal(ai40ShouldAttemptRecovery({...valid,elapsed:59}),false);
 assert.equal(ai40ShouldAttemptRecovery({...valid,blockedOrders:4}),false);
 assert.equal(ai40ShouldAttemptRecovery({...valid,readyAtRally:4}),false);
 assert.equal(ai40ShouldAttemptRecovery({...valid,fighters:7}),false);
 // The healthy-map victories retain long marches without any real blockage.
 assert.equal(ai40ShouldAttemptRecovery({
  fighters:18,blockedOrders:0,elapsed:210,readyAtRally:0
 }),false);
});
