'use strict';
const rules = window.RadarRules;
const $ = selector => document.querySelector(selector);
const escapeHTML = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function safeURL(value) {
  try {
    const u=new URL(value);
    return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';
  } catch { return ''; }
}
function readStore(key,fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function validNews(n) {
  return n&&['id','title','published','company','source','url'].every(key=>typeof n[key]==='string'&&n[key].length>0)
    &&typeof n.summary==='string'&&n.title.length<=600&&n.summary.length<=1600
    &&safeURL(n.url)&&Number.isFinite(Date.parse(n.published))
    &&(!n.companies||(Array.isArray(n.companies)&&n.companies.every(c=>typeof c==='string')));
}
function normalized(n) {
  return {...n,company:n.company==='阿里'?'阿里巴巴':n.company,
    companies:(n.companies||[n.company]).map(c=>c==='阿里'?'阿里巴巴':c)};
}
function newsArray(value) { return Array.isArray(value)?value.filter(validNews).map(normalized):[]; }
const legacy = readStore('radar-news-v1',[]);
const legacyManual = Array.isArray(legacy)?legacy.filter(n=>n&&typeof n==='object').map(n=>({...n,title:n.newsTitle||n.title,summary:n.facts||'',kind:'manual',source:'用户提供 · 未独立核验'})):[];
let custom = newsArray(readStore('radar-news-v2',legacyManual)).map(n=>({...n,kind:'manual'}));
let snapshots = newsArray(readStore('radar-snapshots-v2',[]));
const previousSaved=readStore('radar-saved-v2',readStore('radar-saved-v1',[]));
let saved=new Set(Array.isArray(previousSaved)?previousSaved.filter(v=>typeof v==='string'):[]);
let data=null, fetched=[], company='全部', selectedId=null, tab='overview', view='recommend', showAll=false;
let loading=false, loadError='', usingCache=false, toastTimer;
function notify(text) {
  $('#toast').textContent=text;$('#toast').classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3000);
}
function persist() {
  try {
    localStorage.setItem('radar-news-v2',JSON.stringify(custom));
    localStorage.setItem('radar-saved-v2',JSON.stringify([...saved]));
    localStorage.setItem('radar-snapshots-v2',JSON.stringify(snapshots));
  } catch { notify('浏览器无法保存数据；当前操作可用，刷新后可能丢失。'); }
}
const allNews=()=>[...new Map([...snapshots,...custom,...fetched].map(n=>[n.id,n])).values()];
const total=n=>rules.score(n).total;
const formatDate=value=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
const dateText=value=>Number.isFinite(Date.parse(value))?formatDate(value)+' 北京时间':'暂无成功记录';
function ranked() {
  const candidates=$('#include-manual').checked?[...fetched,...custom]:fetched;
  return rules.rank(candidates,{period:$('#time-filter').value,company,query:$('#search').value,
    minimum:$('#high-score').checked?80:0,sort:'score'});
}
function card(n,index) {
  const old=rules.ageHours(n)>168;
  return `<article class="topic-card ${n.id===selectedId?'selected':''}"><div class="topic-top"><div class="topic-meta"><span class="rank">${String(index+1).padStart(2,'0')}</span><span class="company-badge ${n.company==='苹果'?'apple':n.company==='特斯拉'?'tesla':''}">${escapeHTML(n.companies.join(' / '))}</span><span>${n.kind==='manual'?'手动 · 未核验':old?'已归档':n.report_type==='unconfirmed'?'传闻/曝光 · 待核验':'公开 RSS'}</span></div><button class="save-button ${saved.has(n.id)?'saved':''}" data-save="${escapeHTML(n.id)}" aria-label="${saved.has(n.id)?'取消收藏':'收藏'}：${escapeHTML(n.title)}" aria-pressed="${saved.has(n.id)}">${saved.has(n.id)?'★':'☆'}</button></div><h3><button data-select="${escapeHTML(n.id)}">${escapeHTML(n.title)}</button></h3><p class="topic-description">${escapeHTML(n.summary||'来源未提供摘要，请打开原文阅读；不会自动补写。')}</p><div class="card-bottom"><div class="score"><strong>${total(n)}</strong><span>/ 100</span><span class="score-label">规则参考分</span></div><button class="detail-button" data-select="${escapeHTML(n.id)}">查看选题分析 ↗</button><a class="card-original" href="${escapeHTML(safeURL(n.url))}" target="_blank" rel="noopener noreferrer">打开原文 ↗</a></div><div class="card-footer"><span>↗</span><span>${escapeHTML(n.source)}</span><time class="timestamp" datetime="${escapeHTML(n.published)}">· ${dateText(n.published)} 发布</time></div></article>`;
}
function empty(title,text) {
  return `<div class="empty"><b>${escapeHTML(title)}</b><p>${escapeHTML(text)}</p><button class="secondary" data-reset style="padding:9px 15px;border-radius:6px">重置筛选</button><button class="primary" data-add style="margin-left:8px">手动录入</button></div>`;
}
function renderList(preserveSelection=false) {
  const matches=ranked(), list=showAll?matches.slice():matches.slice(0,5);
  if($('#sort-order').value==='published')list.sort((a,b)=>Date.parse(b.published)-Date.parse(a.published)||a.id.localeCompare(b.id));
  $('#candidate-count').innerHTML=`${matches.length} <em>条</em>`;
  $('#recommended-count').innerHTML=`${Math.min(5,matches.length)} <em>个选题</em>`;
  $('#nav-top-count').textContent=Math.min(5,matches.length);
  $('#list-mode-badge').textContent=showAll?'ALL NEWS':'TOP 5';
  $('#toggle-all').textContent=showAll?'只看 Top 5':'查看全部新闻';
  $('#result-caption').textContent=`符合筛选 ${matches.length} 条 · ${showAll?'显示全部':'最多显示 5 条，不足不补编'} · ${$('#sort-order').value==='score'?'按总分排序':'按发布时间排序'}`;
  if(!list.some(n=>n.id===selectedId)&&!(preserveSelection===true&&allNews().some(n=>n.id===selectedId))) {
    selectedId=list[0]?.id||null;tab='overview';
  }
  $('#topic-list').innerHTML=list.length?list.map(card).join(''):empty(loading?'正在加载新闻…':loadError?'新闻数据暂时不可用':'没有符合条件的真实新闻',loading?'正在读取同站点新闻 JSON。':loadError?'不会回退到历史演示数据。请稍后刷新，并查看来源与评分页。':'可放宽公司、时间或分数筛选。若来源未成功采集，会在顶部与来源页说明；不为了凑够 5 条补编。');
  renderDetail();
}
function platformHint() {
  return {'抖音':'先抛生活问题，快速说明事实','视频号':'补足背景，语气稳健，避免夸大','快手':'用生活语言解释实际影响','小红书':'先给决策问题，再解释适用条件'}[$('#platform').value];
}
function renderDetail() {
  const n=allNews().find(n=>n.id===selectedId);
  if(!n) {
    $('#detail-panel').innerHTML='<div class="detail-body"><div class="empty"><b>选择新闻，查看选题框架</b><p>这里将展示规则评分、普通人视角、3 个标题方向、口播框架与来源。</p></div></div>';return;
  }
  const scoring=rules.score(n), creative=rules.creative(n);
  const labels=[['overview','选题分析'],['titles','标题方向'],['script','口播框架'],['source','原始来源']];
  let body='';
  if(tab==='overview') body=`<h3 class="detail-section-title">五维选题评分 <span>关键词规则 · ${scoring.total} / 100</span></h3>${scoring.values.map((value,i)=>`<div class="dimension"><div class="dimension-label"><span>${rules.dimensions[i].name}</span><b>${value} / 20</b></div><div class="track"><span style="width:${value*5}%"></span></div><p class="dimension-reason">${escapeHTML(scoring.reasons[i])}</p></div>`).join('')}<div class="detail-divider"></div><h3 class="detail-section-title">✦ 为什么值得讲</h3><p class="why">${escapeHTML(creative.why)}</p><div class="angle-box"><b>最适合切入的普通人视角 · ${escapeHTML(creative.angle)}</b>${escapeHTML(creative.perspective)}</div><div class="detail-actions"><button class="secondary" data-tab="titles">看 3 个标题方向</button><button class="primary" data-tab="script">打开口播框架 ↗</button></div>`;
  if(tab==='titles') body=`<h3 class="detail-section-title">3 个短视频标题方向 <span>规则模板 · 非原报道结论</span></h3>${creative.titles.map((title,i)=>`<div class="title-item"><small>0${i+1} / ${['大众疑问','条件核验','个人选择'][i]}</small><h3>${escapeHTML(title)}</h3><button class="copy-button" data-copy="title-${i}">复制标题 ↗</button></div>`).join('')}<div class="warning-text">基于原题的表达方向，没有改写事实。英文原题会保留英文，不假装已翻译或理解。发布前校对，避免暗示尚未发生的影响。</div>`;
  if(tab==='script') body=`<h3 class="detail-section-title">60–90 秒口播框架 <span>请核验并填写占位内容</span></h3><div class="script-meta">按开场 / 事实 / 普通人视角 / 条件 / 收尾分段，不是自动事实成稿。<br>当前平台：${escapeHTML($('#platform').value)} · ${platformHint()}</div><div class="script-text">${escapeHTML(creative.framework)}</div><div class="detail-actions"><button class="primary" data-copy="script">复制口播框架</button><a class="secondary source-link" href="${escapeHTML(safeURL(n.url))}" target="_blank" rel="noopener noreferrer">打开原文核验 ↗</a></div><div class="warning-text">未接入 AI API。时间分段是创作安排，填好后需朗读计时。不能把公司计划说成已完成成果，不能补编数据。${n.kind==='manual'?'手动提供的内容未独立核验。':''}</div>`;
  if(tab==='source') body=`<h3 class="detail-section-title">来源摘要 <span>${n.kind==='manual'?'用户提供 · 未核验':'RSS 原文节选 · 非 AI 改写'}</span></h3><p class="facts">${escapeHTML(n.summary||'来源未提供摘要，本工具不自动补写。请打开原文。')}</p><div class="detail-divider"></div><h3 class="detail-section-title">原始新闻链接</h3><p class="facts timestamp">${dateText(n.published)} 发布</p><a class="source-link" href="${escapeHTML(safeURL(n.url))}" target="_blank" rel="noopener noreferrer">${escapeHTML(n.source)} · 一键打开原文 ↗<small>${escapeHTML(n.title)}</small><small>${escapeHTML(new URL(n.url).hostname)}</small></a>${(n.alternate_sources||[]).filter(s=>safeURL(s.url)).map(s=>`<a class="source-link" href="${escapeHTML(safeURL(s.url))}" target="_blank" rel="noopener noreferrer">同题其他来源：${escapeHTML(s.source)} ↗</a>`).join('')}<div class="warning-text">${n.kind==='manual'?'手动内容与来源链接未独立核验。':'来自所列 RSS 的标题、发布时间和摘要。成功读取订阅不等于独立事实核查。'}请检查原文的数字、语境、适用地区与条件。${n.report_type==='unconfirmed'?'原标题包含传闻、曝光或可能性表述；不能将其讲成官方确认。':''}${n.summary_status==='excerpt'?'摘要为截取片段，不包含全部上下文。':''}</div>`;
  $('#detail-panel').innerHTML=`<div class="detail-heading"><div class="detail-kicker"><span>TOPIC BRIEF / 选题工作台</span><span>${n.kind==='manual'?'手动未核验':'公开 RSS · 规则评分'}</span></div><h2>${escapeHTML(n.title)}</h2><p>${escapeHTML(n.companies.join(' / '))} · ${dateText(n.published)} 发布</p></div><div class="tabs" role="tablist" aria-label="选题详情标签">${labels.map(([id,label])=>`<button role="tab" aria-selected="${tab===id}" class="tab ${tab===id?'active':''}" data-tab="${id}">${label}</button>`).join('')}</div><div class="detail-body" role="tabpanel">${body}</div>`;
}
function renderSaved() {
  const list=allNews().filter(n=>saved.has(n.id));
  $('#saved-count').textContent=list.length;
  $('#saved-list').innerHTML=list.length?list.map(card).join(''):'<div class="empty"><b>把好选题留在这里</b><p>点击新闻卡片上的 ☆ 收藏。收藏快照仅保存在这个浏览器，不延长新闻时效。</p><button class="primary" data-view="recommend">去发现选题 ↗</button></div>';
}
function renderSources() {
  $('#method-dimensions').innerHTML=rules.dimensions.map(d=>`<div class="method-row"><strong>${d.name}</strong><span>${escapeHTML(d.explain)}</span><b>20 分</b></div>`).join('');
  const sources=Array.isArray(data?.sources)?data.sources:[];
  $('#source-directory').innerHTML=sources.length?sources.map(s=>`<article class="source-entry"><span class="company-badge">${s.type==='official_rss'?'官方 RSS':'科技媒体 RSS'}</span><h3>${escapeHTML(s.name)}</h3><p class="source-state ${s.status!=='ok'?'error':''}">${s.status==='ok'?'本次读取成功':'本次读取失败'} · 本次收录 ${Number(s.accepted)||0} 条重点公司新闻</p><p>最近成功：${dateText(s.last_success_at)}<br>最近尝试：${dateText(s.last_attempt_at)}</p>${s.error?`<p class="error-detail">${escapeHTML(s.error)}</p>`:''}<a class="source-link" href="${escapeHTML(safeURL(s.url))}" target="_blank" rel="noopener noreferrer">查看公开 RSS ↗<small>${escapeHTML(s.url)}</small></a></article>`).join(''):'<div class="empty"><b>暂无可读取的来源状态</b><p>请检查数据更新工作流，网页不会自动补入样例。</p></div>';
}
function renderStatus() {
  const successful=(data?.sources||[]).filter(s=>s.status==='ok').length;
  const sourceCount=(data?.sources||[]).length;
  const stale=!data?.last_success_at||Date.now()-Date.parse(data.last_success_at)>21600000;
  $('.notice').classList.toggle('error',Boolean(loadError)||Boolean(data)&&(stale||data.collection_status!=='ok'));
  $('#data-status-title').textContent=loading?'正在刷新新闻数据…':loadError?'数据加载失败':usingCache?'无法读取新数据，正在显示上次本机缓存':!data?.last_success_at?'尚未成功采集新闻':stale?'新闻更新延迟，请留意发布时间':data.collection_status!=='ok'?'部分来源本次读取失败':'公开 RSS 数据已加载';
  $('#data-status-text').textContent=`${data?'最近尝试 '+dateText(data.updated_at)+'；最近成功 '+dateText(data.last_success_at)+'；本次成功 '+successful+'/'+sourceCount+' 个来源。 ':''}评分是透明关键词规则，不是 AI 分析或真实热度；口播提供待填写框架。${usingCache?'缓存不改变新闻日期，过期记录不会混入48小时推荐。':''}`;
}
function renderAll(preserve=false) {renderStatus();renderList(preserve);renderSaved();renderSources();}
function setView(next,preserve=false) {
  view=next;
  ['recommend','saved','sources'].forEach(id=>$('#'+id+'-view').hidden=id!==next);
  document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.view===next));
  $('#view-label').textContent={recommend:'选题推荐',saved:'我的收藏',sources:'来源与评分'}[next];
  $('#page-title').textContent={recommend:'好选题，让创作先一步。',saved:'把好灵感，留下来。',sources:'有依据，才值得讲。'}[next];
  $('#page-subtitle').textContent={recommend:'聚焦科技大厂与商业热点，找到值得讲给大众听的故事。',saved:'收藏保留原文快照，不把旧新闻当新热点。',sources:'公开评分规则、RSS 状态与更新时间。'}[next];
  if(next==='recommend')renderList(preserve);if(next==='saved')renderSaved();if(next==='sources')renderSources();
}
function renderChips() {
  $('#company-filters').innerHTML=['全部',...rules.companies].map(c=>`<button class="chip ${company===c?'active':''}" data-company="${c}" aria-pressed="${company===c}">${c}</button>`).join('');
}
function openDialog() {
  const china=new Date(Date.now()+28800000).toISOString().slice(0,16);
  const input=$('[name="published"]');input.max=china;if(!input.value)input.value=china;
  $('#form-error').textContent='';$('#news-dialog').showModal();
}
async function copy(text) {
  try {
    if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(text);
    else {const input=document.createElement('textarea');input.value=text;input.style.position='fixed';input.style.opacity='0';document.body.append(input);input.select();const success=document.execCommand('copy');input.remove();if(!success)throw new Error('copy');}
    notify('已复制，可粘贴到你的创作笔记。');
  } catch {notify('浏览器不允许自动复制，请选中文字手动复制。');}
}
function resetFilters() {
  company='全部';$('#search').value='';$('#time-filter').value='48h';$('#high-score').checked=false;$('#sort-order').value='score';showAll=false;renderChips();renderList();
}
async function loadNews() {
  if(loading)return;loading=true;$('#reload-news').disabled=true;renderStatus();
  const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),12000);
  try {
    const response=await fetch('data/news.json',{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw new Error('HTTP '+response.status);
    const payload=await response.json();
    if(payload.schema_version!==2||!Array.isArray(payload.news)||!Array.isArray(payload.sources)||!Number.isFinite(Date.parse(payload.updated_at)))throw new Error('数据格式无效');
    if(payload.news.some(n=>!validNews(n)||n.kind!=='rss'))throw new Error('新闻字段或来源类型不完整');
    data=payload;fetched=newsArray(payload.news);loadError='';usingCache=false;
    try{localStorage.setItem('radar-rss-v2',JSON.stringify(payload));}catch{/* Storage may be unavailable; HTTP data remains usable. */}
  } catch(error) {
    const cached=readStore('radar-rss-v2',null);
    if(cached?.schema_version===2&&Array.isArray(cached.news)&&Array.isArray(cached.sources)&&Number.isFinite(Date.parse(cached.updated_at))) {
      data=cached;fetched=newsArray(cached.news).filter(n=>n.kind==='rss');usingCache=true;loadError='';
    } else if(data) {usingCache=true;loadError='';}
    else {data=null;fetched=[];loadError=error.message;usingCache=false;}
  } finally {clearTimeout(timeout);loading=false;$('#reload-news').disabled=false;renderAll(true);}
}
document.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.dataset.view)setView(b.dataset.view);
  if(b.hasAttribute('data-company')){company=b.dataset.company;renderChips();renderList();}
  if(b.dataset.save) {
    const n=allNews().find(n=>n.id===b.dataset.save);
    if(saved.has(b.dataset.save)){saved.delete(b.dataset.save);snapshots=snapshots.filter(n=>n.id!==b.dataset.save);}
    else if(n){saved.add(n.id);snapshots=snapshots.filter(s=>s.id!==n.id).concat(n);}
    persist();renderSaved();if(view==='recommend')renderList(true);notify(saved.has(b.dataset.save)?'已收藏新闻快照':'已取消收藏');
  }
  if(b.dataset.select){selectedId=b.dataset.select;tab='overview';if(view!=='recommend')setView('recommend',true);renderList(true);if(window.innerWidth<=720)$('#detail-panel').scrollIntoView({behavior:'smooth',block:'start'});}
  if(b.dataset.tab){tab=b.dataset.tab;renderDetail();}
  if(b.dataset.copy){const n=allNews().find(n=>n.id===selectedId);if(n){const c=rules.creative(n);copy(b.dataset.copy==='script'?c.framework:c.titles[Number(b.dataset.copy.split('-')[1])]);}}
  if(b.hasAttribute('data-reset'))resetFilters();
  if(b.hasAttribute('data-add'))openDialog();
});
$('#add-news').addEventListener('click',openDialog);$('#close-dialog').addEventListener('click',()=>$('#news-dialog').close());
$('#learn-more').addEventListener('click',()=>setView('sources'));
$('#search').addEventListener('input',()=>renderList());
['time-filter','sort-order','high-score','include-manual'].forEach(id=>$('#'+id).addEventListener('change',()=>renderList()));
$('#platform').addEventListener('change',renderDetail);
$('#toggle-all').addEventListener('click',()=>{showAll=!showAll;renderList();});
$('#reload-news').addEventListener('click',loadNews);
$('#news-form').addEventListener('submit',event=>{
  event.preventDefault();
  try {
    const form=Object.fromEntries(new FormData(event.target)),title=form.title.trim(),summary=form.facts.trim(),url=safeURL(form.url);
    if(!title||summary.length<60)throw new Error('请填写标题，并提供至少 60 个字的事实摘要。');
    if(!url)throw new Error('请输入不含账号密码的 http 或 https 来源链接。');
    const date=new Date(form.published+'+08:00');if(!Number.isFinite(date.getTime())||date.getTime()>Date.now())throw new Error('请选择已发生的新闻时间（北京时间）。');
    const news=normalized({id:'user-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),title,summary,url,company:form.company,published:date.toISOString(),source:'用户提供 · 未独立核验',kind:'manual'});
    custom.unshift(news);persist();$('#news-dialog').close();event.target.reset();$('#include-manual').checked=true;resetFilters();selectedId=news.id;tab='overview';setView('recommend',true);notify('已保存未核验内容；已开启「包含手动录入」。');
  } catch(error){$('#form-error').textContent=error.message;}
});
renderChips();renderAll();loadNews();
// Refresh published JSON only; the browser never scrapes third-party feeds.
setInterval(()=>{if(!document.hidden&&!$('#news-dialog').open)loadNews();},300000);
