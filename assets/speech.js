/* V5.1 LLM UI: no rule fallback, server-only model secrets, compatible local drafts. */
(function(){
 'use strict';
 const S=window.RadarSpeech,L=window.RadarSpeechLLM,B=window.RadarBrain,KEY='radar-speech-v5',esc=escapeHTML;
 const el=s=>document.querySelector(s),uuid=()=> 'speech-'+(crypto.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
 const sessions=new Map(),draftSessions=new Map();let draftSession=null,blocked='';
 const CONNECTION_KEY='radar-model-connection-v1';let connection={endpoint:'',accessToken:'',verified:false,model:''};
 try{const saved=JSON.parse(localStorage.getItem(CONNECTION_KEY)||'null');if(saved?.endpoint)connection.endpoint=L.endpoint(saved.endpoint);}catch{/* Invalid connection config never touches knowledge or drafts. */}
 const connected=()=>connection.verified&&!!connection.endpoint&&!!connection.accessToken;
 function read(){const raw=localStorage.getItem(KEY);return raw===null?{schema_version:1,drafts:[]}:S.validateDraftState(JSON.parse(raw));}
 function readSafe(){try{return read();}catch{blocked='口播草稿暂时无法读取，原数据未清空或覆盖。可导出原始备份；新的输入仍保留在当前页面。';return {schema_version:1,drafts:[]};}}
 readSafe();
 function brain(){try{return {state:window.BrainUI.getState(),error:''};}catch(error){return {state:B.defaultState(),error:'第二大脑暂不可读，本次只依据新闻生成：'+error.message};}}
 function session(n){if(!sessions.has(n.id))sessions.set(n.id,{news:S.snapshot(n),duration:60,versions:{},error:'',notice:''});return sessions.get(n.id);}
 function current(t){return t.versions[t.duration]||null;}
 function rootFor(target){return target.closest('[data-speech-workspace]');}
 function owner(root){return root?.dataset.speechWorkspace==='draft'?draftSession:sessions.get(root?.dataset.speechNews);}
 function renderLibrary(){const count=readSafe().drafts.length;el('#speech-draft-count').textContent=count;el('#speech-draft-error').textContent=blocked;}
 function checksHTML(g){return S.check(g.main,g).map(c=>`<article class="speech-check" data-check-kind="${c.kind}"><span class="speech-label">${c.label}</span><p>${esc(c.sentence)}</p><small>${esc(c.reason)}</small>${c.evidence?.material_id?`<span> · 历史素材引用，不能当作当前新闻事实。</span>`:''}${c.kind==='news'?`<a href="${esc(safeURL(g.news.url))}" target="_blank" rel="noopener noreferrer">打开原文核对 ↗</a>`:''}</article>`).join('');}
 function resultHTML(g,busy=false){
  const timing=S.timing(g.main,g.duration);
  return `<div class="speech-meta" data-speech-timing>${g.provider==='openai'?'OpenAI · '+esc(g.model||'服务端模型'):'旧版规则草稿（保留存档）'}<br>${esc(g.structureLabel)} · ${esc(g.angle)}<br>${g.duration}秒目标 · ${timing.characters}字 · 粗估${timing.from}–${timing.to}秒<br><small>${esc(timing.note)}</small></div>
   <label class="speech-editor-label">主稿（可以直接修改）<textarea data-speech-main aria-label="口播主稿" maxlength="50000" rows="15">${esc(g.main)}</textarea></label>
   <div class="speech-actions"><button class="secondary" data-speech-action="angle" ${!connected()||busy?'disabled':''}>换一个角度</button><button class="secondary" data-speech-action="opening" ${!connected()||busy?'disabled':''}>只改开头</button><button class="secondary" data-speech-action="conflict" ${!connected()||busy?'disabled':''}>加强冲突</button><button class="secondary" data-speech-action="human" ${!connected()||busy?'disabled':''}>更像真人</button><button class="secondary" data-speech-action="risk" ${!connected()||busy?'disabled':''}>降低风险</button></div>
   <div class="speech-actions"><button class="primary" data-speech-copy="main">复制主稿</button><button class="secondary" data-speech-save>保存为草稿</button><button class="secondary" data-speech-work>转为历史作品 ↗</button></div>
   <h4>备选开头 × 3</h4>${g.openings.map((o,i)=>`<article class="speech-option"><b>${esc(o.kind)}</b><p>${esc(o.text)}</p><button data-speech-copy="opening-${i}">复制 ↗</button><button data-speech-opening="${i}">用这个开头</button></article>`).join('')}
   <h4>标题 × 3</h4>${g.titles.map((t,i)=>`<article class="speech-option"><p>${esc(t)}</p><button data-speech-copy="title-${i}">复制标题 ↗</button></article>`).join('')}
   <details class="speech-materials"><summary>本次交给模型的素材 · ${g.used_materials.length}条</summary><p>${esc(g.contextNote)}</p>${g.used_materials.map(m=>`<article class="speech-used"><b>${B.types[m.type].short} · ${esc(m.title)}</b><p>相关性 ${m.relevance} / 100${m.type==='work'?' · 历史表现 '+(m.performance||'数据不足'):''}<br>${esc(m.role)}</p><button data-speech-material="${esc(m.id)}">打开素材 ↗</button></article>`).join('')}</details>
   <details class="speech-why"><summary>为什么这样写</summary>${g.why.map(t=>`<p>${esc(t)}</p>`).join('')}</details>
   <details class="speech-facts" open><summary>事实风险检查</summary><p>模型归类与证据片段仅供核对，不是自动事实认证或平台审核预测。当前事实只依据新闻标题 / 摘要 / 你补充的原文；历史稿不能给本次事实背书。手动改写或新增数字会标为“需要核实”。</p><div data-speech-checks>${checksHTML(g)}</div></details>`;
 }
 function warningHTML(n){const c=brain();let risk;
  try{risk=S.context(n,c.state).risk;}catch{return '<p class="speech-risk">无法读取匹配信息，生成前请检查来源和素材。</p>';}
  return `${c.error?`<p class="speech-risk">${esc(c.error)}</p>`:''}${risk.count?`<p class="speech-risk"><b>该题材与你过去的高风险内容相似。</b><br>内容风险：${risk.level}。默认避开风险作品的原稿、未证实指控及动机推测；记录状态不证明平台处理原因。</p>`:''}`;
 }
 function workspaceHTML(t,scope='news'){
  const entry=current(t),g=entry?.result;
  return `<div data-speech-workspace="${scope}" data-speech-news="${esc(t.news.id)}"><fieldset class="speech-fields" ${t.busy?'disabled':''}>${scope==='draft'?'<p class="speech-archive">正在查看保存时的新闻快照，未自动更新为今日进展。请以新闻发布时间和原文为准。</p>':''}<p class="speech-intro">LLM口播 · 新闻事实 + 历史样稿全文 + 个人观点 + 风险记录。生成与编辑需连接服务端OpenAI；不会回退旧规则稿。</p>${warningHTML(t.news)}<p class="speech-model-status">${connected()?`服务端已连接 · ${esc(connection.model)}。生成会消耗OpenAI API额度。`:L.unavailable}</p><button class="secondary" data-speech-connect>连接大模型 / 设置</button><details class="speech-source-input"><summary>补充新闻原文（可选）</summary><p>当前仅使用已保存标题和RSS摘要，未自动读取链接全文。内容太少时可在这里粘贴原文；不会改写新闻库。传闻仍须保留限定语。</p><textarea data-speech-fulltext rows="5" maxlength="50000" placeholder="粘贴新闻全文或你核对过的完整摘要">${esc(t.news.body||'')}</textarea></details><div class="speech-controls"><label>目标时长<select data-speech-duration aria-label="口播时长"><option value="60" ${t.duration===60?'selected':''}>60 秒</option><option value="90" ${t.duration===90?'selected':''}>90 秒</option></select></label><button class="primary" data-speech-generate ${!connected()||t.busy?'disabled':''}>${t.busy?'模型正在生成…':g?'重新生成口播':'生成口播'}</button><button class="secondary" data-speech-library>我的草稿</button></div><p class="speech-error" data-speech-error role="alert">${esc(t.error||'')}</p><p class="speech-notice" data-speech-notice role="status">${esc(t.notice||'')}</p>${g?`<p class="speech-meta">本稿新闻：${esc(g.news.title)}<br>${dateText(g.news.published)} 发布 · ${dateText(g.generated_at)} 生成<br><a href="${esc(safeURL(g.news.url))}" target="_blank" rel="noopener noreferrer">${esc(g.news.source)} · 打开原文 ↗</a></p>${resultHTML(g,t.busy)}${entry.undo?'<button class="speech-undo" data-speech-undo>撤销上一次调整</button>':''}`:'<p>仅在连接大模型后生成。相关性≥60的高表现历史全文最多4条、个人观点最多3条，风险作品单独作为避雷记录。相关全文不足2条会明确提示，不拿无关作品补数。所选资料会发送给你的服务端及OpenAI；其余知识库不会上传。</p>'}</fieldset></div>`;
 }
 function render(n){return `<section class="speech-generator"><h3>口播生成器 <small>V5.1 · LLM</small></h3>${workspaceHTML(session(n))}</section>`;}
 function repaint(root,t){root.outerHTML=workspaceHTML(t,root.dataset.speechWorkspace);}
 function repaintOwner(root,t){const live=root?.isConnected?root:root?document.querySelector(`[data-speech-workspace="${root.dataset.speechWorkspace}"][data-speech-news="${CSS.escape(t.news.id)}"]`):null;if(live)repaint(live,t);}
 function setBusy(root,value){root.querySelectorAll('button,select,textarea').forEach(x=>{x.disabled=value||(!connected()&&(x.hasAttribute('data-speech-generate')||x.hasAttribute('data-speech-action')));});root.setAttribute('aria-busy',String(value));}
 async function generate(t,action='generate'){
  if(!connected())throw new Error(L.unavailable);
  const c=brain(),previous=current(t),request=L.buildRequest({news:t.news,brain:c.state,duration:t.duration,action,existing:previous?.result});
  const result=await L.call(request,connection,{existing:previous?.result});
  if(action==='generate')t.versions[t.duration]={result,id:null,savedAt:null,undo:previous};
  else t.versions[t.duration]={...previous,result,undo:{result:structuredClone(previous.result),id:previous.id,savedAt:previous.savedAt}};
  t.error='';t.notice=(c.error?c.error+' ':'')+(action==='opening'?'模型已更新3个备选开头，正文保持不变。':'模型已返回初稿，修改尚未保存。请核对事实、观点和语言是否像你。');
 }
 function save(entry){
  if(blocked)throw new Error(blocked);
  const latest=read(),now=new Date().toISOString(),id=entry.id||uuid(),old=latest.drafts.find(d=>d.id===id);
  if(old&&entry.savedAt!==old.updated_at)throw new Error('草稿已在另一窗口更新。当前稿仍保留，请导出或另存，避免覆盖。');
  const d={id,created_at:old?.created_at||now,updated_at:now,result:structuredClone(entry.result)},next={...latest,drafts:latest.drafts.filter(x=>x.id!==id).concat(d)};S.validateDraftState(next);
  try{localStorage.setItem(KEY,JSON.stringify(next));}catch(error){if(error.name==='QuotaExceededError')throw new Error('浏览器空间不足，草稿未保存。当前输入仍在；请先导出备份。');throw error;}
  entry.id=id;entry.savedAt=now;renderLibrary();return d;
 }
 function openLibrary(){renderLibrary();const drafts=readSafe().drafts.slice().sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at)||a.id.localeCompare(b.id));
  el('#speech-drafts-list').innerHTML=drafts.length?drafts.map(d=>`<article class="speech-saved"><button data-speech-load="${esc(d.id)}">${esc(d.result.news.title)}</button><small>${d.result.duration}秒 · ${dateText(d.updated_at)} 保存</small></article>`).join(''):'<p>还没有已保存的口播草稿。生成后点击“保存为草稿”。</p>';
  el('#speech-drafts-status').textContent=blocked;el('#speech-draft-body').innerHTML=draftSession?workspaceHTML(draftSession,'draft'):'';el('#speech-drafts-dialog').showModal();
 }
 document.addEventListener('input',event=>{
  if(event.target.hasAttribute('data-speech-fulltext')){const t=owner(rootFor(event.target));t.news.body=event.target.value;t.news.fulltext_origin='user_paste';return;}
  if(!event.target.hasAttribute('data-speech-main'))return;
  const root=rootFor(event.target),t=owner(root),entry=current(t);if(!entry)return;entry.result.main=event.target.value;entry.result.checks=S.check(entry.result.main,entry.result);entry.result.timing=S.timing(entry.result.main,entry.result.duration);
  root.querySelector('[data-speech-checks]').innerHTML=checksHTML(entry.result);t.notice='当前修改尚未保存。';root.querySelector('[data-speech-notice]').textContent=t.notice;
 });
 document.addEventListener('change',event=>{
  if(!event.target.hasAttribute('data-speech-duration'))return;
  const root=rootFor(event.target),t=owner(root),old=current(t);t.duration=Number(event.target.value);
  t.error='';t.notice=old&&!current(t)?'此时长尚无稿件，点击生成会发起新的模型请求。':'';repaint(root,t);
 });
 document.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.hasAttribute('data-speech-connect')){el('#speech-endpoint').value=connection.endpoint;el('#speech-access-token').value='';el('#speech-connect-status').textContent='OpenAI Key只放在服务端。这里填写应用访问码，访问码只在本页内存保存。';el('#speech-connect-dialog').showModal();return;}
  if(button.hasAttribute('data-speech-library')){openLibrary();return;}
  if(button.hasAttribute('data-speech-load')){try{const d=read().drafts.find(d=>d.id===button.dataset.speechLoad);if(!d)throw new Error('草稿不存在');draftSession=draftSessions.get(d.id)||{news:d.result.news,duration:d.result.duration,versions:{[d.result.duration]:{result:structuredClone(d.result),id:d.id,savedAt:d.updated_at}},error:'',notice:'已打开保存时的新闻快照；未自动更新为今日进展。'};draftSessions.set(d.id,draftSession);el('#speech-draft-body').innerHTML=workspaceHTML(draftSession,'draft');}catch(error){el('#speech-drafts-status').textContent=error.message;}return;}
  const root=rootFor(button),t=owner(root);if(!t)return;
  const entry=current(t);if(t.busy)return;
  try{
   if(button.hasAttribute('data-speech-generate')||button.dataset.speechAction){t.busy=true;setBusy(root,true);t.error='';root.querySelector('[data-speech-notice]').textContent='正在请求模型，当前稿件保留，请稍候…';try{await generate(t,button.dataset.speechAction||'generate');}finally{t.busy=false;repaintOwner(root,t);}return;}
   if(!entry)return;
   if(button.hasAttribute('data-speech-undo')){if(entry.undo){t.versions[t.duration]=entry.undo;t.notice='已撤销上一次调整。';repaint(root,t);}return;}
   if(button.hasAttribute('data-speech-opening')){entry.undo={result:structuredClone(entry.result),id:entry.id,savedAt:entry.savedAt};entry.result=S.applyOpening(entry.result,Number(button.dataset.speechOpening));t.notice='已替换开头，正文保持不变。';repaint(root,t);return;}
   if(button.hasAttribute('data-speech-copy')){const key=button.dataset.speechCopy,text=key==='main'?entry.result.main:key.startsWith('opening-')?entry.result.openings[Number(key.slice(8))].text:entry.result.titles[Number(key.slice(6))];copy(text);return;}
   if(button.hasAttribute('data-speech-save')){save(entry);t.notice='草稿已保存到当前浏览器。';t.error='';repaint(root,t);return;}
   if(button.hasAttribute('data-speech-work')){if(el('#speech-drafts-dialog').open)el('#speech-drafts-dialog').close();window.BrainUI.openGeneratedWork(entry.result);return;}
   if(button.hasAttribute('data-speech-material')){const c=brain();if(!c.state.materials.some(m=>m.id===button.dataset.speechMaterial))throw new Error('源素材当前不存在；草稿中的引用记录仍保留。');if(el('#speech-drafts-dialog').open)el('#speech-drafts-dialog').close();window.BrainUI.jump(button.dataset.speechMaterial);}
  }catch(error){t.error=error.message;if(root.isConnected)root.querySelector('[data-speech-error]').textContent=t.error;else repaintOwner(document.querySelector(`[data-speech-workspace="${root.dataset.speechWorkspace}"][data-speech-news="${CSS.escape(t.news.id)}"]`),t);}
 });
 el('#speech-drafts-close').addEventListener('click',()=>el('#speech-drafts-dialog').close());
 el('#speech-drafts-export').addEventListener('click',()=>{try{const raw=blocked?localStorage.getItem(KEY):JSON.stringify(read());if(raw===null)throw new Error('暂无草稿数据');const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='热点雷达-口播草稿-'+new Date(Date.now()+28800000).toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){el('#speech-drafts-status').textContent=error.message;}});
 el('#speech-drafts-import').addEventListener('click',()=>el('#speech-drafts-file').click());
 el('#speech-drafts-file').addEventListener('change',async event=>{try{const file=event.target.files[0];if(!file)return;if(blocked)throw new Error(blocked);if(file.size>10*1024*1024)throw new Error('备份超过10MB');const incoming=S.validateDraftState(JSON.parse(await file.text())),latest=read(),drafts=latest.drafts.slice();let count=0;for(const d of incoming.drafts){const old=drafts.find(x=>x.id===d.id);if(old&&JSON.stringify(old)===JSON.stringify(d))continue;drafts.push(old?{...d,id:uuid()}:d);count++;}const next=S.validateDraftState({...latest,drafts});localStorage.setItem(KEY,JSON.stringify(next));openLibrary();el('#speech-drafts-status').textContent=`已追加${count}条草稿，原有草稿未覆盖。`;}catch(error){el('#speech-drafts-status').textContent='导入未完成，原数据未覆盖：'+error.message;}finally{event.target.value='';}});
 window.addEventListener('storage',event=>{if(event.key!==KEY)return;blocked='';readSafe();renderLibrary();});

 el('#speech-connect-close').addEventListener('click',()=>el('#speech-connect-dialog').close());
 el('#speech-connect-form').addEventListener('submit',async event=>{
  event.preventDefault();const button=el('#speech-connect-submit');button.disabled=true;
  try{const endpoint=L.endpoint(el('#speech-endpoint').value.trim()),accessToken=el('#speech-access-token').value.trim();if(!accessToken||accessToken.startsWith('sk-'))throw new Error('请填应用访问码，不是OpenAI API Key');
   const response=await fetch(endpoint+'/health',{headers:{Authorization:'Bearer '+accessToken},signal:AbortSignal.timeout(15000),credentials:'omit',cache:'no-store'}),data=await response.json();
   if(!response.ok||!data.configured||data.provider!=='openai')throw new Error(data.error||L.unavailable);
   connection={endpoint,accessToken,verified:true,model:data.model};try{localStorage.setItem(CONNECTION_KEY,JSON.stringify({endpoint}));}catch{/* Connected for this page even when endpoint storage fails. */}
   el('#speech-access-token').value='';el('#speech-connect-dialog').close();renderDetail();if(draftSession&&el('#speech-drafts-dialog').open)el('#speech-draft-body').innerHTML=workspaceHTML(draftSession,'draft');
  }catch(error){connection.verified=false;el('#speech-connect-status').textContent='连接未完成：'+error.message;}finally{button.disabled=false;}
 });
 window.SpeechUI={render};renderLibrary();renderDetail();
})();
