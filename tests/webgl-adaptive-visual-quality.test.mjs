import test from 'node:test';
import assert from 'node:assert/strict';
import {AdaptiveVisualQuality,VISUAL_RESOLUTION_SCALES} from '../scripts/webgl-adaptive-quality.js';

const setup=()=>{
 const ratios=[],levels=[];
 const renderer={setPixelRatio:ratio=>ratios.push(ratio)};
 const effects={setVisualQuality:level=>levels.push(level)};
 return {controller:new AdaptiveVisualQuality({renderer,effects,basePixelRatio:1.6}),ratios,levels};
};
const feed=(controller,ms,frames,now=0,settings={})=>{
 for(let i=0;i<frames;i++){
  now+=ms;controller.observe(ms,now,settings);
 }
 return now;
};

test('reduces resolution during a sustained slow battle and recovers only after stability',()=>{
 const {controller,ratios,levels}=setup();
 let now=feed(controller,33,230);
 assert.equal(controller.level,1);
 assert.equal(ratios.at(-1),1.6*VISUAL_RESOLUTION_SCALES[1]);
 assert.deepEqual(levels,[1]);
 now=feed(controller,16,1100,now);
 assert.equal(controller.level,0);
 assert.equal(ratios.at(-1),1.6);
 assert.equal(levels.at(-1),0);
});

test('does not react to an isolated hitch, paused game or hidden tab',()=>{
 const {controller,ratios}=setup();
 let now=feed(controller,16,120);
 now+=1200;controller.observe(1200,now,{visible:false});
 now=feed(controller,16,80,now,{running:false});
 now=feed(controller,16,100,now);
 assert.equal(controller.level,0);
 assert.deepEqual(ratios,[]);
});

test('visual quality never changes gameplay state and can be disabled',()=>{
 const renderer={setPixelRatio:()=>{throw Error('disabled controller changed quality');}};
 const controller=new AdaptiveVisualQuality({renderer,enabled:false});
 feed(controller,40,400);
 assert.equal(controller.snapshot().level,0);
 assert.equal(controller.snapshot().enabled,false);
});

test('manual quality levels are bounded and secondary-effects budget follows',()=>{
 const {controller,levels}=setup();
 assert.equal(controller.setLevel(99,5000),true);
 assert.equal(controller.level,2);
 assert.equal(controller.setLevel(3,6000),false);
 assert.equal(controller.setLevel(-1,18000),true);
 assert.deepEqual(levels,[2,0]);
});
