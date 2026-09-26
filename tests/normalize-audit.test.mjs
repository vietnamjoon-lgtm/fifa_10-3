import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAudit} from '../tools/normalize-audit.mjs';

const frame=interval=>({interval,render:2,simulation:1,animation:1,calls:100,triangles:1000});
const raw=frames=>({label:'fixture',valid:true,wallSeconds:310.2,hiddenFrames:0,measuredSeconds:frames.reduce((s,f)=>s+f.interval,0)/1000,frames});

test('normalization clips one boundary only, preserves real stalls and source samples',()=>{
 const source=raw([frame(66.6),frame(66.9),...Array.from({length:2997},()=>frame(100)),frame(243.9)]);
 const before=JSON.stringify(source),result=normalizeAudit(source,'fixture');
 assert.equal(result.window.discardedFrameCount,1);
 assert.ok(Math.abs(result.window.discardedMs-66.6)<1e-7);
 assert.ok(Math.abs(result.window.clippedMs-10.8)<1e-7);
 assert.ok(Math.abs(result.window.firstRetainedIntervalMs-56.1)<1e-7);
 assert.equal(result.frameMs.max,243.9);
 assert.ok(Math.abs(result.frameMs.mean*result.frameMs.count-300000)<1e-7);
 assert.equal(JSON.stringify(source),before);
 const warmup=raw([frame(11794.7),...Array.from({length:2984},()=>frame(100)),frame(77.9)]);
 const clipped=normalizeAudit(warmup);
 assert.equal(clipped.window.discardedFrameCount,0);
 assert.ok(clipped.window.firstRetainedIntervalMs>1500);
 assert.equal(clipped.cpu.render.count,warmup.frames.length);
});

test('normalization rejects a suspended/hidden/short capture, including the two-hour signature',()=>{
 const source=raw(Array.from({length:3000},()=>frame(100)));
 for(const change of [{wallSeconds:7676.38},{hiddenFrames:1},{valid:false},{frames:[frame(213923.4)]},{frames:[{...frame(300000),render:7452089.2}]}]){
  assert.throws(()=>normalizeAudit({...source,...change}),/invalid|duration|Hidden|300 seconds|interruption/);
 }
 assert.equal(normalizeAudit(source).window.clippedMs,0);
});
