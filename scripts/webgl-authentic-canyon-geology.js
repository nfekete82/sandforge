import * as THREE from 'three';

/** Authored color grading for the large physical ridge and mesa artwork.
 * Every color is adjusted to the SMALL UV/PBR sandstone rocks, not flat
 * paint. The same palettes are shared with the long canyon wall renderer.
 */
export const CANYON_GEOLOGY=Object.freeze({
 'desert-strike':Object.freeze({
  base:'#c0ab8a',dark:'#7c6656',accent:'#e0cca8',veins:.36
 }),
 'broken-empire':Object.freeze({
  base:'#82534f',dark:'#34343a',accent:'#a76b58',veins:.67
 }),
 'burning-horizon':Object.freeze({
  base:'#9b958c',dark:'#555653',accent:'#c4b5a0',veins:.51
 }),
 'last-stronghold':Object.freeze({
  base:'#666769',dark:'#2e3338',accent:'#948982',veins:.72
 })
});
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
/** Continuous rim profile: natural slumped scree at the outer edge,
 * stepped red/charcoal strata, narrow ledges, and a fractured crown.
 * The first ring hugs the authoritative rock outline at terrain height,
 * so no giant polygon skirts, flat colored ground carpets or square ends.
 */
export const GEOLOGICAL_RINGS=Object.freeze([
 [1.006,0.004],[.994,.034],[.980,.092],[.963,.21],
 [.943,.34],[.921,.43],[.893,.455],[.861,.49],
 [.826,.605],[.788,.716],[.737,.738],[.685,.775],
 [.619,.848],[.542,.863],[.452,.929],[.330,.955]
]);
function fractal(angle,seed){
 return .56*Math.sin(angle*3.3+seed*.00014)+
  .28*Math.sin(angle*7.2-seed*.00018)+
  .13*Math.cos(angle*12.1+seed*.000027);
}
/** Pure mesh builder; never touches world collision, saved maps or routing. */
export function buildGeologicalMesaSurface({
 outline,peak,heightAt,half,id=0,seed=0,mapId='desert-strike',quality='high'
}){
 if(!outline||outline.length<3||!Number.isFinite(peak)||peak<=0)
  return {positions:[],colors:[],uv:[],triangles:0};
 const profile=CANYON_GEOLOGY[mapId]??CANYON_GEOLOGY['desert-strike'];
 const base=new THREE.Color(profile.base),dark=new THREE.Color(profile.dark),
  accent=new THREE.Color(profile.accent);
 const cx=outline.reduce((s,p)=>s+p.x,0)/outline.length,
  cz=outline.reduce((s,p)=>s+p.y,0)/outline.length;
 const perEdge=quality==='low'?2:5;
 const perimeter=[];
 for(let i=0;i<outline.length;i++){
  const a=outline[i],b=outline[(i+1)%outline.length];
  for(let t=0;t<perEdge;t++){
   const u=t/perEdge;
   perimeter.push({x:a.x+(b.x-a.x)*u,z:a.y+(b.y-a.y)*u});
  }
 }
 const positions=[],colors=[],uv=[],points=[];
 const rotation=seed*.00013+id*2.39996;
 for(let k=0;k<GEOLOGICAL_RINGS.length;k++){
  const [radius,rise]=GEOLOGICAL_RINGS[k];
  points.push(perimeter.map((p,i)=>{
   const angle=Math.atan2(p.z-cz,p.x-cx),
    fracture=fractal(angle+rotation,seed^Math.imul(id+1,0x9e3779b9)),
    jitter=(k===0?0:Math.sin(i*.64+k*.37+rotation)*.004);
   const rim=radius*(1+(k===0?0:.018*fracture+jitter));
   const x=cx+(p.x-cx)*rim,z=cz+(p.z-cz)*rim;
   const eroded=(.85+.15*Math.sin(angle*4.5+rotation)+
    .055*Math.sin(i*.81+k*.4+rotation))*peak;
   const shelf=(k===0?0:Math.sin(k*2.9+i*.32+rotation)*peak*.018);
   const y=heightAt(x,z)+Math.max(.25,eroded*rise+shelf);
   return [x-half,y,z-half];
  }));
 }
 const push=(a,b,c,layer)=>{
  for(const p of [a,b,c]){
   positions.push(...p);
   const stripe=Math.sin(p[1]*.080+p[0]*.009+p[2]*.012);
   const oxidation=.5+.5*Math.sin(p[1]*.035+p[0]*.003);
   const band=clamp(layer*.58+stripe*.19+oxidation*.12);
   const color=base.clone().lerp(dark,band);
   // Disconnected mineral streaks are baked in the vertex tone.
   color.lerp(accent,clamp(.10+.075*Math.sin(p[1]*.083+p[2]*.017)));
   colors.push(color.r,color.g,color.b);
   // World-aligned UV: one natural mineral grain across every rocky shelf.
   uv.push((p[0]+half)/150,p[1]/120);
  }
 };
 for(let k=0;k<points.length-1;k++){
  for(let i=0;i<perimeter.length;i++){
   const j=(i+1)%perimeter.length,a=points[k][i],b=points[k][j],
    c=points[k+1][i],d=points[k+1][j];
   const weather=.10+.28*(Math.sin(k*2.7+i*.7+rotation)*.5+.5);
   push(a,c,b,weather);
   push(b,c,d,weather);
  }
 }
 const top=[
  cx-half+Math.sin(rotation)*peak*.061,
  heightAt(cx,cz)+peak*1.02,
  cz-half+Math.cos(rotation)*peak*.061
 ];
 for(let i=0;i<perimeter.length;i++){
  push(points.at(-1)[i],top,points.at(-1)[(i+1)%perimeter.length],.19);
 }
 return {positions,colors,uv,triangles:positions.length/9,
  rings:GEOLOGICAL_RINGS.length,perimeterPoints:perimeter.length};
}
