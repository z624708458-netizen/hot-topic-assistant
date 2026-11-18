/* V6 rules are independent from V3 and V4.1. All missing observations stay null. */
(function(root){
 'use strict';
 const platforms=['douyin','bilibili','xhs'];
 const platformNames={douyin:'抖音',bilibili:'B站',xhs:'小红书'};
 const keywords={财经商业:['企业经营','商业模式','消费降级','品牌竞争','企业裁员','大厂动态','公司倒闭','AI商业化'],职场就业:['裁员','失业','就业环境','程序员','工资变化','职场竞争','年轻人就业','35岁危机'],社会人口:['人口变化','房地产','城市发展','年轻人消费','教育','婚育','城市人口流动'],科技AI:['人工智能','AI替代人工','AI裁员','AI编程','大模型','科技公司','算力','国产科技']};
 const weights={relevance:25,absolute:25,relative:20,engagement:10,freshness:10,creative:10};
 const statuses=['待创作','创作中','已完成','已发布','暂不考虑'];
 const finite=v=>(typeof v==='number'||typeof v==='string'&&/^\d+(\.\d+)?$/.test(v))&&Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=Number.MAX_SAFE_INTEGER?Number(v):null;
 const date=v=>typeof v==='string'&&/(Z|[+-]\d\d:\d\d)$/.test(v)&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;
 function url(v){try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}}
 const day=(now=Date.now())=>new Date(now+28800000).toISOString().slice(0,10);
 function median(values){const a=values.filter(v=>v!==null).sort((x,y)=>x-y);return a.length?a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2:null;}
 function defaults(){return {version:1,enabled:false,platforms:['douyin'],keywords:JSON.parse(JSON.stringify(keywords)),frequency_hours:24,daily_limit:20,daily_items:100,max_items:100,cache_hours:6,retention_hours:24,weights:{...weights},min_score:60};}
 function settings(v){const d=defaults();if(!v||v.version!==1||typeof v.enabled!=='boolean'||!Array.isArray(v.platforms)||v.platforms.some(p=>!platforms.includes(p)))throw Error('数据源设置无效');
  for(const [k,min,max] of [['frequency_hours',1,168],['daily_limit',1,200],['daily_items',1,1000],['max_items',1,500],['cache_hours',1,24],['retention_hours',1,168],['min_score',1,100]])if(!Number.isInteger(v[k])||v[k]<min||v[k]>max)throw Error('设置超出范围：'+k);
  if(v.cache_hours>v.retention_hours)throw Error('缓存时长不能超过数据保留时长');
  if(!v.keywords||Object.keys(v.keywords).length>20)throw Error('关键词分类无效');let count=0;for(const [k,words] of Object.entries(v.keywords)){if(k.length>60||!Array.isArray(words)||words.length>60||words.some(w=>typeof w!=='string'||!w.trim()||w.length>60))throw Error('关键词无效');count+=words.length;}if(count>200)throw Error('关键词最多200个');
  if(!v.weights||Object.keys(weights).some(k=>!Number.isInteger(v.weights[k])||v.weights[k]<0||v.weights[k]>40)||Object.values(v.weights).reduce((a,b)=>a+b,0)!==100)throw Error('六项评分权重必须合计100，单项0–40');
  return {...d,...v,platforms:[...new Set(v.platforms)],weights:Object.fromEntries(Object.keys(weights).map(k=>[k,v.weights[k]])),keywords:Object.fromEntries(Object.entries(v.keywords).map(([k,a])=>[k,[...new Set(a.map(x=>x.trim()))]]))};
 }
 function validateWork(w){if(!w||!platforms.includes(w.platform)||typeof w.platform_id!=='string'||!w.platform_id||w.platform_id.length>300||typeof w.title!=='string'||!w.title||w.title.length>1000||!w.metrics||!w.author||!w.source||!date(w.source.fetched_at))throw Error('作品字段不完整');
  for(const k of ['views','likes','comments','saves','shares'])if(w.metrics[k]!==null&&(typeof w.metrics[k]!=='number'||finite(w.metrics[k])===null))throw Error('播放与互动指标须为真实数值或null');
  if(w.published!==null&&!date(w.published))throw Error('发布时间必须有时区，未知请留空');if(w.url!==null&&!url(w.url))throw Error('作品URL无效');
  if(w.author.id!==null&&(typeof w.author.id!=='string'||w.author.id.length>300)||w.author.name!==null&&(typeof w.author.name!=='string'||w.author.name.length>300))throw Error('作者标识无效');
  if(w.source.kind!=='socialdatax'&&w.source.kind!=='manual')throw Error('来源类型无效');return w;
 }
 function baseline(w,all,now=Date.now()){
  if(!w.author.id||!w.published)return {median:null,count:0,multiplier:null,label:'缺少作者ID或当前发布时间'};
  const before=Date.parse(w.published);if(before>now)return {median:null,count:0,multiplier:null,label:'当前作品发布时间在未来，无法评估'};const old=all.filter(x=>x.id!==w.id&&x.platform===w.platform&&x.author.id===w.author.id&&x.collection_kind==='author_feed'&&x.source.kind===w.source.kind&&x.metrics.views!==null&&x.published&&Date.parse(x.published)<before&&before-Date.parse(x.published)<=90*86400000&&(!x.expires_at||Date.parse(x.expires_at)>now)).sort((a,b)=>Date.parse(b.published)-Date.parse(a.published)).slice(0,30);
  const m=median(old.map(x=>x.metrics.views));if(old.length<5)return {median:null,count:old.length,multiplier:null,label:'历史作者作品不足5条，不能计算基准'};
  const ratio=m>0&&w.metrics.views!==null?w.metrics.views/m:null;
  return {median:m,count:old.length,multiplier:ratio,label:m===0?'历史中位数为0，不计算倍数':old.length<20?'小样本参考（建议至少20条）；未按作品年龄归一化':'近90天已知作品样本；未按作品年龄归一化'};
 }
 function grade(views){return views===null?null:views>=1e6?'S':views>=5e5?'A':views>=1e5?'B':views>=1e4?'C':'D';}
 function match(w,config=defaults()){const text=(w.title+' '+(w.description||'')).toLowerCase();return Object.entries(config.keywords).map(([name,words])=>({name,words:words.filter(k=>text.includes(k.toLowerCase()))})).filter(x=>x.words.length);}
 function score(w,all,config=defaults(),now=Date.now()){
  const b=baseline(w,all,now),g=grade(w.metrics.views),hits=match(w,config),metrics=w.metrics,ratio=b.multiplier;
  const interactionKeys=['likes','comments','saves','shares'],known=interactionKeys.filter(k=>metrics[k]!==null),sum=known.reduce((s,k)=>s+metrics[k],0);
  const age=w.published?(now-Date.parse(w.published))/3600000:null;
  const value=w.analysis&&finite(w.analysis.creative_value)!==null&&w.analysis.creative_value<=10?w.analysis.creative_value:null;
  const normal={relevance:Math.min(1,hits.reduce((s,h)=>s+h.words.length,0)/3),absolute:g?({S:1,A:.85,B:.65,C:.35,D:.1}[g]):null,relative:ratio===null?null:ratio>=10?1:ratio>=5?.85:ratio>=2?.65:ratio>=1?.25:0,
   engagement:metrics.views>0&&known.length?sum<=metrics.views?Math.min(1,sum/metrics.views/.05):null:null,
   freshness:age===null||age<0?null:age<=24?1:age<=72?.7:age<=168?.4:0,creative:value===null?null:value/10};
  const names={relevance:'领域相关性',absolute:'绝对播放表现',relative:'相对历史表现',engagement:'已知互动下界',freshness:'时效性',creative:'AI创作价值'};
  const parts=Object.keys(weights).map(key=>({key,name:names[key],max:config.weights[key],points:normal[key]===null?null:Math.round(normal[key]*config.weights[key]*10)/10}));
  return {version:'6.0.0',total:Math.round(parts.reduce((s,p)=>s+(p.points??0),0)*10)/10,available:parts.filter(p=>p.points!==null).reduce((s,p)=>s+p.max,0),parts,baseline:b,grade:g,domains:hits.map(x=>x.name),keywords:hits.flatMap(x=>x.words),ratio_label:ratio===null?'无法评估':ratio>=10?'超级异常表现':ratio>=5?'强爆款':ratio>=2?'明显超常':ratio>=1?'正常表现':'低于基准',partial_interaction:known.length<4};
 }
 const topicGroups=[{id:'ai-employment',title:'AI与用工变化',test:s=>/(AI|人工智能|大模型|智能体)/i.test(s)&&/(程序员|用工|裁员|就业|岗位|前端)/.test(s)}, {id:'jobs-income',title:'就业与收入变化',test:s=>/(裁员|失业|工资|薪资|招聘|35岁)/.test(s)}, {id:'housing',title:'房地产与城市生活',test:s=>/(房地产|房价|房贷|城市发展)/.test(s)}, {id:'population',title:'人口与婚育变化',test:s=>/(人口|生育|婚育|结婚|老龄|出生率)/.test(s)}, {id:'ai-business',title:'AI商业化与科技竞争',test:s=>/(AI|人工智能|大模型|算力|国产科技)/i.test(s)}];
 function clusters(works){const groups=new Map();for(const w of works){const t=w.title+' '+(w.description||''),rule=topicGroups.find(x=>x.test(t));if(!rule)continue;const g=groups.get(rule.id)||{id:rule.id,title:rule.title,method:'keyword_rules',label:'规则主题线索，未经语义确认',works:[],authors:[]};g.works.push(w.id);if(w.author.id&&!g.authors.includes(w.platform+':'+w.author.id))g.authors.push(w.platform+':'+w.author.id);groups.set(rule.id,g);}return [...groups.values()].filter(g=>g.authors.length>=2);}
 function recommend(works,config=defaults(),now=Date.now()){const ranked=works.map(w=>({work:w,score:score(w,works,config,now)})).filter(x=>x.work.source.kind==='socialdatax'&&x.work.analysis&&x.score.domains.length&&x.score.total>=config.min_score&&x.score.available>=70&&x.work.published&&now-Date.parse(x.work.published)<=7*86400000&&now>=Date.parse(x.work.published)).sort((a,b)=>b.score.total-a.score.total);const seen=new Set();return ranked.filter(x=>{const k=x.work.analysis?.topic||x.work.title;if(seen.has(k))return false;seen.add(k);return true;}).slice(0,10);}
 const api={platforms,platformNames,keywords,weights,statuses,finite,date,url,day,median,defaults,settings,validateWork,baseline,grade,match,score,clusters,recommend};root.RadarIntel=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
