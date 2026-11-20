import {test,expect} from '@playwright/test';

test('actual OPEN factory GLB serializes tank, Humvee and rocket truck without any door',async({page})=>{
 test.setTimeout(85000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/__sf_factory_rollout_qa__.html',route=>route.fulfill({
  contentType:'text/html',
  body:'<script type="importmap">{"imports":{"three":"/vendor/three/three.module.js","three/addons/":"/vendor/three/addons/"}}</script><body></body>'
 }));
 await page.goto('/__sf_factory_rollout_qa__.html');
 const result=await page.evaluate(async()=>{
  const THREE=await import('three');
  const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const {SandforgeProductionGates,GATE_TIMING}=await import('/webgl-production-gates.js');
  const model=await new GLTFLoader().loadAsync('/src/assets/reborn/buildings-3d/factory-0.glb');
  const root=new THREE.Group(),detail=model.scene;
  root.add(detail);detail.scale.setScalar(57);root.updateMatrixWorld(true);
  const base={id:1,kind:'factory',owner:0,hp:1100,facing:0,x:500,y:500};
  const kinds=['tank','rover','artillery'];
  const units=kinds.map((kind,i)=>({
   id:i+2,kind,owner:0,hp:500,x:610+i*4,y:580+i*3,
   orders:[{kind:'move',x:920,y:900}],angle:Math.PI/4,fire:0
  }));
  const actorMap=new Map(units.map(u=>[u.id,{node:new THREE.Group()}]));
  const game={time:10,bases:[base],units,stageWebGLProduction:true,
   productionReleases:[],extendProductionDeparture:()=>{},
   cancelProductionDeparture:()=>{}};
  const entry={node:root,detail};
  const bf={game,world:{size:1000,walkable:()=>true},
   bases:new Map([[1,entry]]),units:actorMap,
   heightAt:()=>0,entityPosition:u=>new THREE.Vector3(u.x-500,0,u.y-500)};
  const controller=new SandforgeProductionGates(bf);
  for(const u of units)game.productionReleases.push({
   baseId:1,unitId:u.id,at:10,kind:u.kind,owner:0,
   from:{x:500,y:500},to:{x:u.x,y:u.y}
  });
  const step=age=>{
   game.time=10+age;
   for(const u of units){
    const actor=actorMap.get(u.id);
    actor.node.visible=true;actor.node.position.copy(bf.entityPosition(u));
    actor.productionMotion=null;
   }
   controller.update(true,1);
  };
  const sequence=[],holds=[];
  step(0);
  const openBay=entry.gate?.openBay===true;
  if(!openBay)throw Error('Modern factory must have permanently open drive-out');
  for(let turn=0,clock=0;turn<units.length;turn++){
   if(turn)step(clock);
   const active=controller.active.get(base.id);
   sequence.push(active?.event.unitId);
   if(!active)throw Error('Missing active rollout on turn '+turn);
   step(clock+1.45);
   holds.push(actorMap.get(active.event.unitId)?.node.visible===true);
   const finish=clock+active.duration+.23;
   step(finish);
   clock=finish+.06;
  }
  const closed=controller.active.size===0&&entry.gate.openBay&&entry.gate.door===null;
  const sameCount=units.length===3;
  controller.dispose();
  return {sequence,holds,closed,sameCount};
 });
 expect(result.sequence).toEqual([2,3,4]);
 expect(result.holds).toEqual([true,true,true]);
 expect(result.closed).toBe(true);
 expect(result.sameCount).toBe(true);
 expect(errors).toEqual([]);
});
