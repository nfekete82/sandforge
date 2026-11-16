import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UPGRADES,UPGRADE_KINDS} from '../dist/src/reborn/strategic-tech.js';
import {UNIT_MISS_CHANCE,unitShotRoll,unitShotMisses,missedGroundPoint}
 from '../dist/src/reborn/unit-accuracy.js';
import {RESEARCH_DECK_GROUPS,researchDeckTechStatus,RESEARCH_DECK_VERSION}
 from '../scripts/webgl-research-deck.js';

const src=path=>readFileSync(path,'utf8');
const research=(completed=[],active=null,remaining=0)=>({completed,active,remaining});
const status=(state,kind,credits=15000,online=true,playing=true)=>
 researchDeckTechStatus(state,kind,UPGRADES,credits,online,playing);

test('new contextual tech tree groups all 9 real upgrades without duplicates',()=>{
 assert.equal(RESEARCH_DECK_VERSION,'research-command-center-v1-20261116');
 assert.equal(RESEARCH_DECK_GROUPS.length,3);
 const kinds=RESEARCH_DECK_GROUPS.flatMap(group=>group.kinds);
 assert.deepEqual(new Set(kinds),new Set(UPGRADE_KINDS));
 assert.equal(kinds.length,UPGRADE_KINDS.length);
 assert.equal(kinds.length,9);
 const menu=src('scripts/webgl-research-deck.js');
 const battlefield=src('scripts/webgl-battlefield.js');
 const build=src('scripts/build.mjs');
 const css=src('src/reborn/webgl-classic-hud.css');
 assert.match(menu,/role="dialog"/);
 assert.match(menu,/data-sf-tech-count/);
 assert.match(menu,/data-sf-tech-start/);
 assert.match(menu,/data-sf-tech-reason/);
 assert.match(menu,/data-sf-tech-active-fill/);
 assert.match(menu,/event\.stopPropagation\(\)/,
  'research menu must never dispatch regular attack/demolition commands');
 assert.match(menu,/overlay\.hidden=id===null\|\|dismissed/);
 assert.match(battlefield,/createSandforgeResearchDeck\(\{/);
 assert.match(battlefield,/this\.researchDeck\?\.update\(\{/);
 assert.match(battlefield,/base,state:techState,credits:g\.credits\[0\],online:researchOnline/);
 assert.match(build,/dist\/webgl-research-deck\.js/);
 assert.match(css,/#sf-classic-root \.sf-research-workspace/);
 assert.match(css,/#sf-classic-root \.sf-research-overlay\[hidden\]/);
});

test('research technology status honors prerequisite, cost, conflict and one active project',()=>{
 const empty=research();
 assert.equal(status(empty,'armor1').key,'ready');
 assert.equal(status(empty,'armor2').key,'prerequisite');
 assert.equal(status(empty,'armor1',0).key,'funds');
 assert.equal(status(empty,'armor1',5000,false).key,'locked');
 assert.equal(status(empty,'armor1',5000,true,false).key,'locked');
 const first=research(['armor1']);
 assert.equal(status(first,'armor1').key,'done');
 assert.equal(status(first,'armor2').key,'ready');
 const active=research(['armor1'],'armor2',22);
 assert.equal(status(active,'armor2').key,'active');
 assert.equal(status(active,'precision').key,'busy');
 const heavyTank=research(['tankArmor']);
 assert.equal(status(heavyTank,'tankArmor').key,'done');
 assert.equal(status(heavyTank,'tankMobility').key,'exclusive');
 const fastTank=research(['tankMobility']);
 assert.equal(status(fastTank,'tankArmor').key,'exclusive');
 assert.equal(status(empty,'missing').key,'invalid');
});

test('ballistics are deterministic for saves, both factions and 25 percent across many shots',()=>{
 assert.equal(UNIT_MISS_CHANCE,.25);
 for(const seed of [1,99,9087]){
  const rolls=Array.from({length:1200},(_,i)=>unitShotRoll(seed,11,19,i*.05,i%3));
  assert.ok(rolls.every(v=>v>=0&&v<1));
  assert.equal(unitShotMisses(seed,11,19,0,1),unitShotMisses(seed,11,19,0,1),
   'same replay state must produce identical hit/miss');
  const rate=rolls.filter(v=>v<UNIT_MISS_CHANCE).length/rolls.length;
  assert.ok(rate>.20&&rate<.30,'sample rate remains near 25%, actual '+rate);
 }
 const from={x:1000,y:1100},target={x:1300,y:1200};
 for(const r of [.01,.25,.52,.93]){
  const p=missedGroundPoint(from,target,22,5000,r);
  assert.ok(Math.hypot(p.x-target.x,p.y-target.y)>30,
   'a missed bullet must land clearly OUTSIDE its intended hitbox');
  assert.ok(p.x>=2&&p.y>=2&&p.x<=4998&&p.y<=4998);
 }
});

test('WebGL rifle misses deal zero damage and produce actual sand miss shots',()=>{
 const game=new Simulation(51892,4);
 game.stageWebGLProduction=true;
 game.status='playing';
 const attacker=game.spawn(0,{x:1100,y:1000},'infantry');
 const target=game.spawn(1,{x:1320,y:1000},'infantry');
 assert.ok(attacker&&target);
 const hp=target.hp;
 let misses=0,hits=0;
 for(let i=0;i<200;i++){
  game.time=i*.05;
  const before=target.hp,shotBefore=game.shots.length;
  game.damage(attacker,target,.04,'rifle',{x:attacker.x,y:attacker.y-18});
  assert.equal(game.shots.length,shotBefore+1);
  const shot=game.shots.at(-1);
  if(shot.miss){
   misses++;
   assert.equal(shot.hit,false);
   assert.equal(target.hp,before,'misses cannot damage, suppress or earn XP');
   assert.equal(shot.impactElevation,0);
   assert.ok(Math.hypot(shot.to.x-target.x,shot.to.y-target.y)>20);
  }else{
   hits++;
   assert.equal(shot.hit,true);
   assert.ok(target.hp<before,'real hits continue to cause damage');
  }
 }
 assert.equal(hits+misses,200);
 assert.ok(misses>30&&misses<70,'25% deterministic misses over 200 rounds');
 assert.ok(target.hp<hp);
 const simSource=src('src/reborn/simulation.ts');
 assert.match(simSource,/if\(this\.stageWebGLProduction&&'orders' in source\)/);
 assert.match(simSource,/for\(const target of missile\.miss\?\[\]:\[/);
 assert.match(simSource,/\(m\.miss!==undefined&&typeof m\.miss!=='boolean'\)/,
  'missed projectiles validate in persisted save files');
});

test('headless simulations retain old accuracy for existing balance tests',()=>{
 const game=new Simulation(1483,4);
 game.stageWebGLProduction=false;
 const attacker=game.spawn(0,{x:1100,y:1000},'infantry');
 const target=game.spawn(1,{x:1310,y:1000},'infantry');
 for(let i=0;i<15;i++){
  game.time=i*.05;
  game.damage(attacker,target,.02,'rifle',{x:attacker.x,y:attacker.y-18});
  assert.equal(game.shots.at(-1)?.hit,true);
 }
});

test('a miss uses pooled sand dust, bounded dent decal, and tracer lands at ground level',()=>{
 const vfx=src('scripts/webgl-combat-vfx.js');
 const battle=src('scripts/webgl-battlefield.js');
 assert.match(vfx,/sandMissAt\(shot\)/);
 assert.match(vfx,/this\.placeScorch\(point\.x,point\.y,7\+this\.rand\(\)\*5\)/);
 assert.match(vfx,/this\.game\.canSee\(0,point\)/);
 assert.match(vfx,/if\(shot\.miss\)\{\s*this\.sandMissAt\(shot\)/);
 assert.match(battle,/this\.heightAt\(shot\.to\.x,shot\.to\.y\)\+\(shot\.miss\?2:27\)/);
 assert.match(vfx,/this\.stats\.misses\+\+/);
});
