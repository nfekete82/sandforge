import {test,expect} from '@playwright/test';

test('standard playable 4-bastion game actually runs and labels only deliberate pauses',async({page})=>{
 test.setTimeout(145000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?bastions=4&seed=2988452066&play=1&terrain=random&biome=desert',{
  waitUntil:'domcontentloaded'
 });
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded,null,{timeout:115000});
 const initial=await page.evaluate(()=>({
  running:window.__sandforgeWebGL.simulationRunning,
  paused:window.__sandforgeWebGL.game.paused,
  time:window.__sandforgeWebGL.game.time,
  banner:document.querySelector('#sf3d-simulation-state').hidden
 }));
 expect(initial.running).toBe(true);
 expect(initial.paused).toBe(false);
 expect(initial.banner).toBe(true);
 await page.waitForTimeout(2700);
 const t=await page.evaluate(()=>window.__sandforgeWebGL.game.time);
 expect(t).toBeGreaterThan(initial.time+.1);
 await page.keyboard.press('Space');
 await expect(page.locator('#sf3d-simulation-state')).toContainText('Leertaste');
 const stopped=await page.evaluate(()=>window.__sandforgeWebGL.game.time);
 await page.waitForTimeout(1000);
 const unchanged=await page.evaluate(()=>window.__sandforgeWebGL.game.time);
 expect(unchanged).toBeCloseTo(stopped,1);
 await page.keyboard.press('Space');
 await expect(page.locator('#sf3d-simulation-state')).toBeHidden();
 expect(await page.evaluate(()=>window.__sandforgeWebGL.simulationRunning)).toBe(true);
 expect(errors).toEqual([]);
});
