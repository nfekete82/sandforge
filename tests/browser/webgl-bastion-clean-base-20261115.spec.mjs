import {test,expect} from '@playwright/test';

test('November 11 Bastion keeps the circular dish and ring without the rectangular shield',async({page})=>{
 test.setTimeout(120000);
 const failures=[];
 page.on('pageerror',error=>failures.push(String(error)));
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&play=1&perf=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:95000});
 await page.waitForFunction(()=>{
  const b=window.__sandforgeWebGL?.battlefield;
  return b&&[...b.bastions.values()].some(entry=>entry.detail?.getObjectByName('RadarDish'));
 },null,{timeout:95000});
 const state=await page.evaluate(()=>{
  const {battlefield,renderer,performance:watch}=window.__sandforgeWebGL;
  return [...battlefield.bastions.values()].filter(entry=>entry.detail).map(entry=>{
   const root=entry.detail;
   const steel=root.getObjectByName('AtlasUpgrade_bastion_steel');
   const actual=()=>['AtlasUpgrade_bastion_camo','AtlasUpgrade_bastion_hazard',
    'AtlasUpgrade_bastion_identity_badge'].filter(name=>root.getObjectByName(name));
   const counter={count:0};
   root.traverse(node=>{if(node.isMesh)counter.count++;});
   return {
    owner:entry.owner,
    removedComponents:actual().length,
    base:!!root.getObjectByName('BastionMkII_base_7'),
    radar:!!root.getObjectByName('RadarDish'),
    capture:!!root.getObjectByName('CaptureSweep_Rotator'),
    steelTrimmed:steel?.geometry?.userData?.sandforgeBastionFrontTrimmed===true,
    reports:root.userData.sandforgeFrontShieldRemoved,
    meshes:counter.count,
    radarMotion:Boolean(entry.motion?.mixer),
    drawCalls:renderer.info.render.calls,
    frameP95:watch.snapshot().frameP95
   };
  });
 });
 expect(state.length).toBeGreaterThan(0);
 for(const entry of state){
  expect(entry.removedComponents).toBe(0);
  expect(entry.base).toBeTruthy();
  expect(entry.radar).toBeTruthy();
  expect(entry.capture).toBeTruthy();
  expect(entry.steelTrimmed).toBeTruthy();
  expect(entry.meshes).toBeGreaterThan(30);
  expect(entry.radarMotion).toBeTruthy();
  expect(entry.drawCalls).toBeGreaterThan(0);
 }
 expect(failures).toEqual([]);
});
