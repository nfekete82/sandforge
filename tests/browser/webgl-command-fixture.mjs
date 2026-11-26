// Read short-lived feedback during the real pointer event, before another
// browser command or a slow software-rendered frame can advance the timer.
export async function rightClickWithCommandPulse(page,point){
 await page.evaluate(()=>{
  const {battlefield,renderer}=window.__sandforgeWebGL;
  window.__commandPulseOnInput=new Promise(resolve=>{
   renderer.domElement.addEventListener('pointerdown',()=>{
    const pulse=battlefield.commandPulse;
    resolve({visible:pulse.visible,opacity:pulse.material.opacity,transient:pulse.userData.commandPulse});
   },{once:true});
  });
 });
 await page.mouse.click(point.x,point.y,{button:'right'});
 return page.evaluate(()=>window.__commandPulseOnInput);
}
