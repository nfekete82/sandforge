/**
 * Adaptive, visual-only WebGL resolution controller.
 * Never changes simulation ticks, AI, pathfinding or saved game state.
 * Fixed 90-frame sample window and asymmetric hysteresis avoid oscillation.
 *
 * ?adaptive=0 disables it for visual A/B testing.
 */
export const VISUAL_RESOLUTION_SCALES=Object.freeze([1,.85,.72]);
// Extend the reviewed #467 controller; resolution is now the LAST resort.
export const VISUAL_QUALITY_STAGES=Object.freeze([
 {post:0,particles:0,decoration:0,resolution:1},
 {post:1,particles:0,decoration:0,resolution:1},
 {post:2,particles:0,decoration:0,resolution:1},
 {post:2,particles:1,decoration:0,resolution:1},
 {post:2,particles:2,decoration:0,resolution:1},
 {post:2,particles:2,decoration:1,resolution:1},
 {post:2,particles:2,decoration:1,resolution:.85},
 {post:2,particles:2,decoration:1,resolution:.72}
].map(Object.freeze));

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export class AdaptiveVisualQuality{
 constructor({renderer,effects=null,post=null,lod=null,basePixelRatio=1,enabled=true}={}){
  this.renderer=renderer;
  this.effects=effects;
  this.post=post;this.lod=lod;
  this.basePixelRatio=clamp(Number(basePixelRatio)||1,.65,2.5);
  this.enabled=enabled;
  this.level=0;
  this.frames=new Float32Array(90);
  this.count=0;this.cursor=0;
  this.badWindows=0;this.goodWindows=0;
  this.lastEvaluation=0;this.lastChangeAt=0;
  this.lastAverageMs=0;
 }
 clearSamples(){
  this.count=0;this.cursor=0;this.badWindows=0;this.goodWindows=0;
  this.lastEvaluation=0;
 }
 setLevel(level,now=0){
  const next=clamp(Math.round(Number(level)||0),0,VISUAL_QUALITY_STAGES.length-1);
  if(next===this.level)return false;
  const before=VISUAL_QUALITY_STAGES[this.level],stage=VISUAL_QUALITY_STAGES[next];
  this.level=next;
  this.lastChangeAt=now;
  if(stage.resolution!==before.resolution)
   this.renderer?.setPixelRatio?.(Math.max(.65,this.basePixelRatio*stage.resolution));
  // Reduce only secondary smoke/dust/chips. Ignition flashes and hit
  // feedback remain fully visible even when rendering is under pressure.
  if(stage.particles!==before.particles)this.effects?.setVisualQuality?.(stage.particles);
  if(stage.post!==before.post)this.post?.setVisualQuality?.(stage.post);
  if(stage.decoration!==before.decoration)this.lod?.setVisualQuality?.(stage.decoration);
  this.clearSamples();
  return true;
 }
 observe(frameMs,now,{running=true,visible=true}={}){
  if(!this.enabled||!running||!visible){
   this.clearSamples();return false;
  }
  // A suspended tab or debugger pause is not evidence of a slow GPU.
  if(!Number.isFinite(frameMs)||frameMs<=0||frameMs>200){
   this.clearSamples();return false;
  }
  this.frames[this.cursor]=frameMs;
  this.cursor=(this.cursor+1)%this.frames.length;
  this.count=Math.min(this.count+1,this.frames.length);
  if(this.count<this.frames.length||now-this.lastEvaluation<1800)return false;
  this.lastEvaluation=now;
  let sum=0;
  for(let i=0;i<this.count;i++)sum+=this.frames[i];
  const avg=sum/this.count;
  this.lastAverageMs=avg;
  if(avg>24){
   this.badWindows++;this.goodWindows=0;
  }else if(avg<17){
   this.goodWindows++;this.badWindows=0;
  }else{
   this.badWindows=0;this.goodWindows=0;
  }
  // Downscale faster than we restore quality; never thrash the GPU
  // texture allocation after one isolated battle-frame spike.
  if(this.badWindows>=2&&now-this.lastChangeAt>=5000)
   return this.setLevel(this.level+1,now);
  if(this.goodWindows>=5&&now-this.lastChangeAt>=12000)
   return this.setLevel(this.level-1,now);
  return false;
 }
 snapshot(){
  return {enabled:this.enabled,level:this.level,
   ...VISUAL_QUALITY_STAGES[this.level],
   resolutionScale:VISUAL_QUALITY_STAGES[this.level].resolution,
   pixelRatio:Math.max(.65,this.basePixelRatio*VISUAL_QUALITY_STAGES[this.level].resolution),
   averageFrameMs:this.lastAverageMs};
 }
}
