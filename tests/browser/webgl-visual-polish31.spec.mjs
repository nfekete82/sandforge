import {test,expect} from '@playwright/test';

test('visual 3.1: slope support, mechanical recoil, pause and bounded particle fade in the real renderer',async({page},testInfo)=>{
 test.setTimeout(150000);const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/WebGL|shader|VALIDATE_STATUS/.test(m.text()))errors.push(m.text());});
 await page.goto('/webgl-preview.html?play=1&map=broken-empire&seed=2026&bastions=12&terrain=rocky&biome=desert&landscape=network&pause=1&adaptive=0');
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded&&window.__sandforgeWebGL?.authenticDesertReady,null,{timeout:120000});
 const id=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL,g=a.game;
  a.renderer.setAnimationLoop(null);
  const home=g.units.find(u=>u.owner===0);
  let slope=null;
  for(let x=Math.max(100,home.x-1000);x<Math.min(g.world.size-100,home.x+1000)&&!slope;x+=50)
   for(let y=Math.max(100,home.y-1000);y<Math.min(g.world.size-100,home.y+1000);y+=50){
    const dx=(a.heightAt(x+24,y)-a.heightAt(x-24,y))/48;
    const dz=(a.heightAt(x,y+24)-a.heightAt(x,y-24))/48;
    if(Math.hypot(dx,dz)>.06&&Math.hypot(dx,dz)<.25&&g.world.walkable({x,y},[],35)){
     slope={x,y};break;
    }
   }
  if(!slope)throw Error('No real moderate drivable slope found');
  const u=g.spawn(0,slope,'tank');u.angle=.4;u.hullAngle=.4;
  g.updateVision();a.battlefield.sync(true,0,false,1);return u.id;
 });
 await page.waitForFunction(id=>!!window.__sandforgeWebGL.battlefield.units.get(id)?.detail,id,{timeout:90000});
 const result=await page.evaluate(id=>{
  const a=window.__sandforgeWebGL,g=a.game,b=a.battlefield,u=g.units.find(u=>u.id===id),e=b.units.get(id);
  const saved=JSON.stringify(g.save());
  for(let i=0;i<30;i++)b.sync(false,1/60,true,1);
  const cachedInput=e.vehiclePoseInput;
  let aimCalls=0;const originalAim=b.orientTankRig;
  b.orientTankRig=function(entry,...args){if(entry===e)aimCalls++;return originalAim.call(this,entry,...args);};
  const onSlope={pitch:e.node.rotation.x,roll:e.node.rotation.z};
  const yaw=e.node.rotation.y,originalHull=u.hullAngle;u.hullAngle=originalHull+.20;
  b.sync(false,1/60,true,1);
  const change=Math.abs(e.node.rotation.y-yaw),aimCallsPerFrame=aimCalls;
  u.hullAngle=originalHull;
  const noSimulationChange=JSON.stringify(g.save())===saved;
  const rest=e.tankRig.gun.position.clone(),bodyZ=e.detail.position.z;
  g.shots.push({source:u.id,weapon:'cannon',owner:0,from:{x:u.x,y:u.y},to:{x:u.x+10,y:u.y},at:g.time,life:.4,hit:true});
  b.sync(false,.025,true,1);
  const kick=e.tankRig.gun.position.distanceTo(rest),body=e.detail.position.z===bodyZ;
  const frozen=e.node.quaternion.clone(),frozenGun=e.tankRig.gun.position.clone();
  b.sync(false,0,false,1);
  const paused=e.node.quaternion.equals(frozen)&&e.tankRig.gun.position.equals(frozenGun);
  for(let i=0;i<20;i++)b.sync(false,.02,true,1);
  const returned=e.tankRig.gun.position.distanceTo(rest);
  const fx=a.effects,pool=fx.smoke;
  g.shots.length=0;fx.emitters.length=0;fx.lastUnitPollTime=g.time;
  pool.particles.length=0;
  fx.particle(pool,u.x,u.y,a.heightAt(u.x,u.y)+20,20,1,0,0,0);
  const opacityRange=pool.opacityRange;
  fx.update(.1,true);const early=pool.opacity.getX(0);
  fx.update(.75,true);const late=pool.opacity.getX(0),count=pool.mesh.count;
  const reusableRange=pool.opacityRange===opacityRange&&pool.opacity.updateRanges[0]===opacityRange;
  a.renderer.info.reset();a.visualPost.render(a.scene,a.camera);
  let glError=a.renderer.getContext().getError();
  fx.update(.2,true);const empty=pool.mesh.count;
  fx.blastAt(u.x,u.y,true);fx.update(.10,true);
  const shockEarly=fx.shockOpacity.getX(0);
  fx.update(.15,true);const shockLate=fx.shockOpacity.getX(0);
  const shockOpacity=fx.shockwave.material.opacity;
  const shift=e.node.position.clone().sub(a.controls.target);
  a.controls.target.add(shift);a.camera.position.add(shift);a.controls.update();
  b.updateFog();a.visualPost.render(a.scene,a.camera);
  glError ||=a.renderer.getContext().getError();
  return {onSlope,change,aimCallsPerFrame,reusableRange,cachedInput:e.vehiclePoseInput===cachedInput,noSimulationChange,kick,body,paused,returned,early,late,count,empty,shockEarly,shockLate,shockOpacity,glError};
 },id);
 console.log('VISUAL_POLISH31 '+JSON.stringify(result));
 expect(Math.abs(result.onSlope.pitch)+Math.abs(result.onSlope.roll)).toBeGreaterThan(.02);
 expect(result.change).toBeGreaterThan(0);expect(result.change).toBeLessThan(.20);
 expect(result.aimCallsPerFrame).toBe(1);expect(result.reusableRange).toBe(true);expect(result.cachedInput).toBe(true);
 expect(result.noSimulationChange).toBe(true);expect(result.kick).toBeGreaterThan(.08);
 expect(result.body).toBe(true);expect(result.paused).toBe(true);expect(result.returned).toBeLessThan(1e-6);
 expect(result.early).toBeGreaterThan(result.late);expect(result.count).toBe(1);expect(result.empty).toBe(0);
 expect(result.shockEarly).toBeGreaterThan(result.shockLate);expect(result.shockOpacity).toBeLessThan(.3);
 expect(result.glError).toBe(0);expect(errors).toEqual([]);
 await page.screenshot({path:testInfo.outputPath('tank-on-slope-rts.png')});
});
