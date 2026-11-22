import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {campaignLayout} from '../dist/src/reborn/config.js';
import {bastionUpgradeStatus,BASTION_UI_UPGRADE_COST}
 from '../scripts/webgl-bastion-upgrade-ui.js';

const campaign=()=>Simulation.campaign(9999,24,'oasis',10);
const state=(t,game)=>bastionUpgradeStatus(t,{
 credits:game.credits[0],
 homeIds:campaignLayout(game.world.mapVersion,game.seed).headquarters,
 headquartersTerritories:game.bases.filter(b=>b.kind==='headquarters'&&b.hp>0)
  .map(b=>b.territory),
 playing:game.status==='playing'
});
test('750-credit upgrade exists and doubles a captured forward Bastion only once',()=>{
 const g=campaign(),homes=campaignLayout(g.world.mapVersion,g.seed).headquarters;
 const t=g.territories.find(x=>!homes.includes(x.id)&&
  !g.bases.some(b=>b.kind==='headquarters'&&b.territory===x.id));
 assert.ok(t,'need a forward Bastion');
 g.credits[0]=BASTION_UI_UPGRADE_COST;
 t.owner=0;t.capturing=-1;t.progress=0;t.upgradeLevel=1;
 const before=g.income(0),old=t.income;
 const available=state(t,g);
 assert.equal(available.upgradable,true);
 assert.equal(available.currentIncome,old);
 assert.equal(available.nextIncome,old*2);
 assert.match(available.buttonLabel,/BASTION VERBESSERN/);
 assert.equal(g.upgradeBastion(0,t.id),true);
 assert.equal(g.credits[0],0);
 assert.equal(g.income(0),before+old);
 assert.equal(t.upgradeLevel,2);
 assert.equal(state(t,g).upgradable,false);
 assert.match(state(t,g).reason,/Stufe 2/);
 assert.equal(g.upgradeBastion(0,t.id),false);
 assert.equal(Simulation.load(g.save()).territories.find(x=>x.id===t.id).upgradeLevel,2);
});

test('home Bastion, enemy or neutral ownership, combat and insufficient credits explain locked command',()=>{
 const g=campaign(),homes=campaignLayout(g.world.mapVersion,g.seed).headquarters;
 const home=g.territories.find(t=>homes.includes(t.id)&&t.owner===0);
 assert.ok(home,'own headquarters Bastion missing');
 g.credits[0]=5000;
 assert.equal(state(home,g).upgradable,false);
 assert.match(state(home,g).reason,/Heimatbastion/);
 assert.equal(g.upgradeBastion(0,home.id),false);
 const t=g.territories.find(x=>!homes.includes(x.id));
 assert.ok(t);
 t.owner=1;
 assert.match(state(t,g).reason,/gegnerische/);
 t.owner=-1;
 assert.match(state(t,g).reason,/neutrale/);
 t.owner=0;t.capturing=1;t.progress=2;
 assert.match(state(t,g).reason,/umkämpft/);
 t.capturing=-1;t.progress=0;g.credits[0]=400;
 assert.match(state(t,g).reason,/350 Credits/);
 assert.equal(state(t,g).upgradable,false);
 g.credits[0]=5000;g.status='victory';
 assert.match(state(t,g).reason,/Partie/);
});

test('live 3D Bastion click and sector-list click both select the same contextual HUD',()=>{
 const js=readFileSync('scripts/webgl-battlefield.js','utf8');
 const hud=readFileSync('scripts/webgl-classic-hud.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(js,/this\.selectedBastion=null/);
 assert.match(js,/selectableBastionAtPointer\(event\)/);
 assert.match(js,/const tower=this\.selectableBastionAtPointer\(event\)/);
 assert.match(js,/this\.selectedBastion=tower\.id/);
 assert.match(js,/this\.selectedBastion=t\.id/);
 assert.match(js,/bastionUpgradeStatus\(selectedBastion,/);
 assert.match(js,/const bastionButton=commands\?\.querySelector/);
 assert.match(js,/bastionButton\.dataset\.upgradeBastion=String\(selectedBastion\.id\)/);
 assert.match(js,/this\.game\.upgradeBastion\(0,id\)/);
 assert.match(js,/bastionButton\.disabled=!bastionStatus\.upgradable/);
 assert.match(js,/portrait\.src='\/src\/assets\/reborn\/bastion-grounded-v2\.png'/);
 assert.match(hud,/id="sf-bastion-upgrade"/);
 assert.match(hud,/data-action="bastion-upgrade"/);
 assert.match(build,/webgl-bastion-upgrade-ui\.js/);
});

test('right-click capture and marching remain unmodified by left-click Bastion selection',()=>{
 const js=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(js,/const clickedBastion=event\.button===2&&this\.selected\.size/);
 assert.match(js,/event\.button===0&&!this\.buildKind&&!this\.rallyMode&&!this\.strategicTargetMode/);
 assert.match(js,/if\(hit\)\{/);
 assert.match(js,/const tower=this\.selectableBastionAtPointer\(event\)/);
 assert.ok(js.indexOf('const tower=this.selectableBastionAtPointer(event)')>
  js.indexOf('const hit=this.friendlyAtPointer(event)'),
  'friendly soldiers and owned buildings must retain click priority');
});
