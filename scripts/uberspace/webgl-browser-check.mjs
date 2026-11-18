/** Real local/staged/live WebGL smoke check with authenticated Chrome.
 * No browser traces, passwords or external credential storage.
 */
import {mkdir} from 'node:fs/promises';
export async function browserCheckWebGL({url,credentials,release,artifacts}){
 const {chromium}=await import('../../tests/browser/node_modules/@playwright/test/index.mjs');
 const browser=await chromium.launch({channel:process.env.ATLAS_BROWSER_CHANNEL??'chrome',headless:true});
 const errors=[],failed=[],external=[];
 let phase='WebGL browser startup';
 try{
  const target=new URL(url),origin=target.origin;
  const context=await browser.newContext({
   httpCredentials:credentials,viewport:{width:1440,height:900}
  }),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{
   if(new URL(r.url()).origin===origin&&r.status()>=400&&r.status()!==401)
    failed.push({status:r.status(),path:new URL(r.url()).pathname});
  });
  page.on('request',r=>{
   if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==origin)
    external.push(new URL(r.url()).origin);
  });
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  phase='WebGL menu and playable campaign';
  await page.locator('#main-dialog').waitFor({state:'visible',timeout:90000});
  await page.locator('#sf3d-new').click();
  await page.locator('#sf3d-new-dialog').waitFor({state:'visible'});
  await page.locator('#sf3d-new-confirm').click();
  phase='Three.js world and AI initialization';
  await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded&&
   !!window.__sandforgeWebGL?.game,null,{timeout:115000});
  const state=await page.evaluate(()=>{
   const game=window.__sandforgeWebGL?.game;
   const canvas=document.querySelector('#stage canvas');
   return {canvas:!!canvas&&canvas.width>300&&canvas.height>200,
    units:game?.units?.length??0,territories:game?.territories?.length??0,
    status:game?.status,drone:window.__sandforgeWebGL?.loaded??false};
  });
  if(!state.canvas||!state.drone||state.territories<4)
   throw Error('3D world not completely initialized: '+JSON.stringify(state));
  // Ensure the exact live WebGL modules (not the old Canvas game) are loaded.
  const source=await page.evaluate(async release=>{
   const path='/releases/'+release+'/src/reborn/catalog.js';
   const {UNITS}=await import(path);
   return {credits:UNITS.drone.cost,flying:UNITS.drone.flying};
  },release);
  if(source.credits!==50||source.flying!==true)
   throw Error('Incorrect production R-01 unit catalog');
  await page.waitForTimeout(550);
  if(errors.length||failed.length||external.length)
   throw Error(JSON.stringify({errors:errors.slice(0,6),failed:failed.slice(0,6),external}));
  if(artifacts){await mkdir(artifacts,{recursive:true});await page.screenshot({path:artifacts+'/webgl-game.png'});}
  return {webgl:true,menu:true,game:true,canvas:true,drone:true,units:state.units,territories:state.territories,consoleErrors:0,failedResources:0};
 }catch(error){throw Error('WebGL browser ('+phase+'): '+error.message,{cause:error});}
 finally{await browser.close();}
}
