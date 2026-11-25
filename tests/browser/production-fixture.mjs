// Infrastructure for presentation tests; worker-driven construction is exercised
// end-to-end in reborn-production.spec.mjs.
export async function provideFacilities(page,kinds){
 return page.evaluate(async kinds=>{
  const a=window.__reborn,g=a.game,{BUILDINGS}=await import('/src/reborn/catalog.js'),home=g.bases.find(b=>b.owner===0&&b.kind==='headquarters'),ids={};
  for(const kind of kinds){
   const existing=g.bases.find(b=>b.owner===0&&b.kind===kind&&b.hp>0&&b.buildRemaining<=0);if(existing){ids[kind]=existing.id;continue;}
   const spec=BUILDINGS[kind];let at;
   for(let radius=200;radius<750&&!at;radius+=40)for(let i=0;i<24;i++){
    const p=g.world.clearSite({x:home.x+Math.cos(i*Math.PI/12)*radius,y:home.y+Math.sin(i*Math.PI/12)*radius},spec.radius);
    if(p&&g.bases.every(b=>Math.hypot(b.x-p.x,b.y-p.y)>=b.radius+spec.radius+24)&&g.territories.every(t=>Math.hypot(t.point.x-p.x,t.point.y-p.y)>=spec.radius+45)){at=p;break;}
   }
   if(!at)throw Error('No presentation fixture site for '+kind);let id=1800;while(g.bases.some(b=>b.id===id)||g.units.some(u=>u.id===id))id++;
   g.bases.push({...home,...at,id,kind,hp:spec.hp,radius:spec.radius,queue:[],queueTypes:[],queueCosts:[],production:0,buildRemaining:0,cooldown:0,rally:null});ids[kind]=id;
  }
  a.refresh();return ids;
 },kinds);
}

// Build legal WebGL sites for presentation tests with the simulation paused.
export async function buildWebGLFacility(page,kind){
 return page.evaluate(kind=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  game.credits[0]=10000;
  const hq=game.bases.find(b=>b.owner===0&&b.kind==='headquarters');
  const candidates=kind==='headquarters'?game.headquartersCandidates(0):[];
  if(hq&&kind!=='headquarters'){
   for(let distance=180;distance<=520;distance+=20){
    for(let i=0;i<32;i++){
     const angle=i*Math.PI/16;
     candidates.push({x:hq.x+distance*Math.cos(angle),y:hq.y+distance*Math.sin(angle)});
    }
   }
  }
  const site=candidates.find(p=>game.buildError(0,kind,p)===null);
  const base=site&&game.build(0,kind,site);
  if(!base)throw Error('No valid WebGL site for '+kind);
  battlefield.drawInterface();
  return base.id;
 },kind);
}

export async function completeWebGLFacility(page,id){
 await page.evaluate(id=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  const base=game.bases.find(base=>base.id===id);
  if(!base)throw Error('Missing WebGL facility '+id);
  base.buildRemaining=0;
  game.updateVision();
  battlefield.drawInterface();
 },id);
}
