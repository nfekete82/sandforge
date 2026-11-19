import {test,expect} from '@playwright/test';

test('RMB on actual WebGL minimap sends selected unit there without moving camera',async({page})=>{
 test.setTimeout(120000);
 const errors=[];
 page.on('pageerror',err=>errors.push(err.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,
  {timeout:100000});
 const seed=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL,g=a.game,b=a.battlefield;
  const first=g.units.find(u=>u.owner===0&&u.hp>0);
  if(!first)throw new Error('No starting playable unit');
  // A real aircraft can always traverse the map, so this test verifies
  // the minimap command rather than procedural cliff pathfinding.
  const scout=g.spawn(0,{x:first.x+35,y:first.y+35},'scout');
  b.selected=new Set([scout.id]);b.selectedBase=null;b.attackMode=false;
  b.sync(true);b.drawInterface();
  return {id:scout.id,size:g.world.size,
   cameraX:a.controls.target.x,cameraZ:a.controls.target.z};
 });
 const mini=page.locator('#sf-map');
 await expect(mini).toBeVisible();
 const bounds=await mini.boundingBox();
 if(!bounds)throw new Error('Minimap not laid out');
 const dest1={x:Math.round(bounds.width*.64),y:Math.round(bounds.height*.37)};
 await mini.click({button:'right',position:dest1});
 const first=await page.evaluate(id=>{
  const a=window.__sandforgeWebGL,u=a.game.units.find(v=>v.id===id);
  return {orders:u.orders.map(v=>({kind:v.kind,x:v.x,y:v.y})),
   selected:a.battlefield.selected.has(id),
   cameraX:a.controls.target.x,cameraZ:a.controls.target.z,
   notice:document.querySelector('#sf-message')?.textContent};
 },seed.id);
 expect(first.orders[0]?.kind).toBe('move');
 // The real Simulation deliberately snaps onto a free, accessible site,
 // so a click on a rocky tile will not land on that exact blocked coordinate.
 const requested1={x:dest1.x/bounds.width*seed.size,
  y:dest1.y/bounds.height*seed.size};
 expect(Math.hypot(first.orders[0].x-requested1.x,
  first.orders[0].y-requested1.y)).toBeLessThan(350);
 expect(first.selected).toBe(true);
 expect(first.cameraX).toBeCloseTo(seed.cameraX,4);
 expect(first.cameraZ).toBeCloseTo(seed.cameraZ,4);
 expect(first.notice).toContain('Minikarte');
 const dest2={x:Math.round(bounds.width*.77),y:Math.round(bounds.height*.24)};
 await mini.click({button:'right',modifiers:['Shift'],position:dest2});
 const queue=await page.evaluate(id=>{
  const a=window.__sandforgeWebGL,u=a.game.units.find(v=>v.id===id);
  return {orders:u.orders.map(v=>({kind:v.kind,x:v.x,y:v.y})),
   cameraX:a.controls.target.x,cameraZ:a.controls.target.z};
 },seed.id);
 expect(queue.orders.length).toBeGreaterThanOrEqual(2);
 const requested2={x:dest2.x/bounds.width*seed.size,
  y:dest2.y/bounds.height*seed.size};
 expect(Math.hypot(queue.orders.at(-1).x-requested2.x,
  queue.orders.at(-1).y-requested2.y)).toBeLessThan(350);
 expect(queue.cameraX).toBeCloseTo(seed.cameraX,4);
 await mini.click({button:'left',position:{x:Math.round(bounds.width*.35),y:Math.round(bounds.height*.72)}});
 const after=await page.evaluate(id=>{
  const a=window.__sandforgeWebGL;
  return {cameraX:a.controls.target.x,cameraZ:a.controls.target.z,
   orders:a.game.units.find(u=>u.id===id).orders.length};
 },seed.id);
 expect(Math.abs(after.cameraX-seed.cameraX)+Math.abs(after.cameraZ-seed.cameraZ))
  .toBeGreaterThan(20);
 expect(after.orders).toBe(queue.orders.length);
 expect(errors).toEqual([]);
});
