import {test,expect} from '@playwright/test';

test('real tank GLB mounts compact flag on rotating turret and real barracks GLB gets solid sides',async({page})=>{
 test.setTimeout(150000);
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?bastions=4&seed=2074&pause=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded,null,{timeout:120000});
 const result=await page.evaluate(async()=>{
  const THREE=await import('three');
  const {attachTeamMarkings,detachTeamMarkings}=await import('/webgl-team-markings.js');
  const {finishBarracksSides,finishBarracksDesertPalette,disposeBarracksSides}=await import('/webgl-barracks-shell.js');
  const {prepareBarracksPortal,disposeBarracksPortal}=await import('/webgl-barracks-portal.js');
  const {buildingIcon}=await import('/webgl-portraits.js');
  const sf=window.__sandforgeWebGL,bf=sf.battlefield;
  const [tankData,barracksData]=await Promise.all([
   bf.getModel(bf.asset('tank',0,'unit')),
   bf.getModel(bf.asset('barracks',0,'building'))
  ]);
  const tank=tankData.scene.clone(true),barracks=barracksData.scene.clone(true);
  const node=new THREE.Group();node.add(tank);
  const entry={node,detail:tank};
  const root=attachTeamMarkings(entry,0,'tank',98,46);
  const turret=tank.getObjectByName('Tank_Turret');
  const flag=root?.getObjectByName('TeamArmourFlag');
  const pole=root?.getObjectByName('TeamFlagpole');
  const before=flag?.getWorldPosition(new THREE.Vector3()).clone();
  if(turret)turret.rotation.y+=.65;
  const after=flag?.getWorldPosition(new THREE.Vector3()).clone();
  const finish=finishBarracksSides(barracks);
  const paletteCount=finishBarracksDesertPalette(barracks);
  const painted=finish.children.filter(m=>m.material?.userData?.sandforgeBarracksPalette);
  const sides=[-1,1].map(side=>finish.getObjectByName('BarracksSolidSideWall_'+side));
  const portalEntry={detail:barracks};
  const portal=prepareBarracksPortal(portalEntry,{localClippingEnabled:false});
  const oldDoor=portal?.doorPanels.some(p=>/BarracksBlastDoor/.test(p.mesh.name));
  const clippedUpgrade=barracks.getObjectByName('AtlasUpgrade_barracks_steel');
  // An actual WebGL draw, not just checking module source text.
  sf.renderer.render(sf.scene,sf.camera);
  const wallIcon=await buildingIcon('wall',sf.renderer);
  const barracksIcon=await buildingIcon('barracks',sf.renderer);
  const out={
   mounted:root?.parent===turret,hasFlag:!!flag&&!!pole,
   flagSize:flag?.scale.x,flagHeight:flag?.scale.y,
   poleHeight:pole?.scale.y,
   followsYaw:!!before&&!!after&&before.distanceTo(after)>.01,
   sides:sides.every(Boolean),panelCount:finish.children.filter(c=>c.name.startsWith('BarracksCamoSidePanel_')).length,
   hasDoor:!!oldDoor,hasPortal:!!portal,hasClippedUpgrade:!!clippedUpgrade?.material?.clippingPlanes,
   wallIconReady:wallIcon.startsWith('data:image/png;base64,'),
   barracksIconReady:barracksIcon.startsWith('data:image/png;base64,'),
   paletteCount,paintedSidePanels:painted.length,
   localPaintShader:painted[0]?.material?.onBeforeCompile?.toString().includes('sfBarracksLocal'),
   shaderPrograms:sf.renderer.info.programs?.length??0
  };
  detachTeamMarkings(entry);disposeBarracksPortal(portalEntry);disposeBarracksSides(barracks);
  return out;
 });
 expect(result.mounted).toBe(true);
 expect(result.hasFlag).toBe(true);
 expect(result.flagSize).toBeGreaterThan(0);
 expect(result.flagSize).toBeLessThan(1);
 expect(result.flagHeight).toBeLessThan(.5);
 expect(result.poleHeight).toBeLessThan(2);
 expect(result.followsYaw).toBe(true);
 expect(result.sides).toBe(true);
 expect(result.panelCount).toBe(6);
 expect(result.hasDoor).toBe(true);
 expect(result.hasPortal).toBe(true);
 expect(result.hasClippedUpgrade).toBe(true);
 expect(result.wallIconReady).toBe(true);
 expect(result.barracksIconReady).toBe(true);
 expect(result.paletteCount).toBeGreaterThan(2);
 expect(result.paintedSidePanels).toBeGreaterThan(2);
 expect(result.localPaintShader).toBe(true);
 expect(result.shaderPrograms).toBeGreaterThan(0);
 expect(errors).toEqual([]);
});
