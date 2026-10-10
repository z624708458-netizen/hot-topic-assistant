/* V4.1 UI. Private data stays in a separate browser key; V3 stores are untouched. */
(function(){
 'use strict';
 const B=window.RadarBrain,KEY='radar-brain-v4';
 const el=s=>document.querySelector(s),esc=escapeHTML;
 let state=B.defaultState(),blocked='',selected=null,editing=null,origin=null,generation=null,drafts={};
 const id=()=> 'kb-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
 function read(){
  const raw=localStorage.getItem(KEY);return raw===null?B.defaultState():B.validateState(JSON.parse(raw));
 }
 try{state=read();}catch{blocked='知识库暂时无法读取：浏览器存储不可用或数据格式异常。原有数据没有被清空或覆盖；请导出保留原数据。';}
 function commit(change){
  if(blocked)throw new Error(blocked);
  let next;
  try{next=change(read());B.validateState(next);localStorage.setItem(KEY,JSON.stringify(next));}
  catch(error){if(error.name==='QuotaExceededError')throw new Error('浏览器存储空间不足，素材尚未保存。输入仍保留，请先导出备份或缩短内容。');throw new Error(error.message||'浏览器无法保存素材，输入仍保留。');}
  state=next;return next;
 }
 function refresh(){render();renderDetail();}
 function metrics(m){return ['views','likes','comments','saves'].filter(k=>typeof m.fields[k]==='number').map(k=>({views:'播放',likes:'点赞',comments:'评论',saves:'收藏'}[k])+' '+m.fields[k].toLocaleString('zh-CN')).join(' · ');}
 function performanceBadge(m){if(m.type!=='work')return '';const p=B.gradePerformance(m);return `<span class="brain-performance-badge">${p.grade||'待补数据'} · ${esc(B.contentStatuses[B.contentStatus(m)])}</span>`;}
 function recordedMetrics(m){return ['views','likes','comments','saves'].map(k=>{const v=m.fields[k],label={views:'播放',likes:'点赞',comments:'评论',saves:'收藏'}[k];return label+'：'+(typeof v==='number'?(v>=10000?(v/10000).toLocaleString('zh-CN',{maximumFractionDigits:2})+' 万（'+v.toLocaleString('zh-CN')+'）':v.toLocaleString('zh-CN')):'未填');}).join(' · ');}
 function performanceHTML(m){const p=B.gradePerformance(m);return `<p>历史表现：<b>${p.grade||'数据不足'}</b>${p.grade?' · '+p.label:''} · ${esc(B.contentStatuses[B.contentStatus(m)])}</p><p>${esc(recordedMetrics(m))}</p><p class="brain-personal-note">${esc(p.explain)}</p>`;}
 function relevanceHTML(x){return `<p><b>相关性：${x.value} / 100 · ${x.band}</b>${x.eligible?' · 可参与加分':' · 不参与个人加分或切口组合'}</p>`;}
 function calculationHTML(a){return `<details class="brain-score-details" id="brain-calculations"><summary>查看个人匹配度计算与参与素材</summary><p class="brain-personal-note">相关性至少 ${a.threshold} 分才能参与；每类只取相关性 × 价值权重 × 类型上限的最高贡献。作品按成绩赋权，其他类型价值权重1。长期关注最多10分。分项四舍五入到1位小数，再相加；同类数量不加分。</p><p class="brain-personal-note">作品基础等级：S≥100万，A≥50万，B≥10万，C≥1万，D&lt;1万；已填互动率=(点赞+评论+收藏)/播放。播放≥1万且互动率≥5%升一级；三项齐全且低于0.1%降一级。互动合计超过播放时不作调整。权重S=1、A=0.85、B=0.7、C=0.5、D=0.3，播放未知=0.4。单次手动快照，未按作品年龄、曝光或平台归一化。</p>${a.personal.reasons.map(r=>`<article class="brain-calculation"><b>${r.label}：${r.points} / ${r.cap}</b><p>${esc(r.explain)}</p>${r.selected?`<button class="brain-reference" data-brain-jump="${esc(r.selected.material.id)}">参与素材：${esc(r.selected.material.title)} ↗</button>${relevanceHTML(r.selected)}<ul>${r.selected.breakdown.map(b=>`<li>${esc(b.label)}：+${b.points}${b.evidence.length?'（'+esc(b.evidence.join('、'))+'）':''}</li>`).join('')}</ul>${r.type==='work'?performanceHTML(r.selected.material):'<p>非作品素材价值权重为1，不代表内容质量已核验。</p>'}${r.candidates.length>1?`<p>本类另有 ${r.candidates.length-1} 条达到阈值；为避免重复堆分，不累计。</p>`:''}`:''}</article>`).join('')}</details>`;}
 function entryDate(m){if(m.type==='case'&&m.fields.date)return m.fields.date+'（经历日期）';const t=B.materialTime(m);return dateText(new Date(t).toISOString())+(m.type==='work'&&m.fields.published?' 发布':' 保存');}
 function buttons(m){return m.tags.map(t=>`<button data-brain-tag="${esc(t)}"># ${esc(t)}</button>`).join('');}
 function render(){
  el('#brain-count').textContent=state.materials.length;
  el('#brain-storage-error').hidden=!blocked;el('#brain-storage-error').textContent=blocked;
  const tagValue=el('#brain-tag').value,allTags=[...new Set(state.materials.flatMap(m=>m.tags))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
  el('#brain-tag').innerHTML='<option value="">全部标签</option>'+allTags.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');el('#brain-tag').value=allTags.includes(tagValue)?tagValue:'';
  const list=B.filter(state.materials,{query:el('#brain-search').value,type:el('#brain-type').value,tag:el('#brain-tag').value,sort:el('#brain-sort').value});
  if(!list.some(m=>m.id===selected))selected=list[0]?.id||null;
  el('#brain-caption').textContent=`全部 ${state.materials.length} 条 · 当前 ${list.length} 条 · 按经历日期 / 作品发布时间排序，未填日期使用首次保存时间`;
  el('#brain-list').innerHTML=list.length?list.map(m=>`<article class="brain-material-card ${m.id===selected?'active':''}"><span class="company-badge">${B.types[m.type].short}</span>${performanceBadge(m)}<h3><button data-brain-open="${esc(m.id)}">${esc(m.title)}</button></h3><p>${esc((m.body||B.meaningfulText?.(m)||Object.values(m.fields).filter(v=>typeof v==='string').join(' ')).slice(0,150))}</p><div class="brain-tags">${buttons(m)}</div><div class="brain-material-meta">${entryDate(m)}${metrics(m)?'<br>'+esc(metrics(m)):''}</div><button class="copy-button" data-brain-edit="${esc(m.id)}">查看 / 编辑素材 ↗</button></article>`).join(''):'<div class="empty"><b>'+ (state.materials.length?'没有匹配的素材':'第二大脑从你的一段文字开始')+'</b><p>'+(state.materials.length?'试试其他关键词、类型或标签。':'不会预填虚构的经历或作品。粘贴一段真实文字，选择类型即可保存。')+'</p><button class="primary" data-brain-add>＋ 添加素材</button></div>';
  renderMaterial();
  const works=B.performance(state.materials);
  el('#brain-performance-list').innerHTML=works.length?works.map(m=>`<div class="brain-performance-item"><button data-brain-jump="${esc(m.id)}">${esc(m.title)}</button><span>${performanceBadge(m)} 播放 ${m.fields.views.toLocaleString('zh-CN')}</span></div>`).join(''):'<p>暂无已填写播放量的作品。可从收藏转为历史作品，再补充发布后的数据。</p>';
 }
 function renderMaterial(){
  const m=state.materials.find(x=>x.id===selected);
  el('#brain-material-detail').innerHTML=m?`<span class="company-badge">${B.types[m.type].label}</span><h2>${esc(m.title)}</h2>${m.type==='work'?performanceHTML(m):''}<p class="brain-material-meta">首次保存 ${dateText(m.created_at)}<br>最近编辑 ${dateText(m.updated_at)}</p><div class="brain-tags">${buttons(m)}</div>${m.body?`<div class="brain-field"><strong>素材内容</strong><p>${esc(m.body)}</p></div>`:''}${B.types[m.type].fields.filter(([k])=>m.fields[k]!==null&&m.fields[k]!==undefined&&m.fields[k]!=='').map(([k,label,kind])=>`<div class="brain-field"><strong>${label}</strong>${kind==='url'?`<a class="source-link" href="${esc(safeURL(m.fields[k]))}" target="_blank" rel="noopener noreferrer">打开素材来源 ↗</a>`:`<p>${esc(kind==='datetime-local'?dateText(m.fields[k]):kind==='select'?B.contentStatuses[B.contentStatus(m)]:m.fields[k])}</p>`}</div>`).join('')}${generationHTML(m.generation)}${originHTML(m.origin,!!m.generation)}<button class="primary brain-section-action" data-brain-edit="${esc(m.id)}">编辑素材</button>`:'<div class="empty"><b>选择一条素材</b><p>这里展示完整内容和可选字段。</p></div>';
 }
 function originHTML(o,generated=false){return o?`<div class="brain-field"><strong>${generated?'由口播生成器转入':'由收藏新闻转入'}</strong><p>${esc(o.title)}<br>${esc(o.source||'')} · ${dateText(o.published)}</p><a class="source-link" href="${esc(safeURL(o.url))}" target="_blank" rel="noopener noreferrer">打开关联新闻 ↗</a><p>${generated?'口播初稿来源于规则生成；尚未填写发布成绩，生成时间不等于发布时间。':'关联新闻不是你的作品文案；作品数据与复盘由你手动填写。'}</p></div>`:'';}
 function generationHTML(g){if(!g)return '';return `<div class="brain-field"><strong>口播生成记录 · 免费规则</strong><p>${dateText(g.generated_at)} 生成 · ${g.duration}秒目标 · 结构${g.structure}</p>${g.used_materials.map(x=>`<p>${esc(B.types[x.type].short+' · '+x.title)} · 相关性${x.relevance}${x.performance?' · 表现'+x.performance:''}</p>${state.materials.some(m=>m.id===x.id)?`<button class="brain-reference" data-brain-jump="${esc(x.id)}">打开调用素材 ↗</button>`:'<p>源素材当前不存在，保留生成时的引用记录。</p>'}`).join('')}<p>观点 / 经历与新闻事实分开记录；发布前请重新核对新闻来源与风险检查。</p></div>`;}
 function renderProfile(){
  el('#brain-profile-companies').innerHTML=Object.keys(B.companyAliases).map(c=>`<label><input type="checkbox" name="focus-company" value="${c}" ${state.profile.companies.includes(c)?'checked':''}>${c}</label>`).join('');
  el('#brain-profile-domains').value=state.profile.domains.join('，');
 }
 function renderAnalysis(n){
  if(blocked)return `<section class="personal-fit"><h3>适合我讲吗？</h3><p>${esc(blocked)}</p><button class="secondary brain-section-action" data-view="brain">打开第二大脑</button></section>${window.SpeechUI?.render(n)||''}`;
  const a=B.analyse(n,state);
  return `<section class="personal-fit" aria-label="适合我讲吗"><h3>适合我讲吗？</h3><button type="button" class="personal-fit-score" data-brain-score aria-expanded="false" aria-controls="brain-calculations" title="查看参与素材与评分计算">${a.personal.total}<small> / 100 · 个人匹配度</small></button><p>${a.personal.label}</p>${a.personal.reasons.map(r=>`<div class="personal-reason"><b>+${r.points} ${r.label}</b><span>${esc(r.explain)}</span>${r.material_id?`<button class="copy-button brain-reference" data-brain-jump="${esc(r.material_id)}">查看加分素材 ↗</button>`:''}</div>`).join('')}<p class="brain-personal-note">个人匹配度来自历史素材、相关性和历史表现的规则计算，不代表未来播放量预测。个人分不改变 V3 新闻分与 Top 5。</p>${calculationHTML(a)}</section>
   <section class="brain-analysis-section brain-history"><h3>类似内容过去表现</h3><p class="brain-personal-note">${esc(a.history.summary)} 展示最多3条，按相关性排序；未知数据显示未填。</p>${a.history.items.map(x=>`<article class="brain-history-item"><h4><button data-brain-jump="${esc(x.material.id)}">${esc(x.material.title)} ↗</button></h4>${relevanceHTML(x)}${performanceHTML(x.material)}</article>`).join('')}</section>
   ${window.SpeechUI?.render(n)||''}
   <section class="brain-analysis-section brain-content-risk" data-risk-level="${a.risk.level}"><h3>内容风险：${a.risk.level}</h3><p>${esc(a.risk.note)}</p>${a.risk.items.map(x=>`<article class="brain-risk-item"><b>风险提示 · ${esc(x.label)}</b><button class="brain-reference" data-brain-jump="${esc(x.id)}">${esc(x.title)} ↗</button><p>${esc(x.reason)}</p>${x.note?`<p>你记录的风险复盘（未独立核实）：${esc(x.note)}</p>`:''}</article>`).join('')}${a.risk.count>3?`<p>另有 ${a.risk.count-3} 条相关风险记录，可在知识库查看。</p>`:''}</section>
   <section class="brain-analysis-section brain-related"><h3>我的第二大脑</h3><p class="brain-personal-note">共 ${a.matchedCount} 条规则命中，展示最多 5 条。公司/人物25、具体产品25、主题20、利益点15、叙事10、标签5；80起强相关，60起中高相关，40起弱相关，低于40仅作扩展。仅60分以上参与个人加分与切口。基于已保存标题、RSS摘要和手动正文；不自动读取原文全文，不是 AI 语义分析。</p>${a.matches.length?a.matches.map(x=>`<article class="brain-match"><span class="company-badge">${B.types[x.material.type].short}</span>${performanceBadge(x.material)}<h4><button data-brain-jump="${esc(x.material.id)}">${esc(x.material.title)} ↗</button></h4>${relevanceHTML(x)}<p><b>为什么相关：</b>${esc(x.reasons.join('；'))}</p><p><b>可以怎么用：</b>${esc(x.eligible?x.use:'仅作为扩展参考，请先核对事件与产品是否一致；不据此推荐个人切口。')}</p>${x.material.type==='work'?performanceHTML(x.material):''}</article>`).join(''):'<p class="brain-personal-note">还没有相关历史素材。不会编造你的经历、观点或作品。</p>'}<button class="secondary brain-section-action" data-view="brain">打开第二大脑 / 添加素材 ↗</button></section>
   <section class="brain-analysis-section"><h3>我的切入角度</h3>${a.angles.length?a.angles.map(x=>`<article class="brain-angle"><h4>${esc(x.line)}</h4><p><b>为什么适合我：</b>${esc(x.why)}</p><p><b>内容结构：</b>${esc(x.structure)}</p><p>可调用素材：</p>${x.materials.map(m=>`<button class="brain-reference" data-brain-jump="${esc(m.id)}">${B.types[m.type].short} · ${esc(m.title)} ↗</button>`).join('')}</article>`).join(''):'<p class="brain-personal-note">暂无60分以上相关素材，不组合个人切口。上方 V3 普通人视角与口播框架仍可使用。</p>'}<p class="brain-personal-note">规则组合提示，不自动判断观点正确性；使用作品时同时核对上方内容风险，勿复用被屏蔽的表达。</p></section>`;
 }
 function captureFields(){
  const values={};el('#brain-extra-fields').querySelectorAll('[data-field]').forEach(input=>values[input.dataset.field]=input.value);return values;
 }
 function showFields(type,values={}){
  el('#brain-extra-fields').innerHTML=B.types[type].fields.map(([key,label,kind])=>{
   let value=values[key]??(kind==='select'?'normal':'');
   if(kind==='datetime-local'&&value&&/Z$/.test(value))value=new Date(Date.parse(value)+28800000).toISOString().slice(0,16);
   const attrs=`data-field="${key}" name="field-${key}"`;
   return `<label>${label}${kind==='select'?`<select ${attrs}>${Object.entries(B.contentStatuses).map(([k,label])=>`<option value="${k}" ${value===k?'selected':''}>${label}</option>`).join('')}</select>`:kind?`<input ${attrs} type="${kind}" ${kind==='number'?'min="0" step="1"':''} ${kind==='text'?'maxlength="1000"':''} value="${esc(value)}">`:`<textarea ${attrs} rows="3" maxlength="50000">${esc(value)}</textarea>`}</label>`;
  }).join('');
 }
 function openEditor(material=null,news=null){
  editing=material;generation=material?.generation||null;origin=material?.origin|| (news?{news_id:news.id,title:news.title,url:news.url,source:news.source,published:news.published}:null);drafts={};
  el('#brain-form').reset();const type=material?.type||(news?'work':'case');
  el('#brain-editor-type').value=type;el('#brain-editor-type').dataset.previous=type;
  el('#brain-form [name="brain-title"]').value=material?.title||news?.title||'';
  el('#brain-form [name="brain-body"]').value=material?.body||'';
  el('#brain-form [name="brain-tags"]').value=material?.tags.join('，')|| (news?news.companies.join('，'):'');
  el('#brain-dialog-title').textContent=material?'编辑素材':news?'转为历史作品':'添加素材';
  el('#brain-dialog-intro').textContent=news?'保留关联新闻，填写你自己的文案与发布后的数据；新闻摘要不会被当作你的作品。全部数据可稍后补充。':'不必填完所有字段。直接粘贴文字、选择类型，就能保存。';
  showFields(type,material?.fields||(news?{platform:el('#platform').value}:{}));el('#brain-extra').open=!!news;
  el('#brain-origin').innerHTML=originHTML(origin,!!generation);el('#brain-form-error').textContent='';el('#brain-dialog').showModal();
 }
 function openGeneratedWork(g){
  window.RadarSpeech.validateResult(g);const record=window.RadarSpeech.workGeneration(g);B.validateGeneration(record);openEditor(null,g.news);generation=record;
  el('#brain-form [name="brain-body"]').value=g.main;el('#brain-extra-fields [data-field="copy"]').value=g.main;
  el('#brain-dialog-intro').textContent='带入新闻标题、当前口播稿、调用素材与生成时间。生成不代表已经发布；发布时间和成绩留空，由你之后补充。';
  el('#brain-origin').innerHTML=generationHTML(generation)+originHTML(origin,true);
 }
 function jump(value){
  el('#brain-search').value='';el('#brain-type').value='all';el('#brain-tag').value='';selected=value;setView('brain');
  if(window.innerWidth<=900)el('#brain-material-detail').scrollIntoView({behavior:'smooth',block:'start'});
 }
 el('#brain-editor-type').innerHTML=Object.entries(B.types).map(([k,t])=>`<option value="${k}">${t.label}</option>`).join('');
 el('#brain-type').innerHTML+=Object.entries(B.types).map(([k,t])=>`<option value="${k}">${t.label}</option>`).join('');
 el('#brain-add').addEventListener('click',()=>openEditor());el('#brain-close').addEventListener('click',()=>el('#brain-dialog').close());
 el('#brain-editor-type').addEventListener('change',e=>{drafts[e.target.dataset.previous]=captureFields();showFields(e.target.value,drafts[e.target.value]||{});e.target.dataset.previous=e.target.value;});
 el('#brain-search').addEventListener('input',render);['brain-type','brain-tag','brain-sort'].forEach(k=>el('#'+k).addEventListener('change',render));
 el('#brain-form').addEventListener('submit',event=>{
  event.preventDefault();try{
   const type=el('#brain-editor-type').value,body=el('#brain-form [name="brain-body"]').value.trim(),fields=captureFields();
   for(const [key,label,kind] of B.types[type].fields){if(kind==='number')fields[key]=fields[key]===''?null:Number(fields[key]);if(kind==='datetime-local'&&fields[key])fields[key]=new Date(fields[key]+'+08:00').toISOString();}
   const supplied=el('#brain-form [name="brain-title"]').value.trim();
   const title=supplied||(body||fields.point||fields.original||fields.comment||fields.event||fields.copy||'').split('\n').find(x=>x.trim())?.trim().slice(0,60);
   if(!title)throw new Error('写一个标题、粘贴一段文字或填写核心内容，即可保存。');
   const now=new Date().toISOString(),m={id:editing?.id||id(),type,title,body,fields,tags:B.tags(el('#brain-form [name="brain-tags"]').value),created_at:editing?.created_at||now,updated_at:now,...(origin?{origin}: {}),...(generation?{generation}: {})};B.validate(m);
   commit(latest=>{const current=latest.materials.find(x=>x.id===m.id);if(editing&&current&&current.updated_at!==editing.updated_at)throw new Error('这条素材已在另一窗口修改；当前输入仍保留，请复制内容后重新打开素材。');return {...latest,materials:latest.materials.filter(x=>x.id!==m.id).concat(m),updated_at:now};});
   selected=m.id;el('#brain-dialog').close();if(view==='brain'){el('#brain-search').value='';el('#brain-type').value='all';el('#brain-tag').value='';}refresh();notify('素材已保存到当前浏览器。');
  }catch(error){el('#brain-form-error').textContent=error.message;}
 });
 el('#brain-profile-form').addEventListener('submit',event=>{
  event.preventDefault();try{const p=B.profile({companies:[...el('#brain-profile-companies').querySelectorAll('input:checked')].map(x=>x.value),domains:B.tags(el('#brain-profile-domains').value)});commit(latest=>({...latest,profile:p}));el('#brain-profile-error').textContent='';renderProfile();refresh();notify('长期关注已保存。');}catch(error){el('#brain-profile-error').textContent=error.message;}
 });
 document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.hasAttribute('data-brain-add'))openEditor();
  if(button.hasAttribute('data-brain-score')){const details=el('#brain-calculations');if(details){details.open=!details.open;button.setAttribute('aria-expanded',String(details.open));}}
  if(button.dataset.brainOpen){selected=button.dataset.brainOpen;render();}
  if(button.dataset.brainEdit)openEditor(state.materials.find(m=>m.id===button.dataset.brainEdit));
  if(button.dataset.brainJump)jump(button.dataset.brainJump);
  if(button.hasAttribute('data-brain-tag')){el('#brain-tag').value=button.dataset.brainTag;render();}
  if(button.dataset.toWork){const news=allNews().find(n=>n.id===button.dataset.toWork);if(news)openEditor(null,news);}
 });
 el('#brain-export').addEventListener('click',()=>{
  try{const raw=blocked?localStorage.getItem(KEY):JSON.stringify(read());if(raw===null)throw new Error('没有可导出的知识库数据。');const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='热点雷达-第二大脑-'+new Date(Date.now()+28800000).toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('已导出当前知识库。备份包含个人内容，请自行保管。');}catch(error){notify(error.message||'无法导出，请检查浏览器存储设置。');}
 });
 el('#brain-import').addEventListener('click',()=>el('#brain-import-file').click());
 el('#brain-import-file').addEventListener('change',async event=>{
  try{const file=event.target.files[0];if(!file)return;if(file.size>10*1024*1024)throw new Error('备份超过10MB，暂不导入。');const incoming=B.validateState(JSON.parse(await file.text()));let added=0;
   commit(latest=>{const materials=latest.materials.slice();for(const m of incoming.materials){const old=materials.find(x=>x.id===m.id);if(old&&JSON.stringify(old)===JSON.stringify(m))continue;materials.push(old?{...m,id:id()}:m);added++;}return {...latest,materials,profile:{companies:[...new Set([...latest.profile.companies,...incoming.profile.companies])],domains:B.tags([...latest.profile.domains,...incoming.profile.domains])}};});
   renderProfile();refresh();el('#brain-storage-error').hidden=true;notify(`已追加 ${added} 条素材并合并长期关注，原有素材未覆盖。`);
  }catch(error){el('#brain-storage-error').hidden=false;el('#brain-storage-error').textContent='导入未完成，原有数据未修改：'+error.message;}finally{event.target.value='';}
 });
 window.addEventListener('storage',event=>{if(event.key!==KEY)return;try{state=read();blocked='';renderProfile();refresh();}catch{blocked='另一个窗口的知识库存储异常，原数据未覆盖。';render();}});
 document.addEventListener('toggle',event=>{if(event.target.id==='brain-calculations')el('[data-brain-score]')?.setAttribute('aria-expanded',String(event.target.open));},true);
 window.BrainUI={render,openEditor,renderAnalysis,jump,openGeneratedWork,getState:()=>{if(blocked)throw new Error(blocked);return structuredClone(read());}};renderProfile();render();renderDetail();
})();
