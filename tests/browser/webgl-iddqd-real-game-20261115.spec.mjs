import {test,expect} from '@playwright/test';

test('real WebGL game enables infinite resources from tactical pause and reuses the same cheat in gameplay',async({page})=>{
 test.setTimeout(180000);
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?bastions=4&seed=2988452066&play=1&terrain=random&biome=desert',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded,null,{timeout:120000});
 const before=await page.evaluate(()=>({
  testMode:window.__sandforgeWebGL.game.testMode,
  credits:window.__sandforgeWebGL.game.credits[0]
 }));
 expect(before.testMode).toBe(false);
 expect(before.credits).toBeLessThan(1_000_000_000);
 await page.evaluate(()=>window.Sandforge3DMenu.openPause());
 await expect(page.locator('#sf3d-pause-dialog')).toBeVisible();
 await page.keyboard.type('iddqd');
 await expect(page.locator('#sf3d-pause-status')).toContainText('TESTMODUS AKTIV · ∞ Credits');
 await expect(page.locator('#sf-credits')).toHaveText('∞');
 expect(await page.evaluate(()=>window.__sandforgeWebGL.game.testMode)).toBe(true);
 expect(await page.evaluate(()=>window.__sandforgeWebGL.game.credits[0])).toBe(1_000_000_000);
 await page.locator('#sf3d-pause-resume').click();
 await expect(page.locator('#sf3d-pause-dialog')).toBeHidden();
 await page.keyboard.type('iddqd');
 await expect(page.locator('#sf-credits')).toHaveText('∞');
 expect(await page.evaluate(()=>window.__sandforgeWebGL.game.credits[0])).toBe(1_000_000_000);
 expect(errors).toEqual([]);
});
