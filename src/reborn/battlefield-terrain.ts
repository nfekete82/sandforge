import {campaignLayout, type MapVersion, type Point} from './config.js';
import type {CanyonRidge} from './canyon-front.js';
import {ridgeCenterY} from './canyon-height.js';
import {raisedMesaHeight,type RaisedMesa} from './raised-mesas.js';

/** Revision 2: roomier buildable pads around bastions / headquarters.
 * Revision 1 remains reproducible for existing saves. */
export const BATTLEFIELD_GENERATOR = 2;
export type BattlefieldGeneratorVersion=1|2|3|4|5|6|7|8|9|10;
export const TERRAIN_GRADING_V2={
 bastionFlatRadius:540,bastionShoulder:360,
 homeFlatRadius:775,homeShoulder:460,
 rockSafetyMargin:110
} as const;
/** Generator v3 only: wide build pads with a smooth transition into the cliffs. */
export const TERRAIN_GRADING_V3={
 bastionFlatRadius:680,bastionShoulder:350,
 homeFlatRadius:890,homeShoulder:430,
 rockSafetyMargin:180
} as const;
export const TERRAIN_PROFILES = ['open','dunes','rocky','oasis','mixed'] as const;
export type TerrainProfile = typeof TERRAIN_PROFILES[number];
export const TERRAIN_LABELS:Record<TerrainProfile,string> = {
 open:'Offene Wüste',dunes:'Dünenlandschaft',rocky:'Felswüste',oasis:'Oasenwüste',mixed:'Gemischte Landschaft'
};
export const TERRAIN_SEGMENTS = 224; // the existing 4 × 56 WebGL triangle lattice
export function isTerrainProfile(p:unknown):p is TerrainProfile{return TERRAIN_PROFILES.includes(p as TerrainProfile);}
/** Named streams: adding a prop never advances terrain, sites, rocks or ruins. */
export function streamSeed(seed:number,name:string,candidate=0):number{
 let h=(seed^Math.imul(candidate,0x9e3779b9))>>>0;
 for(let i=0;i<name.length;i++){h=Math.imul(h^name.charCodeAt(i),0x85ebca6b);h^=h>>>13;}
 return (h^(h>>>16))>>>0;
}
export function terrainProfile(seed:number,requested?:TerrainProfile):TerrainProfile{
 return requested??TERRAIN_PROFILES[streamSeed(seed,'profile')%TERRAIN_PROFILES.length];
}
const smooth=(n:number)=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
const hash=(x:number,y:number,s:number)=>{
 let h=Math.imul(x,374761393)^Math.imul(y,668265263)^s;h=Math.imul(h^(h>>>13),1274126177);
 return ((h^(h>>>16))>>>0)/4294967295;
};
function noise(x:number,y:number,s:number):number{
 const ix=Math.floor(x),iy=Math.floor(y),u=smooth(x-ix),v=smooth(y-iy);
 const a=hash(ix,iy,s),b=hash(ix+1,iy,s),c=hash(ix,iy+1,s),d=hash(ix+1,iy+1,s);
 return (a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v;
}
function fbm(x:number,y:number,s:number):number{
 return noise(x,y,s)*.58+noise(x*2.03+31,y*2.03-19,s^0x61c88647)*.28+
  noise(x*4.11-17,y*4.11+47,s^0x2c9277b5)*.14;
}
export function battlefieldStart(site:Point,size:number):Point{
 return {x:site.x+(site.x<size/2?-260:260),y:site.y+(site.y<size/2?-165:165)};
}
export interface BattlefieldTerrain {
 generatorVersion:BattlefieldGeneratorVersion; profile:TerrainProfile; candidate:number; segments:number; size:number;
 heights:Float32Array; basins:Point[]; minHeight:number; maxHeight:number;
}
/** Connected warped dune crests, broad eroded plateaus and low basin masks.
 * All expensive noise work runs once. Movement, art and combat sample these
 * same triangles, with an explicit conservative maximum walkable gradient. */
export function generateBattlefieldTerrain(seed:number,version:MapVersion,size:number,sites:readonly Point[],
 profile:TerrainProfile,candidate=0,basins:Point[]=[],generatorVersion:BattlefieldGeneratorVersion=BATTLEFIELD_GENERATOR,ridges:readonly CanyonRidge[]=[],plateaus:readonly RaisedMesa[]=[]):BattlefieldTerrain{
 const segments=TERRAIN_SEGMENTS,n=segments+1,step=size/segments,heights=new Float32Array(n*n);
 const s=streamSeed(seed,'terrain',candidate),angle=hash(s,7,s)*Math.PI*2,c=Math.cos(angle),d=Math.sin(angle);
 const homes=campaignLayout(version,seed).headquarters.map(i=>battlefieldStart(sites[i],size));
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){
  const x=i*step,y=j*step;
  const wx=x+(fbm(x/1700,y/1700,s^13)-.5)*720;
  const wy=y+(fbm(x/1600+20,y/1600-9,s^37)-.5)*720;
  const u=(wx*c+wy*d)/690,v=(-wx*d+wy*c)/1370;
  const broad=fbm(wx/1900,wy/1900,s),detail=fbm(wx/630,wy/630,s^731);
  const crest=(Math.sin(u*4.2+(fbm(u*.65,v*.65,s^51)-.5)*5.4+v*.65)+1)*.5;
  // More small, walkable wind-blown mounds; all still pass through the same
  // grading/gradient limiter as units, navigation, construction and fog.
  const hummocks=(profile==='dunes'||profile==='mixed'?12:0)*
   smooth((fbm(wx/430+7,wy/430-11,s^0x47f2)-.35)/.32);
  const dunes=18+crest*crest*(64+55*broad)+detail*17+hummocks;
  const ridge=1-Math.abs(fbm(wx/1100,wy/1100,s^107)*2-1);
  const plateau=smooth((broad-.30)/.38)*154;
  const rocky=12+plateau+ridge*ridge*64+detail*15;
  const open=6+broad*17+detail*7;
  const basin=smooth((fbm(wx/1400+51,wy/1400-30,s^97)-.40)/.25);
  const oasis=7+broad*21+detail*11+basin*31;
  // A rotated, warped zone mask, never rectangular biome tiles.
  const zone=noise(wx/2200+13,wy/2200-17,s^0x3197);
  const mixed=open*(1-smooth((zone-.18)/.25))+dunes*smooth((zone-.18)/.25)*(1-smooth((zone-.52)/.25))+
   rocky*smooth((zone-.52)/.25);
  let h=profile==='open'?open:profile==='dunes'?dunes:profile==='rocky'?rocky:profile==='oasis'?oasis:mixed;
  if(generatorVersion>=3){
   // True continuous mountain relief follows the same physical canyon spine.
   // The navigation grid blocks the cliff itself; only real ramps cross it.
   for(const mountain of ridges){
    if(mountain.ramps.some(r=>Math.abs(x-r.x)<=r.width*.55))continue;
    let nearest=Infinity;
    for(let k=1;k<mountain.spine.length;k++){
     const a=mountain.spine[k-1],b=mountain.spine[k],dx=b.x-a.x,dy=b.y-a.y;
     const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));
     nearest=Math.min(nearest,Math.hypot(x-a.x-t*dx,y-a.y-t*dy));
    }
    const shoulder=smooth((710-nearest)/710);
    h+=shoulder*shoulder*(profile==='rocky'?165:profile==='open'?93:132);
   }
  }
  // Grade the actual authoritative terrain used by rendering, navigation
  // and placement – no floating decorative mesh and no run-time deformation.
  // Wider pads preserve the same profile on all v2 maps; in-between dunes
  // remain rugged. Saved revision-1 maps retain their original exact mask.
  let mask=1;
  if(generatorVersion===1){
   for(const home of homes)mask=Math.min(mask,smooth((Math.hypot(x-home.x,y-home.y)-650)/480));
   for(const site of sites)mask=Math.min(mask,smooth((Math.hypot(x-site.x,y-site.y)-230)/360));
  }else{
   const grading=generatorVersion>=3?TERRAIN_GRADING_V3:TERRAIN_GRADING_V2;
   for(const home of homes)mask=Math.min(mask,smooth(
    (Math.hypot(x-home.x,y-home.y)-grading.homeFlatRadius)/
     grading.homeShoulder));
   for(const site of sites)mask=Math.min(mask,smooth(
    (Math.hypot(x-site.x,y-site.y)-grading.bastionFlatRadius)/
     grading.bastionShoulder));
  }
  h*=mask;
  for(const basin of basins){
   const blend=smooth((Math.hypot(x-basin.x,y-basin.y)-235)/290);
   h=2+(h-2)*blend;
  }
  heights[j*n+i]=h;
 }
 // Lower-only Lipschitz envelope: each edge is <= .22 gradient, so every
 // actual triangle has <= .312 gradient. Flat pads remain exactly flat.
 // Two raster sweeps propagate the distance envelope across the whole map.
 const delta=step*.22;
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){
  const k=j*n+i;let h=heights[k];if(i)h=Math.min(h,heights[k-1]+delta);if(j)h=Math.min(h,heights[k-n]+delta);heights[k]=h;
 }
 for(let j=n-1;j>=0;j--)for(let i=n-1;i>=0;i--){
  const k=j*n+i;let h=heights[k];if(i<segments)h=Math.min(h,heights[k+1]+delta);if(j<segments)h=Math.min(h,heights[k+n]+delta);heights[k]=h;
 }
 // Versioned desert-route repair for the four authored battlefields.
 // The old V4 mountains and sand materials remain identical everywhere
 // except the actual vehicle pass shoulders. Old V4 saves stay unchanged.
 // Existing .22 per-axis Lipschitz grading permits .31 diagonal slopes,
 // above paid rover (.195), tank (.215), artillery (.185) driving limits.
 // A LOWER-ONLY envelope at the drawn gaps brings every triangle below .15.
 if(generatorVersion>=5&&ridges.some(r=>r.ramps.length)){
  const passCells=new Uint8Array(n*n);
  for(const ridge of ridges)for(const ramp of ridge.ramps){
   const left=Math.max(0,Math.floor((ramp.x-ramp.width*.5-115)/step));
   const right=Math.min(segments,Math.ceil((ramp.x+ramp.width*.5+115)/step));
   for(let i=left;i<=right;i++){
    const x=i*step,center=ridgeCenterY(ridge,x);
    for(let j=0;j<n;j++)if(Math.abs(j*step-center)<=1450)
     passCells[j*n+i]=1;
   }
  }
  const regularEdge=step*.22,roadEdge=step*.105;
  const edge=(a:number,b:number)=>passCells[a]||passCells[b]?roadEdge:regularEdge;
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
   const k=j*n+i;let h=heights[k];
   if(i)h=Math.min(h,heights[k-1]+edge(k,k-1));
   if(j)h=Math.min(h,heights[k-n]+edge(k,k-n));
   heights[k]=h;
  }
  for(let j=n-1;j>=0;j--)for(let i=n-1;i>=0;i--){
   const k=j*n+i;let h=heights[k];
   if(i<segments)h=Math.min(h,heights[k+1]+edge(k,k+1));
   if(j<segments)h=Math.min(h,heights[k+n]+edge(k,k+n));
   heights[k]=h;
  }
 }
 // V8 introduces broad DRY LOWLANDS instead of just isolated mountains.
 // These are depressions in the actual terrain mesh (not dark decals).
 // Gentle >600-unit shoulders keep all normal vehicle slopes accessible.
 // Graded Bastion/HQ pads remain unchanged, even beside a valley.
 if(generatorVersion>=8){
  const valleyCenters=[
   {x:size*.27,y:size*.52,r:size*.13,depth:44},
   {x:size*.74,y:size*.47,r:size*.12,depth:36}
  ];
  const smoothStep=(t:number)=>{const u=Math.max(0,Math.min(1,t));return u*u*(3-2*u);};
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
   const p={x:i*step,y:j*step};let lowering=0;
   const clearSite=sites.reduce((t,q)=>Math.min(t,
     smoothStep((Math.hypot(p.x-q.x,p.y-q.y)-TERRAIN_GRADING_V3.bastionFlatRadius)/300)),1);
   for(const valley of valleyCenters){
    const dist=Math.hypot((p.x-valley.x)*.83,(p.y-valley.y)*1.10);
    const v=1-smoothStep((dist-valley.r*.34)/(valley.r*.9));
    lowering=Math.max(lowering,valley.depth*v*clearSite);
   }
   heights[j*n+i]-=lowering;
  }
 }
 // Version 7/8 add physical walkable summits AFTER the legacy lower-only
 // height envelope. Their sheer rock edges must not be artificially graded
 // into round slopes; only the long carved ramps are vehicle-safe.
 // The exact SAME final height grid drives rendering, physics and fog.
 if(generatorVersion>=7&&plateaus.length){
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
   const k=j*n+i,p={x:i*step,y:j*step};
   let h=heights[k];
   for(const mesa of plateaus)h=raisedMesaHeight(h,p,mesa);
   heights[k]=h;
  }
 }
 let minHeight=Infinity,maxHeight=-Infinity;
 for(const h of heights){minHeight=Math.min(minHeight,h);maxHeight=Math.max(maxHeight,h);}
 return {generatorVersion,profile,candidate,segments,size,heights,basins,minHeight,maxHeight};
}
/** Subtle exposed-earth band on graded shoulders (visual colour only).
 * All values are deterministic and baked into existing mesh vertex colours. */
export function terrainGradingEdge(x:number,y:number,sites:readonly Point[],
 homes:readonly Point[],version:BattlefieldGeneratorVersion):number{
 if(version<2)return 0;
 let strongest=0;
 for(const [positions,flat] of [
  [sites,version>=3?TERRAIN_GRADING_V3.bastionFlatRadius:TERRAIN_GRADING_V2.bastionFlatRadius] as const,
  [homes,version>=3?TERRAIN_GRADING_V3.homeFlatRadius:TERRAIN_GRADING_V2.homeFlatRadius] as const
 ]){
  for(const p of positions){
   const offset=Math.hypot(x-p.x,y-p.y)-flat;
   const band=smooth(offset/46)*(1-smooth((offset-78)/200));
   strongest=Math.max(strongest,band);
  }
 }
 return strongest;
}

/** Exact barycentric interpolation, including the b–c diagonal used by WebGL.
 * Clamped outside the playfield only for the existing decorative edge apron. */
export function battlefieldHeightAt(t:BattlefieldTerrain,x:number,y:number):number{
 const gx=Math.max(0,Math.min(t.segments,x/t.size*t.segments)),gy=Math.max(0,Math.min(t.segments,y/t.size*t.segments));
 const i=Math.min(t.segments-1,Math.floor(gx)),j=Math.min(t.segments-1,Math.floor(gy)),u=gx-i,v=gy-j;
 const n=t.segments+1,k=j*n+i,a=t.heights[k],b=t.heights[k+1],c=t.heights[k+n],d=t.heights[k+n+1];
 return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
}
export function battlefieldSlopeAt(t:BattlefieldTerrain,x:number,y:number):number{
 const gx=Math.max(0,Math.min(t.segments-1e-7,x/t.size*t.segments)),gy=Math.max(0,Math.min(t.segments-1e-7,y/t.size*t.segments));
 const i=Math.floor(gx),j=Math.floor(gy),n=t.segments+1,k=j*n+i,h=t.heights,step=t.size/t.segments;
 return gx-i+gy-j<=1?Math.hypot(h[k+1]-h[k],h[k+n]-h[k])/step:
  Math.hypot(h[k+n+1]-h[k+n],h[k+n+1]-h[k+1])/step;
}
