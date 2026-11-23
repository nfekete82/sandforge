/**
 * Adaptive, visual-only WebGL resolution controller.
 * Never changes simulation ticks, AI, pathfinding or saved game state.
 * Fixed 90-frame sample window and asymmetric hysteresis avoid oscillation.
 *
 * ?adaptive=0 disables it for visual A/B testing.
 */
export const VISUAL_RESOLUTION_SCALES=Object.freeze([1,.85,.72]);

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export class AdaptiveVisualQuality{
 constructor({renderer,effects=null,basePixelRatio=1,enabled=true}={}){
  this.renderer=renderer;
  this.effects=effects;
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
  const next=clamp(Math.round(Number(level)||0),0,VISUAL_RESOLUTION_SCALES.length-1);
  if(next===this.level)return false;
  this.level=next;
  this.lastChangeAt=now;
  this.renderer?.setPixelRatio?.(Math.max(.65,this.basePixelRatio*VISUAL_RESOLUTION_SCALES[next]));
  // Reduce only secondary smoke/dust/chips. Ignition flashes and hit
  // feedback remain fully visible even when rendering is under pressure.
  this.effects?.setVisualQuality?.(next);
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
   resolutionScale:VISUAL_RESOLUTION_SCALES[this.level],
   pixelRatio:Math.max(.65,this.basePixelRatio*VISUAL_RESOLUTION_SCALES[this.level]),
   averageFrameMs:this.lastAverageMs};
 }
}
