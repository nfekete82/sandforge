import * as THREE from 'three';

/**
 * Sandforge's second-generation desert material: three coordinated *real*
 * tiling color textures, blended IN the existing MeshStandardMaterial's PBR
 * shader.  No flat decal, second ground mesh, image-lit highlight, shader
 * noise loop or extra draw call.  The authored dune photograph stays the main
 * albedo; these two fine details fill otherwise featureless open terrain.
 *
 * All noise is baked ONCE on startup as RGBA DataTextures (256px), not in
 * the per-frame render loop. Texture coordinates derive from continuous local
 * world geometry, so there are no seams across the 16 ground chunks and no
 * moving pattern on model/building previews.
 */
export const DESERT_SURFACE_DETAIL=Object.freeze({
 revision:'nonperiodic-natural-desert-sediment-v5-20261116',
 size:512,
 windTileMetres:540,
 siltTileMetres:235,
 gritTileMetres:48,
 coverageTileMetres:1780,
 coverageStrength:.43,
 gritStrength:.11,
 rippleTileMetres:285,
 rippleStrength:.22
});
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const mix=(a,b,t)=>a+(b-a)*t;
const ease=t=>t*t*(3-2*t);
const hash=(x,y,seed)=>{
 let h=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+seed)|0;
 h=Math.imul(h^(h>>>13),1274126177);
 return ((h^(h>>>16))>>>0)/4294967296;
};
// Signed, periodic and seamlessly repeating VALUE noise.
function tiledNoise(u,v,f,seed){
 const X=u*f,Y=v*f,ix=Math.floor(X),iy=Math.floor(Y);
 const fx=ease(X-ix),fy=ease(Y-iy);
 const x=((ix%f)+f)%f,y=((iy%f)+f)%f,x1=(x+1)%f,y1=(y+1)%f;
 return mix(
  mix(hash(x,y,seed),hash(x1,y,seed),fx),
  mix(hash(x,y1,seed),hash(x1,y1,seed),fx),fy);
}
const rgba=(data,index,r,g,b)=>{
 data[index]=Math.round(clamp(r,0,255));
 data[index+1]=Math.round(clamp(g,0,255));
 data[index+2]=Math.round(clamp(b,0,255));
 data[index+3]=255;
};
function makeTexture(data,size,renderer,{srgb=true,name=''}={}){
 const tex=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
 tex.name=name;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
 tex.minFilter=THREE.LinearMipmapLinearFilter;
 tex.magFilter=THREE.LinearFilter;
 tex.generateMipmaps=true;
 tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 if(srgb)tex.colorSpace=THREE.SRGBColorSpace;
 tex.needsUpdate=true;
 return tex;
}
export function createDesertSurfaceDetail(renderer){
 const size=DESERT_SURFACE_DETAIL.size,count=size*size;
 const grit=new Uint8Array(count*4);
 const silt=new Uint8Array(count*4);
 const mask=new Uint8Array(count*4);
 const ripples=new Uint8Array(count*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,index=(y*size+x)*4;
  // Repeatable surface patterns: dusty compacted silt, wind-carved ripples,
  // mineral particles and tiny pits. No white spots and no sharp color jumps.
  const broad=tiledNoise(u,v,3,0x7a11b5);
  const medium=tiledNoise(u,v,11,0x12881c);
  const fine=tiledNoise(u,v,42,0x4cab90);
  const tiny=tiledNoise(u,v,92,0x55aa91);
  // Multi-frequency non-directional sediment instead of the repeating
  // 18-cycle sine bands that looked like display scanlines in the sand.
  const softenedGrain=.56*medium+.44*fine;
  const dust=.56*broad+.29*medium+.15*fine;
  // Silt is a mildly more compact and striated sand; no dark crust islands.
  // Sand/silt/powder alternation is genuinely visible at RTS scale,
  // unlike the old +/-3 RGB texture hidden under the terrain albedo.
  const s=clamp((dust-.5)*1.32+.12*(softenedGrain-.5),-.40,.40);
  rgba(silt,index,
   207+38*s+10*(tiny-.5),
   187+33*s+8*(tiny-.5),
   155+30*s+6*(tiny-.5));
  // Subtle dense grain with very small occluded quartz/mineral specks.
  const fleck=tiny>.83?-.075:tiny<.16?-.060:0;
  const g=(fine-.5)*.35+(medium-.5)*.13+fleck;
  rgba(grit,index,
   212+67*g,193+63*g,166+60*g);
  // World-size sediment pockets appear through a low-frequency,
  // seamless coverage mask rather than painted white cloud overlays.
  const patch=.61*tiledNoise(u,v,4,0x8ac361)+
   .27*tiledNoise(u,v,9,0x207bec)+.12*tiledNoise(u,v,21,0x4923dc);
  const m=clamp(.58+1.45*(patch-.49));
  // Independent wind/ridge envelopes stored in spare texture channels;
  // PBR uses one sampled mask and only the original terrain mesh.
  const wind=clamp(.55+.40*(tiledNoise(u,v,6,0x917ab1)-.5)+.08*(medium-.5));
  const dune=clamp(.48+.45*(tiledNoise(u,v,3,0x62b2e0)-.5)+.28*(broad-.5));
  rgba(mask,index,m*255,wind*255,dune*255);
  // Warped, seam-periodic dune ripples baked once; unlike the former plain
  // cosine lines these never form straight, evenly spaced screen bands.
  const warp=(tiledNoise(u,v,7,0x238c9a)-.5)*5.4+
   (tiledNoise(u,v,15,0x3b2071)-.5)*1.8;
  const phase=u*37+v*7+warp;
  const secondary=u*71-v*17+warp*.83+
   (tiledNoise(u,v,11,0x77d913)-.5)*2.7;
  const triangle=t=>1-Math.abs(2*(t-Math.floor(t))-1);
  const broadRipple=ease(triangle(phase));
  const fineRipple=ease(triangle(secondary));
  const ripple=clamp(.5+(broadRipple-.5)*.72+(fineRipple-.5)*.22+
   (fine-.5)*.16);
  rgba(ripples,index,ripple*255,(.5+(fineRipple-.5)*.74)*255,wind*255);
 }
 return Object.freeze({
  silt:makeTexture(silt,size,renderer,{name:'SandforgeSiltPBRColor'}),
  grit:makeTexture(grit,size,renderer,{name:'SandforgeFineMineralGrain'}),
  mask:makeTexture(mask,size,renderer,{srgb:false,name:'SandforgeSedimentCoverage'}),
  ripples:makeTexture(ripples,size,renderer,{srgb:false,name:'SandforgeWindCarvedRippleRelief'})
 });
}

export function installDesertSurfaceDetail(material,renderer){
 if(material.userData?.sandforgeSurfaceDetail)return material.userData.sandforgeSurfaceDetail;
 const maps=createDesertSurfaceDetail(renderer);
 const revision=DESERT_SURFACE_DETAIL.revision;
 const previous=material.onBeforeCompile;
 material.onBeforeCompile=function(shader,r){
  previous.call(this,shader,r);
  shader.uniforms.sfDesertSilt={value:maps.silt};
  shader.uniforms.sfDesertGrain={value:maps.grit};
  shader.uniforms.sfDesertMask={value:maps.mask};
  shader.uniforms.sfDesertRipples={value:maps.ripples};
  const varying='varying vec2 sfDesertGround; varying float sfDesertRelief;';
  shader.vertexShader=shader.vertexShader.replace('#include <common>',
   '#include <common>\n'+varying);
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
   '#include <begin_vertex>\nsfDesertGround=position.xz;sfDesertRelief=1.0-clamp(normal.y,0.0,1.0);');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
   '#include <common>\n'+varying+'\nuniform sampler2D sfDesertSilt;\nuniform sampler2D sfDesertGrain;\nuniform sampler2D sfDesertMask;\nuniform sampler2D sfDesertRipples;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',[
   '#include <map_fragment>',
   '// Single surface, three physical colour textures; no second mesh.',
   'vec3 sfDesertZoning=texture2D(sfDesertMask,sfDesertGround/'+DESERT_SURFACE_DETAIL.coverageTileMetres.toFixed(1)+').rgb;',
   'float sfBedMask=smoothstep(.30,.76,sfDesertZoning.r);',
   'float sfDuneZone=clamp(.16+sfDesertZoning.b*.75+smoothstep(.012,.17,sfDesertRelief)*.24,0.0,1.0);',
   'float sfWindZone=clamp(.22+sfDesertZoning.g*.58+sfDuneZone*.22,0.0,1.0);',
   '// Two scales at different rotations break the straight, repeating photo-tile look.',
   'vec2 sfSandTwist=vec2(.8660254*sfDesertGround.x-.5*sfDesertGround.y,.5*sfDesertGround.x+.8660254*sfDesertGround.y);',
   'vec3 sfSediment=texture2D(sfDesertSilt,sfDesertGround/'+DESERT_SURFACE_DETAIL.siltTileMetres.toFixed(1)+').rgb;',
   'sfSediment=mix(sfSediment,texture2D(sfDesertSilt,sfSandTwist/'+(DESERT_SURFACE_DETAIL.siltTileMetres*1.61).toFixed(1)+').rgb,.32);',
   'vec3 sfMineral=texture2D(sfDesertGrain,sfDesertGround/'+DESERT_SURFACE_DETAIL.gritTileMetres.toFixed(1)+').rgb;',
   'sfMineral=mix(sfMineral,texture2D(sfDesertGrain,sfSandTwist/'+(DESERT_SURFACE_DETAIL.gritTileMetres*.47).toFixed(1)+').rgb,.22);',
   'float sfWindDrift=texture2D(sfDesertMask,sfSandTwist/'+DESERT_SURFACE_DETAIL.windTileMetres.toFixed(1)+').g;',
   'vec2 sfRippleUV=sfSandTwist/'+DESERT_SURFACE_DETAIL.rippleTileMetres.toFixed(1)+';',
   'vec3 sfWindRipples=texture2D(sfDesertRipples,sfRippleUV).rgb;',
   'float sfRippleShade=(sfWindRipples.r-.5)*'+DESERT_SURFACE_DETAIL.rippleStrength.toFixed(3)+';',
   'diffuseColor.rgb=mix(diffuseColor.rgb,sfSediment,sfBedMask*'+DESERT_SURFACE_DETAIL.coverageStrength.toFixed(2)+');',
   'diffuseColor.rgb=mix(diffuseColor.rgb,sfMineral,'+DESERT_SURFACE_DETAIL.gritStrength.toFixed(3)+'*(.42+.5*sfBedMask));',
   '// Soft broad dune/hollow shading, continuous over all terrain chunks.',
   'diffuseColor.rgb*=1.0+(.5-sfDesertZoning.r)*.063+(sfDuneZone-.5)*.034+(sfWindDrift-.5)*.044;',
   '// Soft sunlit ridges and sheltered troughs in the actual PBR ground material.',
   'diffuseColor.rgb*=clamp(1.0+sfRippleShade*sfWindZone,.88,1.12);'
  ].join('\n'));
  // Wind ripple bump relief fades naturally in sheltered/flat areas while
  // staying visible on exposed dunes. Keep the physical Three.js normal map.
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',
   'vec3 sfFlatSandNormal=normal;\n#include <normal_fragment_maps>\nnormal=normalize(mix(sfFlatSandNormal,normal,sfWindZone));');
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',
   '#include <roughnessmap_fragment>\nroughnessFactor=clamp(mix(roughnessFactor,.94,sfBedMask*.16)+(sfDuneZone-.5)*.022,.89,.985);');
 };
 material.customProgramCacheKey=()=>revision;
 material.userData={...material.userData,
  sandforgeSurfaceDetail:maps,
  sandforgeSurfaceDetailRevision:revision};
 material.needsUpdate=true;
 return maps;
}
