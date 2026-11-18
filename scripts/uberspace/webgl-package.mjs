/** Versioned authenticated Three.js/WebGL production packaging for Uberspace.
 * All URLs are pinned to an immutable release protected by Apache Basic Auth.
 */
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {listFiles,validRelease,moduleReferences} from './package.mjs';

const sha256=value=>createHash('sha256').update(value).digest('hex');
const media=/\.(?:js|css|html|png|webp|svg|glb|gltf|bin|json|wav|mp3|jpg|jpeg|wasm|woff2|avif)$/i;
const textFile=/\.(?:js|css|html|json|svg|gltf)$/i;
const forbidden=/(^|\/)(?:node_modules|legacy|supply-pbr|supply-custom|\.git)(\/|$)|\.map$|\.ts$/;
const critical=[
 'index.html','classic.html','webgl-preview.js','webgl-title-menu.js',
 'webgl-battlefield.js','webgl-recon-drone.js','webgl-classic-hud.css',
 'vendor/three/three.module.js','vendor/three/three.core.js',
 'src/reborn/simulation.js','src/reborn/main.js',
 'src/assets/reborn/buildings-3d/barracks-0.glb',
 'src/assets/reborn/buildings-3d/barracks-1.glb',
 'src/assets/reborn/buildings-3d/headquarters-0.glb',
 'src/assets/reborn/buildings-3d/headquarters-1.glb',
 'src/assets/reborn/buildings-3d/bastion-0.glb',
 'src/assets/reborn/buildings-3d/factory-0.glb',
 'src/assets/reborn/buildings-3d/airfield-0.glb'
];
const publishable=file=>{
 if(forbidden.test(file)||!media.test(file)||/^\./.test(file)||
   !/^[A-Za-z0-9_./-]+$/.test(file))return false;
 if(file==='index.html'||file==='classic.html'||file==='webgl-preview.html')return true;
 if(file.startsWith('src/assets/reborn/'))return true;
 if(file.startsWith('src/reborn/'))return /\.(?:js|css)$/.test(file);
 if(file.startsWith('vendor/three/'))return file.endsWith('.js');
 // Never publish inspectors, art laboratories, sources or browser test pages.
 if(!file.includes('/'))return /^webgl-[\w-]+\.(?:js|css)$/.test(file)||
   /^sandforge-[\w-]+\.js$/.test(file)||
   ['style.css','retro-desert.css','building-art-version.json'].includes(file);
 return false;
};

/** Pin literal root-relative asset paths; leave a homepage URL "/" untouched. */
export function pinWebGLPaths(source,release){
 if(!validRelease(release))throw Error('Invalid release ID');
 const prefix='/releases/'+release+'/';
 return source.replace(/(["'\x60(=])\/(?!\/|releases\/)([a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]*)*)/g,
  (whole,lead,value)=>{
   const shouldPin=value.startsWith('src/')||value.startsWith('vendor/')||
    value.startsWith('webgl-')||value.startsWith('sandforge-')||
    ['style.css','retro-desert.css','classic.html','webgl-preview.html',
     'building-art-version.json'].includes(value);
   return shouldPin?lead+prefix+value:whole;
  });
}
const unsafeReference=(text)=>/["'\x60(=]\/(?:src\/|vendor\/|webgl-|sandforge-|style\.css|retro-desert\.css|classic\.html)/.test(text);

export async function packageWebGL({root,output,release,commit,branch}){
 if(!validRelease(release)||!/^[a-f0-9]{40}$/.test(commit))
  throw Error('Invalid WebGL release provenance');
 const dist=path.join(root,'dist');
 const files=(await listFiles(dist)).filter(publishable);
 for(const required of critical)if(!files.includes(required))
  throw Error('Incomplete WebGL/PBR build; required '+required);
 const manifest={schema:2,renderer:'webgl',release,commit,branch,
  createdAt:new Date().toISOString(),url:'https://nf.uber.space/',files:{}};
 for(const file of files){
  const src=path.join(dist,file),dst=path.join(output,file);
  await mkdir(path.dirname(dst),{recursive:true});
  if(textFile.test(file)){
   let body=await readFile(src,'utf8');
   if(file==='index.html'&&!body.includes('id="stage"'))
    throw Error('Refusing to publish Canvas as the WebGL entry');
   body=pinWebGLPaths(body,release)
    .replace(/^\/\/# sourceMappingURL=.*$/gm,'');
   if(unsafeReference(body))throw Error('Unpinned WebGL asset reference in '+file);
   await writeFile(dst,body);
  }else await copyFile(src,dst);
  const data=await readFile(dst);
  manifest.files[file]={size:data.length,sha256:sha256(data)};
 }
 const notices='THIRD_PARTY_NOTICES.txt';
 try{
  const data=await readFile(path.join(root,'THIRD_PARTY_NOTICES.md'));
  await writeFile(path.join(output,notices),data);
  manifest.files[notices]={size:data.length,sha256:sha256(data)};
 }catch(error){if(error.code!=='ENOENT')throw error;}
 await validateWebGLPackage(output,manifest);
 await writeFile(path.join(output,'deployment.json'),JSON.stringify(manifest,null,2)+'\n');
 const manifestSHA256=sha256(await readFile(path.join(output,'deployment.json')));
 const bytes=Object.values(manifest.files).reduce((sum,f)=>sum+f.size,0);
 return {manifest,manifestSHA256,bytes};
}
export async function validateWebGLPackage(output,manifest){
 if(manifest.renderer!=='webgl'||!validRelease(manifest.release))
  throw Error('Invalid WebGL release manifest');
 const prefix='/releases/'+manifest.release+'/';
 for(const required of critical)if(!manifest.files[required])
  throw Error('Missing WebGL critical file: '+required);
 for(const file of critical.filter(p=>p.endsWith('.glb')))
  if(manifest.files[file].size<20000)throw Error('Placeholder PBR model: '+file);
 const html=await readFile(path.join(output,'index.html'),'utf8');
 if(!html.includes('id="stage"')||!html.includes(prefix+'webgl-title-menu.js')||
    !html.includes(prefix+'vendor/three/three.module.js')||
    !html.includes('type="importmap"'))
  throw Error('Root WebGL page lacks pinned Three.js/menu bootstrap');
 if(html.includes('href="/classic.html"')||html.includes('src="/webgl-title-menu.js"'))
  throw Error('WebGL homepage contains unpinned game routes');
 const names=Object.keys(manifest.files);
 if(names.some(x=>forbidden.test(x)))throw Error('Development/retired logistics asset in release');
 for(const file of names.filter(x=>x.endsWith('.js'))){
  const body=await readFile(path.join(output,file),'utf8');
  for(const spec of moduleReferences(body)){
   if(/^https:\/\//.test(spec)||spec==='three'||spec.startsWith('three/addons/'))continue;
   let resolved;
   if(spec.startsWith(prefix))resolved=spec.slice(prefix.length);
   else if(spec.startsWith('./')||spec.startsWith('../'))
    resolved=path.posix.normalize(path.posix.join(path.posix.dirname(file),spec));
   else throw Error('Unpinned/unknown browser import '+spec+' in '+file);
   if(!manifest.files[resolved])throw Error('Missing browser import '+resolved+' from '+file);
  }
 }
 return true;
}
