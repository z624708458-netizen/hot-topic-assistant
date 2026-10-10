/* V4: private-material schema and explainable relevance, independent of V3 scores. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RadarBrain=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const types={
  case:{label:'个人经历 / Case 库',short:'个人经历',points:20,fields:[['date','日期','date'],['event','事件经过'],['feeling','我的感受'],['conflict','冲突点'],['topics','可以延伸的话题']]},
  opinion:{label:'我的观点库',short:'个人观点',points:20,fields:[['point','核心观点'],['background','背景'],['reason','为什么这么判断'],['related','相关公司 / 人物 / 行业','text'],['counter','可以反驳它的观点']]},
  viral:{label:'爆款案例库',short:'爆款案例',points:15,fields:[['original','原始标题','text'],['copy','原文 / 文案'],['source','来源','text'],['url','链接','url'],['opening','开头方式'],['conflict','核心冲突'],['structure','内容结构'],['emotion','情绪点'],['potential','为什么可能爆'],['borrow','可以借鉴的结构']]},
  comment:{label:'用户需求 / 评论库',short:'用户需求',points:15,fields:[['comment','原评论'],['source','来源','text'],['likes','点赞量（不知道可留空）','number'],['question','用户真正关心的问题'],['emotion','情绪'],['topics','可以延伸的选题']]},
  work:{label:'历史作品库',short:'历史作品',points:20,fields:[['copy','文案'],['published','发布时间（北京时间）','datetime-local'],['platform','平台','text'],['views','播放量','number'],['likes','点赞','number'],['comments','评论','number'],['saves','收藏','number'],['review','我自己的复盘']]}
 };
 const companyAliases={"小米": ["小米", "Xiaomi", "Redmi", "红米"], "华为": ["华为", "Huawei", "鸿蒙", "HarmonyOS"], "腾讯": ["腾讯", "Tencent", "微信", "WeChat"], "字节跳动": ["字节跳动", "字节", "ByteDance", "抖音", "TikTok", "豆包"], "阿里巴巴": ["阿里巴巴", "阿里", "Alibaba", "通义", "千问", "Qwen", "淘宝", "天猫"], "百度": ["百度", "Baidu", "文心"], "OpenAI": ["OpenAI", "ChatGPT", "GPT-5", "GPT-4", "Sora"], "苹果": ["苹果", "Apple", "iPhone", "iPad", "MacBook", "iOS", "Apple Intelligence"], "特斯拉": ["特斯拉", "Tesla"]};
 const people=[{"name": "雷军", "company": "小米", "points": 25, "aliases": ["雷军", "Lei Jun"]}, {"name": "任正非", "company": "华为", "points": 25, "aliases": ["任正非", "Ren Zhengfei"]}, {"name": "余承东", "company": "华为", "points": 24, "aliases": ["余承东", "Richard Yu"]}, {"name": "马化腾", "company": "腾讯", "points": 24, "aliases": ["马化腾", "Pony Ma"]}, {"name": "张一鸣", "company": "字节跳动", "points": 22, "aliases": ["张一鸣", "Zhang Yiming"]}, {"name": "马云", "company": "阿里巴巴", "points": 25, "aliases": ["马云", "Jack Ma"]}, {"name": "李彦宏", "company": "百度", "points": 22, "aliases": ["李彦宏", "Robin Li"]}, {"name": "马斯克", "company": "特斯拉", "points": 25, "aliases": ["马斯克", "Elon Musk"]}, {"name": "库克", "company": "苹果", "points": 23, "aliases": ["库克", "Tim Cook"]}, {"name": "萨姆·奥特曼", "company": "OpenAI", "points": 20, "aliases": ["萨姆·奥特曼", "山姆·奥特曼", "Sam Altman"]}];
 const themes=[
  {name:'AI',words:['AI','人工智能','大模型','ChatGPT','OpenAI','豆包','千问','Qwen','GPT','Codex']},
  {name:'房地产',words:['房地产','房产','楼市','房价','房贷','买房','租房','中介']},
  {name:'职场与收入',words:['职场','裁员','工资','奖金','年终奖','降薪','就业','失业','招聘','岗位','同事','老板']},
  {name:'消费与价格',words:['消费','降价','涨价','售价','价格','预算','购买','购物','退款','收费','免费','会员']},
  {name:'汽车与出行',words:['汽车','车主','购车','交付','试驾','续航','充电','电池','出行','打车']},
  {name:'手机与数码',words:['手机','iPhone','鸿蒙','智能家居','数码','电脑','家电']},
  {name:'隐私与权益',words:['隐私','个人信息','消费者','权益','诈骗','维权','起诉','处罚','召回','事故','判决','被判']},
  {name:'商业与竞争',words:['商业','销量','市场份额','竞争','收购','投资','融资','财报','营收','亏损','创纪录']},
  {name:'内容创作',words:['短视频','口播','创作者','评论区','播放量','视频号','抖音','内容创作']},
  {name:'生活与观察',words:['旅行','旅游','生活观察','生活经历','家庭','教育','学习']}
 ];
 function contains(text,word){
  if(!word)return false;
  if(/^[\x00-\x7f]+$/.test(word))return new RegExp('(^|[^a-z0-9])'+word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'([^a-z0-9]|$)','i').test(text);
  return text.toLowerCase().includes(word.toLowerCase());
 }
 function tags(text){return [...new Set((Array.isArray(text)?text:String(text||'').split(/[,，;；\n#]+/)).map(x=>String(x).trim()).filter(Boolean))].slice(0,50);}
 function textOf(m){return [m.title,m.body,...Object.values(m.fields||{}),...(m.tags||[])].filter(v=>v!==null&&v!==undefined).join(' ');}
 function meaningfulText(m){return [m.title,m.body,...types[m.type].fields.filter(f=>!['date','datetime-local','number','url'].includes(f[2])).map(f=>m.fields?.[f[0]]),...(m.tags||[])].filter(Boolean).join(' ');}
 function validURL(url){try{const u=new URL(url);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}}
 function validate(m){
  if(!m||typeof m!=='object'||!Object.hasOwn(types,m.type)||typeof m.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(m.id))throw new Error('素材类型或编号无效');
  if(typeof m.title!=='string'||!m.title.trim()||m.title.length>300||typeof m.body!=='string'||m.body.length>50000)throw new Error('素材标题或文字长度无效');
  if(!Array.isArray(m.tags)||m.tags.length>50||m.tags.some(t=>typeof t!=='string'||!t.trim()||t.length>100))throw new Error('标签格式无效（每个标签最多100字）');
  if(!m.fields||typeof m.fields!=='object'||Array.isArray(m.fields)||Object.keys(m.fields).some(k=>!types[m.type].fields.some(f=>f[0]===k)))throw new Error('补充字段格式无效');
  for(const [key,label,kind] of types[m.type].fields){
   const v=m.fields[key];if(v===null||v===undefined||v==='')continue;
   if(kind==='number'){if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)throw new Error(label+'请输入非负整数，或留空');}
   else if(typeof v!=='string'||v.length>50000)throw new Error(label+'格式或长度无效');
   else if(kind==='url'&&!validURL(v))throw new Error('链接请使用不含账号密码的 http 或 https 地址');
   else if(kind==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v))throw new Error('日期无效');
   else if(kind==='datetime-local'&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,19)!==v.slice(0,19)))throw new Error('发布时间无效');
  }
  if(!Number.isFinite(Date.parse(m.created_at))||!Number.isFinite(Date.parse(m.updated_at)))throw new Error('素材保存时间无效');
  if(m.origin&&(!m.origin.news_id||typeof m.origin.title!=='string'||!validURL(m.origin.url)))throw new Error('关联新闻格式无效');
  return m;
 }
 function profile(p){
  if(!p||!Array.isArray(p.companies)||p.companies.some(c=>!Object.hasOwn(companyAliases,c))||!Array.isArray(p.domains)||p.domains.length>50||p.domains.some(t=>typeof t!=='string'||!t.trim()||t.length>100))throw new Error('长期关注设置无效');
  return {companies:[...new Set(p.companies)],domains:tags(p.domains)};
 }
 function defaultState(){return {schema_version:1,materials:[],profile:{companies:Object.keys(companyAliases),domains:['AI','商业']}};}
 function validateState(s){
  if(!s||s.schema_version!==1||!Array.isArray(s.materials)||s.materials.length>3000)throw new Error('知识库备份格式无效');
  const ids=new Set();s.materials.forEach(m=>{validate(m);if(ids.has(m.id))throw new Error('素材编号重复');ids.add(m.id);});profile(s.profile);return s;
 }
 function newsText(n){return [n.title,n.summary,n.body,n.content,...(n.keywords||[]),...(n.companies||[n.company]),...(n.people||[])].filter(Boolean).join(' ');}
 function signals(n){
  const text=newsText(n),companies=Object.entries(companyAliases).filter(([c,aliases])=>(n.companies||[n.company]).includes(c)||aliases.some(a=>contains(text,a))).map(([c])=>c);
  const persons=people.filter(p=>(n.people||[]).includes(p.name)||p.aliases.some(a=>contains(text,a)));
  return {text,companies,persons,themes:themes.filter(t=>t.words.some(w=>contains(text,w)))};
 }
 function related(n,m,prepared=signals(n)){
  const s=prepared,text=meaningfulText(m),reasons=[],tokens=[];let value=0;
  const cs=s.companies.filter(c=>companyAliases[c].some(a=>contains(text,a)));
  if(cs.length){value+=Math.min(40,cs.length*30);reasons.push('公司/产品名称：'+cs.join('、'));tokens.push(...cs);}
  const ps=s.persons.filter(p=>p.aliases.some(a=>contains(text,a)));
  if(ps.length){value+=Math.min(30,ps.length*25);reasons.push('人物名称：'+ps.map(p=>p.name).join('、'));tokens.push(...ps.map(p=>p.name));}
  const ts=m.tags.filter(t=>contains(s.text,t));
  if(ts.length){value+=Math.min(30,ts.length*15);reasons.push('标签命中：'+ts.join('、'));tokens.push(...ts);}
  const shared=s.themes.map(t=>({...t,shared:t.words.filter(w=>contains(s.text,w)&&contains(text,w)),materialWords:t.words.filter(w=>contains(text,w))})).filter(t=>t.materialWords.length);
  if(shared.length){value+=Math.min(30,shared.length*10);reasons.push('共同主题：'+shared.map(t=>t.name+(t.shared.length?'（'+t.shared.slice(0,3).join('、')+'）':'（词表归类）')).join('、'));tokens.push(...shared.map(t=>t.name));}
  // Ignore arbitrary bigrams: at least an explicit name, tag, or a configured theme.
  return {material:m,value:Math.min(100,value),reasons,tokens:[...new Set(tokens)]};
 }
 const uses={case:'以自己的真实经历作类比，说明经历与这条新闻的差异，不当作新闻事实证据。',opinion:'回看已有判断，再用本次新闻检验适用条件；区分个人观点和来源事实。',viral:'只借鉴开头、冲突和组织结构；重写本次新闻，不复制原文。',comment:'将已记录的用户问题变成开场疑问；不把单条评论代表成所有用户。',work:'对照旧作品的观点与本次变化，引用自己已填写的复盘及真实表现数据。'};
 function matches(n,materials){const prepared=signals(n);return materials.map(m=>related(n,m,prepared)).filter(x=>x.value>0).sort((a,b)=>b.value-a.value||Date.parse(b.material.updated_at)-Date.parse(a.material.updated_at)||a.material.id.localeCompare(b.material.id));}
 function personal(n,all,p){
  const reasons=[];let total=0;
  for(const type of ['work','opinion','case','viral','comment']){const ms=all.filter(x=>x.material.type===type);const points=ms.length?types[type].points:0;total+=points;reasons.push({type,points,label:types[type].short,explain:ms.length?`找到${ms.length}条明确相关素材，按类型加分一次。`:'暂无明确相关素材，不加分。',material_id:ms[0]?.material.id||null});}
  const s=signals(n),cs=p.companies.filter(c=>s.companies.includes(c)),ds=p.domains.filter(d=>contains(s.text,d)||s.themes.some(t=>contains(t.name,d)||t.words.some(w=>contains(d,w))));
  const focus=cs.length>0||ds.length>0;total+=focus?10:0;reasons.push({type:'focus',points:focus?10:0,label:'长期关注',explain:focus?'命中：'+[...cs,...ds].join('、')+'。':'未命中已设置的长期关注。'});
  return {total,reasons,label:total>=70?'有多种历史素材可调用':total>=30?'有部分素材可调用':'个人积累证据较少'};
 }
 function angles(n,all){
  const best=t=>all.find(x=>x.material.type===t),a=best('opinion'),c=best('case'),w=best('work'),q=best('comment'),v=best('viral'),result=[];
  const build=(line,refs,structure,why)=>({line,why,materials:refs.filter(Boolean).map(x=>({id:x.material.id,title:x.material.title,type:x.material.type})),structure});
  if(a||c){const refs=[a,c].filter(Boolean);result.push(build(a?`用我的观点「${a.material.title}」检验这条新闻`:`从我经历过的「${c.material.title}」切入这条新闻`,refs,'我的问题或判断 → 本次来源事实 → 我的经历（如有）→ 相同与不同 → 条件和反例',refs.map(x=>types[x.material.type].short+'命中'+x.tokens.join('、')).join('；')+'。素材与新闻只是规则相关，不能直接证明结论。'));}
  if(q||w){const refs=[q,w].filter(Boolean);result.push(build(q?`回应我记录的用户问题：「${q.material.fields.question||q.material.title}」`:`回看「${w.material.title}」：这次有哪些可核实的新变化？`,refs,q?'用户疑问 → 本次新闻证据 → 对照已有作品（如有）→ 具体适用条件 → 留下讨论问题':'旧作品问题 → 本次真实变化 → 哪些判断保留/需修改 → 我的复盘 → 观众如何选择',refs.map(x=>types[x.material.type].short+'命中'+x.tokens.join('、')).join('；')+'。没有填写过的成绩或用户需求不会补写。'));}
  if(v)result.push(build(`借鉴「${v.material.title}」的组织方式，讲清这条新闻`,[v,...[a,c,q,w].filter(Boolean).slice(0,2)],v.material.fields.borrow||v.material.fields.structure||'开场生活问题 → 本次新闻事实 → 核心冲突 → 对普通人的影响 → 边界与讨论',`结构案例命中${v.tokens.join('、')}。这里只借鉴结构，不复制案例原文；未填结构时使用通用框架。`));
  return result.slice(0,3);
 }
 function analyse(n,state){const all=matches(n,state.materials);return {matches:all.slice(0,5).map(x=>({...x,use:uses[x.material.type]})),matchedCount:all.length,personal:personal(n,all,state.profile),angles:angles(n,all)};}
 function materialTime(m){const original=m.type==='case'?m.fields.date:m.type==='work'?m.fields.published:null;return Date.parse(original||m.created_at);}
 function filter(materials,{query='',type='all',tag='',sort='newest'}={}){const key=query.trim().toLowerCase();return materials.filter(m=>(type==='all'||m.type===type)&&(!tag||m.tags.includes(tag))&&textOf(m).toLowerCase().includes(key)).slice().sort((a,b)=>(sort==='oldest'?1:-1)*(materialTime(a)-materialTime(b))||a.id.localeCompare(b.id));}
 function performance(materials){return materials.filter(m=>m.type==='work'&&typeof m.fields.views==='number').slice().sort((a,b)=>b.fields.views-a.fields.views||Date.parse(b.updated_at)-Date.parse(a.updated_at)).slice(0,3);}
 return {types,companyAliases,people,themes,tags,textOf,validate,validateState,profile,defaultState,validURL,signals,related,matches,personal,analyse,angles,filter,materialTime,performance,uses};
});
