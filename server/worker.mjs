// Deploy this server separately. Secrets are server bindings, never static assets.
import '../assets/speech-contract.js';
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
export const providers={openai};
export async function handle(request,env,fetcher=fetch){
 const url=new URL(request.url),origin=request.headers.get('Origin'),allowed=env.ALLOWED_ORIGIN||'https://z624708458-netizen.github.io';
 // Exact origin + private application token. No public anonymous paid endpoint.
 if(!origin||origin!==allowed)return reply({error:'访问来源不允许'},403);
 if(!env.APP_ACCESS_TOKEN||env.APP_ACCESS_TOKEN.length<24)return reply({error:'服务端应用访问码尚未配置'},503,origin);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, GET, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600','Vary':'Origin'}});
 if(!await equal(request.headers.get('Authorization')||'','Bearer '+env.APP_ACCESS_TOKEN))return reply({error:'应用访问码无效；不要填写OpenAI Key'},401,origin);
 if(!env.OPENAI_API_KEY)return reply({error:C.unavailable},503,origin);
 if(url.pathname==='/health'&&request.method==='GET')return reply({configured:true,provider:'openai',model:env.OPENAI_MODEL||'gpt-4.1-mini'},200,origin);
 if(url.pathname!=='/generate'||request.method!=='POST')return reply({error:'接口不存在'},404,origin);
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return reply({error:'仅接受JSON'},415,origin);
 // Best effort per-isolate throttle; project budget is also needed at OpenAI.
 const ip=request.headers.get('CF-Connecting-IP')||'private-user',now=Date.now(),bucket=buckets.get(ip);if(bucket&&bucket.until>now&&bucket.count>=10)return reply({error:'操作过于频繁，请一分钟后重试'},429,origin);
 const next=bucket&&bucket.until>now?{...bucket,count:bucket.count+1}:{until:now+60000,count:1};buckets.set(ip,next);for(const [key,b] of buckets)if(b.until<now)buckets.delete(key);
 try{const p=C.validateRequest(await readBounded(request));const provider=env.MODEL_PROVIDER||'openai';if(!Object.hasOwn(providers,provider))throw new Error('MODEL_FAILED');return reply(await providers[provider](p,env,fetcher),200,origin);}catch(error){
  const messages={INPUT_TOO_LARGE:'全文素材过大，请减少输入；系统不会静默截断',MODEL_AUTH:'服务端OpenAI Key无效或没有模型权限',MODEL_QUOTA:'OpenAI配额不足或请求受限，请检查账户额度',MODEL_INCOMPLETE:'模型未完整返回稿件，旧稿保留，请重试',MODEL_FAILED:'模型服务暂时不可用，旧稿保留',TimeoutError:'模型请求超时，旧稿保留'};
  // Never echo upstream payload/errors or input records to clients or logs.
  return reply({error:messages[error.message]||messages[error.name]||'请求或模型输出未通过格式/来源校验，旧稿保留'},error.message==='INPUT_TOO_LARGE'?413:error.message?.startsWith('MODEL_')||error.name==='TimeoutError'?502:400,origin);
 }
}
export default {fetch:handle};
