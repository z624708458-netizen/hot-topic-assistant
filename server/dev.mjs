// Loopback-only dev server: no real API calls unless explicitly configured by the user.
import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {database} from './sqlite.mjs';
import worker from './worker.mjs';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),port=Number(process.env.PORT||8876);
await mkdir(path.join(root,'.local'),{recursive:true});const db=database(path.join(root,'.local/intel.sqlite'));
const env={INTEL_DB:db,APP_ACCESS_TOKEN:process.env.APP_ACCESS_TOKEN||'LOCAL_ONLY_6_DEVELOPMENT_123456',ALLOWED_ORIGIN:'http://127.0.0.1:'+port};
for(const k of ['SOCIALDATAX_API_KEY','SOCIALDATAX_ENABLED','SOCIALDATAX_TERMS_CONFIRMED','SOCIALDATAX_BILLING_APPROVED','OPENAI_API_KEY','MODEL_ENABLED','MODEL_PROVIDER','OPENAI_MODEL','DEEPSEEK_API_KEY','DEEPSEEK_MODEL','INTEL_MODEL_PROVIDER','INTEL_MODEL_ENABLED'])if(process.env[k])env[k]=process.env[k];
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
const server=http.createServer(async(req,res)=>{try{if(req.headers.host!=='127.0.0.1:'+port){res.writeHead(403);res.end('Loopback host only');return;}const u=new URL(req.url,env.ALLOWED_ORIGIN);
 if(['/intel/','/douyin/','/blogger/'].some(p=>u.pathname.startsWith(p))||['/health','/generate'].includes(u.pathname)){
  const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>900000){res.writeHead(413);res.end('Request too large');return;}chunks.push(chunk);}
  const headers=new Headers(req.headers);if(!headers.has('Origin'))headers.set('Origin',env.ALLOWED_ORIGIN);
  const response=await worker.fetch(new Request(u,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})}),env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
 }
 const file=u.pathname==='/'?'index.html':decodeURIComponent(u.pathname.slice(1));if(!(file==='index.html'||/^(assets|data)\//.test(file))||file.split('/').some(s=>s==='..')){res.writeHead(404);res.end('Not found');return;}
 const full=path.resolve(root,file);if(!full.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}res.writeHead(200,{'Content-Type':types[path.extname(full)]||'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(full));
 }catch{res.writeHead(500);res.end('Local request failed; no secrets logged');}});
server.listen(port,'127.0.0.1',()=>process.stdout.write('V6 local server ready on loopback port '+port+'. Local access-code instructions: docs/v6.md\n'));
process.on('SIGTERM',()=>server.close(()=>{db.close();process.exit(0);}));
