import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {segmentDistance} from '../dist/src/reborn/world-generation.js';
import {navigationLine} from '../dist/src/reborn/navigation-line.js';
import {limitModelShadowCasters} from '../scripts/webgl-shadow-budget.js';

function oldNavigationLine(a,b,cell,columns,blocked,obstacles,radius,clearance){
 const probes=Array.from({length:8},(_,i)=>({x:Math.cos(i*Math.PI/4),y:Math.sin(i*Math.PI/4)}));
 for(const o of obstacles)if(segmentDistance(o,a,b)<o.radius+radius+clearance)return false;
 const clear=(x,y)=>x>=0&&y>=0&&x<columns&&y<columns&&!blocked[y*columns+x];
 const ray=(ox,oy)=>{
  const ax=a.x+ox,ay=a.y+oy,bx=b.x+ox,by=b.y+oy,dx=bx-ax,dy=by-ay;
  let x=Math.floor(ax/cell),y=Math.floor(ay/cell);
  const endX=Math.floor(bx/cell),endY=Math.floor(by/cell);
  if(!clear(x,y)||!clear(endX,endY))return false;
  const sx=Math.sign(dx),sy=Math.sign(dy),tx=dx?cell/Math.abs(dx):Infinity,
   ty=dy?cell/Math.abs(dy):Infinity;
  let nx=dx?((sx>0?x+1:x)*cell-ax)/dx:Infinity;
  let ny=dy?((sy>0?y+1:y)*cell-ay)/dy:Infinity;
  while(x!==endX||y!==endY){
   if(x===endX)nx=Infinity;if(y===endY)ny=Infinity;
   if(Math.abs(nx-ny)<1e-12){
    if(!clear(x+sx,y)||!clear(x,y+sy))return false;
    x+=sx;y+=sy;nx+=tx;ny+=ty;
   }else if(nx<ny){x+=sx;nx+=tx;}else{y+=sy;ny+=ty;}
   if(!clear(x,y))return false;
  }
  return true;
 };
 if(!ray(0,0))return false;
 if(clearance>0)for(const p of probes)if(!ray(p.x*clearance,p.y*clearance))return false;
 return true;
}

test('new fast obstacle pruning preserves precise original wall and cliff navigation',()=>{
 const cols=240,cell=25,blocked=new Uint8Array(cols*cols);
 for(let i=0;i<600;i++)blocked[(i*829)%blocked.length]=1;
 let seed=20261119;
 const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<900;i++){
  const ax=200+rnd()*5200,ay=200+rnd()*5200;
  const a={x:ax,y:ay},b={x:ax+(rnd()-.5)*140,y:ay+(rnd()-.5)*140};
  const obstacles=Array.from({length:22},(_,j)=>({
   x:j<5?ax+(rnd()-.5)*80:rnd()*6000,
   y:j<5?ay+(rnd()-.5)*80:rnd()*6000,
   radius:10+rnd()*35
  }));
  const radius=i%3===0?10:22,clearance=i%4===0?0:12;
  const before=oldNavigationLine(a,b,cell,cols,blocked,obstacles,radius,clearance);
  const after=navigationLine(a,b,cell,cols,blocked,obstacles,radius,clearance);
  assert.equal(after,before,'routing mismatch sample '+i);
 }
});

test('shadow detail budget retains textured meshes and animations but cuts shadow passes',()=>{
 const root=new THREE.Group(),mat=new THREE.MeshStandardMaterial({roughness:.65});
 const geos=[];
 for(let i=0;i<80;i++){
  const geo=new THREE.BoxGeometry(i<6?20:1,1,1);geos.push(geo);
  const m=new THREE.Mesh(geo,mat);
  m.castShadow=true;m.receiveShadow=true;m.position.x=i;
  root.add(m);
 }
 const saved=root.children.map(o=>({geometry:o.geometry,material:o.material}));
 const first=limitModelShadowCasters(root,12);
 assert.deepEqual(first,{total:80,selected:12});
 assert.equal(root.children.filter(x=>x.castShadow).length,12);
 assert.equal(root.children.filter(x=>x.receiveShadow).length,80);
 assert.ok(root.children.slice(0,6).every(x=>x.castShadow),
  'largest armour/hull surfaces retain their silhouette shadows');
 root.children.forEach((m,i)=>{
  assert.equal(m.geometry,saved[i].geometry);
  assert.equal(m.material,saved[i].material);
 });
 limitModelShadowCasters(root,12);
 assert.equal(root.children.filter(x=>x.castShadow).length,12,
  'repeated calls never increase draw count or allocate geometry');
 geos.forEach(g=>g.dispose());mat.dispose();
});

test('large synchronous squad A* bursts are deferred in modern 50ms ticks',()=>{
 const g=new Simulation(20261119,24);
 g.world.blocked.fill(0);g.world.components.fill(0);
 const home=g.bases.find(b=>b.owner===0);
 const units=Array.from({length:9},(_,i)=>g.spawn(0,{
  x:home.x+100+(i%3)*29,y:home.y+130+Math.floor(i/3)*32
 },'tank'));
 const target={x:home.x+420,y:home.y+550};
 let count=0;
 g.world.path=(from,to)=>{count++;return [to];};
 for(const u of units){u.repath=0;u.path=[];}
 g.time=730;
 for(const u of units)g.move(u,target,.05);
 assert.equal(count,2,'only two expensive path searches per physics tick');
 assert.equal(units.filter(u=>u.repath>.09&&u.repath<=.30).length,7,
  'the others preserve their move orders and retry shortly');
 g.time+=.05;
 for(const u of units.slice(2)){u.repath=0;g.move(u,target,.05);}
 assert.equal(count,4,'fresh physics tick admits the next two routes');
});
