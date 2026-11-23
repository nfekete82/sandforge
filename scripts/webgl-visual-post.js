import * as THREE from 'three';

// Explicit opt-in on LIGHT meshes only. Sand, sky, HUD and PBR shells never
// enter the bloom mask, regardless of how bright their albedo/highlights are.
export const BLOOM_LAYER=11;
export function markTechnicalGlow(root){
 root.traverse(node=>{
  if(node.isMesh&&/^SF_EnergyCore_PBR_energy$|^SF_Bastion_Emissive_|^BastionStatic_beacon$/.test(node.name))
   node.layers.enable(BLOOM_LAYER);
 });
}
const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const blur=`uniform sampler2D inputMap;uniform vec2 direction;varying vec2 vUv;
 void main(){vec3 c=texture2D(inputMap,vUv).rgb*.4;
 c+=(texture2D(inputMap,vUv+direction).rgb+texture2D(inputMap,vUv-direction).rgb)*.24;
 c+=(texture2D(inputMap,vUv+direction*2.).rgb+texture2D(inputMap,vUv-direction*2.).rgb)*.06;
 gl_FragColor=vec4(c,1.);}`;
const composite=`
 #include <common>
 uniform sampler2D sceneMap,depthMap,bloomMap;
 uniform vec2 texel;uniform float nearPlane,farPlane,orthographic,aoStrength,bloomStrength;
 varying vec2 vUv;
 float viewDepth(vec2 uv){float d=texture2D(depthMap,uv).r;
  return orthographic>.5?mix(nearPlane,farPlane,d):nearPlane*farPlane/(farPlane-d*(farPlane-nearPlane));}
 float luma(vec3 c){return dot(c/(1.+c),vec3(.299,.587,.114));}
 void main(){
  vec3 c=texture2D(sceneMap,vUv).rgb;
  // Small, edge-directed filter in linear space. Flat textured areas retain
  // their original detail. Native canvas MSAA remains used in bypass mode.
  vec3 n=texture2D(sceneMap,vUv+vec2(0.,texel.y)).rgb;
  vec3 s=texture2D(sceneMap,vUv-vec2(0.,texel.y)).rgb;
  vec3 e=texture2D(sceneMap,vUv+vec2(texel.x,0.)).rgb;
  vec3 w=texture2D(sceneMap,vUv-vec2(texel.x,0.)).rgb;
  float l=luma(c),ln=luma(n),ls=luma(s),le=luma(e),lw=luma(w);
  float edge=max(max(ln,ls),max(le,lw))-min(min(ln,ls),min(le,lw));
  if(edge>max(.08,l*.22)){
   vec2 dir=abs(ln-ls)>abs(le-lw)?vec2(texel.x*.5,0.):vec2(0.,texel.y*.5);
   c=mix(c,(texture2D(sceneMap,vUv+dir).rgb+texture2D(sceneMap,vUv-dir).rgb)*.5,.55);
  }
  float d=viewDepth(vUv),ao=0.;
  if(aoStrength>0.&&d<farPlane*.98){
   // Four mirrored depth pairs cancel a sloped flat desert floor.
   // Range rejection prevents halos across distant terrain / black sky.
   for(int i=0;i<4;i++){
    float a=float(i)*.785398;vec2 o=vec2(cos(a),sin(a))*texel*3.;
    float d1=viewDepth(vUv+o),d2=viewDepth(vUv-o);
    float range=1.-smoothstep(18.,55.,max(abs(d-d1),abs(d-d2)));
    ao+=smoothstep(1.2,12.,2.*d-d1-d2)*range;
   }
  }
  c*=1.-ao*.25*aoStrength;
  c+=texture2D(bloomMap,vUv).rgb*bloomStrength;
  // Subtle neutral grade; no additional haze, grain, vignette or gamma.
  c=mix(vec3(dot(c,vec3(.2126,.7152,.0722))),c,.985);
  gl_FragColor=vec4(c,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`;

/** One HDR scene/depth target, explicit depth-tested light mask, two small
 * separable blurs, combined AO/AA/grade/output. No composer or normal pass.
 * ACES + sRGB conversion happen ONLY in the final framebuffer shader.
 * Render targets persist across toggles and are resized only with the canvas. */
export class SandforgeVisualPost{
 constructor(renderer,{enabled=true}={}){
  this.renderer=renderer;this.enabled=enabled;this.level=0;this.failed=false;
  this.size=new THREE.Vector2();this.width=0;this.height=0;this.targets=null;
  this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  this.blurMaterial=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:blur,
   depthTest:false,depthWrite:false,toneMapped:false,
   uniforms:{inputMap:{value:null},direction:{value:new THREE.Vector2()}}});
  this.outputMaterial=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:composite,
   depthTest:false,depthWrite:false,
   uniforms:{sceneMap:{value:null},depthMap:{value:null},bloomMap:{value:null},
    texel:{value:new THREE.Vector2()},nearPlane:{value:1},farPlane:{value:12000},
    orthographic:{value:1},aoStrength:{value:.22},bloomStrength:{value:.16}}});
  this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.outputMaterial);
  this.quad.frustumCulled=false;this.scene.add(this.quad);
 }
 setEnabled(enabled){this.enabled=!!enabled;}
 setVisualQuality(level){this.level=level;}
 ensureSize(){
  this.renderer.getDrawingBufferSize(this.size);
  const w=Math.max(1,this.size.x),h=Math.max(1,this.size.y);
  if(this.width===w&&this.height===h)return;
  this.width=w;this.height=h;
  if(!this.targets){
   const main=new THREE.WebGLRenderTarget(w,h,{type:THREE.HalfFloatType});
   main.texture.colorSpace=THREE.LinearSRGBColorSpace;
   main.depthTexture=new THREE.DepthTexture(w,h,THREE.UnsignedIntType);
   const mask=new THREE.WebGLRenderTarget(w,h,{type:THREE.HalfFloatType});
   // The mask shares the scene depth: opaque buildings/terrain occlude glow
   // without re-rendering all scenery black or swapping authored materials.
   mask.depthTexture=main.depthTexture;
   const a=new THREE.WebGLRenderTarget(Math.ceil(w/4),Math.ceil(h/4),{depthBuffer:false,type:THREE.HalfFloatType});
   const b=a.clone();this.targets={main,mask,a,b};
  }else{
   const {main,mask,a,b}=this.targets;
   main.setSize(w,h);mask.setSize(w,h);
   a.setSize(Math.ceil(w/4),Math.ceil(h/4));b.setSize(Math.ceil(w/4),Math.ceil(h/4));
  }
 }
 render(scene,camera){
  const r=this.renderer;
  if(!this.enabled||this.failed||this.level>=2){r.render(scene,camera);return;}
  const layer=camera.layers.mask,autoClear=r.autoClear,shadowUpdate=r.shadowMap.autoUpdate;
  const background=scene.background;
  try{
   this.ensureSize();const {main,mask,a,b}=this.targets;
   r.setRenderTarget(main);r.render(scene,camera);
   if(this.level===0){
    r.shadowMap.autoUpdate=false;r.autoClear=false;scene.background=null;
    camera.layers.set(BLOOM_LAYER);r.setRenderTarget(mask);r.clear(true,false,false);
    r.render(scene,camera);camera.layers.mask=layer;scene.background=background;
    r.autoClear=true;
    this.quad.material=this.blurMaterial;
    this.blurMaterial.uniforms.inputMap.value=mask.texture;
    this.blurMaterial.uniforms.direction.value.set(4/this.width,0);
    r.setRenderTarget(a);r.render(this.scene,this.camera);
    this.blurMaterial.uniforms.inputMap.value=a.texture;
    this.blurMaterial.uniforms.direction.value.set(0,1/b.height);
    r.setRenderTarget(b);r.render(this.scene,this.camera);
   }
   const u=this.outputMaterial.uniforms;
   u.sceneMap.value=main.texture;u.depthMap.value=main.depthTexture;
   u.bloomMap.value=this.level===0?b.texture:main.texture;
   u.texel.value.set(1/this.width,1/this.height);
   u.nearPlane.value=camera.near;u.farPlane.value=camera.far;
   u.orthographic.value=camera.isOrthographicCamera?1:0;
   u.aoStrength.value=this.level===0?.22:0;u.bloomStrength.value=this.level===0?.16:0;
   this.quad.material=this.outputMaterial;r.setRenderTarget(null);r.render(this.scene,this.camera);
  }catch(error){
   this.failed=true;console.warn('Sandforge Visual 3.0 disabled:',error);
   camera.layers.mask=layer;scene.background=background;r.setRenderTarget(null);r.autoClear=true;r.render(scene,camera);
  }finally{
   camera.layers.mask=layer;scene.background=background;r.autoClear=autoClear;r.shadowMap.autoUpdate=shadowUpdate;
  }
 }
 snapshot(){return {enabled:this.enabled,active:this.enabled&&!this.failed&&this.level<2,level:this.level,
  failed:this.failed,width:this.width,height:this.height};}
 dispose(){
  if(this.targets){const {main,mask,a,b}=this.targets;mask.depthTexture=null;
   mask.dispose();main.dispose();a.dispose();b.dispose();this.targets=null;}
  this.quad.geometry.dispose();this.blurMaterial.dispose();this.outputMaterial.dispose();
  this.width=0;this.height=0;
 }
}
