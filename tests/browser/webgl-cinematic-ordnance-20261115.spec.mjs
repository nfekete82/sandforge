import {test,expect} from '@playwright/test';

test('real WebGL2: tank rockets, artillery wakes and finned falling bomber ordnance render as capped instanced effects',async({page})=>{
 test.setTimeout(85000);
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/__sf_ordnance_qa__.html',route=>route.fulfill({
  contentType:'text/html',
  body:'<script type="importmap">{"imports":{"three":"/vendor/three/three.module.js","three/addons/":"/vendor/three/addons/"}}</script><body></body>'
 }));
 await page.goto('/__sf_ordnance_qa__.html');
 const state=await page.evaluate(async()=>{
  const THREE=await import('three');
  const {SandforgeCombatEffects}=await import('/webgl-combat-vfx.js');
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(55,1,.1,1500);
  camera.position.set(0,260,350);camera.lookAt(0,50,0);
  scene.add(new THREE.HemisphereLight('#fff7e4','#777366',1.7));
  const directional=new THREE.DirectionalLight('#ffffff',1.6);
  directional.position.set(120,270,90);scene.add(directional);
  const renderer=new THREE.WebGLRenderer({antialias:false});
  renderer.setSize(140,140);
  const size=4000,half=size*.5;
  const pos=(x,z,y=0)=>new THREE.Vector3(x-half,y,z-half);
  const units=[
   {id:11,kind:'tank',hp:100,owner:0,x:1920,y:1900,angle:0},
   {id:12,kind:'artillery',hp:100,owner:0,x:1880,y:1890,angle:0},
   {id:13,kind:'bomber',hp:100,owner:0,x:2000,y:1850,angle:0,flightHeight:1}
  ];
  const missiles=[
   {id:71,source:11,owner:0,from:{x:1920,y:1900},to:{x:2080,y:2010},
    angle:.5,at:.2,impactAt:1.2,type:'antiArmor'},
   {id:72,source:12,owner:0,from:{x:1880,y:1890},to:{x:2010,y:2060},
    angle:1.1,at:.2,impactAt:1.4},
   {id:73,source:13,owner:0,from:{x:2000,y:1850},to:{x:2070,y:2010},
    angle:1,at:.2,impactAt:1.6,type:'bomb'}
  ];
  const game={seed:2074,time:.72,units,unitById:new Map(units.map(u=>[u.id,u])),
   missiles,shots:[],blasts:[],canSee:()=>true};
  const world={size,index:()=>0};
  const fx=new SandforgeCombatEffects({
   scene,camera,game,world,pos,heightAt:()=>0,lowQuality:true
  });
  fx.updateRockets(true);
  fx.updateFallingBombs(true);
  game.time=.87;
  fx.updateRockets(true);
  fx.updateFallingBombs(true);
  const before={
   rocketBodies:fx.rockets.count,rocketTrails:fx.rocketStreaks.count,
   rocketsFired:fx.statsRocket.launched,bombs:fx.bombBodies.count,
   bombNoses:fx.bombNoses.count,bombFinA:fx.bombFinsA.count,
   bombFinB:fx.bombFinsB.count,
   heldOrigins:fx.rocketOrigins.size,
   kinds:[fx.ordnanceKinds.get(71),fx.ordnanceKinds.get(72),fx.ordnanceKinds.get(73)]
  };
  fx.blastAt(2070,2010,true,'bomb');
  renderer.render(scene,camera);
  const glError=renderer.getContext().getError();
  const drawCalls=renderer.info.render.calls;
  game.missiles=[];
  fx.updateRockets(false);
  fx.updateFallingBombs(false);
  const cleared={rockets:fx.rockets.count,trails:fx.rocketStreaks.count,
   bombs:fx.bombBodies.count,origins:fx.rocketOrigins.size};
  renderer.dispose();renderer.domElement.remove();
  return {...before,cleared,glError,drawCalls,
   shockwaves:fx.shocks.length,flash:fx.flash.particles.length};
 });
 expect(state.rocketBodies).toBe(2);
 expect(state.rocketTrails).toBeGreaterThan(0);
 expect(state.rocketTrails).toBeLessThanOrEqual(2*5);
 expect(state.rocketsFired).toBe(2);
 expect(state.bombs).toBe(1);
 expect(state.bombNoses).toBe(1);
 expect(state.bombFinA).toBe(1);
 expect(state.bombFinB).toBe(1);
 expect(state.heldOrigins).toBe(2);
 expect(state.kinds).toEqual(['tank','artillery','bomb']);
 expect(state.flash).toBeGreaterThan(0);
 expect(state.shockwaves).toBeGreaterThan(0);
 expect(state.glError).toBe(0);
 expect(state.drawCalls).toBeGreaterThan(0);
 expect(state.cleared).toEqual({rockets:0,trails:0,bombs:0,origins:0});
 expect(errors).toEqual([]);
});
