import {Room} from './room.js';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const codePattern=/^[A-Z2-9]{8}$/;
export default {
 async fetch(request,env){
  const url=new URL(request.url),origin=request.headers.get('Origin'),allowed=env.ALLOWED_ORIGINS.split(',');
  if(url.pathname==='/health')return json({ok:true,protocol:1,simulationHz:120,snapshotHz:25});
  if(!origin||!allowed.includes(origin))return json({error:'허용되지 않은 접속 주소입니다.'},403);
  const headers={'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Methods':'POST,GET,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'};
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  const cors=res=>{if(res.status===101)return res;const next=new Response(res.body,res);for(const [key,value]of Object.entries(headers))next.headers.set(key,value);return next;};
  try{
   if(request.method==='POST'&&url.pathname==='/rooms'){
    if(Number(request.headers.get('Content-Length'))>400000)return cors(json({error:'요청이 너무 큽니다.'},413));
    const text=await request.text();if(text.length>400000)return cors(json({error:'요청이 너무 큽니다.'},413));const data=JSON.parse(text);
    const bytes=crypto.getRandomValues(new Uint8Array(8)),alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',code=[...bytes].map(x=>alphabet[x%32]).join('');
    const stub=env.ROOMS.get(env.ROOMS.idFromName(code),{locationHint:'apac'});
    return cors(await stub.fetch(new Request('https://room/init',{method:'POST',body:JSON.stringify({...data,code})})));
   }
   const route=url.pathname.match(/^\/rooms\/([A-Z2-9]{8})\/(join|socket)$/);
   if(!route||!codePattern.test(route[1]))return cors(json({error:'방 주소를 확인해 주세요.'},404));
   const stub=env.ROOMS.get(env.ROOMS.idFromName(route[1]),{locationHint:'apac'});
   return cors(await stub.fetch(new Request('https://room/'+route[2],request)));
  }catch{return cors(json({error:'서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'},400));}
 }
};

export class TouchlineRoom{
 constructor(ctx,env){this.ctx=ctx;this.env=env;this.room=null;this.timer=null;}
 async fetch(request){
  const path=new URL(request.url).pathname;
  if(path==='/init'&&request.method==='POST'){
   if(this.room)return json({error:'이미 사용 중인 방입니다. 다시 만들어 주세요.'},409);
   const data=await request.json();this.room=new Room({code:data.code,halfSeconds:data.halfSeconds,gameplay:data.gameplay});this.timer=setInterval(()=>{this.room.tick();if(this.room.phase==='closed'){clearInterval(this.timer);this.timer=null;}},1000/60);
   return json(this.room.reserve(data.name,true,data.squad));
  }
  if(!this.room||this.room.phase==='closed')return json({error:'방이 없거나 만료됐습니다. 새 초대 링크를 받아 주세요.'},410);
  if(path==='/join'&&request.method==='POST'){
   const text=await request.text();if(text.length>400000)return json({error:'요청이 너무 큽니다.'},413);
   try{const data=JSON.parse(text);return json(this.room.reserve(data.name,false,data.squad));}catch(e){return json({error:e.message},409);}
  }
  if(path==='/socket'&&request.headers.get('Upgrade')?.toLowerCase()==='websocket'){
   const pair=new WebSocketPair(),client=pair[0],socket=pair[1];socket.accept();let team=null;
   const send=data=>socket.send(JSON.stringify(data));
   const authTimer=setTimeout(()=>{if(team===null)socket.close(1008,'Authentication required');},5000);
   socket.addEventListener('message',event=>{
    if(typeof event.data!=='string'||event.data.length>4096){socket.close(1009,'Message too large');return;}
    try{const message=JSON.parse(event.data);
     if(team===null){if(message.type!=='auth'||message.protocol!==1)throw Error('게임을 새로고침해 주세요.');team=this.room.connect(message.token,send,()=>socket.close(1000,'Session ended'));clearTimeout(authTimer);}
     else if(this.room.slots[team]?.send===send)this.room.message(team,message);
    }catch(e){send({type:'error',message:e.message||'연결 오류'});socket.close(1008,'Invalid session');}
   });
   const disconnect=()=>{clearTimeout(authTimer);if(team!==null)this.room.disconnect(team,send);};socket.addEventListener('close',disconnect);socket.addEventListener('error',disconnect);
   return new Response(null,{status:101,webSocket:client});
  }
  return json({error:'잘못된 요청입니다.'},400);
 }
}
