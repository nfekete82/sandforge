/** Read-only HTTP/HTTPS checks for the actual protected WebGL release. */
import {createHash} from 'node:crypto';
import {request,ORIGIN} from './transport.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const core=[
 'index.html','webgl-preview.js','webgl-title-menu.js','webgl-battlefield.js',
 'webgl-recon-drone.js','webgl-classic-hud.css',
 'vendor/three/three.module.js','src/reborn/simulation.js',
 'src/assets/reborn/buildings-3d/barracks-0.glb',
 'src/assets/reborn/buildings-3d/headquarters-0.glb',
 'src/assets/reborn/buildings-3d/bastion-0.glb'
];
export async function checkWebGLRelease(credentials,release,{live=false,allAssets=false}={}){
 const root=live?'/':'/releases/'+release+'/index.html';
 const entry=await request(ORIGIN+root,{credentials,body:true});
 if(entry.status!==200)throw Error('WebGL entry HTTP '+entry.status);
 const html=await entry.text(),prefix='/releases/'+release+'/';
 if(!html.includes('id="stage"')||!html.includes(prefix+'webgl-title-menu.js')||
    !html.includes(prefix+'vendor/three/three.module.js'))
  throw Error('Wrong or unpinned WebGL game HTML');
 const manifestResponse=await request(ORIGIN+(live?'/deployment.json':prefix+'deployment.json'),{credentials,body:true});
 if(manifestResponse.status!==200)throw Error('WebGL deployment manifest HTTP '+manifestResponse.status);
 const manifest=await manifestResponse.json();
 if(manifest.release!==release||manifest.renderer!=='webgl')
  throw Error('Live release/renderer does not match requested WebGL release');
 if(hash(Buffer.from(html))!==manifest.files['index.html']?.sha256)
  throw Error('WebGL HTML release integrity mismatch');
 const names=allAssets?Object.keys(manifest.files):core;
 for(const file of names){
  const info=manifest.files[file];
  if(!info)throw Error('Missing live WebGL asset '+file);
  const result=await request(ORIGIN+prefix+file,{credentials,method:'HEAD'});
  if(result.status!==200)throw Error('Live resource '+file+' HTTP '+result.status);
  const size=Number(result.headers.get('content-length'));
  if(size&&size!==info.size)throw Error('Truncated live resource '+file);
  if(file.endsWith('.js')&&!/(?:javascript|ecmascript)/i.test(result.headers.get('content-type')??''))
   throw Error('Incorrect JavaScript MIME type '+file);
 }
 for(const file of ['webgl-preview.js','webgl-title-menu.js','webgl-recon-drone.js']){
  const result=await request(ORIGIN+prefix+file,{credentials,body:true});
  if(result.status!==200||hash(Buffer.from(await result.arrayBuffer()))!==manifest.files[file].sha256)
   throw Error('WebGL JavaScript hash mismatch '+file);
 }
 if(live&&!entry.headers.get('cache-control')?.includes('no-store'))
  throw Error('Live index must be private/no-store');
 return {release,renderer:'webgl',verified: names.length,contentHashes:4,live};
}
