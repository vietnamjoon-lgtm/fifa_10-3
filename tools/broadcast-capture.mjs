// Deterministic scene capture for camera/pitch/lighting before-after comparison.
// Requires a local server (node server.mjs) and Playwright's Chromium (not a repo dependency).
// Time is virtual: requestAnimationFrame/performance.now are driven by the script and
// Math.random is seeded, so two builds replay the identical AI match frame for frame.
// Usage: node tools/broadcast-capture.mjs <baseUrl> <outDir> [shots|video|fps] [--night] [--quality high]
import fs from 'node:fs';
import path from 'node:path';
const playwrightPath=process.env.PLAYWRIGHT_MODULE||'/opt/node22/lib/node_modules/playwright/index.mjs';
const {chromium}=await import(playwrightPath);
const positional=process.argv.slice(2).filter((a,i,all)=>!a.startsWith('--')&&!['--quality','--only'].includes(all[i-1]));
const [base='http://127.0.0.1:4173',out='captures',mode='shots']=positional;
const night=process.argv.includes('--night'),qi=process.argv.indexOf('--quality'),quality=qi>0?process.argv[qi+1]:'high',oi=process.argv.indexOf('--only'),only=oi>0?process.argv[oi+1].split(','):null,want=name=>!only||only.includes(name);
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(180000);
page.on('pageerror',e=>console.error('pageerror',e.message));
const settings={quality,adaptiveQuality:false,timeOfDay:night?'night':'day',halfSeconds:600,sound:false};
await page.addInitScript(([settings,virtual])=>{
 try{localStorage.setItem('touchline-settings',JSON.stringify(settings));}catch{}
 if(!virtual)return;
 let now=0,seed=12345;const queue=[];
 performance.now=()=>now;window.requestAnimationFrame=cb=>{queue.push(cb);return queue.length;};
 Math.random=()=>((seed=(seed*1103515245+12345)%2147483648)/2147483648);
 window.__advance=(frames,dt)=>{for(let i=0;i<frames;i++){now+=dt*1000;for(const cb of queue.splice(0))cb(now);}};
},[settings,mode!=='fps']);
await page.goto(base+'/?qa=1');
await page.waitForFunction(()=>window.touchlineQA&&window.touchline);
await page.waitForTimeout(1500);
const advance=(seconds,dt=1/30)=>page.evaluate(([n,dt])=>window.__advance(n,dt),[Math.round(seconds/dt),dt]);
const state=()=>page.evaluate(()=>{const m=window.touchlineQA.match,b=m.physics.ball;return {state:m.state,time:m.time,x:b.position.x,y:b.position.y,z:b.position.z,speed:Math.hypot(b.velocity.x,b.velocity.z)};});
async function kickoff(){
 if(mode!=='fps')await advance(.2);
 await page.evaluate(()=>{document.getElementById('kickoff').click();document.getElementById('setup-start').click();});
 await page.evaluate(()=>{window.touchlineQA.match.autoplay=true;});
}
// Fast-forward at a tiny viewport (SwiftShader cost scales with pixels); the simulation is
// unaffected, and the view is restored and settled for a second before any capture.
async function until(test,limit=90,step=.2){await page.setViewportSize({width:320,height:180});try{for(let t=0;t<limit;t+=step){const s=await state();if(test(s))return s;await advance(step,1/20);}throw Error('scene not reached');}finally{await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(1500);}}
// Give the compositor a real-time moment to present the last virtual-time frame.
const shot=async name=>{await page.evaluate(()=>{document.getElementById('qa-panel')?.remove();});await page.waitForTimeout(400);await page.screenshot({path:path.join(out,name+'.png')});console.log('saved',name,JSON.stringify(await state()));};
if(mode==='shots'){
 await kickoff();
 await until(s=>s.state==='playing'||s.state==='kickoff',30);await advance(1.2,1/60);await shot(night?'night-kickoff':'kickoff');
 if(!night&&(want('long-pass')||want('box'))){
  if(want('long-pass')||want('box')){await until(s=>s.state==='playing'&&s.time>3&&s.y>1.4&&s.speed>15);await advance(.25,1/60);if(want('long-pass'))await shot('long-pass');}
  if(want('box')){await until(s=>s.state==='playing'&&s.time>6&&Math.abs(s.x)>37&&Math.abs(s.z)<19,240);await advance(.6,1/60);await shot('box');}
 }
}else if(mode==='video'){
 // Same 16 s of AI play for both builds: frames at 30 fps, encoded afterwards with ffmpeg.
 await kickoff();await until(s=>s.state==='playing',30);await advance(3);
 // Read the canvas in the same task as the render (no preserveDrawingBuffer needed); HUD excluded.
 for(let i=0;i<480;i++){const data=await page.evaluate(()=>{window.__advance(1,1/30);return document.getElementById('scene').toDataURL('image/jpeg',.88);});
  fs.writeFileSync(path.join(out,`f${String(i).padStart(4,'0')}.jpg`),Buffer.from(data.split(',')[1],'base64'));}
}else if(mode==='fps'){
 // Real time: 22-player AI match; report mean fps and p95 frame time over 20 s.
 await kickoff();await page.waitForTimeout(4000);
 const result=await page.evaluate(()=>new Promise(resolve=>{const times=[];let last=performance.now();const start=last;const tick=now=>{times.push(now-last);last=now;if(now-start<20000)requestAnimationFrame(tick);else{const s=[...times].sort((a,b)=>a-b);resolve({frames:times.length,meanFps:+(1000*times.length/(now-start)).toFixed(2),p50Ms:+s[Math.floor(s.length*.5)].toFixed(1),p95Ms:+s[Math.floor(s.length*.95)].toFixed(1),active:window.touchlineQA.match.players.filter(p=>p.active).length,drawCalls:window.touchline.snapshot().drawCalls});}};requestAnimationFrame(tick);}));
 console.log(JSON.stringify({base,quality,night,...result}));
}
await browser.close();
