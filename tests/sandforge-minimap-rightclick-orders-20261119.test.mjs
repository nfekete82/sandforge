import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {minimapPointerToWorld,worldToMinimap} from '../scripts/webgl-map-edges.js';

const rect={left:125,top:670,width:224,height:224};
const size=3600;

test('minimap uses true rendered CSS bounds, not the bitmap backing size',()=>{
 const p=minimapPointerToWorld(125+224*.75,670+224*.25,rect,size);
 assert.deepEqual(p,{x:size*.75,y:size*.25});
 const stretched={left:15,top:500,width:336,height:168};
 const scaled=minimapPointerToWorld(15+336*.4,500+168*.7,stretched,size);
 assert.ok(Math.abs(scaled.x-size*.4)<1e-8);
 assert.ok(Math.abs(scaled.y-size*.7)<1e-8);
});

test('minimap destination orientation matches existing HUD markers, no swapped or inverted axes',()=>{
 for(const [x,y] of [[size*.2,size*.8],[size*.65,size*.35],[size*.5,size*.5]]){
  const mini=worldToMinimap(x-size/2,y-size/2,size,rect.width,rect.height);
  const actual=minimapPointerToWorld(rect.left+mini.x,rect.top+mini.y,rect,size);
  assert.ok(Math.abs(actual.x-x)<1e-7);
  assert.ok(Math.abs(actual.y-y)<1e-7);
 }
});

test('minimap border clicks are valid inside the same safe playable edge, outside clicks are ignored',()=>{
 assert.deepEqual(minimapPointerToWorld(rect.left,rect.top,rect,size),{x:12,y:12});
 assert.deepEqual(minimapPointerToWorld(rect.left+rect.width,rect.top+rect.height,rect,size),
  {x:size-12,y:size-12});
 for(const p of [
  [rect.left-1,rect.top+20],
  [rect.left+20,rect.top+rect.height+1],
  [Number.NaN,rect.top],
  [rect.left,Infinity]
 ])assert.equal(minimapPointerToWorld(...p,rect,size),null);
 assert.equal(minimapPointerToWorld(rect.left,rect.top,{...rect,width:0},size),null);
});

test('actual Simulation accepts minimap world move and honors Shift append for a selected scout',()=>{
 const g=new Simulation(2074,24);
 const scout=g.spawn(0,{x:g.world.size*.31,y:g.world.size*.38},'scout');
 const r={left:0,top:0,width:224,height:224};
 const a=minimapPointerToWorld(150,60,r,g.world.size);
 const b=minimapPointerToWorld(180,90,r,g.world.size);
 assert.equal(g.command([scout.id],{kind:'move',...a}),1);
 assert.equal(scout.orders[0].kind,'move');
 assert.equal(scout.orders[0].x,a.x);
 assert.equal(scout.orders[0].y,a.y);
 assert.equal(g.command([scout.id],{kind:'move',...b},true),1);
 assert.ok(scout.orders.length>=2,'shift queues a second minimap waypoint');
 assert.equal(scout.orders.at(-1).x,b.x);
 assert.equal(scout.orders.at(-1).y,b.y);
});

test('WebGL minimap right-click is wired to real selected-unit orders, not camera navigation',()=>{
 const s=readFileSync('scripts/webgl-battlefield.js','utf8');
 const hud=readFileSync('scripts/webgl-classic-hud.js','utf8');
 assert.match(s,/this\.mini\.addEventListener\('pointerdown',e=>\{/);
 assert.match(s,/if\(e\.button!==2\)return/);
 assert.match(s,/minimapPointerToWorld\(e\.clientX,e\.clientY/);
 assert.match(s,/this\.game\.command\(ids,\{kind,\.\.\.point\},e\.shiftKey\)/);
 assert.match(s,/this\.mini\.addEventListener\('contextmenu',e=>e\.preventDefault\(\)\)/);
 assert.match(s,/this\.mini\.addEventListener\('click',e=>\{/);
 assert.match(hud,/Rechtsklick bewegt ausgewählte Einheiten/);
});
