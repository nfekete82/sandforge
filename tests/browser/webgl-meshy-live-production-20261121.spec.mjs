import {test,expect} from '@playwright/test';

test('actual Meshy GLB in real Three.js: both factions, all four facings, three paid vehicles per shutter',async({page})=>{
 test.setTimeout(240000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/__sandforge_real_meshy_vehicle_rollout__.html',route=>route.fulfill({
  contentType:'text/html',body:'<script type="importmap">{"imports":{"three":"/vendor/three/three.module.js","three/addons/":"/vendor/three/addons/"}}</script>'
 }));
 await page.goto('/__sandforge_real_meshy_vehicle_rollout__.html');
 const report=await page.evaluate(async()=>{
  const THREE=await import('three');
  const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const {SandforgeProductionGates,GATE_TIMING}=await import('/webgl-production-gates.js');
  const {paintMeshyFactoryTeam}=await import('/webgl-meshy-factory-team.js');
  const {buildingFacingAngle}=await import('/webgl-scale.js');
  const loader=new GLTFLoader(),rows=[];
  for(const owner of [0,1]){
   const glb=(await loader.loadAsync('/src/assets/reborn/buildings-3d/factory-'+owner+'.glb')).scene;
   const baseMaterial=glb.getObjectByName('FactoryRollupDoor')?.material;
   if(!baseMaterial?.normalMap||!baseMaterial.roughnessMap)
    throw Error('Meshy physical shutter lost original PBR');
   paintMeshyFactoryTeam(glb,owner);
   for(const facing of [0,2,1,3]){
    const model=glb.clone(true),root=new THREE.Group();
    root.rotation.y=buildingFacingAngle(facing);
    root.add(model);
    const box=new THREE.Box3().setFromObject(model);
    const dimensions=box.getSize(new THREE.Vector3());
    const scale=200/Math.max(dimensions.x,dimensions.z);
    const center=box.getCenter(new THREE.Vector3());
    model.scale.setScalar(scale);
    model.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);
    root.updateMatrixWorld(true);
    const base={id:1,owner,kind:'factory',x:500,y:500,facing,hp:1100,buildRemaining:0};
    const kinds=['tank','rover','artillery'];
    const units=kinds.map((kind,i)=>({id:i+2,owner,kind,hp:1000,
     x:670+i*6,y:760+i*5,fire:0,angle:0,
     orders:[{kind:'move',x:830,y:860}]}));
    const actors=new Map(units.map(u=>[u.id,{node:new THREE.Group()}]));
    const holds=new Map(),released=[],sounds=[];
    const game={bases:[base],units,time:10,stageWebGLProduction:true,
     productionReleases:[],obstacles:()=>[],
     extendProductionDeparture(id,until){holds.set(id,until)},
     cancelProductionDeparture(id){released.push(id)}};
    const entry={kind:'factory',owner,node:root,detail:model};
    const bf={game,bases:new Map([[1,entry]]),units:actors,
     world:{size:1000,walkable:()=>true},heightAt:()=>0,
     entityPosition:u=>new THREE.Vector3(u.x-500,0,u.y-500),
     sound:{productionGate(kind){sounds.push(kind)}}};
    const production=new SandforgeProductionGates(bf);
    game.productionReleases.push(...units.map(u=>({
     baseId:1,unitId:u.id,kind:u.kind,owner,at:10
    })));
    const step=age=>{
     game.time=10+age;
     for(const u of units){
      const actor=actors.get(u.id);
      actor.node.visible=true;
      actor.node.position.copy(bf.entityPosition(u));
      actor.productionMotion=null;
     }
     production.update(true,1);
    };
    const sequence=[],opened=[];
    let clock=0;
    for(let i=0;i<3;i++){
     step(clock);
     const active=production.active.get(1);
     if(!active)throw Error('Missing scheduled Meshy gate event '+owner+'/'+facing+'/'+i);
     sequence.push(active.event.unitId);
     const gate=entry.gate;
     if(!gate.meshyShutter||gate.openBay)throw Error('Wrong factory presenter');
     step(clock+.75);
     const halfway=gate.door.position.y>gate.doorClosedY&&
      gate.door.scale.y<gate.doorScaleY;
     step(clock+GATE_TIMING.warning+GATE_TIMING.opening);
     const full=gate.door.position.y>gate.doorClosedY+.31;
     opened.push(halfway&&full);
     clock+=GATE_TIMING.warning+GATE_TIMING.opening+
       active.duration+GATE_TIMING.closing+.18;
     step(clock);
     if(production.active.size!==0||Math.abs(gate.door.position.y-gate.doorClosedY)>1e-8)
      throw Error('Factory shutter failed to close and release queue');
     clock+=.06;
    }
    const ok=sequence.join(',')==='2,3,4'&&opened.every(Boolean)&&
     units.every(u=>released.includes(u.id))&&sounds.length===3;
    rows.push({owner,facing,sequence,opened,ok,
     paint:owner===1?model.children.some(x=>x.userData?.sandforgeMeshyFactionOwned):
      true});
    production.dispose();
   }
  }
  return rows;
 });
 console.log('MESHY_GAME_PRODUCTION_8_FACING_CASES '+JSON.stringify(report));
 expect(report).toHaveLength(8);
 expect(report.every(row=>row.ok)).toBe(true);
 expect(errors).toEqual([]);
});
