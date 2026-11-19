/** Seeded and purely visual village plots around real oasis layouts.
 * The classic, wide-spaced desert hamlets retain their original algorithm.
 * No paths, blocking tiles, save data or gameplay buildings are modified.
 */
export const OASIS_HAMLET_REVISION='oasis-adobe-hamlets-v1-20261119';
const TAU=Math.PI*2;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function random(seed){
 let x=(seed^0x483ae159)>>>0;
 return ()=>{x=(x+0x6d2b79f5)>>>0;let n=x;
  n=Math.imul(n^(n>>>15),n|1);
  n^=n+Math.imul(n^(n>>>7),n|61);
  return ((n^(n>>>14))>>>0)/4294967296;};
}
const range=(rng,a,b)=>a+(b-a)*rng();
const footprint=house=>Math.hypot(house.width,house.depth)*.5;

export function planOasisVillages({world,terrain,seed=world?.seed??0,oases=[],lowQuality=false}={}){
 if(!world?.size||!world?.index||!terrain?.sites||!oases.length)return [];
 const target=lowQuality?Math.min(1,oases.length):Math.min(3,oases.length);
 const chosen=[];
 const source=[...oases].sort((a,b)=>a.id-b.id);
 for(const oasis of source){
  if(chosen.length>=target)break;
  const rng=random((seed^oasis.seed^Math.imul(oasis.id+1,0x9e3779b9))>>>0);
  const mainAngle=rng()*TAU;
  const intended=lowQuality?[
   'main_house','flat_house','small_hut'
  ]:[
   'main_house','flat_house','courtyard_house',
   'market_house','small_hut','ruin_house'
  ];
  const limits={
   main_house:[160,192,54,70],
   flat_house:[122,158,43,59],
   courtyard_house:[136,174,44,61],
   small_hut:[80,106,31,43],
   ruin_house:[84,119,30,44],
   market_house:[118,151,41,56]
  };
  const houses=[];
  // For a real village, buildings sit 250-500 units from the water, in
  // an irregular crescent. A broad approach to the pool is left entirely free.
  const minimumRing=oasis.radius*1.30+105;
  const maximumRing=Math.min(oasis.radius*1.30+338,535);
  const houseCount=lowQuality?3:5+Math.floor(rng()*2);
  for(let index=0;index<houseCount;index++){
   const kind=intended[index];
   const [minW,maxW,minH,maxH]=limits[kind];
   const width=range(rng,minW,maxW);
   const depth=width*range(rng,kind==='courtyard_house'?.93:.70,
    kind==='courtyard_house'?1.13:.99);
   const height=range(rng,minH,maxH);
   const quarter=Math.floor(rng()*4)*Math.PI*.5;
   const angle=quarter+range(rng,-.21,.21);
   const template={main_house:0,flat_house:1,courtyard_house:2,
    small_hut:3,ruin_house:4,market_house:5}[kind];
   // Persist the original authored glTF as the foundation for all variants.
   // The distinguishing features are proportions, roof levels, courtyard walls
   // and separately seeded orientation rather than copy/pasted model placement.
   const proposal={kind,variant:template,width,depth,height,angle,
    tint:range(rng,.88,1.06),damage:kind==='ruin_house',
    roofLevel:kind==='main_house'?2:kind==='small_hut'?0:1};
   let selected=null;
   for(let attempt=0;attempt<120;attempt++){
    const arc=range(rng,-1.55,1.55);
    const theta=mainAngle+arc;
    const radius=index===0?range(rng,minimumRing,minimumRing+54):
     range(rng,minimumRing+20,maximumRing);
    const candidate={...proposal,x:oasis.x+Math.cos(theta)*radius,
     y:oasis.y+Math.sin(theta)*radius};
    const pad=footprint(candidate)+28;
    if(candidate.x<pad+55||candidate.y<pad+55||
       candidate.x>world.size-pad-55||candidate.y>world.size-pad-55)continue;
    // Oasis vegetation and the wet pool stay visible and passable.
    if(distance(candidate,oasis)<oasis.radius*1.22+footprint(candidate)+28)continue;
    if(chosen.some(v=>v.houses.some(h=>
      distance(candidate,h)<footprint(candidate)+footprint(h)+36)))continue;
    if(houses.some(h=>distance(candidate,h)<footprint(candidate)+footprint(h)+22))continue;
    const siteMargin=(world.generatorVersion===3?875:1150)+footprint(candidate);
    if(terrain.sites.some(site=>distance(candidate,site)<siteMargin))continue;
    if((terrain.ruins??[]).some(ruin=>
      distance(candidate,ruin)<footprint(candidate)+Math.hypot(ruin.width,ruin.depth)*.55+70))continue;
    const samples=[
     {x:candidate.x,y:candidate.y},
     ...[-1,1].flatMap(dx=>[-1,1].map(dy=>({
      x:candidate.x+dx*width*.39,y:candidate.y+dy*depth*.39
     })))
    ];
    if(samples.some(p=>world.index(p)<0||world.blocked[world.index(p)]||
       !world.walkable(p)|| (world.terrainSlope?.(p.x,p.y)??0)>.13))continue;
    if(samples.some(p=>Math.abs(world.terrainHeight?.(p.x,p.y)-
        world.terrainHeight?.(candidate.x,candidate.y))>8))continue;
    selected=candidate;break;
   }
   if(selected)houses.push(selected);
  }
  // Demand a true mix of residential footprints, otherwise skip this oasis.
  if(houses.length<(lowQuality?2:4)||!houses.some(h=>h.kind==='main_house'))continue;
  // Worn tracks run from the outer crescent towards the village, never straight
  // through the water or into the protected Bastion construction circles.
  const angles=houses.map(h=>Math.atan2(h.y-oasis.y,h.x-oasis.x));
  const meanX=angles.reduce((sum,a)=>sum+Math.cos(a),0);
  const meanY=angles.reduce((sum,a)=>sum+Math.sin(a),0);
  const streetAngle=Math.atan2(meanY,meanX)+Math.PI*.5;
  const centroid=houses.reduce((p,h)=>({x:p.x+h.x/houses.length,
   y:p.y+h.y/houses.length}),{x:0,y:0});
  chosen.push({id:oasis.id,oasisId:oasis.id,x:centroid.x,y:centroid.y,
   angle:streetAngle,houses,roadLength:Math.min(260,Math.max(130,oasis.radius*1.55)),
   architecturalStyle:'oasis-adobe',seed:oasis.seed});
 }
 return chosen;
}
