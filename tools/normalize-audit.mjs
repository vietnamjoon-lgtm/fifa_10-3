// Run from the repository root: node tools/normalize-audit.mjs [output.json input.json ...]
// This only writes a derived summary; input evidence is never modified.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const cpuKeys=['simulation','physics','animation','skinning','shadowCpu','render'];
const stats=values=>{
 const sorted=[...values].sort((a,b)=>a-b);
 return {count:values.length,mean:values.reduce((a,b)=>a+b,0)/values.length,p95:sorted[Math.floor((sorted.length-1)*.95)],max:sorted.at(-1)};
};
export const method={
 window:'The last exactly 300000 ms of the recorded raw frame-interval sequence, ending at the final recorded frame. This is an interval-relative window: absolute RAF timestamps were not exported.',
 clipping:'Remove whole leading intervals outside the window, then clip only the first retained interval. Keep every other interval and every retained frame cost unchanged, including real stalls.',
 statistics:'FPS is retained frame count / 300 seconds; interval mean/P95/max use the clipped boundary interval. CPU/draw/triangle statistics use retained whole-frame samples, without prorating the boundary frame. P95 uses floor((count - 1) * 0.95), matching the recorder.',
 gpu:'Raw GPU query samples/timestamps were not exported, so the original aggregate is retained separately as gpuOriginalReferenceOnly, not recalculated or claimed as this exact 300-second window.',
 validity:'Reject hidden frames, a source explicitly marked invalid, wall time outside [310,330) seconds, missing/invalid frame intervals, less than 300 recorded seconds, or a render call of 10000 ms or more.',
 caveat:'Normalization corrects a warmup-boundary bookkeeping error; it cannot make different gameplay sequences/cameras/teams identical or remove genuine performance regressions.'
};

export function normalizeAudit(raw,rawSource='unknown'){
 const errors=[];
 if(raw.valid===false)errors.push('Source explicitly marked invalid');
 if(raw.hiddenFrames!==0)errors.push('Hidden-frame count must be zero');
 if(!Number.isFinite(raw.wallSeconds)||raw.wallSeconds<310||raw.wallSeconds>=330)errors.push('Wall duration outside [310,330) seconds');
 if(!Array.isArray(raw.frames)||!raw.frames.length)errors.push('No raw frame samples');
 const frames=raw.frames||[];
 if(frames.some(f=>!Number.isFinite(f.interval)||f.interval<=0))errors.push('Frame intervals must be finite and positive');
 if(frames.some(f=>!Number.isFinite(f.render)||f.render>=10000))errors.push('Invalid render cost or render interruption >=10000 ms');
 const recordedMs=frames.reduce((sum,f)=>sum+f.interval,0);
 if(!Number.isFinite(recordedMs)||recordedMs<300000)errors.push('Less than 300 seconds of recorded intervals');
 if(errors.length)throw new Error(`${rawSource}: ${errors.join('; ')}`);

 // Work backwards so rounding in a large discarded prefix cannot change the window.
 let remaining=300000,index=frames.length,firstIntervalMs=0;
 while(index>0&&remaining>0){
  index--;
  firstIntervalMs=Math.min(frames[index].interval,remaining);
  remaining-=firstIntervalMs;
 }
 const retained=frames.slice(index),intervals=retained.map((f,i)=>i===0?firstIntervalMs:f.interval);
 const clippedMs=frames[index].interval-firstIntervalMs;
 const discardedMs=frames.slice(0,index).reduce((sum,f)=>sum+f.interval,0);
 return {
  rawSource,label:raw.label,valid:true,method,environment:raw.environment,
  original:{wallSeconds:raw.wallSeconds,measuredSeconds:raw.measuredSeconds,recordedIntervalMs:recordedMs,frameCount:frames.length,firstIntervalMs:frames[0].interval,valid:raw.valid??null},
  window:{measuredSeconds:300,firstRawFrameIndex:index,lastRawFrameIndex:frames.length-1,retainedFrameCount:retained.length,discardedFrameCount:index,discardedMs,clippedMs,totalRemovedMs:discardedMs+clippedMs,firstRetainedOriginalIntervalMs:frames[index].interval,firstRetainedIntervalMs:firstIntervalMs},
  averageFps:retained.length/300,frameMs:stats(intervals),
  stalls:{over100ms:intervals.filter(t=>t>100).length,over200ms:intervals.filter(t=>t>200).length,over1000ms:intervals.filter(t=>t>1000).length},
  cpu:Object.fromEntries(cpuKeys.map(key=>[key,stats(retained.map(f=>f[key]||0))])),
  drawCalls:stats(retained.map(f=>f.calls)),triangles:stats(retained.map(f=>f.triangles)),
  gpuOriginalReferenceOnly:raw.gpuRenderMs,
  notes:['Physics is included in simulation; skinning and shadow CPU are included in render. Do not add these nested values.','The boundary CPU sample is retained in full because no within-frame timestamps exist. All reported frame stalls inside the chosen window remain.']
 };
}

async function main(){
 const defaults=['reports/match-polish/touchline-upstream-e40fa61-match.json','reports/match-polish/touchline-final-e4c9240-match.json','reports/match-polish/touchline-final-integrated-match.json'];
 const [output='reports/match-polish-normalized.json',...args]=process.argv.slice(2),inputs=args.length?args:defaults;
 if(inputs.some(input=>resolve(input)===resolve(output)))throw new Error('Output must differ from every raw source');
 const result={version:1,method,runs:[],rejected:[]};
 for(const rawSource of inputs){
  const text=await readFile(rawSource,'utf8'),raw=JSON.parse(text),sha256=createHash('sha256').update(text).digest('hex');
  try{result.runs.push({...normalizeAudit(raw,rawSource),rawSha256:sha256});}
  catch(error){result.rejected.push({rawSource,rawSha256:sha256,label:raw.label,wallSeconds:raw.wallSeconds,measuredSeconds:raw.measuredSeconds,renderMaxMs:raw.cpu?.render?.max,reason:error.message});}
 }
 await writeFile(output,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({output,runs:result.runs.map(r=>({label:r.label,fps:r.averageFps,p95:r.frameMs.p95,max:r.frameMs.max,clippedMs:r.window.clippedMs,discardedMs:r.window.discardedMs})),rejected:result.rejected.map(r=>r.rawSource)},null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
