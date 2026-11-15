import {Simulation} from '../dist/src/reborn/simulation.js';
const seeds=[2988452066,3610769721];
for(const seed of seeds){
 const g=Simulation.campaign(seed,23);
 g.stageWebGLProduction=true;
 const initialOwner=g.territories.map(t=>t.owner);
 console.log('SEED',seed,'initial',{owner:initialOwner,redHome:g.startRegions[1],blueHome:g.startRegions[0],redWorker:g.units.filter(u=>u.owner===1).map(u=>({kind:u.kind,x:u.x,y:u.y})),chosenProfile:g.world.generated?.battlefield?.profile});
 for(let i=1;i<=4400;i++){
  g.step(.05);
  if(i%400===0){
   const red=g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier);
   const enemyBases=g.bases.filter(b=>b.owner===1&&b.hp>0);
   const state=g.tactical.state;
   const owners=g.territories.map(t=>t.owner);
   console.log('CHECK',JSON.stringify({
    seed,time:Math.round(g.time),status:g.status,owners,initialOwner,
    credits:g.credits[1],redHQ:enemyBases.find(b=>b.kind==='headquarters')?.buildRemaining??null,
    redBases:enemyBases.map(b=>[b.kind,Number(b.buildRemaining.toFixed(2))]),
    redFighters:red.filter(u=>u.kind!=='engineer'&&u.kind!=='medic').length,
    redOrders:red.filter(u=>u.orders.length).slice(0,7).map(u=>[u.kind,u.orders[0].kind,Math.round(u.orders[0].x),Math.round(u.orders[0].y)]),
    aiPhase:state.phase,aiSince:state.phaseAt,commander:state.commander?.phase,
    mission:state.commander?.mission?.kind,missionSector:state.commander?.mission?.sector,
    lastPlan:state.lastPlan,aborted:state.commander?.aborted
   }));
  }
  if(g.status!=='playing')break;
 }
}
