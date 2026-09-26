// Local-only evidence receiver; never part of the deployed build.
import http from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'.'),output=path.resolve(process.argv[3]||'reports/match-polish'),port=Number(process.env.PORT||4191);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.wasm':'application/wasm'};
await mkdir(output,{recursive:true});
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,`http://127.0.0.1:${port}`);
 if(req.method==='POST'&&url.pathname==='/__audit/evidence'){
  if(req.headers.origin!==`http://127.0.0.1:${port}`){res.writeHead(403).end();return;}
  const name=url.searchParams.get('name');if(!/^touchline-[a-z0-9-]+\.(png|json)$/.test(name||'')){res.writeHead(400).end();return;}
  let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>20*1024*1024){res.writeHead(413).end();return;}chunks.push(chunk);}
  await writeFile(path.join(output,name),Buffer.concat(chunks));res.writeHead(201).end('saved');return;
 }
 if(req.method!=='GET'){res.writeHead(405).end();return;}
 const pathname=decodeURIComponent(url.pathname),file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)||pathname.startsWith('/tools/')||pathname.includes('..')){res.writeHead(403).end();return;}
 const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}).end(data);
 }catch{res.writeHead(404).end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Local audit http://127.0.0.1:${port}`));
