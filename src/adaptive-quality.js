// Presentation only: never changes simulation tick rate, input or saved quality.
export class AdaptiveQuality {
 constructor(){this.reset();}
 reset(){this.scale=1;this.elapsed=0;this.window=[];this.windowTime=0;this.cooldown=6;}
 update(dt,enabled=true){
  if(!enabled){const changed=this.scale!==1;this.reset();return changed;}
  if(!Number.isFinite(dt)||dt<=0||dt>.25)return false;
  this.elapsed+=dt;this.cooldown=Math.max(0,this.cooldown-dt);this.window.push(dt);this.windowTime+=dt;
  if(this.windowTime<3)return false;
  const sorted=this.window.sort((a,b)=>a-b),mean=this.windowTime/sorted.length,p95=sorted[Math.floor((sorted.length-1)*.95)];
  this.window=[];this.windowTime=0;if(this.cooldown>0)return false;
  const previous=this.scale;
  if(mean>1/34&&p95>.038)this.scale=Math.max(.7,Math.round((this.scale-.1)*10)/10);
  else if(mean<1/48&&p95<.027)this.scale=Math.min(1,Math.round((this.scale+.1)*10)/10);
  if(previous===this.scale)return false;this.cooldown=this.scale<previous?6:18;return true;
 }
}
