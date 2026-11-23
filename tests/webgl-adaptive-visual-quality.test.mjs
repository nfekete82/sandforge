import test from 'node:test';
import assert from 'node:assert/strict';
import {AdaptiveVisualQuality,VISUAL_QUALITY_STAGES} from '../scripts/webgl-adaptive-quality.js';

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

test('reduces optional post during sustained load, preserves resolution, slowly recovers',()=>{
 const {controller,ratios,levels}=setup();
 let now=feed(controller,33,230);
 assert.equal(controller.level,1);
 assert.deepEqual(ratios,[]);
 assert.deepEqual(levels,[]);
 now=feed(controller,16,1100,now);
 assert.equal(controller.level,0);
 assert.deepEqual(ratios,[]);
 assert.deepEqual(levels,[]);
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
 assert.equal(controller.level,VISUAL_QUALITY_STAGES.length-1);
 assert.equal(controller.setLevel(99,6000),false);
 assert.equal(controller.setLevel(-1,18000),true);
 assert.deepEqual(levels,[2,0]);
});

test('post, particles, decorative shadows, then resolution; restoration reverses order',()=>{
 const calls=[];
 const controller=new AdaptiveVisualQuality({renderer:{setPixelRatio:v=>calls.push(['resolution',v])},
  effects:{setVisualQuality:v=>calls.push(['particles',v])},
  post:{setVisualQuality:v=>calls.push(['post',v])},lod:{setVisualQuality:v=>calls.push(['decor',v])}});
 for(let i=1;i<8;i++)controller.setLevel(i,i*5000);
 assert.deepEqual(calls,[['post',1],['post',2],['particles',1],['particles',2],['decor',1],['resolution',.85],['resolution',.72]]);
 calls.length=0;
 for(let i=6;i>=0;i--)controller.setLevel(i,100000-i*12000);
 assert.deepEqual(calls,[['resolution',.85],['resolution',1],['decor',0],['particles',1],['particles',0],['post',1],['post',0]]);
});

test('one short hitch amid stable frames never changes quality',()=>{
 const {controller,ratios}=setup();let now=feed(controller,16.7,150);
 now+=100;controller.observe(100,now);
 feed(controller,16.7,700,now);
 assert.equal(controller.level,0);assert.deepEqual(ratios,[]);
});
