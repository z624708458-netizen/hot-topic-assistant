(function(root){
 'use strict';
 const I=root.RadarIntel,S=root.RadarSocialDataX,V=root.RadarIntelService,M=root.RadarIntelModel;
 async function handle(request,env,fetcher,h){const u=new URL(request.url),origin=request.headers.get('Origin')||'',send=(d,s=200)=>h.reply(d,s,origin);
  if(u.pathname==='/intel/status'&&request.method==='GET')return send({version:'6.0.0',database_bound:!!env.INTEL_DB,source:{provider:'socialdatax',configured:S.enabled(env),real_call_verified:false,platforms:I.platforms,message:S.enabled(env)?'配置齐备；权限、字段与费用以真实响应为准':'尚未配置SocialDataX或未确认授权/费用'},model:M.status(env),automation_enabled:env.INTEL_AUTOMATION_ENABLED==='true',legacy_preserved:true});
  if(!env.APP_ACCESS_TOKEN||env.APP_ACCESS_TOKEN.length<24)return send({error:'服务端应用访问码尚未配置'},503);
  if(!await h.equal(request.headers.get('Authorization')||'','Bearer '+env.APP_ACCESS_TOKEN))return send({error:'应用访问码无效；不要在网页输入任何API Key'},401);
  if(!env.INTEL_DB)return send({error:'V6作品数据库未绑定；请按说明创建D1并运行增量迁移'},503);
  const store=new V.Store(env.INTEL_DB),method=request.method,path=u.pathname;
  try{await store.purge();const c=await store.config();
   if(method==='GET'){
    if(path==='/intel/settings')return send({settings:c});
    if(path==='/intel/works'){const works=await store.works();return send({works:works.map(w=>({...w,score:I.score(w,works,c)})),scoring_version:'6.0.0'});}
    if(path==='/intel/authors'){const works=await store.works();return send({authors:(await store.authors()).map(a=>({...a,observed_works:works.filter(w=>w.platform===a.platform&&w.author.id===a.platform_id).length})),coverage:'仅当前保留窗口内已取得作品，不代表账号全部历史'});}
    if(path==='/intel/usage')return send({usage:await store.usage(),logs:await store.all('SELECT created_at,platform,operation,status FROM intel_logs ORDER BY created_at DESC LIMIT 50'),cost_note:'attempts是实际工具调用尝试，含可能失败的请求；金额及积分未由供应商账单核对，未知不按0展示'});
    if(path==='/intel/trends'){const works=await store.works(),semantic=await store.cache('semantic_clusters');return send({rules:I.clusters(works),semantic:semantic?.groups||[],method:semantic?'llm_and_rules':'keyword_rules_only',note:'尚无跨日期完整采样时，不推断话题增长或衰退'});}
    if(path==='/intel/topics')return send({topics:(await store.all('SELECT body FROM intel_topics ORDER BY updated_at DESC LIMIT 1000')).map(x=>JSON.parse(x.body))});
    if(path==='/intel/report'){const r=await store.get('SELECT body FROM intel_reports WHERE day=?',I.day());return send(r?JSON.parse(r.body):{day:I.day(),topics:[],count:0,message:'今日报告尚未生成；不足优质数据时不会补足10条'});}
    if(path==='/intel/export')return send({schema_version:1,settings:c,authors:await store.authors(),works:await store.works(),topics:(await store.all('SELECT body FROM intel_topics')).map(x=>JSON.parse(x.body)),exported_at:new Date().toISOString(),retention_note:'平台数据沿用原始到期时间；备份应自行保管并遵守原数据保留约定'});
   }
   if(method!=='POST')return send({error:'接口不存在'},404);
   if(!request.headers.get('Content-Type')?.startsWith('application/json'))return send({error:'仅接受JSON'},415);
   const p=await h.readBounded(request);if(!p||typeof p!=='object'||Array.isArray(p))throw S.safe('INVALID_INPUT');
   if(path==='/intel/settings')return send({settings:await store.saveConfig(p.settings)});
   if(path==='/intel/authors'){
    if(p.action==='delete'){if(typeof p.id!=='string')throw S.safe('INVALID_AUTHOR');await store.run('DELETE FROM intel_authors WHERE id=?',p.id);return send({deleted:true,works_preserved:true});}
    const a={...p.author,id:p.author?.id||'manual:'+crypto.randomUUID()};return send({author:await store.putAuthor(a)});
   }
   if(path==='/intel/author-profile'){
    const a=await store.author(p.id);if(!a||!a.homepage)throw S.safe('INVALID_AUTHOR');if(h.throttled(request,'intel-collect',6))return send({error:'操作频繁，请稍后重试'},429);
    const r=await V.operation(store,c,a.platform,'profile',a.homepage,'',env,fetcher),profile=r.data.user||r.data.profile||r.data;const followers=I.finite(profile.follower_count??profile.followers_count??profile.fans_count??profile.fans??profile.followers);
    const platformID=profile.sec_user_id||profile.user_id||profile.uid||profile.mid;const changed={...a,followers,source:'socialdatax',profile_source_tool:r.tool,profile_fetched_at:r.fetched_at,profile_expires_at:new Date(Date.parse(r.fetched_at)+c.retention_hours*3600000).toISOString(),platform_id:typeof platformID==='string'?platformID:a.platform_id};return send({author:await store.putAuthor(changed)});
   }
   if(path==='/intel/collect'){
    if(h.throttled(request,'intel-collect',6))return send({error:'操作频繁，请一分钟后重试'},429);return send(await V.collect(store,c,p,env,fetcher));
   }
   if(path==='/intel/enrich'){
    if(h.throttled(request,'intel-enrich',6))return send({error:'操作频繁，请一分钟后重试'},429);return send(await V.enrich(store,c,p.id,p.type,env,fetcher));
   }
   if(path==='/intel/analyze'||path==='/intel/script'||path==='/intel/cluster'){
    if(!M.status(env).configured)throw S.safe('MODEL_NOT_CONNECTED');if(h.throttled(request,'intel-model',10))return send({error:'模型操作频繁，请一分钟后重试'},429);
    const meteredFetch=async(url,args)=>{const provider=M.status(env).provider;await store.reserve(c,provider);try{const response=await fetcher(url,args);if(response.ok)await store.run('UPDATE intel_usage SET successes=successes+1 WHERE day=? AND provider=?',I.day(),provider);await store.log('model',provider,response.ok?'http_ok':'http_failed');return response;}catch(e){await store.log('model',provider,'network_or_timeout');throw e;}};
    const all=await store.works();if(path==='/intel/cluster'){const result=await M.cluster(all,env,meteredFetch);await store.saveCache('semantic_clusters',result.output,c);return send(result);}
    const ids=path==='/intel/analyze'?[p.id]:p.ids;if(!Array.isArray(ids)||!ids.length||ids.length>10||ids.some(x=>typeof x!=='string'))throw S.safe('INVALID_INPUT');const works=ids.map(id=>all.find(w=>w.id===id));if(works.some(w=>!w))throw S.safe('INVALID_WORK');
    if(path==='/intel/script'){const brain=Array.isArray(p.personal_materials)?p.personal_materials.slice(0,7).map(x=>({title:typeof x.title==='string'?x.title.slice(0,300):'',text:typeof x.text==='string'?x.text.slice(0,10000):''})):[];const sourceWorks=works.map(w=>({...w,...(typeof p.manual_texts?.[w.id]==='string'&&p.manual_texts[w.id].trim()?{research_text:{text:p.manual_texts[w.id].slice(0,30000),kind:'user_paste_unverified'}}:{})}));const generated=await M.script(sourceWorks,brain,env,meteredFetch);return send({...generated,source_works:works.map(w=>({id:w.id,title:w.title,url:w.url,fetched_at:w.source.fetched_at}))});}
    const w=works[0],hits=I.match(w,c).flatMap(h=>h.words),feedback=(await store.all('SELECT body FROM intel_topics')).map(r=>JSON.parse(r.body)).filter(t=>t.status==='已发布'&&I.finite(t.published_metrics?.views)!==null&&hits.some(k=>(t.title+' '+t.notes).toLowerCase().includes(k.toLowerCase()))).sort((a,b)=>(b.published_metrics?.views||0)-(a.published_metrics?.views||0)).slice(0,3).map(t=>({title:t.title,metrics:t.published_metrics,review:(t.notes||'').slice(0,2000)})),result=await M.analyze(w,typeof p.manual_text==='string'?p.manual_text.slice(0,30000):'',env,meteredFetch,{focus_keywords:c.keywords,related_published_work:feedback});await store.putWork({...w,...(typeof p.manual_text==='string'&&p.manual_text.trim()?{research_text:{text:p.manual_text.slice(0,30000),kind:'user_paste_unverified'}}:{}),analysis:{...result.output,provider:result.provider,model:result.model,generated_at:result.generated_at},score_history:[...(w.score_history||[]),I.score(w,all,c)].slice(-20)},c);return send(result);
   }
   if(path==='/intel/report')return send(await V.report(store));
   if(path==='/intel/topics'){
    if(!p.topic||typeof p.topic.title!=='string'||p.topic.title.length>600||!I.statuses.includes(p.topic.status)||!Array.isArray(p.topic.work_ids)||p.topic.work_ids.some(x=>typeof x!=='string')||typeof p.topic.notes!=='string'||p.topic.notes.length>50000)throw S.safe('INVALID_INPUT');
    const topic={...p.topic,id:typeof p.topic.id==='string'?p.topic.id:'topic:'+crypto.randomUUID(),updated_at:new Date().toISOString(),published_metrics:Object.fromEntries(['views','likes','comments','saves'].map(k=>[k,I.finite(p.topic.published_metrics?.[k])]))};await store.run('INSERT INTO intel_topics(id,body,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at',topic.id,JSON.stringify(topic),topic.updated_at);return send({topic});
   }
   if(path==='/intel/import'){
    const incoming=p.backup?S.clean(p.backup,env):null;if(!incoming||incoming.schema_version!==1||!Array.isArray(incoming.works)||incoming.works.length>500||!Array.isArray(incoming.authors)||incoming.authors.length>500||!Array.isArray(incoming.topics)||incoming.topics.length>1000)throw S.safe('INVALID_INPUT');
    // Validate everything in a dry-run before the atomic batch. Imported platform records keep expiry.
    const statements=[];for(const w of incoming.works){I.validateWork(w);if(w.id!==w.platform+':'+w.platform_id||!I.date(w.expires_at))throw S.safe('INVALID_INPUT');if(Date.parse(w.expires_at)<=Date.now())continue;statements.push(store.db.prepare('INSERT OR IGNORE INTO intel_works(id,platform,author_id,published,fetched_at,expires_at,body) VALUES(?,?,?,?,?,?,?)').bind(w.id,w.platform,w.author.id,w.published,w.source.fetched_at,w.expires_at,JSON.stringify({...w,source:{...w.source,kind:'manual',original_kind:w.source.kind,imported_unverified:true}})));}
    for(const a of incoming.authors){if(!a||typeof a.id!=='string'||!I.platforms.includes(a.platform)||typeof a.name!=='string'||!a.name.trim()||a.homepage&&!I.url(a.homepage)||typeof a.followed!=='boolean'||typeof a.paused!=='boolean'||!Array.isArray(a.domains))throw S.safe('INVALID_AUTHOR');statements.push(store.db.prepare('INSERT OR IGNORE INTO intel_authors(id,platform,body,updated_at) VALUES(?,?,?,?)').bind(a.id,a.platform,JSON.stringify(a),new Date().toISOString()));}
    for(const t of incoming.topics){if(typeof t.id!=='string'||typeof t.title!=='string'||!I.statuses.includes(t.status)||!Array.isArray(t.work_ids))throw S.safe('INVALID_INPUT');statements.push(store.db.prepare('INSERT OR IGNORE INTO intel_topics(id,body,updated_at) VALUES(?,?,?)').bind(t.id,JSON.stringify(t),new Date().toISOString()));}
    if(statements.length>2000)throw S.safe('INVALID_INPUT');if(statements.length)await store.db.batch(statements);return send({imported:true,settings_preserved:true,existing_records_preserved:true});
   }
   return send({error:'接口不存在'},404);
  }catch(e){const message=V.messages[e.message]||{MODEL_REQUEST_FAILED:'模型请求失败，未生成规则替代稿',MODEL_OUTPUT_INVALID:'模型输出校验失败，请核对后重试',MODEL_EVIDENCE_INVALID:'模型引用不在输入资料中，已拒绝保存',TRANSCRIPT_REQUIRED:'请先取得真实字幕或粘贴至少30字已核对文案',INPUT_TOO_LARGE:'请求过大，未写入'}[e.message];
   if(message)return send({error:message,code:e.message},e.message==='MODEL_NOT_CONNECTED'||e.message==='SOCIALDATAX_NOT_CONFIGURED'?503:['DAILY_BUDGET_EXCEEDED','DAILY_ITEMS_EXCEEDED'].includes(e.message)?429:e.message.startsWith('MODEL_')?502:400);
   return send({error:'请求未通过校验或V6数据库未就绪；原数据保留。请核对输入和增量迁移。'},400);
  }
 }
 root.RadarIntelAPI={handle};
})(globalThis);
