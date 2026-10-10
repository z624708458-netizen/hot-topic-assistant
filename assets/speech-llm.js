/* LLM-only orchestration: select full records, send context, validate model output. */
(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./brain-rules.js'):root.RadarBrain,node?require('./speech-rules.js'):root.RadarSpeech,node?require('./speech-contract.js'):root.RadarSpeechContract);if(node)module.exports=api;else root.RadarSpeechLLM=api;})(globalThis,function(B,S,C){
 'use strict';
 function writingPreference(text){return /口播|写稿|文案|科技内容|内容创作|视频开头/.test(text)&&/切入|不要|优先|风格|少讲|结构|口语|参数/.test(text);}
 function buildRequest({news,brain,duration=60,action='generate',existing=null}){
  B.validateState(brain);const matches=B.matches(news,brain.materials),eligible=matches.filter(x=>x.value>=60);
  const works=eligible.filter(x=>x.material.type==='work'&&['normal','deleted'].includes(B.contentStatus(x.material))&&['S','A','B'].includes(B.gradePerformance(x.material).grade)&&(x.material.fields.copy||x.material.body).trim()).sort((a,b)=>(b.value>=80)-(a.value>=80)||B.gradePerformance(b.material).factor-B.gradePerformance(a.material).factor||b.value-a.value||a.material.id.localeCompare(b.material.id)).slice(0,4);
  const views=eligible.filter(x=>x.material.type==='opinion'&&(x.material.fields.point||x.material.body).trim()).sort((a,b)=>b.value-a.value||a.material.id.localeCompare(b.material.id)).slice(0,3);
  const describe=x=>({id:x.material.id,type:x.material.type,title:x.material.title,text:x.material.type==='work'?(x.material.fields.copy||x.material.body):(x.material.fields.point?Object.entries(x.material.fields).filter(([k,v])=>['point','background','reason','counter'].includes(k)&&v).map(([k,v])=>k+'：'+v).join('\n')+(x.material.body?'\n'+x.material.body:''):x.material.body),relevance:x.value,performance:x.material.type==='work'?B.gradePerformance(x.material).grade:null,status:B.contentStatus(x.material),metrics:x.material.type==='work'?Object.fromEntries(['views','likes','comments','saves'].map(k=>[k,x.material.fields[k]??null])):{}});
  const opinions=views.map(describe),risk=B.contentRisk(news,matches);
  const p={version:C.version,action,duration,current_news:S.snapshot(news),style_works:works.map(describe),opinions:opinions.filter(m=>!writingPreference(m.text)),writing_preferences:opinions.filter(m=>writingPreference(m.text)),risk_records:risk.items.map(r=>{const m=brain.materials.find(x=>x.id===r.id);return {id:m.id,title:m.title,status:B.contentStatus(m),text:m.fields.copy||m.body,note:m.fields.risk_note||'',relevance:r.relevance??60};}),focus:[...brain.profile.companies,...brain.profile.domains],existing_draft:existing?.main||''};
  C.validateRequest(p);return p;
 }
 function normalizeResult(o,p,{model='OpenAI',existing=null}={}){
  C.validateOutput(o,p);const submitted=[...p.style_works,...p.opinions,...p.writing_preferences];
  const segments=o.paragraphs.map((s,i)=>({text:s.text,kind:s.kind,evidence:{references:s.references},role:i===0?'hook':'body'}));
  const main=p.action==='opening'&&existing?existing.main:segments.map(s=>s.text).join('\n\n');
  const result={version:C.version,provider:'openai',model,news:S.snapshot(p.current_news),duration:p.duration,angleIndex:p.action==='angle'?(existing?.angleIndex||0)+1:existing?.angleIndex||0,availableStructures:['A','B','C','D'],structure:o.structure,structureLabel:o.structure_label,angle:o.angle,hookVersion:(existing?.hookVersion||0)+(p.action==='opening'?1:0),generated_at:new Date().toISOString(),segments:p.action==='opening'&&existing?existing.segments:segments,main,openings:o.openings,titles:o.titles,used_materials:submitted.map(m=>({id:m.id,type:m.type,title:m.title,relevance:m.relevance,performance:m.performance,role:m.type==='work'?'全文已交给模型，作为语言节奏与结构参考，不作为当前事实':p.writing_preferences.some(x=>x.id===m.id)?'已作为写作偏好传入，不念进正文':'已作为历史观点传入，不作为当前事实'})),model_used_ids:o.used_material_ids,risk:{level:p.risk_records.some(x=>x.status==='removed')?'高':p.risk_records.length?'中':'低',count:p.risk_records.length,items:p.risk_records},contextNote:`本次交给模型：${p.style_works.length}条高表现作品全文、${p.opinions.length}条事件观点、${p.writing_preferences.length}条写作偏好、${p.risk_records.length}条风险记录。${p.style_works.length<2?'相关高表现全文不足2条，不补充无关作品，也不宣称学到了完整个人风格。':''}素材已传入不代表模型已成功学到，最终由你审稿。`,why:o.why};
  if(p.action==='opening'&&existing){result.used_materials=existing.used_materials;result.risk=existing.risk;result.structure=existing.structure;result.structureLabel=existing.structureLabel;result.angle=existing.angle;result.contextNote=existing.contextNote;result.titles=existing.titles;result.why=existing.why;}
  result.checks=C.check(main,result,S.hazards);result.timing=S.timing(main,p.duration);return S.validateResult(result);
 }
 function endpoint(value){const u=new URL(value);if(u.username||u.password||u.search||u.hash||!(u.protocol==='https:'||u.protocol==='http:'&&['127.0.0.1','localhost'].includes(u.hostname)))throw new Error('请填写HTTPS服务端地址，不要填写Key或账号密码');return u.href.replace(/\/$/,'');}
 async function call(p,connection,{fetcher=globalThis.fetch,existing=null}={}){
  C.validateRequest(p);if(!connection?.endpoint||!connection.accessToken)throw new Error(C.unavailable);
  if(connection.accessToken.startsWith('sk-'))throw new Error('这里是应用访问码，不能填写OpenAI API Key；Key只能配置在服务端');
  const base=endpoint(connection.endpoint),response=await fetcher(base+'/generate',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+connection.accessToken},body:JSON.stringify(p),signal:AbortSignal.timeout(65000),cache:'no-store',credentials:'omit'});
  let data;try{data=await response.json();}catch{throw new Error('模型接口未返回有效JSON，旧稿保留，请检查服务端地址');}
  if(!response.ok)throw new Error(data?.error||'模型请求失败，旧稿保留');
  if(!data||data.provider!=='openai'||!data.model)throw new Error('接口没有返回真实模型Provider，未生成口播');
  return normalizeResult(data.output,p,{model:data.model,existing});
 }
 return {version:C.version,buildRequest,normalizeResult,endpoint,call,writingPreference,unavailable:C.unavailable};
});
