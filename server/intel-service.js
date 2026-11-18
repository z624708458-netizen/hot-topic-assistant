/* V6 D1 store and service. Prefix-only additive tables; private single-user API. */
(function(root){
 'use strict';
 const I=root.RadarIntel,S=root.RadarSocialDataX;
 const now=()=>new Date().toISOString(),id=()=>crypto.randomUUID();
 const read=s=>JSON.parse(s.body);
 class Store{
  constructor(db){this.db=db;}
  async all(sql,...args){return (await this.db.prepare(sql).bind(...args).all()).results;}
  async get(sql,...args){return this.db.prepare(sql).bind(...args).first();}
  async run(sql,...args){return this.db.prepare(sql).bind(...args).run();}
  async config(){const r=await this.get('SELECT body FROM intel_settings WHERE id=1');return r?I.settings(read(r)):I.defaults();}
  async saveConfig(v){const c=I.settings(v);await this.run('INSERT INTO intel_settings(id,body) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body',JSON.stringify(c));return c;}
  async works(){return (await this.all('SELECT body FROM intel_works WHERE expires_at>? ORDER BY fetched_at DESC LIMIT 3000',now())).map(read);}
  async work(key){const r=await this.get('SELECT body FROM intel_works WHERE id=? AND expires_at>?',key,now());return r?read(r):null;}
  async putWork(w,c){I.validateWork(w);const old=await this.work(w.id),expires_at=new Date(Date.parse(w.source.fetched_at)+c.retention_hours*3600000).toISOString();
   const merged={...old,...w,expires_at,collection_kind:old?.collection_kind==='author_feed'?'author_feed':w.collection_kind,snapshots:[...(old?.snapshots||[]),...(old?[{fetched_at:old.source.fetched_at,metrics:old.metrics}]:[])].slice(-10)};
   await this.run('INSERT INTO intel_works(id,platform,author_id,published,fetched_at,expires_at,body) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET author_id=excluded.author_id,published=excluded.published,fetched_at=excluded.fetched_at,expires_at=excluded.expires_at,body=excluded.body',w.id,w.platform,w.author.id,w.published,w.source.fetched_at,expires_at,JSON.stringify(merged));
   if(w.author.id){const tracked=await this.get("SELECT body FROM intel_authors WHERE platform=? AND json_extract(body,'$.platform_id')=? LIMIT 1",w.platform,w.author.id);const key=tracked?read(tracked).id:w.platform+':'+w.author.id,previous=await this.author(key);await this.putAuthor({...previous,id:key,platform:w.platform,platform_id:w.author.id,name:w.author.name||previous?.name||'昵称暂无数据',homepage:w.author.homepage||previous?.homepage||'',followers:w.author.followers??previous?.followers??null,domains:previous?.domains||I.match(w,c).map(h=>h.name),followed:previous?.followed||false,paused:previous?.paused||false,last_collected:previous?.last_collected||null,source:'socialdatax',profile_expires_at:expires_at});}
   return merged;
  }
  async authors(){return (await this.all('SELECT body FROM intel_authors ORDER BY updated_at DESC LIMIT 2000')).map(read);}
  async author(key){const a=await this.get('SELECT body FROM intel_authors WHERE id=?',key);return a?read(a):null;}
  async putAuthor(a){if(!a||!I.platforms.includes(a.platform)||typeof a.id!=='string'||a.id.length>400||typeof a.name!=='string'||!a.name.trim()||a.name.length>300||a.homepage&&!I.url(a.homepage)||!Array.isArray(a.domains)||a.domains.some(x=>typeof x!=='string'||x.length>60)||typeof a.followed!=='boolean'||typeof a.paused!=='boolean')throw S.safe('INVALID_AUTHOR');
   const fields={id:a.id,platform:a.platform,platform_id:typeof a.platform_id==='string'?a.platform_id.slice(0,300):null,name:a.name,homepage:a.homepage||'',followers:I.finite(a.followers),domains:a.domains,followed:a.followed,paused:a.paused,last_collected:I.date(a.last_collected),source:a.source==='socialdatax'?'socialdatax':'manual',profile_expires_at:I.date(a.profile_expires_at),profile_fetched_at:I.date(a.profile_fetched_at),profile_source_tool:typeof a.profile_source_tool==='string'?a.profile_source_tool.slice(0,200):null};
   await this.run('INSERT INTO intel_authors(id,platform,body,updated_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET platform=excluded.platform,body=excluded.body,updated_at=excluded.updated_at',a.id,a.platform,JSON.stringify(fields),now());return fields;
  }
  async log(platform,operation,status){await this.run('INSERT INTO intel_logs(id,created_at,platform,operation,status) VALUES(?,?,?,?,?)',id(),now(),platform,operation,status);}
  async reserve(c,provider='socialdatax'){const row=await this.get('INSERT INTO intel_usage(day,provider,attempts,successes) VALUES(?,?,1,0) ON CONFLICT(day,provider) DO UPDATE SET attempts=attempts+1 WHERE attempts<? RETURNING attempts',I.day(),provider,c.daily_limit);if(!row)throw S.safe('DAILY_BUDGET_EXCEEDED');}
  async usage(){return this.all('SELECT day,provider,attempts,successes,credits FROM intel_usage ORDER BY day DESC LIMIT 30');}
  async cache(key){const r=await this.get('SELECT body FROM intel_cache WHERE id=? AND expires_at>?',key,now());return r?read(r):null;}
  async saveCache(key,data,c){await this.run('INSERT INTO intel_cache(id,expires_at,body) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET expires_at=excluded.expires_at,body=excluded.body',key,new Date(Date.now()+c.cache_hours*3600000).toISOString(),JSON.stringify(data));}
  async purge(){const at=now();await this.run('DELETE FROM intel_daily_works WHERE day<?',I.day());await this.run('DELETE FROM intel_works WHERE expires_at<=?',at);await this.run('DELETE FROM intel_cache WHERE expires_at<=?',at);await this.run("DELETE FROM intel_authors WHERE json_extract(body,'$.source')='socialdatax' AND json_extract(body,'$.followed')=0 AND NOT EXISTS (SELECT 1 FROM intel_works WHERE intel_works.platform=intel_authors.platform AND intel_works.author_id=json_extract(intel_authors.body,'$.platform_id'))");await this.run("UPDATE intel_authors SET body=json_set(body,'$.followers',NULL,'$.profile_fetched_at',NULL) WHERE json_extract(body,'$.profile_expires_at')<=?",at);await this.run('DELETE FROM intel_logs WHERE created_at<?',new Date(Date.now()-30*86400000).toISOString());}
 }
 const messages={SOCIALDATAX_NOT_CONFIGURED:'尚未启用SocialDataX；需要服务端Key、数据使用确认及费用授权',SOCIALDATAX_AUTH_REQUIRED:'SocialDataX认证或权限不足',SOCIALDATAX_RATE_LIMITED:'数据源限流，请稍后从当前游标继续；没有自动重试付费请求',SOCIALDATAX_UPSTREAM_FAILED:'数据源请求失败，原记录保留',SOCIALDATAX_RPC_FAILED:'数据源协议错误；未自动重试',SOCIALDATAX_TOOL_FAILED:'数据源工具调用失败；请核对权限或账户额度',SOCIALDATAX_SCHEMA_CHANGED:'数据源字段契约发生变化，已停止该操作',SOCIALDATAX_CAPABILITY_UNAVAILABLE:'当前账号没有提供这项能力',SOCIALDATAX_RESPONSE_TOO_LARGE:'数据源响应超过安全上限',DAILY_ITEMS_EXCEEDED:'达到今日作品处理上限，未发起新的付费请求',DAILY_BUDGET_EXCEEDED:'达到今日调用上限，已停止请求',INVALID_AUTHOR:'博主记录无效',INVALID_WORK:'作品不存在或已超过保留期限',INVALID_INPUT:'输入无效',TRANSCRIPT_FAILED:'已记录转写任务失败，不重复提交或轮询，请先在数据源核对任务',TRANSCRIPT_SUBMISSION_UNKNOWN:'转写提交状态未知，请先在数据源核对任务，避免重复付费；未自动重新提交',MODEL_NOT_CONNECTED:'当前未连接大模型，无法生成高质量口播或AI分析'};
 async function hash(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
 async function operation(store,c,platform,type,value,cursor,env,fetcher,beforePaid=null){if(!I.platforms.includes(platform)||!c.platforms.includes(platform)||!c.enabled||!S.enabled(env))throw S.safe('SOCIALDATAX_NOT_CONFIGURED');
  if(typeof value!=='string'||!value||value.length>3000||typeof cursor!=='string'||cursor.length>16000)throw S.safe('INVALID_INPUT');
  const key=await hash(JSON.stringify([platform,type,value,cursor])),cached=await store.cache(key);if(cached)return {...cached,cache_hit:true};
  try{const result=await S.call(platform,type,value,cursor,env,fetcher,async()=>{await store.reserve(c);if(beforePaid)await beforePaid();});const safe={...S.clean(result,env),fetched_at:now()};await store.run('UPDATE intel_usage SET successes=successes+1 WHERE day=? AND provider=?',I.day(),'socialdatax');await store.log(platform,type,'ok');await store.saveCache(key,safe,c);return {...safe,cache_hit:false};}
  catch(e){await store.log(platform,type,e.public?e.message:'NETWORK_OR_TIMEOUT');throw e;}
 }
 async function collect(store,c,input,env,fetcher=fetch){const platform=input.platform,type=input.author_id?'posts':'search';let value=input.keyword,author=null;
  if(input.author_id){author=await store.author(input.author_id);if(!author||author.platform!==platform||!author.homepage||author.paused)throw S.safe('INVALID_AUTHOR');value=author.homepage;}
  if((await store.get('SELECT count(*) AS n FROM intel_daily_works WHERE day=?',I.day())).n>=c.daily_items)throw S.safe('DAILY_ITEMS_EXCEEDED');
  const cursor=input.cursor||'',result=await operation(store,c,platform,type,value,cursor,env,fetcher),d=result.data;
  if(!d||!Array.isArray(d.items))throw S.safe('SOCIALDATAX_SCHEMA_CHANGED');
  const normalized=d.items.slice(0,c.max_items).map(raw=>S.normalize(raw,platform,result.tool,type==='posts'?'author_feed':'search',result.fetched_at));
  if(author){const ids=[...new Set(normalized.filter(Boolean).map(w=>w.author.id).filter(Boolean))];if(ids.length===1){author={...author,platform_id:ids[0]};await store.putAuthor(author);}}
  let count=0,skipped=0,itemLimit=false;for(const w of normalized){if(!w){skipped++;continue;}const reserved=await store.get('INSERT INTO intel_daily_works(day,work_id) SELECT ?,? WHERE (SELECT count(*) FROM intel_daily_works WHERE day=?)<? ON CONFLICT(day,work_id) DO NOTHING RETURNING work_id',I.day(),w.id,I.day(),c.daily_items);if(!reserved&&!await store.get('SELECT work_id FROM intel_daily_works WHERE day=? AND work_id=?',I.day(),w.id)){itemLimit=true;break;}await store.putWork(w,c);count++;}
  if(author)await store.putAuthor({...await store.author(author.id)||author,last_collected:now()});
  const token=typeof d.next_page_token==='string'?d.next_page_token:'';if(cursor&&token===cursor)throw S.safe('SOCIALDATAX_SCHEMA_CHANGED');
  const partial=d.items.length>c.max_items||itemLimit; // Do not advance past items that the local batch limit discarded.
  const output={platform,count,skipped,cache_hit:result.cache_hit,next_page_token:partial?cursor:token,has_more:partial?true:typeof d.has_more==='boolean'?d.has_more:null,partial,continuation_blocked:partial,query:{platform,keyword:input.keyword||null,author_id:input.author_id||null},message:partial?'达到本页或今日作品处理上限，游标未推进；请调整上限后重试（缓存可复用）':'仅代表已返回的当前页，空游标不证明账号或平台完整覆盖',fetched_at:now()};
  await store.run('INSERT INTO intel_runs(id,body,updated_at) VALUES(?,?,?)',id(),JSON.stringify(output),now());return output;
 }
 async function enrich(store,c,key,type,env,fetcher=fetch){const w=await store.work(key);if(!w||!w.url)throw S.safe('INVALID_WORK');
  if(type==='detail'){const result=await operation(store,c,w.platform,'detail',w.url,'',env,fetcher),raw=result.data.item||result.data.detail||result.data;const full=S.normalize(raw,w.platform,result.tool,w.collection_kind,result.fetched_at);if(!full||full.id!==w.id)throw S.safe('SOCIALDATAX_SCHEMA_CHANGED');return store.putWork(full,c);}
  if(type==='comments'){if(w.comments_fetched_at&&w.comments_has_more===false)return w;const result=await operation(store,c,w.platform,'comments',w.url,w.comments_cursor||'',env,fetcher);if(!Array.isArray(result.data.items))throw S.safe('SOCIALDATAX_SCHEMA_CHANGED');const comments=result.data.items.slice(0,100).map((x,i)=>({id:String(x.comment_id??x.id??('local:'+(w.comments_cursor||'first')+':'+i)),text:typeof (x.text||x.content)==='string'?(x.text||x.content).slice(0,3000):'',likes:I.finite(x.like_count??x.digg_count),source_tool:result.tool})).filter(x=>x.text);return store.putWork({...w,comments:[...new Map([...(w.comments||[]),...comments].map(x=>[x.id,x])).values()].slice(-2000),comments_cursor:typeof result.data.next_page_token==='string'?result.data.next_page_token:'',comments_has_more:result.data.has_more??null,comments_fetched_at:result.fetched_at},c);}
  if(type==='transcript'){
   const jobKey=w.id,job=await store.get('SELECT body FROM intel_jobs WHERE id=?',jobKey),saved=job?read(job):null;
   if(['failed','error','cancelled'].includes(saved?.status))throw S.safe('TRANSCRIPT_FAILED');
   if(saved&&!saved.job_id)throw S.safe('TRANSCRIPT_SUBMISSION_UNKNOWN');
   const intent=()=>store.run('INSERT INTO intel_jobs(id,platform,work_id,body) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body',jobKey,w.platform,w.id,JSON.stringify({status:'submission_unknown',updated_at:now()}));
   const result=await operation(store,c,w.platform,saved?.job_id?'job':'transcript',saved?.job_id||w.url,'',env,fetcher,saved?.job_id?null:intent),d=result.data;
   const text=typeof d.transcript==='string'?d.transcript:typeof d.text==='string'?d.text:typeof d.result?.text==='string'?d.result.text:null;
   if(text&&text.length>100000)throw S.safe('SOCIALDATAX_RESPONSE_TOO_LARGE');
   if(text&&['completed','succeeded','success','done'].includes(d.status)){const changed=await store.putWork({...w,transcript:{text:text.slice(0,100000),source_tool:result.tool,fetched_at:now(),kind:'vendor_speech_to_text',timed_segments:Array.isArray(d.segments)?d.segments.slice(0,2000):null}},c);await store.run('DELETE FROM intel_jobs WHERE id=?',jobKey);return changed;}
   if(typeof d.job_id==='string'){const record={job_id:d.job_id,status:typeof d.status==='string'?d.status:'pending',updated_at:now()};await store.run('INSERT INTO intel_jobs(id,platform,work_id,body) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body',jobKey,w.platform,w.id,JSON.stringify(record));
    // Poll responses must not stay cached for hours. Persist the job ID instead of resubmitting.
    const cacheKey=await hash(JSON.stringify([w.platform,saved?.job_id?'job':'transcript',saved?.job_id||w.url,'']));await store.run('DELETE FROM intel_cache WHERE id=?',cacheKey);
    return {job:record,message:['failed','error','cancelled'].includes(record.status)?'转写失败，保留任务记录；请在数据源核对，不自动重试付费任务':'转写任务尚未完成；下次检查将查询已有job_id，不重复提交'};
   }throw S.safe('SOCIALDATAX_SCHEMA_CHANGED');
  }throw S.safe('INVALID_INPUT');
 }
 async function report(store){
  const c=await store.config(),works=await store.works(),selected=I.recommend(works,c),semantic=await store.cache('semantic_clusters'),items=new Map();
  for(const x of selected){let group=semantic?.groups?.find(g=>g.work_ids.includes(x.work.id));const members=group?works.filter(w=>group.work_ids.includes(w.id)&&w.source.kind==='socialdatax'&&I.match(w,c).length&&w.analysis&&w.published&&Date.parse(w.published)<=Date.now()&&Date.now()-Date.parse(w.published)<=7*86400000&&I.score(w,works,c).total>=c.min_score&&I.score(w,works,c).available>=70):[];if(new Set(members.filter(w=>w.author.id).map(w=>w.platform+':'+w.author.id)).size<2)group=null;const key=group?'semantic:'+group.title:x.work.analysis.topic||x.work.title,existing=items.get(key);
   if(existing){if(!existing.work_ids.includes(x.work.id))existing.work_ids.push(x.work.id);continue;}items.set(key,{id:x.work.id,title:group?.title||x.work.analysis.topic||x.work.title,score:x.score.total,work_ids:group?members.map(w=>w.id):[x.work.id],reason:group?.reason||x.work.analysis.reason,angle:x.work.analysis.angle,difficulty:x.work.analysis.difficulty,aggregation:group?'llm_semantic':'single_work'});
  }
  const result={day:I.day(),created_at:now(),method:'v6_rules_plus_model',topics:[...items.values()].slice(0,10),count:Math.min(10,items.size),message:items.size?'只包含达到门槛且有AI研究依据的作品；需打开原文核验':'没有足够已核验数据和AI研究依据，不凑10条'};
  await store.run('INSERT INTO intel_reports(day,body,created_at) VALUES(?,?,?) ON CONFLICT(day) DO UPDATE SET body=excluded.body,created_at=excluded.created_at',result.day,JSON.stringify(result),result.created_at);return result;
 }

 async function scheduled(env,fetcher=fetch){if(!env.INTEL_DB||env.INTEL_AUTOMATION_ENABLED!=='true')return {status:'disabled'};const store=new Store(env.INTEL_DB),c=await store.config();await store.purge();if(!c.enabled||!S.enabled(env))return {status:'unconfigured'};
  const due=(await store.authors()).filter(a=>a.followed&&!a.paused&&a.homepage&&(!a.last_collected||Date.now()-Date.parse(a.last_collected)>=c.frequency_hours*3600000));let done=0;
  for(const a of due){try{await collect(store,c,{platform:a.platform,author_id:a.id},env,fetcher);done++;}catch(e){if(e.message==='DAILY_BUDGET_EXCEEDED')break;}}
  const lastSearch=await store.get('SELECT updated_at FROM intel_runs WHERE id=?','automation:last-search');
  if(!due.length&&(!lastSearch||Date.now()-Date.parse(lastSearch.updated_at)>=c.frequency_hours*3600000)){const queries=Object.values(c.keywords).flat();for(const p of c.platforms.slice(0,3)){try{if(queries.length)await collect(store,c,{platform:p,keyword:queries[Number(I.day().slice(-2))%queries.length]},env,fetcher);}catch(e){if(['DAILY_BUDGET_EXCEEDED','DAILY_ITEMS_EXCEEDED'].includes(e.message))break;}}await store.run('INSERT INTO intel_runs(id,body,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at','automation:last-search','{}',now());}
  if(env.INTEL_AUTO_RESEARCH==='true'){
   const M=root.RadarIntelModel,candidates=(await store.works()).filter(w=>w.url).map(w=>({w,s:I.score(w,[] ,c)})).filter(x=>x.s.domains.length&&(x.w.metrics.views>=100000||x.s.total>=40)).sort((a,b)=>b.s.total-a.s.total).slice(0,3);
   for(const {w} of candidates){for(const type of ['detail','comments','transcript']){try{await enrich(store,c,w.id,type,env,fetcher);}catch(e){if(e.message==='DAILY_BUDGET_EXCEEDED')break;}}
    const latest=await store.work(w.id);if(latest&&M.status(env).configured&&(latest.transcript?.text||latest.description||'').length>=30&&!latest.analysis){try{const metered=async(url,args)=>{const provider=M.status(env).provider;await store.reserve(c,provider);const response=await fetcher(url,args);if(response.ok)await store.run('UPDATE intel_usage SET successes=successes+1 WHERE day=? AND provider=?',I.day(),provider);return response;};const analyzed=await M.analyze(latest,'',env,metered);await store.putWork({...latest,analysis:{...analyzed.output,provider:analyzed.provider,generated_at:analyzed.generated_at}},c);}catch(e){await store.log('model','auto_analyze',e.public?e.message:'FAILED');}}
   }
  }
  await report(store);return {status:'ok',authors_checked:done};
 }
 root.RadarIntelService={Store,messages,operation,collect,enrich,report,scheduled};
})(globalThis);
