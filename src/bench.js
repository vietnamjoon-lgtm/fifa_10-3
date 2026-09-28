// Developer benchmark, opened with ?qa=1&bench=1 (qa.js is replaced by an empty stub in production
// builds, so this module is never loaded there). Runs in the tester's own browser on its real GPU:
// a 22-player AI match through every quality x time-of-day preset, then a per-element render-cost
// breakdown on one frozen frame. Results are shown on screen and offered as a JSON download.
const $=id=>document.getElementById(id);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const frame=()=>new Promise(r=>requestAnimationFrame(r));
function set(id,value){const el=$(id);if(!el)return;if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new Event('change'));}
const stats=values=>{const s=[...values].sort((a,b)=>a-b),at=p=>s[Math.min(s.length-1,Math.floor((s.length-1)*p))];
 return {frames:s.length,meanFps:+(1000*s.length/values.reduce((a,b)=>a+b,0)).toFixed(1),p50Ms:+at(.5).toFixed(2),p95Ms:+at(.95).toFixed(2),p99Ms:+at(.99).toFixed(2),maxMs:+s.at(-1).toFixed(2)};};
async function sample(seconds){const times=[];let last=await frame();const end=last+seconds*1000;while(last<end){const now=await frame();times.push(now-last);last=now;}return stats(times);}
function panel(){const el=document.createElement('pre');el.id='bench-panel';el.style.cssText='position:fixed;left:12px;top:12px;z-index:60;max-width:760px;max-height:92vh;overflow:auto;background:#061712f0;color:#e8f5e0;border:1px solid #c6ff5d88;padding:12px;font:12px/1.45 ui-monospace,monospace;white-space:pre-wrap';document.body.append(el);return el;}

// Render the current frame n times with a pixel read-back so the GPU work is included in the timing.
function renderCost(qa,n=12){const {renderer,scene,camera}=qa,gl=renderer.getContext(),px=new Uint8Array(4),s=[];
 for(let i=0;i<n;i++){const t=performance.now();renderer.render(scene,camera);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);s.push(performance.now()-t);}
 s.splice(0,2);s.sort((a,b)=>a-b);return {ms:+s[Math.floor(s.length/2)].toFixed(2),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};}
function breakdown(qa){const {renderer,scene,stadium,match}=qa,field=stadium.field,rigs=match.players.map(p=>p.rig.root),out={};
 const recompile=()=>scene.traverse(o=>{if(o.material)[].concat(o.material).forEach(m=>m.needsUpdate=true);});
 out.all=renderCost(qa);
 stadium.crowdGroup.visible=false;out.withoutCrowd=renderCost(qa);stadium.crowdGroup.visible=true;
 renderer.shadowMap.enabled=false;recompile();renderCost(qa,4);out.withoutShadowMap=renderCost(qa);renderer.shadowMap.enabled=true;recompile();renderCost(qa,4);
 const shown=rigs.map(r=>r.visible);rigs.forEach(r=>r.visible=false);out.withoutPlayers=renderCost(qa);rigs.forEach((r,i)=>r.visible=shown[i]);
 field.visible=false;out.withoutPitch=renderCost(qa);field.visible=true;
 const stands=stadium.stadium.children.filter(c=>c!==field&&c!==stadium.crowdGroup);stands.forEach(c=>c.visible=false);out.withoutStandsAndGoals=renderCost(qa);stands.forEach(c=>c.visible=true);
 const ratio=renderer.getPixelRatio();renderer.setPixelRatio(ratio/2);out.halfResolution=renderCost(qa);renderer.setPixelRatio(ratio);
 return out;}

export async function runBench(){
 const out=panel(),log=text=>{out.textContent+=text+'\n';};
 log('TOUCHLINE BENCH — keep this tab focused and visible (a hidden or blurred tab pauses the match).');
 while(!window.touchlineQA?.renderer)await wait(100);
 const qa=window.touchlineQA,gl=qa.renderer.getContext(),info=gl.getExtension('WEBGL_debug_renderer_info');
 const env={userAgent:navigator.userAgent,gpu:info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),devicePixelRatio,viewport:[innerWidth,innerHeight],date:new Date().toISOString(),url:location.href};
 log(`GPU: ${env.gpu}\nviewport ${innerWidth}x${innerHeight} @${devicePixelRatio}x`);
 await wait(1500);
 // Remember the tester's display settings; they are restored when the run ends.
 const ids=['adaptiveQuality-select','shadow-select','crowd-select','timeOfDay-select','quality'],saved=ids.map(id=>{const el=$(id);return el&&(el.type==='checkbox'?el.checked:el.value);});
 set('adaptiveQuality-select',false);set('shadow-select',true);set('crowd-select',true);
 $('kickoff')?.click();await wait(200);$('setup-start')?.click();await wait(500);qa.match.autoplay=true;
 const runs=[];
 for(const timeOfDay of ['night','day'])for(const quality of ['high','medium','low']){
  set('timeOfDay-select',timeOfDay);set('quality',quality);log(`… ${timeOfDay} / ${quality}`);
  await sample(2.5);const r=await sample(10);
  runs.push({timeOfDay,quality,canvas:[qa.renderer.domElement.width,qa.renderer.domElement.height],active:qa.match.players.filter(p=>p.active).length,state:qa.match.state,...r});
  log(`   ${r.meanFps} fps · p50 ${r.p50Ms} ms · p95 ${r.p95Ms} ms · p99 ${r.p99Ms} ms`);
 }
 set('timeOfDay-select','night');set('quality','high');await sample(2);
 log('… render-cost breakdown (night / high, one frozen frame)');
 const previous=qa.match.state;qa.match.state='paused';await frame();
 const parts=breakdown(qa);qa.match.state=previous;
 for(const [k,v] of Object.entries(parts))log(`   ${k.padEnd(22)} ${String(v.ms).padStart(7)} ms · ${v.calls} calls · ${v.triangles} tris`);
 const result={env,runs,breakdown:parts};console.log('TOUCHLINE_BENCH',JSON.stringify(result));
 const a=document.createElement('a');a.textContent='\n⬇ bench.json 저장';a.style.color='#c6ff5d';a.download=`touchline-bench-${Date.now()}.json`;a.href=URL.createObjectURL(new Blob([JSON.stringify(result,null,1)],{type:'application/json'}));out.append(a);
 const copy=document.createElement('button');copy.textContent='JSON 복사';copy.style.cssText='margin-left:12px';copy.onclick=()=>navigator.clipboard?.writeText(JSON.stringify(result));out.append(copy);
 ids.forEach((id,i)=>saved[i]!==undefined&&set(id,saved[i]));
 log('\nDONE — display settings restored.');window.touchlineBench=result;return result;
}
