import {test,expect} from '@playwright/test';

test('actual Three.js desert A/B lab: GPU scene, real GLBs, mode switch',async({page},info)=>{
 // Software WebGL needs longer for two real GPU screenshots on shared CI runners.
 test.setTimeout(180000);
 await page.setViewportSize({width:960,height:540});
 const exceptions=[];
 page.on('pageerror',error=>exceptions.push(error.message));
 await page.goto('/desert-look-lab.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#scene canvas')).toHaveCount(1);
 await expect(page.locator('#after')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#status')).toContainText('Original-GLB-Objekte geladen',{timeout:40000});
 await expect(page.locator('#status')).toContainText('NEU:',{timeout:40000});
 await page.waitForFunction(()=>{
  const txt=document.getElementById('stats')?.textContent??'';
  const match=txt.match(/Draw Calls:\s*(\d+)/);
  return !!match&&Number(match[1])>1;
 },null,{timeout:20000});
 const enhanced=await page.locator('#scene canvas').screenshot({path:info.outputPath('desert-after.png')});
 await page.locator('#before').click();
 await expect(page.locator('#before')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#status')).toContainText('VORHER:');
 const basic=await page.locator('#scene canvas').screenshot({path:info.outputPath('desert-before.png')});
 expect(basic.equals(enhanced),'rendered before/after frames should differ').toBe(false);
 await page.locator('#after').click();
 await expect(page.locator('#after')).toHaveAttribute('aria-pressed','true');
 expect(exceptions).toEqual([]);
});
