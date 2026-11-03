/* Blogger Radar V1: observed data only; no platform cache in durable user state. */
(function(root,factory){const api=factory();root.RadarBlogger=api;if(typeof module==='object'&&module.exports)module.exports=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const domains={社会热点:['社会热点','民生','劳动权益','社保','住房','教育','医疗','消费','公共事件'],就业:['就业','招聘','失业','求职','工资','薪资','裁员','校招','应届生','灵活就业','农民工'],职场:['职场','加班','双休','996','劳动合同','五险一金','降薪','绩效','管理','职场关系'],人口:['人口','出生率','生育率','人口流动','人口净流入','老龄化','养老','退休','结婚','户籍']};
 const tabs=['today','following','ignored'];
 const text=(v,max=2000)=>typeof v==='string'?v.slice(0,max):'';
 function link(v){try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}}
 function endpoint(v){if(!v)return '';const u=new URL(v);if((u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))||u.username||u.password||u.search||u.hash)throw Error('服务地址须为HTTPS，不含密钥、查询参数或账号');return u.href.replace(/\/$/,'');}
 function stamp(v){return typeof v==='string'&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;}
 function number(v){return (typeof v==='number'||typeof v==='string'&&/^\d+(\.\d+)?$/.test(v))&&Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=Number.MAX_SAFE_INTEGER?Number(v):null;}
 function hash(v){let h=2166136261;for(const c of v){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
 function classify(value){const s=String(value).toLowerCase();return Object.entries(domains).map(([domain,words])=>({domain,words:words.filter(w=>s.includes(w.toLowerCase()))})).filter(x=>x.words.length);}
 function identity(a,workID=''){if(a.platform_id)return {id:'dy:'+a.platform_id,confidence:'high',reason:'官方稳定作者ID（应用范围内）'};if(a.nickname&&a.avatar)return {id:'weak:'+hash(a.nickname+'|'+a.avatar),confidence:'low',reason:'仅昵称＋头像辅助合并，可能重名或换头像，非身份认证'};return {id:'uncertain:'+hash(workID+'|'+a.nickname),confidence:'low',reason:'缺少稳定ID或头像；按作品分开保留，不强行合并同名作者'};}
 function score(author,now=Date.now()){
  const works=author.works||[],hits=classify(works.map(w=>w.title+' '+(w.keywords||[]).join(' ')).join(' '));
  const keywords=[...new Set(hits.flatMap(x=>x.words))];
  const knownDates=works.filter(w=>w.published&&Date.parse(w.published)<=now),recent=knownDates.filter(w=>now-Date.parse(w.published)<=7*86400000);
  const interactions=works.map(w=>Object.values({likes:w.metrics.likes,comments:w.metrics.comments,shares:w.metrics.shares}).filter(v=>v!==null));
  const hasInteraction=interactions.some(v=>v.length),sum=interactions.reduce((s,v)=>s+v.reduce((a,b)=>a+b,0),0);
  const last=knownDates.length?Math.max(...knownDates.map(w=>Date.parse(w.published))):null;
  const parts=[{label:'领域匹配',max:40,points:hits.length?Math.min(40,20+10*(keywords.length-1)):0,reason:keywords.join('、')||'未命中领域词'},
   {label:'近7天相关作品',max:25,points:knownDates.length?Math.min(25,recent.length*5):null,reason:knownDates.length?'已发现且有日期的近7天作品'+recent.length+'条；不是账号全部产量':'发布时间缺失，无法评估'},
   {label:'作品互动表现',max:20,points:hasInteraction?Math.min(20,Math.round(Math.log10(1+sum)*4)):null,reason:hasInteraction?'已返回赞/评/分享合计'+sum+'，缺项不补；不推断互动率或历史均值':'没有赞/评/分享数据，无法评估'},
   {label:'最近活跃',max:15,points:last===null?null:now-last<=86400000?15:now-last<=3*86400000?10:now-last<=7*86400000?5:0,reason:last===null?'发布时间缺失，无法评估':'仅按本次已知最近作品发布时间'}];
  return {earned:parts.reduce((s,p)=>s+(p.points??0),0),available:parts.filter(p=>p.points!==null).reduce((s,p)=>s+p.max,0),parts,domains:hits.map(x=>x.domain),last_published:last===null?null:new Date(last).toISOString(),recent_count:recent.length,discovered_count:works.length};
 }
 function validateWork(w){
  if(!w||typeof w.id!=='string'||!w.id||w.id.length>300||typeof w.title!=='string'||w.title.length>600||!w.author||!w.metrics||!w.source||!Array.isArray(w.keywords)||w.keywords.some(x=>typeof x!=='string')||!Array.isArray(w.source.available_fields)||w.source.available_fields.some(x=>typeof x!=='string'))throw Error('官方适配作品格式异常');
  for(const k of ['views','likes','comments','shares'])if(w.metrics[k]!==null&&(typeof w.metrics[k]!=='number'||number(w.metrics[k])===null))throw Error('官方适配互动字段不完整或无效');
  for(const k of ['platform_id','nickname','avatar'])if(w.author[k]!==null&&typeof w.author[k]!=='string')throw Error('官方适配作者字段无效');
  if(w.published!==null&&!stamp(w.published)||!stamp(w.source.fetched_at)||typeof w.source.name!=='string'||typeof w.source.api!=='string'||typeof w.source.scope!=='string')throw Error('官方适配来源或时间无效');
  return w;
 }
 function candidates(works,now=Date.now()){
  const map=new Map();
  for(const w of works){if(!w.author.platform_id&&!w.author.nickname)continue;if(!classify(w.title+' '+(w.keywords||[]).join(' ')).length)continue;
   const ident=identity(w.author,w.id),old=map.get(ident.id);
   if(old){if(!old.works.some(x=>x.id===w.id||(x.url&&x.url===w.url)))old.works.push(w);}
   else map.set(ident.id,{id:ident.id,nickname:w.author.nickname||'作者昵称暂无数据',platform_id:w.author.platform_id||null,avatar:w.author.avatar||null,identity_confidence:ident.confidence,identity_reason:ident.reason,homepage:'',origin:'official',works:[w]});
  }
  return [...map.values()].map(a=>({...a,...score(a,now)})).sort((a,b)=>b.earned-a.earned||b.available-a.available||a.id.localeCompare(b.id)).slice(0,30);
 }
 const defaultState=()=>({schema_version:1,authors:[],filters:{tab:'today',domain:'all',endpoint:''}});
 function checkString(v,max){if(typeof v!=='string'||v.length>max)throw Error('备份文字字段不合法');return v;}
 function manualWork(w){if(!w||typeof w!=='object')throw Error('作品记录无效');const url=checkString(w.url,2000);if(!link(url))throw Error('作品链接必须为HTTPS');return {id:checkString(w.id,200),url:link(url),title:checkString(w.title,600),note:checkString(w.note,30000),added_at:stamp(w.added_at)||(()=>{throw Error('作品记录日期无效');})(),origin:'manual'};}
 function validateState(s){
  if(!s||s.schema_version!==1||!Array.isArray(s.authors)||s.authors.length>2000||!s.filters||!tabs.includes(s.filters.tab)||!['all',...Object.keys(domains)].includes(s.filters.domain))throw Error('不是有效的博主雷达V1备份');
  const ids=new Set();const authors=s.authors.map(a=>{
   if(!a||!Array.isArray(a.domains)||a.domains.some(d=>!Object.hasOwn(domains,d))||typeof a.followed!=='boolean'||typeof a.ignored!=='boolean'||a.followed&&a.ignored||!Array.isArray(a.works)||a.works.length>300)throw Error('博主记录无效');
   const id=checkString(a.id,200);if(!id||ids.has(id))throw Error('博主编号为空或重复');ids.add(id);
   const homepage=checkString(a.homepage,2000);if(homepage&&!link(homepage))throw Error('主页链接无效，不会猜测主页');
   if(!stamp(a.created_at)||!stamp(a.updated_at))throw Error('博主记录日期无效');
   const workIds=new Set();const works=a.works.map(manualWork);for(const w of works){if(workIds.has(w.id))throw Error('作品编号重复');workIds.add(w.id);}
   return {id,nickname:checkString(a.nickname,300),platform_id:a.platform_id===null?null:checkString(a.platform_id,200),domains:[...new Set(a.domains)],homepage,followed:a.followed,ignored:a.ignored,created_at:stamp(a.created_at),updated_at:stamp(a.updated_at),origin:'user_reference',works};
  });
  return {schema_version:1,authors,filters:{tab:s.filters.tab,domain:s.filters.domain,endpoint:endpoint(checkString(s.filters.endpoint,2000))}};
 }
 function reference(a,now=new Date().toISOString()){return {id:a.id,nickname:a.nickname,platform_id:a.platform_id||null,domains:a.domains||[],homepage:link(a.homepage)||'',followed:false,ignored:false,origin:'user_reference',created_at:now,updated_at:now,works:[]};}
 function update(s,author,action){const next=validateState(s),existing=next.authors.find(x=>x.id===author.id),a=existing||reference(author);if(!existing)next.authors.push(a);
  if(action==='follow'){a.followed=true;a.ignored=false;}else if(action==='unfollow')a.followed=false;else if(action==='ignore'){a.ignored=true;a.followed=false;}else if(action==='restore')a.ignored=false;else throw Error('未知操作');a.updated_at=new Date().toISOString();return validateState(next);
 }
 function merge(local,incoming){const a=validateState(local),b=validateState(incoming);for(const item of b.authors){const old=a.authors.find(x=>x.id===item.id);if(!old){a.authors.push(item);continue;}
  if(old.platform_id&&item.platform_id&&old.platform_id!==item.platform_id)throw Error('相同编号对应不同身份，导入拒绝');
  if(!old.homepage)old.homepage=item.homepage;old.domains=[...new Set([...old.domains,...item.domains])];
  for(const w of item.works){const same=old.works.find(x=>x.id===w.id||x.url===w.url);if(!same)old.works.push(w);else if(JSON.stringify(same)!==JSON.stringify(w)&&same.note!==w.note){if(!old.works.some(x=>x.url===w.url&&x.note===w.note))old.works.push({...w,id:'manual:'+hash(JSON.stringify(w)),url:w.url});}}
 }return validateState(a);}
 return {version:'1.0.0',domains,tabs,text,link,endpoint,stamp,number,hash,classify,identity,score,candidates,validateWork,defaultState,validateState,reference,update,merge};
});
