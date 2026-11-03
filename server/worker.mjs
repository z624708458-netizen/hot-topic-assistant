// Deploy this server separately. Secrets are server bindings, never static assets.
import '../assets/speech-contract.js';
import '../assets/blogger-rules.js';
import '../assets/blogger-contract.js';
import './douyin-provider.js';
const C=globalThis.RadarSpeechContract;
const API='https://api.openai.com/v1/responses';
const buckets=new Map();
function reply(data,status=200,origin=''){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})}});}
async function equal(a,b){const hash=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));const [x,y]=await Promise.all([hash(a),hash(b)]);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0;}
async function readBounded(request){
 const max=900000;if(Number(request.headers.get('Content-Length'))>max)throw new Error('INPUT_TOO_LARGE');
 const reader=request.body?.getReader();if(!reader)throw new Error('BAD_INPUT');let size=0,chunks=[];
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new Error('INPUT_TOO_LARGE');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.byteLength;}return JSON.parse(new TextDecoder().decode(bytes));
}
export async function openai(p,env,fetcher=fetch){
 const response=await fetcher(API,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+env.OPENAI_API_KEY},body:JSON.stringify({model:env.OPENAI_MODEL||'gpt-4.1-mini',store:false,max_output_tokens:3500,input:[{role:'system',content:C.systemPrompt},{role:'user',content:JSON.stringify(p)}],text:{format:{type:'json_schema',name:'creator_speech',strict:true,schema:C.outputSchema}}}),signal:AbortSignal.timeout(55000)});
 if(!response.ok){if(response.status===401||response.status===403)throw new Error('MODEL_AUTH');if(response.status===429)throw new Error('MODEL_QUOTA');throw new Error('MODEL_FAILED');}
 const body=await response.json();if(body.status!=='completed'||body.output?.some(x=>x.content?.some(c=>c.type==='refusal')))throw new Error('MODEL_INCOMPLETE');
 const text=(body.output||[]).flatMap(x=>x.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('');if(!text)throw new Error('MODEL_INCOMPLETE');
 const output=C.validateOutput(JSON.parse(text),p);return {provider:'openai',model:env.OPENAI_MODEL||'gpt-4.1-mini',output};
}
export async function analyzeBlogger(p,env,fetcher=fetch){
 const K=globalThis.RadarBloggerContract,input=K.validateRequest(p);
 const response=await fetcher(API,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+env.OPENAI_API_KEY},body:JSON.stringify({model:env.OPENAI_MODEL||'gpt-4.1-mini',store:false,max_output_tokens:3000,input:[{role:'system',content:K.prompt},{role:'user',content:JSON.stringify(input)}],text:{format:{type:'json_schema',name:'blogger_analysis',strict:true,schema:K.schema}}}),signal:AbortSignal.timeout(55000)});
 if(!response.ok)throw new Error('MODEL_FAILED');const raw=await response.json();if(raw.status!=='completed'||raw.output?.some(x=>x.content?.some(c=>c.type==='refusal')))throw new Error('MODEL_INCOMPLETE');
 const output=JSON.parse((raw.output||[]).flatMap(x=>x.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join(''));
 return {provider:'openai',model:env.OPENAI_MODEL||'gpt-4.1-mini',output:K.validateOutput(output,input)};
}
export const providers={openai};
const bloggerProviders={openai:analyzeBlogger};
function throttled(request,prefix,max){const key=prefix+':'+(request.headers.get('CF-Connecting-IP')||'private-user'),now=Date.now(),old=buckets.get(key);if(old&&old.until>now&&old.count>=max)return true;buckets.set(key,old&&old.until>now?{...old,count:old.count+1}:{until:now+60000,count:1});for(const [k,b] of buckets)if(b.until<now)buckets.delete(k);return false;}
async function douyinRoute(request,env,fetcher,origin,url){
 const D=globalThis.RadarDouyin;
 if(request.method!=='GET'||!['/douyin/status','/douyin/discover','/douyin/hot-words','/douyin/hot-videos'].includes(url.pathname))return reply({error:'接口不存在'},404,origin);
 if(url.search)return reply({error:'当前接口不接受查询参数，不提供通用搜索或任意上游代理'},400,origin);
 if(url.pathname==='/douyin/status')return reply(D.status(env),200,origin);
 if(url.pathname==='/douyin/hot-words')return reply({status:'not_enabled',message:'热点词/上升词接口参数与权限尚待核对，未启用',words:[],fetched_at:null},503,origin);
 const s=D.status(env);if(!s.configured)return reply({status:'unconfigured',message:s.message,candidates:[],works:[],fetched_at:null},503,origin);
 if(!env.APP_ACCESS_TOKEN||env.APP_ACCESS_TOKEN.length<24)return reply({error:'服务端应用访问码尚未配置'},503,origin);
 if(!await equal(request.headers.get('Authorization')||'','Bearer '+env.APP_ACCESS_TOKEN))return reply({error:'应用访问码无效；不要填写平台密钥'},401,origin);
 if(throttled(request,'douyin',4))return reply({error:'发现操作过于频繁，请一分钟后重试'},429,origin);
 try{return reply(await (url.pathname==='/douyin/discover'?D.discover(env,fetcher):D.hotVideos(env,fetcher)),200,origin);}catch(error){return reply({status:'error',message:error.safe?error.message:'抖音服务暂时不可用，未返回发现结果',candidates:[],works:[],fetched_at:null},502,origin);}
}
export async function handle(request,env,fetcher=fetch){
 const url=new URL(request.url),origin=request.headers.get('Origin'),allowed=env.ALLOWED_ORIGIN||'https://z624708458-netizen.github.io';
 // Public readiness checks never invoke a model or read personal materials.
 const health=url.pathname==='/health'&&request.method==='GET';
 const publicStatus=url.pathname==='/douyin/status'&&request.method==='GET';
 if((origin&&origin!==allowed)||(!origin&&!health&&!publicStatus))return reply({error:'访问来源不允许'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, GET, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600','Vary':'Origin'}});
 if(url.pathname.startsWith('/douyin/'))return douyinRoute(request,env,fetcher,origin||'',url);
 const enabled=env.MODEL_ENABLED==='true'&&!!env.OPENAI_API_KEY;
 const tokenReady=typeof env.APP_ACCESS_TOKEN==='string'&&env.APP_ACCESS_TOKEN.length>=24;
 if(health){
  const verified=enabled&&tokenReady&&await equal(request.headers.get('Authorization')||'','Bearer '+env.APP_ACCESS_TOKEN);
  return reply({backend_ready:true,configured:verified,access_verified:verified,provider:'openai',...(verified?{model:env.OPENAI_MODEL||'gpt-4.1-mini'}:{message:C.unavailable})},200,origin||'');
 }
 if(!['/generate','/blogger/analyze'].includes(url.pathname)||request.method!=='POST')return reply({error:'接口不存在'},404,origin);
 // Deployment is safe without secrets. Activation must be explicit, never automatic.
 if(!enabled)return reply({error:C.unavailable},503,origin);
 if(!tokenReady)return reply({error:'服务端应用访问码尚未配置'},503,origin);
 if(!await equal(request.headers.get('Authorization')||'','Bearer '+env.APP_ACCESS_TOKEN))return reply({error:'应用访问码无效；不要填写OpenAI Key'},401,origin);
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return reply({error:'仅接受JSON'},415,origin);
 // Best effort per-isolate throttle; project budget is also needed at OpenAI.
 const ip=request.headers.get('CF-Connecting-IP')||'private-user',now=Date.now(),bucket=buckets.get(ip);if(bucket&&bucket.until>now&&bucket.count>=10)return reply({error:'操作过于频繁，请一分钟后重试'},429,origin);
 const next=bucket&&bucket.until>now?{...bucket,count:bucket.count+1}:{until:now+60000,count:1};buckets.set(ip,next);for(const [key,b] of buckets)if(b.until<now)buckets.delete(key);
 try{if(url.pathname==='/blogger/analyze'){const provider=env.MODEL_PROVIDER||'openai';if(!Object.hasOwn(bloggerProviders,provider))throw new Error('MODEL_FAILED');return reply(await bloggerProviders[provider](await readBounded(request),env,fetcher),200,origin);}
 const p=C.validateRequest(await readBounded(request));const provider=env.MODEL_PROVIDER||'openai';if(!Object.hasOwn(providers,provider))throw new Error('MODEL_FAILED');return reply(await providers[provider](p,env,fetcher),200,origin);}catch(error){
  const messages={INPUT_TOO_LARGE:'全文素材过大，请减少输入；系统不会静默截断',MODEL_AUTH:'服务端OpenAI Key无效或没有模型权限',MODEL_QUOTA:'OpenAI配额不足或请求受限，请检查账户额度',MODEL_INCOMPLETE:'模型未完整返回稿件，旧稿保留，请重试',MODEL_FAILED:'模型服务暂时不可用，旧稿保留',TimeoutError:'模型请求超时，旧稿保留'};
  // Never echo upstream payload/errors or input records to clients or logs.
  return reply({error:messages[error.message]||messages[error.name]||'请求或模型输出未通过格式/来源校验，旧稿保留'},error.message==='INPUT_TOO_LARGE'?413:error.message?.startsWith('MODEL_')||error.name==='TimeoutError'?502:400,origin);
 }
}
export default {fetch:handle};
