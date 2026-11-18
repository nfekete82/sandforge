import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const menuSource=readFileSync('scripts/webgl-title-menu.js','utf8');
const sceneSource=readFileSync('scripts/webgl-preview.js','utf8');

function harness(initialRunning=true){
 const documentHandlers=new Map();
 const windowHandlers=new Map();
 const calls=[];
 class Element {
  constructor(id){
   this.id=id;this.open=false;this.hidden=false;this.disabled=false;
   this.checked=true;this.value='';this.textContent='';this.listeners=new Map();
  }
  addEventListener(type,listener){
   if(!this.listeners.has(type))this.listeners.set(type,[]);
   this.listeners.get(type).push(listener);
  }
  matches(){return false;}
  showModal(){this.open=true;}
  close(){
   this.open=false;
   for(const fn of this.listeners.get('close')??[])fn({target:this});
  }
  click(){calls.push(['synthetic-click',this.id]);}
 }
 const elements=new Map();
 const get=id=>{
  if(!elements.has(id))elements.set(id,new Element(id));
  return elements.get(id);
 };
 const document={
  getElementById:get,
  querySelectorAll:()=>[],
  addEventListener:(type,fn)=>{
   if(!documentHandlers.has(type))documentHandlers.set(type,[]);
   documentHandlers.get(type).push(fn);
  }
 };
 const runtime={
  loaded:true,simulationRunning:initialRunning,
  setSimulationRunning(next,source){
   this.simulationRunning=Boolean(next);
   calls.push(['set-running',Boolean(next),source]);
  }
 };
 const window={
  __sandforgeWebGL:runtime,
  addEventListener:(type,fn)=>{
   if(!windowHandlers.has(type))windowHandlers.set(type,[]);
   windowHandlers.get(type).push(fn);
  }
 };
 const location={pathname:'/webgl-preview.html',search:'',assign(){}};
 const localStorage={getItem:()=>null,setItem(){}};
 vm.runInNewContext(menuSource,{window,document,location,localStorage,
  URLSearchParams,Element,console,Uint32Array,Math});
 // Menu initialization starts on the main screen. Simulate entry to the
 // active already-loaded campaign, then exercise the *actual* key listener.
 get('main-dialog').open=false;
 function dispatch(type,code='Space',overrides={}){
  const ev={
   code,key:code==='Space'?' ':code==='Escape'?'Escape':'x',
   repeat:false,ctrlKey:false,metaKey:false,altKey:false,
   target:get('simulation'),defaultPrevented:false,stopped:false,
   preventDefault(){this.defaultPrevented=true;},
   stopImmediatePropagation(){this.stopped=true;},
   ...overrides
  };
  for(const fn of documentHandlers.get(type)??[]){
   fn(ev);
   if(ev.stopped)break;
  }
  return ev;
 }
 return {runtime,calls,get,dispatch,window};
}

test('Space opens the modal and pauses the game through one direct setter',()=>{
 const h=harness(true);
 const ev=h.dispatch('keydown');
 assert.equal(ev.defaultPrevented,true);
 assert.equal(ev.stopped,true);
 assert.equal(h.get('sf3d-pause-dialog').open,true);
 assert.equal(h.runtime.simulationRunning,false);
 assert.deepEqual(h.calls,[['set-running',false,'Taktische Pause']]);
 const release=h.dispatch('keyup');
 assert.equal(release.defaultPrevented,true,'no delayed native button click');
 assert.equal(release.stopped,true);
});

test('Space inside the pause modal resumes the game exactly once',()=>{
 const h=harness(true);
 h.dispatch('keydown');h.dispatch('keyup');
 h.dispatch('keydown');h.dispatch('keyup');
 assert.equal(h.get('sf3d-pause-dialog').open,false);
 assert.equal(h.runtime.simulationRunning,true);
 assert.deepEqual(h.calls.map(x=>x.slice(0,2)),[
  ['set-running',false],['set-running',true]
 ]);
 assert.ok(h.calls.every(x=>x[0]!=='synthetic-click'));
});

test('regression: previously paused simulation MUST resume from menu',()=>{
 const h=harness(false);
 h.dispatch('keydown');h.dispatch('keyup');
 assert.equal(h.get('sf3d-pause-dialog').open,true);
 h.dispatch('keydown');h.dispatch('keyup');
 assert.equal(h.get('sf3d-pause-dialog').open,false);
 assert.equal(h.runtime.simulationRunning,true,
  'old returnToGame=false path used to leave the simulation paused forever');
});

test('Resume button also starts a previously paused simulation',()=>{
 const h=harness(false);
 h.window.Sandforge3DMenu.openPause();
 h.get('sf3d-pause-resume').listeners.get('click')[0]();
 assert.equal(h.get('sf3d-pause-dialog').open,false);
 assert.equal(h.runtime.simulationRunning,true);
});

test('Space repeat, text fields, Ctrl+Space and unrelated menu do not toggle',()=>{
 const h=harness(true);
 const skipped=h.dispatch('keydown','Space',{repeat:true});
 assert.equal(skipped.defaultPrevented,false);
 const form=new (Object.getPrototypeOf(h.get('simulation')).constructor)('input');
 form.matches=s=>s.includes('input');
 h.dispatch('keydown','Space',{target:form});
 h.dispatch('keydown','Space',{ctrlKey:true});
 h.get('sf3d-options-dialog').open=true;
 h.dispatch('keydown','Space');
 assert.equal(h.calls.length,0);
 assert.equal(h.runtime.simulationRunning,true);
});

test('runtime setter is idempotent and always resets frame debt on resume',()=>{
 const start=sceneSource.indexOf('function setSimulationRunning(');
 const end=sceneSource.indexOf("$('simulation').onclick=event=>",start);
 assert.ok(start>0&&end>start,'single runtime pause setter present');
 const button={textContent:'',setAttribute(name,value){this[name]=value;}};
 const state={
  running:false,pauseSource:'Leertaste',accumulator:2.5,
  game:{paused:true},sound:{pause(){}},updates:0,
  // Called as an unbound function inside the VM: capture state, not `this`.
  updateSimulationBanner(){state.updates++;},
  $:()=>button
 };
 // Imported functions are isolated from renderer globals for this test.
 vm.runInNewContext(sceneSource.slice(start,end)+
  '\nthis.setSimulationRunning=setSimulationRunning;',state);
 assert.equal(state.setSimulationRunning(true),true);
 assert.equal(state.running,true);
 assert.equal(state.game.paused,false);
 assert.equal(state.accumulator,0);
 assert.equal(state.pauseSource,'');
 assert.equal(button['aria-pressed'],'true');
 assert.equal(state.setSimulationRunning(true),true);
 assert.equal(state.running,true,'repeated setter call must never toggle again');
 assert.equal(state.updates,2,'setter refreshes banner even if state is unchanged');
 assert.match(sceneSource,/if\(event\.code==='Space'&&!window\.Sandforge3DMenu\)/);
 assert.match(sceneSource,/simulationBanner\.hidden=!reason\|\|document\.getElementById\('sf3d-pause-dialog'\)\?\.open===true/);
});
