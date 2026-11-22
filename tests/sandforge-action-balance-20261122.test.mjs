import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {RULES} from '../dist/src/reborn/config.js';
import {ACTION_BALANCE,initialActionCredits,constructionRate,productionRate,groundSpeedRate,actionBastionProbePolicy}
 from '../dist/src/reborn/action-balance.js';

test('new Action matches grant the same paid credit bonus to BOTH sides, only once',()=>{
 const g=new Simulation(2999,3),before=[...g.credits];
 assert.equal(g.balancePreset,'classic');
 assert.equal(g.configureBalancePreset('action'),true);
 assert.deepEqual(g.credits,before.map(initialActionCredits));
 assert.equal(g.configureBalancePreset('action'),false);
 assert.deepEqual(g.credits,before.map(initialActionCredits));
 assert.equal(g.balancePreset,'action');
 assert.equal(RULES.captureTime,8,'Bastion capturing must not be made instant');
});

test('Action modifiers speed up real unit movement but never unbalance aircraft',()=>{
 const classic=new Simulation(2999,3),action=new Simulation(2999,3);
 action.configureBalancePreset('action');
 const player=classic.units.find(u=>u.owner===0&&u.kind==='infantry');
 assert.ok(player);
 assert.equal(action.speed(player)/classic.speed(player),ACTION_BALANCE.groundSpeed);
 assert.equal(action.speed({...player,kind:'tank'})/classic.speed({...player,kind:'tank'}),ACTION_BALANCE.groundSpeed);
 assert.equal(action.speed({...player,kind:'scout'})/classic.speed({...player,kind:'scout'}),1);
 assert.equal(constructionRate('action'),1.25);
 assert.equal(constructionRate('classic'),1);
 assert.equal(productionRate('action','Infanterie'),1.30);
 assert.equal(productionRate('action','Fahrzeuge'),1.20);
 assert.equal(productionRate('action','Luftunterstützung'),1);
 assert.equal(groundSpeedRate('classic',false),1);
});

test('real paid HQ queues train a new engineer faster in Action with canonical queue durations',()=>{
 const classic=new Simulation(2999,3),action=new Simulation(2999,3);
 action.configureBalancePreset('action');
 const train=g=>{
  const hq=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
  assert.ok(hq);
  assert.equal(g.recruit(hq.id,'engineer'),true);
  assert.equal(hq.queue.length,1);
  assert.equal(hq.queue[0],7);
  return hq;
 };
 const ordinary=train(classic),rapid=train(action);
 for(let i=0;i<111;i++){classic.step(.05);action.step(.05);}
 assert.equal(rapid.queue.length,0,'Action engineer should complete around 5.4 seconds');
 assert.equal(ordinary.queue.length,1,'Classic engineer should require 7 seconds');
 assert.equal(classic.stats.factions[0].producedUnits,0);
 assert.equal(action.stats.factions[0].producedUnits,1);
});

test('Action mode survives save/load and classic historical saves remain unchanged',()=>{
 const g=new Simulation(1024,3);
 const old=g.save();
 assert.equal(old.balancePreset,undefined);
 assert.equal(Simulation.load(old).balancePreset,'classic');
 g.configureBalancePreset('action');
 for(let i=0;i<21;i++)g.step(.05);
 const saved=g.save();
 assert.equal(saved.balancePreset,'action');
 const restored=Simulation.load(saved);
 assert.equal(restored.balancePreset,'action');
 assert.deepEqual(restored.credits,g.credits,'save load must not grant the opening credit boost twice');
 assert.ok(restored.speed(restored.units.find(u=>u.owner===0))>0);
 assert.throws(()=>Simulation.load({...saved,balancePreset:'turbo'}),/beschädigt|Version|Ungültig/);
});

test('Action early Bastion probes are paid, time gated and respect observed home attacks',()=>{
 const base={preset:'action',mapVersion:24,time:80,available:4,blue:4,red:1,observedHomeThreat:false};
 assert.deepEqual(actionBastionProbePolicy(base),{slots:2,counter:true});
 assert.equal(actionBastionProbePolicy({...base,preset:'classic'}).slots,0);
 assert.equal(actionBastionProbePolicy({...base,time:5}).slots,0);
 assert.equal(actionBastionProbePolicy({...base,available:1}).slots,0);
 assert.equal(actionBastionProbePolicy({...base,observedHomeThreat:true}).slots,0);
 assert.deepEqual(actionBastionProbePolicy({...base,mapVersion:25,time:90,blue:1,red:1}),
  {slots:2,counter:false},'12-Bastion Action uses public ownership only');
 assert.equal(actionBastionProbePolicy({...base,time:250}).slots,0);
});

test('WebGL new-game menu enables Action without altering Classic deep links or 3D game speed',()=>{
 const menu=readFileSync('scripts/webgl-title-menu.js','utf8');
 const page=readFileSync('webgl-preview.html','utf8');
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 assert.match(page,/id="sf3d-balance-preset"/);
 assert.match(page,/value="action" selected/);
 assert.match(page,/value="classic"/);
 assert.match(menu,/params\.set\('balance','action'\)/);
 assert.match(menu,/balancePreset:data\.balancePreset==='action'/);
 assert.match(preview,/!session&&query\.get\('balance'\)==='action'/);
 assert.doesNotMatch(preview,/simulationSpeed\s*=\s*1\.20/);
});

test('Action hit feedback reuses bounded instancing and respects audio mixing',()=>{
 const vfx=readFileSync('scripts/webgl-combat-vfx.js','utf8');
 const audio=readFileSync('src/reborn/audio.ts','utf8');
 assert.match(vfx,/this\.game\.balancePreset==='action'/);
 assert.match(vfx,/Math\.min\(16,Math\.ceil\(response\.sparkCount\*1\.2\)\)/);
 assert.match(vfx,/Math\.min\(24,Math\.ceil\(n\*1\.17\)\)/);
 assert.match(vfx,/pool\.particles\.length>=pool\.max/,'Action VFX must retain instance caps');
 assert.match(audio,/g\.balancePreset==='action'/);
 assert.match(audio,/this\.lastExplosionAt/,'audio must retain spatial voice gate');
 assert.match(audio,/this\.effectsVolume/,'user volume controls still apply');
});

test('paid 9s Action recon scan reveals a chosen area but never a free persistent enemy map',()=>{
 const g=new Simulation(2999,3);
 const enemy=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 assert.ok(enemy);
 assert.equal(g.canSee(0,enemy),false);
 assert.equal(g.useActionReconScan(enemy),false,'Classic cannot use Action scan');
 g.configureBalancePreset('action');
 const before=g.credits[0];
 assert.equal(g.useActionReconScan(enemy),true,'Action with active HQ may pay for map scan');
 assert.equal(g.credits[0],before-ACTION_BALANCE.reconScanCredits);
 assert.equal(g.canSee(0,enemy),true,'visibility via same authoritative FOW, not cosmetic icon');
 assert.equal(g.useActionReconScan(enemy),false,'cooldown cannot be bypassed');
 assert.ok(g.actionScanReadyAt>=90);
 const saved=g.save();
 assert.equal(saved.balancePreset,'action');
 assert.ok(saved.actionScan&&saved.actionScan.until>saved.time);
 const load=Simulation.load(saved);
 assert.equal(load.balancePreset,'action');
 assert.equal(load.actionScanReadyAt,g.actionScanReadyAt);
 assert.equal(load.canSee(0,enemy),true);
 assert.equal(load.useActionReconScan(enemy),false,'save/reload must not reset cooldown');
 for(let i=0;i<190;i++)load.step(.05);
 assert.equal(load.actionScan?.until<=load.time,true);
 assert.equal(load.canSee(0,enemy),false,
  'after scan expires the target must be hidden again without real unit vision');
 assert.throws(()=>Simulation.load({...saved,actionScanReadyAt:9999}),
  /beschädigt|Version|Ungültig/,'tampered cooldown must not load');
});

test('scan target is the camera focus and action-only cooldown is visible on HUD',()=>{
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 const page=readFileSync('webgl-preview.html','utf8');
 assert.match(page,/id="action-scan"/);
 assert.match(preview,/game\.useActionReconScan\(focus\)/);
 assert.match(preview,/controls\.target\.x\+half/);
 assert.match(preview,/actionScanButton\.hidden=game\.balancePreset!=='action'/);
 assert.match(preview,/actionScanButton\.disabled=!ready/);
});
