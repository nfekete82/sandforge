#!/usr/bin/env node
// Sandforge: Bastion Wars — deterministic game-ready flame tank PBR GLBs.
// Generated into dist only. Authored local GLBs in src/assets take precedence.
import {mkdirSync, existsSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {deflateSync} from 'node:zlib';
const OUT=process.argv[2]||'dist/src/assets/reborn/animation';
const TAU=Math.PI*2;
const PALETTE={
 sand:[187,161,116],sandLight:[214,188,143],sandDark:[145,123,90],
 olive:[86,94,67],oliveLight:[108,117,79],black:[30,32,31],
 graphite:[49,51,49],metal:[94,99,94],steel:[142,144,134],
 rubber:[34,34,32],copper:[195,112,56],bronze:[135,83,48],
 amber:[246,160,62],team:[38,102,185]
};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const rgb=(v)=>v.map(c=>Math.round(clamp(c,0,255)));
const groupMap=new Map();
function group(part,mat){const key=part+'|'+mat;if(!groupMap.has(key))groupMap.set(key,{part,mat,p:[],n:[],uv:[]});return groupMap.get(key);}
function vertex([x,y,z]){return [x,z,-y];} // design is X forward negative, Y sideways, Z up
function face(part,mat,a,b,c){
 const g=group(part,mat),v=[a,b,c].map(vertex);
 const u=v[1].map((n,i)=>n-v[0][i]),w=v[2].map((n,i)=>n-v[0][i]);
 const normal=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];
 const s=Math.hypot(...normal)||1;
 for(const p of v){g.p.push(...p);g.n.push(...normal.map(v=>v/s));g.uv.push(p[0]*.75+p[2]*.19,p[1]*.72+p[2]*.12);}
}
function quad(part,mat,a,b,c,d){face(part,mat,a,b,c);face(part,mat,a,c,d);}
function box(part,mat,at,size,rotation=0){
 const [sx,sy,sz]=size.map(n=>n*.5),co=Math.cos(rotation),si=Math.sin(rotation);
 const corners=[[-sx,-sy,-sz],[sx,-sy,-sz],[sx,sy,-sz],[-sx,sy,-sz],[-sx,-sy,sz],[sx,-sy,sz],[sx,sy,sz],[-sx,sy,sz]];
 const pts=corners.map(([x,y,z])=>[at[0]+co*x+si*z,at[1]+y,at[2]-si*x+co*z]);
 for(const [a,b,c,d] of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]])quad(part,mat,pts[a],pts[b],pts[c],pts[d]);
}
function cylinder(part,mat,center,r,length,axis='z',sections=18){
 const a=[...center],b=[...center],index=axis==='x'?0:axis==='y'?1:2;
 a[index]-=length*.5;b[index]+=length*.5;
 const p=(t,at)=>{const q=[...at];if(index===0){q[1]+=r*Math.cos(t);q[2]+=r*Math.sin(t);}else if(index===1){q[0]+=r*Math.cos(t);q[2]+=r*Math.sin(t);}else{q[0]+=r*Math.cos(t);q[1]+=r*Math.sin(t);}return q};
 for(let i=0;i<sections;i++){const t=i*TAU/sections,n=(i+1)*TAU/sections;
  const l=p(t,a),k=p(n,a),m=p(n,b),h=p(t,b);
  quad(part,mat,l,k,m,h);face(part,mat,a,k,l);face(part,mat,b,h,m);
 }
}
function tube(part,mat,a,b,r,segments=12){
 const v=b.map((n,i)=>n-a[i]),len=Math.hypot(...v);if(len<1e-6)return;
 const t=v.map(n=>n/len),hint=Math.abs(t[2])<.8?[0,0,1]:[0,1,0];
 let n=[t[1]*hint[2]-t[2]*hint[1],t[2]*hint[0]-t[0]*hint[2],t[0]*hint[1]-t[1]*hint[0]],d=Math.hypot(...n);
 n=n.map(q=>q/d);const m=[t[1]*n[2]-t[2]*n[1],t[2]*n[0]-t[0]*n[2],t[0]*n[1]-t[1]*n[0]];
 const circle=(p,ang)=>p.map((q,j)=>q+r*(Math.cos(ang)*n[j]+Math.sin(ang)*m[j]));
 for(let i=0;i<segments;i++){const u=i*TAU/segments,w=(i+1)*TAU/segments;quad(part,mat,circle(a,u),circle(a,w),circle(b,w),circle(b,u));}
}
function profile(part,mat,outline,width,side=0){
 const front=outline.map(([x,z])=>[x,side-width/2,z]),back=outline.map(([x,z])=>[x,side+width/2,z]);
 for(let i=1;i<outline.length-1;i++){face(part,mat,front[0],front[i+1],front[i]);face(part,mat,back[0],back[i],back[i+1]);}
 for(let i=0;i<outline.length;i++){const j=(i+1)%outline.length;quad(part,mat,front[i],front[j],back[j],back[i]);}
}
function build(owner){
 groupMap.clear();
 // Armored lower tub and sculpted sloped front glacis.
 box('Hull','graphite',[0,0,.91],[4.30,2.17,.65]);
 profile('Hull','sand',[[-2.49,1.04],[-2.32,1.37],[-1.17,1.82],[.92,1.86],[2.19,1.55],[2.23,1.13]],2.22);
 profile('Hull','sandDark',[[-2.5,1.03],[-2.49,1.29],[-1.55,1.62],[-1.26,1.37],[-1.63,1.07]],2.4);
 box('Hull','olive',[1.35,0,1.82],[1.57,1.69,.19]);
 for(const s of [-1,1]){
  profile('Hull','sandLight',[[-2.4,.99],[-2.28,1.46],[-1.34,1.64],[-.8,1.53],[-.8,.99]],.44,s*1.06);
  profile('Hull','sand',[[-1.11,.99],[-1.06,1.51],[.96,1.48],[2.17,1.31],[2.19,.94]],.25,s*1.14);
  profile('Hull','olive',[[.02,1.39],[.27,1.45],[.65,1.43],[.49,1.22],[.13,1.22]],.025,s*1.274);
  profile('Hull','oliveLight',[[1.13,1.36],[1.72,1.31],[1.92,1.23],[1.24,1.19]],.025,s*1.274);
  box('Hull','sandDark',[.12,s*1.24,1.12],[1.82,.09,.35]);
  for(let i=0;i<7;i++)box('Hull','graphite',[-.32+i*.17,s*1.31,1.35],[.05,.016,.22]);
  box('Hull','sandLight',[-2.02,s*.93,1.30],[.95,.58,.35],-.12);
  box('Lights','graphite',[-2.31,s*.86,1.57],[.1,.34,.16]);
  box('Lights','amber',[-2.37,s*.86,1.57],[.025,.25,.085]);
  for(let i=0;i<13;i++)cylinder('Hull','steel',[-1.55+i*.29,s*1.31,1.01],.025,.035,'y',8);
 }
 // Distinct physical tread links and six bogies per side.
 for(const s of [-1,1]){
  const side=s*1.17,part=s<0?'Track_L':'Track_R';
  for(const [i,x] of [-1.83,-1.15,-.46,.23,.92,1.63].entries()){
   const r=i===0||i===5?.43:.35;
   cylinder(part,'black',[x,side,.47],r,.23,'y',20);
   cylinder(part,'steel',[x,side+s*.13,.47],r*.76,.032,'y',20);
   cylinder(part,'graphite',[x,side+s*.158,.47],r*.29,.035,'y',12);
   for(let a=0;a<6;a++){
    const t=a*TAU/6;cylinder(part,'metal',[x+Math.cos(t)*r*.62,side+s*.16,.47+Math.sin(t)*r*.62],.022,.025,'y',7);
   }
  }
  const belt=[];
  for(let i=0;i<25;i++)belt.push([-1.83+i*(3.48/24),.89]);
  for(let i=0;i<12;i++){const a=Math.PI/2-i*Math.PI/11;belt.push([1.65+.39*Math.cos(a),.47+.42*Math.sin(a)]);}
  for(let i=0;i<25;i++)belt.push([1.65-i*(3.48/24),.05]);
  for(let i=0;i<12;i++){const a=-Math.PI/2-i*Math.PI/11;belt.push([-1.83-.39*Math.cos(a),.47+.42*Math.sin(a)]);}
  for(let i=0;i<belt.length;i++){
   const [x,z]=belt[i],[nx,nz]=belt[(i+1)%belt.length],d=Math.hypot(nx-x,nz-z),ang=-Math.atan2(nz-z,nx-x);
   box(part,'rubber',[(x+nx)*.5,side,(z+nz)*.5],[Math.max(.026,d*.97),.34,.14],ang);
   box(part,'steel',[(x+nx)*.5,side+s*.022,(z+nz)*.5],[Math.max(.025,d*.71),.39,.03],ang);
  }
  box(part,'sandDark',[-.13,s*1.22,.88],[3.65,.13,.28]);
 }
 // Double-barrel flamethrower with vented shroud and orange glowing internals.
 for(const s of [-1,1]){
  const y=s*.23;
  tube('Flame_Projector','graphite',[-2.20,y,1.42],[-3.23,y,1.42],.18,18);
  tube('Flame_Projector','metal',[-3.2,y,1.42],[-3.50,y,1.42],.155,18);
  cylinder('Flame_Projector','bronze',[-3.4,y,1.42],.17,.11,'x',18);
  cylinder('Flame_Projector','black',[-3.49,y,1.42],.118,.03,'x',18);
  cylinder('Flame_Projector','amber',[-3.508,y,1.42],.082,.01,'x',14);
  for(let i=0;i<7;i++)cylinder('Flame_Projector','bronze',[-3.12+i*.107,y,1.42],.22,.032,'x',12);
  for(let i=0;i<12;i++){
   const x=-3.33+i*.087;box('Flame_Projector','steel',[x,y-.21,1.59],[.05,.038,.14]);
   box('Flame_Projector','steel',[x,y+.21,1.59],[.05,.038,.14]);
   box('Flame_Projector','steel',[x,y,1.64],[.05,.43,.04]);
  }
  for(let i=0;i<5;i++)box('Flame_Projector','metal',[-2.83,y-.20+i*.10,1.63],[.94,.022,.04]);
 }
 profile('Flame_Projector','graphite',[[-3.42,1.31],[-3.3,1.78],[-2.38,1.78],[-2.15,1.36]],.78);
 for(const s of [-1,1])box('Flame_Projector','metal',[-2.67,s*.48,1.55],[1.25,.075,.09],.06);
 // Turret silhouette, vents, maintenance hatch and communication antenna.
 cylinder('Turret','graphite',[-.6,0,1.77],.66,.18,'z',24);
 profile('Turret','sandLight',[[-1.2,1.79],[-.92,2.03],[-.1,2.04],[.13,1.78]],1.03);
 box('Turret','sandDark',[-.42,0,2.057],[.57,.72,.1]);
 cylinder('Turret','olive',[-.45,0,2.13],.25,.05,'z',20);
 tube('Turret','graphite',[-.10,.36,2.02],[-.07,.36,2.95],.027,10);
 cylinder('Turret','black',[-.07,.36,2.96],.045,.048,'z',10);
 for(let i=0;i<8;i++)box('Hull','graphite',[.30+i*.2,0,1.96],[.065,1.65,.04]);
 // Armored rear fuel cells, straps, corrugated hoses and external guards.
 for(const s of [-1,1]){
  const y=s*.46;
  cylinder('Fuel_System','olive',[1.16,y,2.1],.36,1.66,'x',24);
  for(const x of [.50,1.16,1.82])cylinder('Fuel_System','sandDark',[x,y,2.1],.38,.09,'x',24);
  cylinder('Fuel_System','black',[2.03,y,2.1],.23,.09,'x',20);
  cylinder('Fuel_System','bronze',[1.63,y,2.47],.09,.055,'z',16);
  tube('Fuel_System','graphite',[1.65,y,1.84],[.3,y,1.61],.105);
  tube('Fuel_System','metal',[.5,y,2.12],[-.9,y,1.99],.082);
  for(let i=0;i<16;i++)cylinder('Fuel_System','metal',[.45+i*.08,y,2.12+i*.008],.103,.028,'x',10);
  for(const x of [.3,1.95])tube('Fuel_System','steel',[x,s*.89,1.73],[x,s*.89,2.29],.04,9);
  tube('Fuel_System','steel',[.3,s*.89,2.29],[1.95,s*.89,2.29],.036,9);
 }
 box('Hull','black',[2.26,0,1.33],[.07,1.24,.62]);
 for(let i=0;i<9;i++)box('Hull','steel',[2.302,-.49+i*.122,1.36],[.023,.067,.41]);
 for(const s of [-1,1]){
  box('Lights','amber',[2.31,s*.84,1.3],[.03,.17,.11]);
  tube('Hull','steel',[2.2,s*.84,.97],[2.45,s*.84,.75],.05);
  tube('Hull','steel',[2.45,s*.84,.75],[2.2,s*.84,.68],.05);
  for(const x of [-.30,-.11,.08])box('Team_Accent','team',[x,s*1.315,1.42],[.075,.02,.2],-.23);
  for(const x of [1.60,1.73])box('Team_Accent','team',[x,s*.16,2.53],[.055,.13,.009]);
 }
 return writeGlb(owner);
}
