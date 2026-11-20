/** Cosmetic, seed-stable wreck parts attached to individual sedan sites.
 * Every piece belongs to a real wreck; no floating independent debris fields,
 * AI obstacles, changed World.blocked cells, or altered saved game data.
 */
export const SEDAN_DEBRIS_VERSION='burned-sedan-scatter-v1-20261120';
const PATTERNS=Object.freeze([
 ['door','wheel','bumper','shard','glass'],
 ['door','hood','wheel','pipe','shard'],
 ['hood','bumper','wheel','shard','glass','pipe']
]);
const hypot=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const distanceToSegment=(p,a,b)=>{
 const dx=b.x-a.x,dy=b.y-a.y,denom=dx*dx+dy*dy||1,
  u=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/denom));
 return Math.hypot(p.x-a.x-u*dx,p.y-a.y-u*dy);
};
const rng=(seed)=>{
 let state=seed>>>0;
 return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;
  return state/4294967296;};
};
export function planBurnedSedanDebris({
 world,terrain=world?.generated,seed=world?.seed??0,
 cars=[],lowQuality=false
}={}){
 if(!world||!terrain?.sites?.length||!cars?.length)return [];
 const out=[],size=world.size,roads=terrain.roads??[];
 const ruins=terrain.ruins??[];
 for(const [carIndex,car] of cars.entries()){
  // Separate RNG stream from the main Sedan placement so adding fragments
  // never changes the car positions, rotations or terrain fingerprint.
  const random=rng((seed^Math.imul(carIndex+1,0x9e3779b9)^0x75b8ea47)>>>0);
  const kinds=PATTERNS[(carIndex+(car.variant??0))%PATTERNS.length];
  for(const [index,kind] of kinds.entries()){
   if(lowQuality&&(kind==='glass'||kind==='pipe'||kind==='shard'))continue;
   for(let attempt=0;attempt<36;attempt++){
    const major=!['glass','shard','pipe'].includes(kind);
    const radius=(major?53:42)+random()*(major?59:52);
    const theta=(index%2===0?Math.PI*.5:-Math.PI*.5)+(random()-.5)*1.7;
    const localX=Math.sin(theta)*radius;
    const localZ=Math.cos(theta)*radius+((random()-.5)*19);
    // Three.js +Y rotation: world X = cos(a)*x + sin(a)*z.
    const x=car.x+Math.cos(car.angle)*localX+Math.sin(car.angle)*localZ;
    const y=car.y-Math.sin(car.angle)*localX+Math.cos(car.angle)*localZ;
    const p={x,y},d=hypot(car,p);
    if(d<38||d>135||x<135||y<135||x>size-135||y>size-135)continue;
    if(out.some(v=>hypot(v,p)<17))continue;
    if(terrain.sites.some(v=>hypot(v,p)<760))continue;
    if(ruins.some(r=>hypot(r,p)<Math.max(r.width,r.depth)*.56+48))continue;
    if(roads.some(road=>road.slice(1).some((b,i)=>
     distanceToSegment(p,road[i],b)<65)))continue;
    if(!world.walkable(p,[],14)||world.terrainSlope(x,y)>.22)continue;
    out.push(Object.freeze({
     kind,carIndex,x,y,angle:car.angle+(random()-.5)*2.9,
     scale:car.scale*(.83+random()*.33),
     tilt:(random()-.5)*.30
    }));
    break;
   }
  }
 }
 return out;
}
