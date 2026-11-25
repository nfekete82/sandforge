import {buildWebGLFacility,completeWebGLFacility} from './production-fixture.mjs';
import {test,expect} from '@playwright/test';

async function load(page){
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:95000});
}

test('full-width HUD unifies radar, catalog, production and commands in one dock',async({page})=>{
 test.setTimeout(115000);
 await load(page);
 const before=await page.evaluate(()=>{
  const rect=id=>{
   const r=document.querySelector(id).getBoundingClientRect();
   return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};
  };
  return {
   viewport:{width:innerWidth,height:innerHeight},
   dock:rect('#sidebar'),
   radar:rect('#sidebar .radar'),
   catalog:rect('#sidebar .catalog'),
   production:rect('#sf-production'),
   commands:rect('#sf-selection-panel'),
   map:rect('#sf-map'),
   zoom:window.__sandforgeWebGL.camera.zoom,
   minZoom:window.__sandforgeWebGL.controls.minZoom,
   worldSize:window.__sandforgeWebGL.game.world.size,
   worldVersion:window.__sandforgeWebGL.game.world.mapVersion,
   rimHidden:window.__sandforgeWebGL.boundaryCliffs.cliffs.every(x=>!x.visible)
  };
 });
 expect(before.dock.top).toBeGreaterThan(590); // unified 270px dock leaves the battle visible
 expect(before.dock.bottom).toBeGreaterThan(875);
 expect(before.dock.left).toBeLessThanOrEqual(12);
 expect(before.dock.right).toBeGreaterThanOrEqual(before.viewport.width-12);
 expect(before.dock.width).toBeGreaterThan(before.viewport.width-24);
 expect(before.radar.left).toBeLessThan(before.catalog.left);
 expect(before.catalog.left).toBeLessThan(before.production.left);
 expect(before.catalog.right).toBeLessThanOrEqual(before.production.left+2);
 expect(before.production.right).toBeLessThanOrEqual(before.commands.left+2);
 expect(before.production.height).toBeCloseTo(before.catalog.height,1);
 expect(before.commands.bottom).toBeGreaterThan(875);
 expect(before.map.width).toBeGreaterThan(100);
 expect(before.zoom).toBeCloseTo(.59,2);
 expect(before.minZoom).toBeLessThan(.5);
 expect(before.worldVersion).toBe(19);
 expect(before.worldSize).toBe(6240);
 expect(before.rimHidden).toBe(true);
 await page.evaluate(()=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  const engineer=game.units.find(u=>u.owner===0&&u.kind==='engineer');
  battlefield.selected=new Set([engineer.id]);battlefield.selectedBase=null; battlefield.drawInterface();
 });
 await page.locator('#sf-tabs button[data-tab="buildings"]').click();
 // Exercise the wider Linux fallback as well as the installed condensed font.
 await page.addStyleTag({content:'#sf-classic-root{--display:Arial, sans-serif}'});
 const after=await page.evaluate(()=>{
  const elements=[...document.querySelectorAll(
   '#sf-actions .sf-group[data-sf-group="buildings"] .catalog-card')];
  const visible=elements.filter(e=>e.getBoundingClientRect().width>0);
  const boxes=visible.slice(0,2).map(e=>e.getBoundingClientRect());
  const first=visible[0],last=visible.at(-1);
  const names=visible.map(card=>card.querySelector('.card-name'));
  const toNum=(e,key)=>Number.parseFloat(getComputedStyle(e)[key])||0;
  const tab=document.querySelector('#sidebar .catalog-tabs button[data-tab="buildings"]');
  return {
   tab:document.querySelector('#sf-classic-root').dataset.tab,
   cards:visible.length,first:boxes[0]?.left??0,second:boxes[1]?.left??0,
   dockHeight:document.querySelector('#sidebar').getBoundingClientRect().height,
   tabHeight:tab.getBoundingClientRect().height,tabFont:toNum(tab,'fontSize'),
   cardHeight:first.getBoundingClientRect().height,
   cardGridHeight:first.parentElement.clientHeight,
   cardBottom:first.getBoundingClientRect().bottom,
   catalogBottom:document.querySelector('#sf-actions').getBoundingClientRect().bottom,
   cardImageHeight:first.querySelector('.sf-card-image').getBoundingClientRect().height,
   cardMetaHeight:first.querySelector('.card-meta').getBoundingClientRect().height,
   longNameLayout:visible.filter(card=>['research','silo'].includes(card.dataset.build))
    .map(card=>{
     const label=card.querySelector('.card-name');
     return {kind:card.dataset.build,whiteSpace:getComputedStyle(label).whiteSpace,
      clipped:label.scrollHeight>label.clientHeight+1,
      lines:Math.round(label.getBoundingClientRect().height/toNum(label,'lineHeight'))};
    }),
   labelMin:Math.min(...names.map(el=>toNum(el,'fontSize'))),
   commandFont:toNum(document.querySelector('#sf-selection-panel .commands button'),'fontSize')
  };
 });
 expect(after.tab).toBe('buildings');
 expect(after.cards).toBeGreaterThan(1);
 expect(after.second).toBeGreaterThan(after.first);
 expect(after.dockHeight).toBe(225);
 expect(after.tabHeight).toBeGreaterThanOrEqual(30);
 expect(after.tabFont).toBeGreaterThanOrEqual(10);
 expect(after.cardHeight).toBeGreaterThanOrEqual(after.cardGridHeight-20);
 expect(after.cardBottom).toBeLessThanOrEqual(after.catalogBottom+2);
 expect(after.cardImageHeight).toBeGreaterThan(after.cardMetaHeight);
 expect(after.cardMetaHeight).toBeGreaterThanOrEqual(56);
 expect(after.longNameLayout).toHaveLength(2);
 expect(after.longNameLayout.every(label=>label.whiteSpace==='normal'&&
  !label.clipped&&label.lines<=2)).toBe(true);
 expect(after.labelMin).toBeGreaterThanOrEqual(12);
 expect(after.commandFont).toBeGreaterThanOrEqual(9);
 // The same four dock sections should remain inside ONE container at 1600px
 // and still be usable at 820px without a detached command window.
 await page.setViewportSize({width:1600,height:900});
 const mac=await page.evaluate(()=>{
  const r=s=>document.querySelector(s).getBoundingClientRect();
  const dock=r('#sidebar'),catalog=r('#sidebar .catalog'),
   production=r('#sf-production'),command=r('#sf-selection-panel');
  return {dockHeight:dock.height,productionHeight:production.height,catalogHeight:catalog.height,
   rightOf:production.left>=catalog.right-2,
   beforeCommands:production.right<=command.left+2};
 });
 expect(mac.dockHeight).toBe(225);
 expect(mac.productionHeight).toBeCloseTo(mac.catalogHeight,1);
 expect(mac.rightOf&&mac.beforeCommands).toBe(true);
 await page.setViewportSize({width:820,height:720});
 const narrow=await page.evaluate(()=>{
  const r=s=>document.querySelector(s).getBoundingClientRect();
  const catalog=r('#sidebar .catalog'),production=r('#sf-production'),
   command=r('#sf-selection-panel'),dock=r('#sidebar');
  return {separate:document.querySelector('#sf-production').parentElement.id==='sidebar',
   aligned:Math.abs(production.top-catalog.top)<10,
   inside:production.bottom<=dock.bottom+1,
   beforeCommands:production.right<=command.left+2,
   slotVisible:production.width>100};
 });
 expect(narrow.separate).toBe(true);
 expect(narrow.aligned&&narrow.inside&&narrow.beforeCommands&&narrow.slotVisible).toBe(true);
});

test('lite infantry visual scale is reduced without changing unit collision radius',async({page})=>{
 test.setTimeout(115000);
 await load(page);
 const result=await page.evaluate(()=>{
  const view=window.__sandforgeWebGL,game=view.game;
  const soldier=game.units.find(u=>u.owner===0&&u.kind==='infantry');
  const entry=view.battlefield.units.get(soldier.id);
  return {scale:entry?.placeholder?.scale.x,kind:soldier.kind,
   radius:game.world.walkable(soldier),sameUnit:entry?.node?.userData?.id===soldier.id};
 });
 expect(result.kind).toBe('infantry');
 // Deliberately downsized infantry in 3D: the engine collision footprint
 // and authoritative movement remain unchanged.
 expect(result.scale).toBeCloseTo(.38,3);
 expect(result.sameUnit).toBe(true);
 expect(result.radius).toBe(true);
});

test('spacious desert details are subtle decals, not oversized scattered blobs',async({page})=>{
 test.setTimeout(120000);
 await load(page);
 const visuals=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL,scene=a.scene;
  const craters=scene.getObjectByName('visual-desert-craters');
  const stones=scene.getObjectByName('visual-desert-debris');
  const geometry=craters?.geometry;
  const {craterCount,segments,groundConforming}=geometry?.userData??{};
  const positions=geometry?.getAttribute('position');
  const sizes=[];
  for(let crater=0;crater<craterCount;crater++){
   const center=crater*(1+6*segments);
   let radius=0;
   for(let vertex=center+1;vertex<center+1+6*segments;vertex++){
    radius=Math.max(radius,Math.hypot(positions.getX(vertex)-positions.getX(center),
     positions.getZ(vertex)-positions.getZ(center)));
   }
   sizes.push(radius*2);
  }
  return {version:a.game.world.mapVersion,craters:craterCount,
   groundConforming,vertices:positions?.count,expectedVertices:craterCount*(1+6*segments),
   opacity:craters?.material?.opacity,debris:stones?.count??0,craterSizes:sizes};
 });
 expect(visuals.version).toBe(19);
 expect(visuals.craters).toBeLessThanOrEqual(30);
 expect(visuals.craters).toBeGreaterThan(0);
 expect(visuals.opacity).toBeCloseTo(.76,2);
 expect(visuals.groundConforming).toBe(true);
 expect(visuals.vertices).toBe(visuals.expectedVertices);
 expect(visuals.debris).toBeLessThanOrEqual(160);
 expect(visuals.craterSizes.every(v=>v>0&&v<150)).toBe(true);
});

test('lite mode still requests original detailed PBR building model, and ruins receive props',async({page})=>{
 test.setTimeout(125000);
 await load(page);
 const state=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL,g=a.game,b=a.battlefield;
  const site=g.headquartersCandidates(0).find(p=>g.buildError(0,'headquarters',p)===null);
  if(!site)throw new Error('No valid HQ fixture placement');
  const building=g.build(0,'headquarters',site);
  if(!building)throw new Error('HQ fixture could not be created');
  b.sync(true);
  const entry=b.bases.get(building.id);
  return {requested:entry?.requested===true,
   filename:b.asset('headquarters',0,'building'),
   sandApron:entry?.node.getObjectByName('sand-apron-headquarters-'+building.id)?.isMesh===true,
   grounding:b.grounding.items.has(building.id),
   lite:b.lite===true};
 });
 expect(state.lite).toBe(true);
 expect(state.requested).toBe(true);
 expect(state.sandApron).toBe(true);
 expect(state.grounding).toBe(true);
 expect(state.filename).toContain('buildings-3d/headquarters-0.glb');
 await page.waitForFunction(()=>{
  const b=window.__sandforgeWebGL?.battlefield;
  return [...(b?.bases.values()??[])].some(e=>e.kind==='headquarters'&&e.detail);
 },null,{timeout:65000});
 const hasPBR=await page.evaluate(()=>{
  const entries=[...window.__sandforgeWebGL.battlefield.bases.values()];
  const model=entries.find(e=>e.kind==='headquarters')?.detail;
  let maps=0;
  model?.traverse(n=>{
   if(!n.isMesh)return;
   const materials=Array.isArray(n.material)?n.material:[n.material];
   maps+=materials.filter(m=>m?.map&&m?.normalMap).length;
  });
  return maps>0;
 });
 expect(hasPBR).toBe(true);
 await page.waitForFunction(()=>window.__sandforgeWebGL.scene.children.some(
  node=>node.userData?.ruinDecor===true),null,{timeout:65000});
 const props=await page.evaluate(()=>window.__sandforgeWebGL.scene.children.filter(
  node=>node.userData?.ruinDecor===true).length);
 expect(props).toBeGreaterThan(0);
});


test('global catalog unlocks the correct production roster independently of selection',async({page})=>{
 // Software Chromium needs extra time to decode all icons and click through every producer tab.
 test.setTimeout(150000);
 await load(page);
 const group=kind=>page.locator('#sf-actions [data-sf-group="'+kind+'"]');
 const tab=kind=>page.locator('#sf-tabs [data-tab="'+kind+'"]');
 const buildings=group('buildings').locator('[data-build]');
 const expectedBuildings=['headquarters','barracks','factory','airfield','generator',
  'wall','wallGate','bunker','turret','research','silo'];
 await expect(group('buildings')).toBeVisible();
 expect(await buildings.evaluateAll(cards=>cards.map(card=>card.dataset.build))).toEqual(expectedBuildings);
 const layout=await buildings.evaluateAll(cards=>{
  const first=cards[0],name=first.querySelector('.card-name'),cost=first.querySelector('.card-cost');
  const boxes=cards.map(el=>el.getBoundingClientRect());
  return {row:boxes.every(box=>box.width>0&&Math.abs(box.y-boxes[0].y)<5),
   name:getComputedStyle(name).whiteSpace,
   priceBelow:cost.getBoundingClientRect().top>=name.getBoundingClientRect().bottom};
 });
 expect(layout).toEqual({row:true,name:'normal',priceBelow:true});
 const icons=group('buildings').locator('img[data-sf-building-icon]');
 await expect(icons).toHaveCount(expectedBuildings.length);
 await expect.poll(()=>icons.evaluateAll(images=>images.map(img=>img.dataset.sfIconStatus)),
  {timeout:45000}).toEqual(expectedBuildings.map(()=>'ready'));
 const sizes=await icons.evaluateAll(async images=>{
  const sizes=[];
  for(const img of images){
   // Trigger lazy loading with the actual horizontally scrollable card strip.
   img.scrollIntoView({behavior:'instant',block:'nearest',inline:'nearest'});
   await img.decode();
   sizes.push([img.naturalWidth,img.naturalHeight]);
  }
  return sizes;
 });
 expect(sizes).toEqual(expectedBuildings.map(()=>[320,220]));

 for(const category of ['infantry','vehicles','aircraft'])await expect(tab(category)).toBeHidden();
 const units=(category,producer)=>group(category).locator('[data-sf-producer="'+producer+'"] [data-unit]');
 const kinds=cards=>cards.evaluateAll(all=>all.map(card=>card.dataset.unit));
 const hq=await buildWebGLFacility(page,'headquarters');
 await expect(tab('infantry')).toBeHidden();
 await completeWebGLFacility(page,hq);
 await tab('infantry').click();
 expect(await kinds(units('infantry','headquarters'))).toEqual(['engineer']);
 await tab('aircraft').click();
 expect(await kinds(units('aircraft','headquarters'))).toEqual(['drone']);
 for(const [facility,category,roster] of [
  ['barracks','infantry',['infantry','medic','heavy','rocket']],
  ['factory','vehicles',['rover','tank','flamer','artillery']],
  ['airfield','aircraft',['scout','bomber']]
 ]){
  const id=await buildWebGLFacility(page,facility);
  await expect(units(category,facility)).toHaveCount(0);
  await completeWebGLFacility(page,id);
  await tab(category).click();
  expect(await kinds(units(category,facility))).toEqual(roster);
 }
 await page.evaluate(()=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  const engineer=game.units.find(u=>u.owner===0&&u.kind==='engineer');
  battlefield.selected.add(engineer.id);
  battlefield.drawInterface();
 });
 await expect(group('aircraft')).toBeVisible();
 for(const category of ['buildings','infantry','vehicles','aircraft'])await expect(tab(category)).toBeVisible();
});

test('selecting a completed HQ trains the pioneer in that exact building queue',async({page})=>{
 test.setTimeout(115000);
 await load(page);
 const buildingId=await page.evaluate(()=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  game.credits[0]=10000;
  const site=game.headquartersCandidates(0).find(p=>game.buildError(0,'headquarters',p)===null);
  if(!site)throw Error('No HQ fixture site');
  const base=game.build(0,'headquarters',site);
  if(!base)throw Error('Could not build HQ fixture');
  base.buildRemaining=0;base.hp=1200;
  game.updateVision();
  battlefield.sync(true,.06,false,1);
  battlefield.selected.clear();battlefield.selectedBase=base.id;
  battlefield.drawInterface();
  return base.id;
 });
 await expect(page.locator('#sf-tabs button[data-tab="buildings"]')).toBeVisible();
 await page.locator('#sf-tabs button[data-tab="infantry"]').click();
 await expect(page.locator('[data-sf-producer="headquarters"] [data-unit="engineer"]')).toBeVisible();
 await expect(page.locator('[data-sf-producer="barracks"]')).toHaveCount(0);
 await page.locator('[data-unit="engineer"]').click();
 const result=await page.evaluate(id=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  const base=game.bases.find(b=>b.id===id);
  return {queue:base.queueTypes.slice(),selectedBase:battlefield.selectedBase,
   notice:battlefield.panel.querySelector('#sf-message').textContent,
   context:battlefield.panel.dataset.tab};
 },buildingId);
 expect(result.queue).toContain('engineer');
 expect(result.selectedBase).toBe(buildingId);
 expect(result.notice).toContain('in Auftrag');
 expect(result.context).toBe('infantry');
});

test('selecting multiple soldiers shows a squad portrait with the correct count',async({page})=>{
 test.setTimeout(115000);
 await load(page);
 const squad=await page.evaluate(()=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  const soldiers=game.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier).slice(0,2);
  if(soldiers.length!==2)throw Error('Starting campaign needs two soldiers');
  battlefield.selected=new Set(soldiers.map(u=>u.id));
  battlefield.selectedBase=null;
  battlefield.drawInterface();
  const selected=document.querySelector('#sf-squad-portrait');
  return {count:battlefield.selected.size,visible:!selected.hidden,
   singleHidden:document.querySelector('#sf-portrait').hidden,
   images:[...selected.querySelectorAll('.sf-squad-member')].length,
   label:selected.getAttribute('aria-label'),
   countLabel:selected.querySelector('.sf-squad-count').textContent};
 });
 expect(squad).toMatchObject({
  count:2,visible:true,singleHidden:true,images:3,
  label:'2 ausgewählte Einheiten',countLabel:'×2'
 });
 await expect.poll(()=>page.locator('#sf-squad-portrait .sf-squad-member').first()
  .evaluate(img=>img.complete&&img.naturalWidth>0),{timeout:20000}).toBe(true);
 const single=await page.evaluate(()=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  const soldier=game.units.find(u=>u.owner===0&&u.hp>0&&!u.carrier);
  battlefield.selected=new Set([soldier.id]);battlefield.drawInterface();
  return {groupHidden:document.querySelector('#sf-squad-portrait').hidden,
   singleVisible:!document.querySelector('#sf-portrait').hidden};
 });
 expect(single).toEqual({groupHidden:true,singleVisible:true});
});

test('paused simulation is visibly labeled and resumes unit logic in 3D showcase',async({page})=>{
 test.setTimeout(120000);
 await load(page); // deliberately starts in ?pause=1
 const banner=page.locator('#sf3d-simulation-state');
 await expect(banner).toBeVisible();
 await expect(banner).toContainText('SIMULATION PAUSIERT');
 const start=await page.evaluate(()=>window.__sandforgeWebGL.game.time);
 await page.evaluate(()=>document.getElementById('simulation').click());
 await expect(banner).toBeHidden();
 await page.waitForFunction(previous=>window.__sandforgeWebGL.game.time>previous+.20,
  start,{timeout:15000});
 await page.evaluate(()=>window.__sandforgeWebGL.setShowcase(true));
 const before=await page.evaluate(()=>window.__sandforgeWebGL.game.time);
 await page.waitForFunction(previous=>window.__sandforgeWebGL.game.time>previous+.20,
  before,{timeout:15000});
 expect(await page.evaluate(()=>window.__sandforgeWebGL.simulationRunning)).toBe(true);
 await page.evaluate(()=>document.getElementById('simulation').click());
 await expect(banner).toContainText('SIMULATION PAUSIERT');
 const stopped=await page.evaluate(()=>window.__sandforgeWebGL.game.time);
 await page.waitForTimeout(180);
 expect(await page.evaluate(()=>window.__sandforgeWebGL.game.time)).toBeCloseTo(stopped,5);
});

test('a medic in lite 3D mode is a detailed soldier instead of a blue capsule',async({page})=>{
 test.setTimeout(125000);
 await load(page);
 const medicId=await page.evaluate(()=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  const engineer=game.units.find(u=>u.owner===0&&u.hp>0&&u.kind==='engineer');
  if(!engineer)throw Error('No engineer to anchor test');
  const medic=game.spawn(0,{x:engineer.x+75,y:engineer.y+15},'medic');
  battlefield.sync(true,.02,false,1);
  const entry=battlefield.units.get(medic.id);
  if(!entry?.requested)throw Error('Lite mode failed to request genuine medic GLB');
  if(entry.placeholder.children.length<10)throw Error('Medic fallback still looks like a capsule');
  return medic.id;
 });
 await page.waitForFunction(id=>Boolean(window.__sandforgeWebGL.battlefield.units.get(id)?.detail),
  medicId,{timeout:70000});
 const state=await page.evaluate(id=>{
  const e=window.__sandforgeWebGL.battlefield.units.get(id);
  return {kind:e.kind,detail:!!e.detail,
   removed:e.placeholder===null,attached:e.detail?.parent===e.node,
   meshes:e.detail?.children.length??0};
 },medicId);
 expect(state.kind).toBe('medic');
 expect(state.detail).toBe(true);
 expect(state.removed).toBe(true);
 expect(state.attached).toBe(true);
 expect(state.meshes).toBeGreaterThan(0);
});

test('unified production panel lists live queue slots and building progress',async({page})=>{
 test.setTimeout(120000);
 await load(page);
 const layout=await page.evaluate(()=>{
  const dock=document.querySelector('#sidebar').getBoundingClientRect();
  const panel=document.querySelector('#sf-production');
  const production=panel.getBoundingClientRect();
  const catalog=document.querySelector('#sf-actions').getBoundingClientRect();
  return {height:production.height,catalogHeight:catalog.height,
   columnHeight:document.querySelector("#sidebar .catalog").getBoundingClientRect().height,
   beside:production.left>=catalog.right-2,inside:production.bottom<=dock.bottom,
   separate:panel.parentElement?.id==='sidebar',
   border:getComputedStyle(panel).borderTopWidth,
   empty:document.querySelector('#sf-queue-slots').textContent};
 });
 expect(layout.height).toBeCloseTo(layout.columnHeight,1);
 expect(layout.catalogHeight).toBeGreaterThan(100);
 expect(layout.beside).toBe(true);
 expect(layout.separate).toBe(true);
 expect(layout.inside).toBe(true);
 expect(layout.border).toBe('0px'); // Production belongs to one continuous dock, not a separate frame.
 expect(layout.empty).toContain('Noch keine Produktion aktiv');

 const queue=await page.evaluate(()=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  game.credits[0]=10000;
  const site=game.headquartersCandidates(0).find(p=>game.buildError(0,'headquarters',p)===null);
  if(!site)throw Error('No HQ location');
  const hq=game.build(0,'headquarters',site);
  if(!hq)throw Error('HQ build failed');
  hq.buildRemaining=0;hq.hp=1200;
  if(!game.recruit(hq.id,'engineer')||!game.recruit(hq.id,'engineer'))
   throw Error('Cannot enqueue 2 pioneers');
  hq.production=hq.queue[0]*.5;
  battlefield.selectedBase=hq.id;battlefield.selected.clear();battlefield.drawInterface();
  const panel=document.querySelector('#sf-production');
  const first=panel.querySelector('[data-queue-index="0"]');
  return {count:panel.querySelectorAll('[data-queue-index]').length,
   name:first.querySelector('strong').textContent,icon:first.querySelector('img').dataset.sfUnitIcon,
   status:first.querySelector('small').textContent,
   progress:panel.querySelector('#sf-progress').style.width,
   tileProgress:first.querySelector('.sf-slot-progress i').style.width,
   aria:panel.querySelector('.production-track').getAttribute('aria-valuenow'),
   time:panel.querySelector('#sf-queue-time').textContent,
   summary:panel.querySelector('#sf-queue-count').textContent};
 });
 expect(queue.count).toBe(2);
 expect(queue.name).toBe('Pionier');
 expect(queue.icon).toBe('engineer');
 expect(queue.status).toContain('50%');
 expect(Number.parseFloat(queue.progress)).toBeCloseTo(50,5);
 expect(Number.parseFloat(queue.tileProgress)).toBeCloseTo(50,5);
 expect(queue.aria).toBe('50');
 expect(queue.time).toMatch(/^\d+ s$/);
 expect(queue.summary).toBe('2 AKTIV');

 const construction=await page.evaluate(()=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  const hq=game.bases.find(b=>b.id===battlefield.selectedBase);
  game.cancel(hq.id);game.cancel(hq.id);
  hq.buildRemaining=10;hq.production=0;
  battlefield.drawInterface();
  const tile=document.querySelector('#sf-queue-slots [data-build-id]');
  return {name:tile?.querySelector('strong').textContent,
   status:tile?.querySelector('small').textContent,
   progress:document.querySelector('#sf-progress').style.width,
   buildHidden:document.querySelector('#sf-building-status').hidden,
   summary:document.querySelector('#sf-queue-count').textContent};
 });
 expect(construction.name).toBe('Kommandozentrale');
 expect(construction.status).toContain('BAU · 50%');
 expect(Number.parseFloat(construction.progress)).toBeCloseTo(50,5);
 expect(construction.buildHidden).toBe(false);
 expect(construction.summary).toBe('1 AKTIV · 1 BAU');
});


test('production strip globally lists every producer and building site without selection',async({page})=>{
 test.setTimeout(120000);
 await load(page);
 const state=await page.evaluate(()=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  game.credits[0]=10000;
  const site=game.headquartersCandidates(0).find(p=>game.buildError(0,'headquarters',p)===null);
  const hq=game.build(0,'headquarters',site);
  if(!hq)throw Error('No headquarters');
  hq.buildRemaining=0;
  hq.queue=[7,7];hq.queueTypes=['engineer','engineer'];hq.production=3.5;
  const barracks={...hq,id:hq.id+1000,kind:'barracks',hp:800,
   x:hq.x+220,queue:[10,8],queueTypes:['infantry','medic'],production:5};
  const factory={...hq,id:hq.id+1001,kind:'factory',hp:1100,
   x:hq.x+390,queue:[18],queueTypes:['tank'],production:9};
  const newSite={...hq,id:hq.id+1002,kind:'turret',hp:650,
   x:hq.x+510,queue:[],queueTypes:[],production:0,buildRemaining:5};
  game.bases.push(barracks,factory,newSite);
  battlefield.selected.clear();battlefield.selectedBase=null; battlefield.drawInterface();
  const panel=document.querySelector('#sf-queue-slots');
  const before=[...panel.querySelectorAll('[data-queue-base]')]
   .map(n=>({base:Number(n.dataset.queueBase),unit:n.querySelector('strong').textContent,
    source:n.querySelector('.sf-production-source')?.textContent,
    pct:n.querySelector('small').textContent}));
  const siteCount=panel.querySelectorAll('[data-build-id]').length;
  const savedNode=panel.querySelector('[data-queue-base]');
  battlefield.selectedBase=factory.id;battlefield.drawInterface();
  const afterFactory=panel.querySelector('[data-queue-base]')===savedNode;
  battlefield.selectedBase=hq.id;battlefield.drawInterface();
  const afterHQ=panel.querySelector('[data-queue-base]')===savedNode;
  battlefield.selectedBase=null;battlefield.drawInterface();
  return {before,siteCount,afterFactory,afterHQ,
   summary:document.querySelector('#sf-queue-count').textContent};
 });
 expect(state.before.map(x=>x.unit)).toEqual([
  'Pionier','Pionier','Infanteriesoldat','Sanitäter','Kampfpanzer'
 ]);
 expect(new Set(state.before.map(x=>x.base)).size).toBe(3);
 expect(state.before.find(x=>x.unit==='Kampfpanzer').source).toBe('Fahrzeugfabrik');
 expect(state.before.find(x=>x.unit==='Kampfpanzer').pct).toContain('50%');
 expect(state.siteCount).toBe(1);
 expect(state.afterFactory).toBe(true);
 expect(state.afterHQ).toBe(true);
 expect(state.summary).toBe('6 AKTIV · 1 BAU'); // Five unit orders plus one build site.
});

test('generator build card becomes grey and disabled after the third energy core',async({page})=>{
 test.setTimeout(115000);
 await load(page);
 const state=await page.evaluate(()=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  game.credits[0]=10000;
  const site=game.headquartersCandidates(0).find(p=>game.buildError(0,'headquarters',p)===null);
  const hq=game.build(0,'headquarters',site);
  if(!hq)throw Error('Could not build HQ');
  hq.buildRemaining=0;
  const engineer=game.units.find(u=>u.owner===0&&u.kind==='engineer');
  battlefield.selected=new Set([engineer.id]);
  battlefield.selectedBase=null;
  const button=()=>document.querySelector('#sf-actions [data-build="generator"]');
  battlefield.drawInterface();
  const initial={disabled:button()?.disabled};
  for(let i=0;i<2;i++){
   game.bases.push({...hq,id:hq.id+2000+i,kind:'generator',hp:500,
    queue:[],queueTypes:[],buildRemaining:9,production:0});
  }
  battlefield.drawInterface();
  const two={disabled:button().disabled};
  game.bases.push({...hq,id:hq.id+2002,kind:'generator',hp:500,
   queue:[],queueTypes:[],buildRemaining:9,production:0});
  battlefield.drawInterface();
  const three={disabled:button().disabled,locked:button().classList.contains('locked'),
   reason:button().getAttribute('aria-description'),tooltip:button().title};
  game.bases.pop();battlefield.drawInterface();
  const afterRemoval={disabled:button().disabled};
  return {initial,two,three,afterRemoval};
 });
 expect(state.initial.disabled).toBe(false);
 expect(state.two.disabled).toBe(false);
 expect(state.three.disabled).toBe(true);
 expect(state.three.locked).toBe(true);
 expect(state.three.reason).toContain('Maximal 3 Energiekerne');
 expect(state.three.tooltip).toContain('Maximal 3 Energiekerne');
 expect(state.afterRemoval.disabled).toBe(false);
});

test('vehicle factory and barracks have recognizable physical equipment beside them',async({page})=>{
 test.setTimeout(120000);
 await load(page);
 const state=await page.evaluate(()=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  game.credits[0]=10000;
  const site=game.headquartersCandidates(0).find(p=>game.buildError(0,'headquarters',p)===null);
  const base=game.build(0,'headquarters',site);
  if(!base)throw Error('HQ fixture missing');
  base.kind='factory';base.hp=1100;base.buildRemaining=0;
  const barracks={...base,id:base.id+3000,kind:'barracks',hp:800,
   x:base.x+250,queue:[],queueTypes:[],production:0};
  game.bases.push(barracks);
  battlefield.sync(true,0,false,1);
  const workshop=battlefield.bases.get(base.id)?.yard;
  const infantry=battlefield.bases.get(barracks.id)?.yard;
  const count=(root,name)=>{
   let n=0;root?.traverse(obj=>{if(obj.name===name)n++;});return n;
  };
  base.facing=2;barracks.facing=3;battlefield.sync(false,0,false,1);
  return {workshop:workshop?.name,infantry:infantry?.name,
   wheels:count(workshop,'SpareTyre'),tracks:count(workshop,'SpareTrackLink'),
   engines:count(workshop,'EngineBlock'),
   helmets:count(infantry,'InfantryHelmet'),
   guns:count(infantry,'InfantryWeaponRackRifle'),
   visuallyOnly:workshop?.userData?.nonPlayable&&infantry?.userData?.nonPlayable,
   factoryTurn:battlefield.bases.get(base.id)?.node.rotation.y,
   barracksTurn:battlefield.bases.get(barracks.id)?.node.rotation.y};
 });
 expect(state.workshop).toBe('sf-yard-factory');
 expect(state.infantry).toBe('sf-yard-barracks');
 expect(state.wheels).toBe(5);
 expect(state.tracks).toBe(8);
 expect(state.engines).toBe(1);
 expect(state.helmets).toBe(3);
 expect(state.guns).toBe(3);
 expect(state.visuallyOnly).toBe(true);
 expect(state.factoryTurn).toBeCloseTo(Math.PI/2,5);
 expect(state.barracksTurn).toBeCloseTo(Math.PI*1.5,5);
});


test('completed field command receives an open-front perimeter, supply cache and lamps only once',async({page})=>{
 test.setTimeout(115000);
 await load(page);
 const result=await page.evaluate(()=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  game.credits[0]=10000;
  const site=game.headquartersCandidates(0).find(p=>game.buildError(0,'headquarters',p)===null);
  if(!site)throw Error('No valid HQ yard location');
  const hq=game.build(0,'headquarters',site);
  if(!hq)throw Error('HQ build rejected');
  hq.buildRemaining=0;hq.hp=1200;
  battlefield.sync(true,0,false,1);
  const entry=battlefield.bases.get(hq.id),yard=entry?.yard;
  const decor=yard?.getObjectByName('BasePerimeter_headquarters');
  const fence=decor?.getObjectByName('BarracksWireFencePosts');
  const width=225,front=width*.28,gateHalf=width*.23;
  const matrix=fence?.matrix.clone();
  let frontClear=true;
  for(let i=0;i<(fence?.count??0);i++){
   fence.getMatrixAt(i,matrix);
   const x=matrix.elements[12],z=matrix.elements[14];
   if(z>front+.001||(z>front-1&&Math.abs(x)<gateHalf-.001))
    frontClear=false;
  }
  const first=yard;
  battlefield.sync(false,0,false,1);
  const second=battlefield.bases.get(hq.id)?.yard;
  const count=name=>{
   let total=0;yard?.traverse(obj=>{if(obj.name===name)total++;});
   return total;
  };
  hq.facing=2;battlefield.sync(false,0,false,1);
  return {
   hqId:hq.id,
   yard:yard?.name,attached:yard?.parent===entry?.node,
   singleton:first===second,
   visualOnly:yard?.userData?.nonPlayable&&decor?.userData?.nonPlayable,
   fenceInstance:fence?.isInstancedMesh,posts:fence?.count,frontClear,
   lamps:count('SecurityLamp'),crates:count('SupplyCrate'),
   lampDiffusers:count('LampDiffuser'),
   rotated:entry?.node.rotation.y,
   gameSaveHasYard:Object.keys(hq).some(key=>/yard|perimeter|fence|lamp|crate/i.test(key))
  };
 });
 expect(result.yard).toBe('sf-yard-headquarters');
 expect(result.attached).toBe(true);
 expect(result.singleton).toBe(true);
 expect(result.visualOnly).toBe(true);
 expect(result.fenceInstance).toBe(true);
 expect(result.posts).toBeGreaterThanOrEqual(12);
 expect(result.frontClear).toBe(true);
 expect(result.lamps).toBeGreaterThanOrEqual(2);
 expect(result.crates).toBeGreaterThanOrEqual(2);
 expect(result.lampDiffusers).toBe(result.lamps);
 expect(result.rotated).toBeCloseTo(Math.PI/2,5);
 expect(result.gameSaveHasYard).toBe(false);
 // Toggle only the new perimeter props live to isolate render cost without
 // reloading or changing simulation time, unit orders or existing equipment.
 const toggle=await page.evaluate(hqId=>{
  const app=window.__sandforgeWebGL;
  const before=app.game.time;
  const countOff=app.setSiteDecorEnabled(false);
  const decor=app.battlefield.bases.get(hqId)?.yard
   ?.getObjectByName('BasePerimeter_headquarters');
  const invisible=decor?.visible===false;
  const countOn=app.setSiteDecorEnabled(true);
  return {countOff,countOn,invisible,visible:decor?.visible===true,
   unchangedClock:app.game.time===before};
 },result.hqId);
 expect(toggle.countOff).toBeGreaterThanOrEqual(1);
 expect(toggle.countOn).toBe(toggle.countOff);
 expect(toggle.invisible&&toggle.visible&&toggle.unchangedClock).toBe(true);
});


test('perf overlay separates bomber sight computation from simulation, VFX and renderer costs',async({page})=>{
 test.setTimeout(115000);
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1&perf=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:95000});
 const diagnostics=await page.evaluate(()=>{
  const app=window.__sandforgeWebGL;
  const game=app.game;
  game.updateVision(); // simulate a real visible-state pass while paused
  const result=app.performance.snapshot();
  return {
   enabled:app.performance.enabled,profileVision:game.profileVision,
   profileSquadWork:game.profileSquadWork,profilePaths:game.world.profilePaths,
   unitWorkP95:result.unitWorkP95,collisionP95:result.collisionP95,
   pathWorkP95:result.pathWorkP95,maxPathCallMs:result.maxPathCallMs,
   pathCalls:result.pathCalls,
   visionCompletedAt:game.visionCompletedAt,visionDurationMs:game.visionDurationMs,
   visionP95:result.visionP95,maxVisionMs:result.maxVisionMs,
   overlay:document.querySelector('#sf-webgl-performance')!==null,
   hasPhases:['simP95','syncP95','effectsP95','renderP95','lastAiPlanMs']
    .every(field=>Number.isFinite(result[field]))
  };
 });
 expect(diagnostics.enabled).toBe(true);
 expect(diagnostics.profileVision).toBe(true);
 expect(diagnostics.profileSquadWork).toBe(true);
 expect(diagnostics.profilePaths).toBe(true);
 expect(diagnostics.unitWorkP95).toBeGreaterThanOrEqual(0);
 expect(diagnostics.collisionP95).toBeGreaterThanOrEqual(0);
 expect(diagnostics.pathWorkP95).toBeGreaterThanOrEqual(0);
 expect(diagnostics.maxPathCallMs).toBeGreaterThanOrEqual(0);
 expect(diagnostics.pathCalls).toBeGreaterThanOrEqual(0);
 expect(diagnostics.visionCompletedAt).toBeGreaterThanOrEqual(0);
 expect(diagnostics.visionDurationMs).toBeGreaterThanOrEqual(0);
 expect(diagnostics.visionP95).toBeGreaterThanOrEqual(0);
 expect(diagnostics.maxVisionMs).toBeGreaterThanOrEqual(diagnostics.visionDurationMs);
 expect(diagnostics.overlay).toBe(true);
 expect(diagnostics.hasPhases).toBe(true);
 // Export without DevTools: keyboard focus stays on the game viewport.
 await page.evaluate(()=>document.activeElement?.blur?.());
 const ready=page.waitForEvent('download');
 await page.keyboard.press('Shift+P');
 const download=await ready;
 expect(download.suggestedFilename()).toMatch(/^sandforge-performance-\d+s\.json$/);
});


test('locked silo stays readable and unselected until affordable',async({page})=>{
 test.setTimeout(115000);
 await load(page);
 const states=await page.evaluate(()=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  const location=game.headquartersCandidates(0).find(p=>game.buildError(0,'headquarters',p)===null);
  const hq=game.build(0,'headquarters',location);
  if(!hq)throw Error('Could not create base prerequisite');
  hq.buildRemaining=0;
  const engineer=game.units.find(u=>u.owner===0&&u.kind==='engineer');
  battlefield.selected=new Set([engineer.id]);
  battlefield.selectedBase=null;
  game.credits[0]=400;
  battlefield.buildKind='silo';
  battlefield.drawInterface();
  const card=()=>document.querySelector('#sf-actions button.catalog-card[data-build="silo"]');
  const state=()=>({
   disabled:card().disabled,
   selected:card().classList.contains('sf-selected-build'),
   locked:card().classList.contains('locked'),
   imageFilter:getComputedStyle(card().querySelector('.sf-card-image img')).filter,
   reason:card().dataset.lockReason
  });
  const locked=state();
  game.credits[0]=9000;battlefield.drawInterface();
  const available=state();
  return {locked,available};
 });
 expect(states.locked.disabled).toBe(true);
 expect(states.locked.selected).toBe(false);
 expect(states.locked.locked).toBe(true);
 expect(states.locked.imageFilter).toBe('grayscale(0.26) brightness(1.08) contrast(1.04)');
 expect(states.locked.reason).toContain('Zu wenig Credits');
 expect(states.available.disabled).toBe(false);
 expect(states.available.selected).toBe(true);
 expect(states.available.locked).toBe(false);
 expect(states.available.imageFilter).toBe('none');
});
