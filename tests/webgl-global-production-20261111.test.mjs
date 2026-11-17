import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS,BUILDINGS} from '../dist/src/reborn/catalog.js';
import {UPGRADES,UPGRADE_KINDS} from '../dist/src/reborn/strategic-tech.js';
import {globalCatalogAvailability,GLOBAL_PRODUCTION_TABS} from '../scripts/webgl-global-catalog.js';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const battlefield=source('scripts/webgl-battlefield.js');
const hud=source('scripts/webgl-classic-hud.js');
const css=source('src/reborn/webgl-classic-hud.css');

test('the global dock has exactly four production tabs; research is building-only',()=>{
 for(const [tab,name] of [
  ['buildings','GEBÄUDE'],['infantry','INFANTERIE'],
  ['vehicles','FAHRZEUGE'],['aircraft','FLUGZEUGE']]){
  assert.match(hud,new RegExp('data-tab="'+tab+'"[^>]*>'+name+'</button>'));
  assert.ok(battlefield.includes('data-sf-group="'+tab+'"'));
  assert.ok(css.includes('[data-tab="'+tab+'"]'),
   'missing CSS for category '+tab);
 }
 assert.equal((hud.match(/<button data-tab=/g)||[]).length,4);
 assert.deepEqual(GLOBAL_PRODUCTION_TABS,['buildings','infantry','vehicles','aircraft']);
 assert.doesNotMatch(hud,/data-tab="research"/,'no global research button');
 assert.doesNotMatch(battlefield,/data-sf-group="research"/,'no duplicate research catalogue');
 assert.match(battlefield,/createSandforgeResearchDeck\(\{/);
 assert.match(hud,/data-tab="aircraft"[^>]*hidden>FLUGZEUGE<\/button>/);
 assert.ok(hud.includes("panel.dataset.tab='buildings'"));
 assert.ok(hud.includes('data-action="sectors"'));
 assert.match(battlefield,/const available=globalCatalogAvailability\(g\)/);
 assert.match(battlefield,/const aircraftRoster=roster\(\[\['airfield','FLUGFELD'\]\],'Luftunterstützung'\)/);
 assert.match(battlefield,/const vehicleRoster=roster\(\[\['factory','FAHRZEUGFABRIK'\]\],'Fahrzeuge'\)/);
 assert.ok(battlefield.includes('if(!ready)return'));
 assert.ok(css.includes('button[hidden]'));
});

const setup=()=>{
 const g=new Simulation(20261111,19);
 g.credits[0]=100000;
 let id=500000;
 const add=kind=>{
  const b={id:id++,kind,owner:0,x:2000,y:2000,hp:BUILDINGS[kind].hp,
   buildRemaining:0,radius:BUILDINGS[kind].radius,territory:0,
   queue:[],queueTypes:[],production:0,cooldown:0,rally:null};
  g.bases.push(b);return b;
 };
 return {g,add};
};

test('real simulation automatically chooses barracks/factory/airfield despite no selection',()=>{
 const {g,add}=setup();
 assert.equal(g.producer(0,'infantry'),undefined);
 const barracks=add('barracks'),factory=add('factory'),airfield=add('airfield');
 const cases=[
  ['engineer','headquarters'],['infantry','barracks'],['medic','barracks'],
  ['heavy','barracks'],['rocket','barracks'],
  ['rover','factory'],['tank','factory'],['artillery','factory'],
  ['scout','airfield'],['bomber','airfield']
 ];
 for(const [kind,sourceKind] of cases){
  const producer=g.producer(0,kind);
  assert.ok(producer,'global producer missing for '+kind);
  assert.equal(producer.kind,sourceKind);
  assert.equal(g.recruit(producer.id,kind),true,
   'global card must enqueue '+kind+' in real game');
  assert.ok(producer.queueTypes.includes(kind));
 }
 assert.equal(barracks.queueTypes.length,4);
 assert.equal(factory.queueTypes.length,3);
 assert.equal(airfield.queueTypes.length,2);
 assert.equal(g.count(0)+g.queued(0)<=48,true);
});

test('actual HUD click queues from auto-detected producer even if nothing is selected',()=>{
 const {g,add}=setup();
 add('barracks');add('factory');add('airfield');add('research');
 const listeners=new Map();
 const actions={scrollTop:50};
 const detail={textContent:''};
 const panel={dataset:{tab:'vehicles'},
  addEventListener:(name,cb)=>listeners.set(name,cb),
  querySelector(selector){
   if(selector==='#sf-map')return {addEventListener(){}};
   if(selector==='#sf-actions')return actions;
   if(selector==='#sf-catalog-detail')return detail;
   throw Error('Unexpected selector '+selector);
  }};
 const constructor=new Function('installClassicHud','BUILDINGS','UNITS','UPGRADES',
  'UPGRADE_KINDS','researchIconMarkup','createSandforgeResearchDeck',
  'createSandforgeConfirmDialog','INTERCEPTOR_ENABLED','globalCatalogAvailability',
  'return class TestUI {'+
  battlefield.slice(battlefield.indexOf(' buildInterface(){'),
   battlefield.indexOf('\n saveGame(){',battlefield.indexOf(' buildInterface(){')))+
  '}');
 const UI=constructor(()=>panel,BUILDINGS,UNITS,UPGRADES,UPGRADE_KINDS,
  ()=>'<svg></svg>',()=>({reopen(){},update(){}}),
  ()=>({ask:()=>Promise.resolve(false)}),true,globalCatalogAvailability);
 const ui=new UI();
 ui.game=g;ui.selected=new Set();ui.selectedBase=null;
 ui.sound={enabled:false};
 const messages=[];
 ui.message=s=>messages.push(s);
 ui.drawInterface=()=>{};
 ui.catalogContext=()=>({producer:null,engineer:false,canBuild:true});
 ui.buildInterface();
 const click=(dataset)=>listeners.get('click')({
  target:{closest:()=>({dataset})}
 });
 click({unit:'infantry'});
 click({unit:'tank'});
 click({unit:'bomber'});
 assert.equal(ui.selectedBase,null,'never auto-select a facility to train units');
 const queued=g.bases.flatMap(b=>b.queueTypes);
 assert.ok(queued.includes('infantry'));
 assert.ok(queued.includes('tank'));
 assert.ok(queued.includes('bomber'));
 assert.ok(messages.every(m=>!m.includes('auswählen')),
  'global training must never request clicking a production building');
 const freeTech=UPGRADE_KINDS.find(kind=>!UPGRADES[kind].requires);
 assert.ok(freeTech);
 ui.selectedBase=null;
 click({upgrade:freeTech});
 assert.equal(g.research[0].active,null,
  'global HUD must NOT start research; select the lab to open its separate modal');
 assert.equal(ui.selectedBase,null);
 for(const tab of ['buildings','infantry','vehicles','aircraft']){
  listeners.get('sandforge-tabchange')({detail:{tab}});
  assert.equal(panel.dataset.tab,'vehicles',
   'tab events must only change the clicked view, not force an unrelated selection');
 }
});

test('new production sources become available on completion, not while under construction',()=>{
 const {g,add}=setup();
 const barracks=add('barracks'),factory=add('factory'),airfield=add('airfield');
 for(const b of [barracks,factory,airfield])b.buildRemaining=12;
 assert.equal(g.producer(0,'infantry'),undefined);
 assert.equal(g.producer(0,'tank'),undefined);
 assert.equal(g.producer(0,'bomber'),undefined);
 factory.buildRemaining=0;
 assert.equal(g.producer(0,'tank')?.id,factory.id);
 assert.equal(g.producer(0,'bomber'),undefined);
 const lab=add('research');
 lab.buildRemaining=5;
 const tech=UPGRADE_KINDS.find(k=>!UPGRADES[k].requires);
 assert.equal(g.startResearch(0,tech),false,'incomplete lab cannot start tech');
 lab.buildRemaining=0;
 assert.equal(g.startResearch(0,tech),true);
});

test('more than one producer sends work to the shortest available queue',()=>{
 const {g,add}=setup();
 const first=add('factory'),second=add('factory');
 first.queueTypes=['rover','tank','rover'];
 first.queue=[11,18,11];first.production=2;
 assert.equal(g.producer(0,'tank')?.id,second.id);
 assert.ok(g.recruit(second.id,'tank'));
 assert.equal(second.queueTypes[0],'tank');
});

test('only finished player-owned source buildings unlock their relevant production menus',()=>{
 const {g,add}=setup();
 const available=()=>globalCatalogAvailability(g);
 assert.deepEqual(available(),{
  buildings:true,infantry:true,vehicles:false,aircraft:false,
  territories:true
 },'starting HQ unlocks pioneer production only');
 const barracks=add('barracks');
 barracks.buildRemaining=4;
 assert.equal(available().infantry,true);
 const factory=add('factory');
 factory.buildRemaining=3;
 assert.equal(available().vehicles,false,'construction in progress is NOT unlocked');
 factory.buildRemaining=0;
 assert.equal(available().vehicles,true);
 assert.equal(available().aircraft,false);
 const airfield=add('airfield');
 airfield.buildRemaining=1;
 assert.equal(available().aircraft,false);
 airfield.buildRemaining=0;
 assert.equal(available().aircraft,true,'airfield unlocks ONLY aircraft tab');
 const lab=add('research');
 lab.buildRemaining=0;
 assert.equal('research' in available(),false,'research is not a global production tab');
 lab.hp=0;
 assert.equal('research' in available(),false,'destroying lab cannot show an obsolete tab');
 airfield.owner=1;
 assert.equal(available().aircraft,false,'enemy-owned airfield does not unlock air tab');
 // Current tab disappears gracefully when the last factory is destroyed.
 factory.hp=0;
 assert.equal(available().vehicles,false);
 assert.equal(available().buildings,true);
});

test('unit types are split into independent factory and aircraft menus',()=>{
 const units=Object.keys(UNITS);
 const ground=units.filter(u=>UNITS[u].producers.includes('factory'));
 const airborne=units.filter(u=>UNITS[u].producers.includes('airfield'));
 assert.deepEqual(ground,['rover','tank','artillery']);
 assert.deepEqual(airborne,['scout','bomber']);
 for(const u of airborne)assert.ok(!ground.includes(u));
 const {g,add}=setup();add('factory');add('airfield');
 assert.equal(g.producer(0,'rover')?.kind,'factory');
 assert.equal(g.producer(0,'scout')?.kind,'airfield');
});
