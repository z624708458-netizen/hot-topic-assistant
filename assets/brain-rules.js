/* V4.1: compatible private-material schema; deterministic rules, independent of V3. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RadarBrain=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const types={
  case:{label:'个人经历 / Case 库',short:'个人经历',points:20,fields:[['date','日期','date'],['event','事件经过'],['feeling','我的感受'],['conflict','冲突点'],['topics','可以延伸的话题']]},
  opinion:{label:'我的观点库',short:'个人观点',points:20,fields:[['point','核心观点'],['background','背景'],['reason','为什么这么判断'],['related','相关公司 / 人物 / 行业','text'],['counter','可以反驳它的观点']]},
  viral:{label:'爆款案例库',short:'爆款案例',points:15,fields:[['original','原始标题','text'],['copy','原文 / 文案'],['source','来源','text'],['url','链接','url'],['opening','开头方式'],['conflict','核心冲突'],['structure','内容结构'],['emotion','情绪点'],['potential','为什么可能爆'],['borrow','可以借鉴的结构']]},
  comment:{label:'用户需求 / 评论库',short:'用户需求',points:15,fields:[['comment','原评论'],['source','来源','text'],['likes','点赞量（不知道可留空）','number'],['question','用户真正关心的问题'],['emotion','情绪'],['topics','可以延伸的选题']]},
  work:{label:'历史作品库',short:'历史作品',points:20,fields:[['copy','文案'],['published','发布时间（北京时间）','datetime-local'],['platform','平台','text'],['views','播放量','number'],['likes','点赞','number'],['comments','评论','number'],['saves','收藏','number'],['review','我自己的复盘'],['status','内容状态','select'],['risk_note','风险复盘 / 已记录的原因（可留空）']]}
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
 // Product families are explicit: XR/手机 alone are sectors, never exact products.
 const products=[
  ['Vision Pro','苹果',['Vision Pro','VisionPro','Apple Vision']],['iPhone','苹果',['iPhone','苹果手机']],['iPad','苹果',['iPad']],['MacBook','苹果',['MacBook']],['HomePod','苹果',['HomePod']],
  ['小米 SU7','小米',['SU7']],['小米 YU7','小米',['YU7']],['Redmi','小米',['Redmi','红米']],['鸿蒙','华为',['鸿蒙','HarmonyOS']],['Mate','华为',['Mate']],['Pura','华为',['Pura']],
  ['微信','腾讯',['微信','WeChat']],['抖音','字节跳动',['抖音']],['TikTok','字节跳动',['TikTok']],['豆包','字节跳动',['豆包']],['淘宝','阿里巴巴',['淘宝']],['千问','阿里巴巴',['千问','Qwen']],
  ['文心','百度',['文心']],['ChatGPT','OpenAI',['ChatGPT']],['Sora','OpenAI',['Sora']],['Model 3','特斯拉',['Model 3']],['Model Y','特斯拉',['Model Y']]
 ];
 const topics=[
  ['裁员与业务调整',['裁员','解雇','失业','layoff','layoffs','job cuts','重组','业务调整','业务收缩','退出业务','砍掉','产品失败']],
  ['价格与收费',['降价','涨价','价格','售价','收费','免费','订阅费','price cut','price hike']],
  ['销量与经营表现',['销量','销售额','营收','利润','财报','亏损','市场份额','首销','sales','earnings']],
  ['资本市场',['股票','股价','资本市场','暴跌','暴涨','市值','上市','stock']],
  ['薪酬与就业',['工资','薪酬','奖金','降薪','招聘','岗位','就业','职场']],
  ['权益与监管',['隐私','个人信息','监管','处罚','起诉','诉讼','封禁','维权','投诉']],
  ['事故与产品安全',['事故','召回','自燃','安全隐患','碰撞']],
  ['XR业务',['Vision Pro','VisionPro','XR','虚拟现实','混合现实','头显']],
  ['智能家居',['智能家居','HomePod','智能音箱']],
  ['AI应用',['人工智能','AI','大模型','ChatGPT','豆包','千问','Sora']],
  ['新品与产品体验',['新品','新产品','发布会','体验','评测']],
  ['软件维护',['系统更新','软件更新','API更新','补丁','停止支持']],
  ['房地产',['房地产','房产','楼市','房贷','买房','租房']]
 ];
 const interests=[
  ['工作与收入',['裁员','解雇','失业','工资','薪酬','奖金','降薪','就业','岗位','招聘','职场','重组','业务调整','layoffs','job cuts']],
  ['消费成本',['降价','涨价','价格','售价','收费','免费','订阅','预算','退款','房贷','price cut','price hike']],
  ['购买与使用选择',['购买','选购','体验','售后','停产','新品','产品失败','Vision Pro','VisionPro','XR','头显']],
  ['用户权益与安全',['隐私','个人信息','权益','维权','事故','召回','处罚','投诉','安全隐患']],
  ['投资得失',['股价','股票','资本市场','投资者','暴跌','暴涨','市值']]
 ];
 const narratives=[
  ['业务变化与前后对照',['裁员','重组','调整','退出','收缩','失败','亏损','layoffs','job cuts']],
  ['价格变化与成本对照',['降价','涨价','价格','收费','免费']],
  ['争议回应与证据边界',['争议','回应','道歉','投诉','质疑','起诉']],
  ['选择问题与体验复盘',['为什么','怎么选','购买','体验','评测','复盘']],
  ['成绩变化与数据核对',['销量','首销','营收','财报','市值','暴跌','暴涨']]
 ];
 const contentStatuses={normal:'正常',limited:'被限流',removed:'被下架 / 屏蔽',complaint:'被投诉',deleted:'自己删除'};
 const threshold=60;
 function contentStatus(m){return m.fields?.status||'normal';}
 function hitGroups(text,table){return table.filter(([,words])=>words.some(w=>contains(text,w))).map(([name])=>name);}
 function productNames(text){return products.filter(([, ,words])=>words.some(w=>contains(text,w))).map(([name])=>name);}
 function contains(text,word){
  if(!word)return false;
  if(/^[\x00-\x7f]+$/.test(word))return new RegExp('(^|[^a-z0-9])'+word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'([^a-z0-9]|$)','i').test(text);
  return text.toLowerCase().includes(word.toLowerCase());
 }
 function tags(text){return [...new Set((Array.isArray(text)?text:String(text||'').split(/[,，;；\n#]+/)).map(x=>String(x).trim()).filter(Boolean))].slice(0,50);}
 function textOf(m){return [m.title,m.body,...Object.values(m.fields||{}),...(m.tags||[])].filter(v=>v!==null&&v!==undefined).join(' ');}
 function meaningfulText(m){return [m.title,m.body,...types[m.type].fields.filter(f=>!['date','datetime-local','number','url','select'].includes(f[2])).map(f=>m.fields?.[f[0]]),...(m.tags||[])].filter(Boolean).join(' ');}
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
   else if(kind==='select'&&!Object.hasOwn(contentStatuses,v))throw new Error('内容状态无效');
   else if(kind==='url'&&!validURL(v))throw new Error('链接请使用不含账号密码的 http 或 https 地址');
   else if(kind==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v))throw new Error('日期无效');
   else if(kind==='datetime-local'&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,19)!==v.slice(0,19)))throw new Error('发布时间无效');
  }
  if(!Number.isFinite(Date.parse(m.created_at))||!Number.isFinite(Date.parse(m.updated_at)))throw new Error('素材保存时间无效');
  if(m.origin&&(!m.origin.news_id||typeof m.origin.title!=='string'||!validURL(m.origin.url)))throw new Error('关联新闻格式无效');
  if(m.generation)validateGeneration(m.generation);
  return m;
 }
 function validateGeneration(g){
  if(!g||g.version!=='5.0.0'||g.provider!=='rules'||!Number.isFinite(Date.parse(g.generated_at))||typeof g.news_id!=='string'||![60,90].includes(g.duration)||!['A','B','C','D'].includes(g.structure)||!Array.isArray(g.used_materials)||g.used_materials.length>5||g.used_materials.some(x=>!x||typeof x.id!=='string'||typeof x.title!=='string'||x.title.length>300||!Object.hasOwn(types,x.type)||!Number.isFinite(x.relevance)||x.relevance<60||x.relevance>100||!(x.performance===null||['S','A','B','C','D'].includes(x.performance))||typeof x.role!=='string')||!Array.isArray(g.checks)||g.checks.length>500||g.checks.some(x=>!x||typeof x.sentence!=='string'||!['news','history','judgment','review'].includes(x.kind)))throw new Error('口播生成记录无效');
  return g;
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
 function newsText(n){return [n.title,n.summary,n.body,n.content].filter(Boolean).join(' ');}
 function materialContext(m){
  // Tags, metrics, URLs, platform/status and risk review cannot create event context.
  const ignored=['review','risk_note','related','source','platform','counter'];
  return [m.title,m.body,...types[m.type].fields.filter(f=>!ignored.includes(f[0])&&!['date','datetime-local','number','url','select'].includes(f[2])).map(f=>m.fields?.[f[0]])].filter(Boolean).join(' ');
 }
 function companyIn(text){return Object.entries(companyAliases).filter(([,aliases])=>aliases.some(a=>contains(text,a))).map(([c])=>c).concat(products.filter(([, ,words])=>words.some(w=>contains(text,w))).map(([,c])=>c));}
 function coreSignals(title,context){
  const titleCompanies=companyIn(title),titlePeople=people.filter(p=>p.aliases.some(a=>contains(title,a)));
  const persons=titlePeople.length?titlePeople:people.filter(p=>p.aliases.some(a=>contains(context,a)));
  return {companies:[...new Set(titleCompanies.length?titleCompanies:companyIn(context))],persons};
 }
 function signals(n){
  const text=newsText(n),core=coreSignals(n.title||'',text);
  if(!core.companies.length)core.companies=(n.companies||[n.company]).filter(c=>Object.hasOwn(companyAliases,c));
  return {...core,text,themes:themes.filter(t=>t.words.some(w=>contains(text,w))),products:productNames(n.title||'').length?productNames(n.title):productNames(text),topics:hitGroups(text,topics),interests:hitGroups(text,interests),narratives:hitGroups(text,narratives)};
 }
 function related(n,m,prepared=signals(n)){
  const s=prepared,text=materialContext(m),core=coreSignals(m.title,[text,m.fields?.related].filter(Boolean).join(' ')),breakdown=[],tokens=[];
  const add=(key,label,points,evidence)=>{breakdown.push({key,label,points:evidence.length?points:0,evidence});tokens.push(...evidence);};
  const cs=s.companies.filter(c=>core.companies.includes(c)),ps=s.persons.filter(p=>core.persons.some(x=>x.name===p.name)).map(p=>p.name);
  add('entity','核心公司 / 人物名称',25,[...cs,...ps]);
  const materialProducts=productNames(m.title).length?productNames(m.title):productNames(text),materialTopics=hitGroups(text,topics),materialInterests=hitGroups(text,interests),materialNarratives=hitGroups(text,narratives);
  const sharedProducts=s.products.filter(name=>materialProducts.includes(name));
  add('product','具体产品 / 项目',25,sharedProducts);
  add('topic','具体事件主题',20,s.topics.filter(t=>materialTopics.includes(t)));
  add('interest','普通人利益点',15,s.interests.filter(t=>materialInterests.includes(t)));
  add('narrative','内容叙事结构',10,s.narratives.filter(t=>materialNarratives.includes(t)));
  const ts=m.tags.filter(t=>contains(s.text,t));
  // Company tags alone are at most 5; "高度重合" requires >=2 and >=half the material's tags.
  add('tags','标签高度重合',5,ts.length>=2&&ts.length/m.tags.length>=.5?ts:[]);
  const value=breakdown.reduce((sum,x)=>sum+x.points,0),band=value>=80?'强相关':value>=60?'中高相关':value>=40?'弱相关':'扩展素材';
  const reasons=breakdown.filter(x=>x.points).map(x=>`${x.label} +${x.points}：${x.evidence.join('、')}`);
  if(ts.length&&!breakdown.find(x=>x.key==='tags').points)reasons.push('标签命中但未达高度重合，不加分：'+ts.join('、'));
  return {material:m,value,score:value,band,eligible:value>=threshold,breakdown,reasons,tokens:[...new Set(tokens)]};
 }
 function gradePerformance(m){
  const f=m.fields||{},views=typeof f.views==='number'?f.views:null,keys=['likes','comments','saves'],known=keys.filter(k=>typeof f[k]==='number'),interactions=known.reduce((sum,k)=>sum+f[k],0);
  // A sum above views may mean mismatched statistics. Do not use it as a bonus.
  const invalid=views===0&&interactions>0||views!==null&&interactions>views;
  const rate=views>0&&known.length&&!invalid?interactions/views:null;
  if(views===null)return {grade:null,label:'数据不足',factor:.4,views,rate,complete:known.length===3,explain:'播放量未填写；不推定成绩，参考权重0.4。'};
  const grades=['D','C','B','A','S'];let index=views>=1000000?4:views>=500000?3:views>=100000?2:views>=10000?1:0;
  const base=grades[index];
  // Small samples cannot turn into a hit by a handful of interactions.
  const promoted=views>=10000&&rate!==null&&rate>=.05&&index<4;
  if(promoted)index++;
  const low=views>=10000&&known.length===3&&rate!==null&&rate<.001;
  if(low&&index>0)index--;
  const grade=grades[index],factor={S:1,A:.85,B:.7,C:.5,D:.3}[grade];
  return {grade,label:{S:'超级爆款',A:'爆款',B:'表现较好',C:'普通',D:'表现较差'}[grade],factor,views,rate,complete:known.length===3,explain:`播放档 ${base}（${views.toLocaleString('zh-CN')}）；`+(invalid?'互动数与播放数不一致，未使用互动率。':rate===null?'互动数据不足，未调整等级。':`已填互动率 ${(rate*100).toFixed(2)}%${known.length<3?'（部分字段，不能据此降级）':''}；`)+(promoted?'达到5%且播放≥1万，提升一级。':low?'三项齐全且互动率低于0.1%，降低一级。':'')+`参考权重${factor}。`};
 }
 const uses={case:'以自己的真实经历作类比，说明经历与这条新闻的差异，不当作新闻事实证据。',opinion:'回看已有判断，再用本次新闻检验适用条件；区分个人观点和来源事实。',viral:'只借鉴开头、冲突和组织结构；重写本次新闻，不复制原文。',comment:'将已记录的用户问题变成开场疑问；不把单条评论代表成所有用户。',work:'对照旧作品的观点与本次变化，引用自己已填写的复盘及真实表现数据。'};
 function matches(n,materials,includeZero=false){const prepared=signals(n);return materials.map(m=>related(n,m,prepared)).filter(x=>includeZero||x.value>0).sort((a,b)=>b.value-a.value||Date.parse(b.material.updated_at)-Date.parse(a.material.updated_at)||a.material.id.localeCompare(b.material.id));}
 function personal(n,all,p){
  const reasons=[];let total=0;
  for(const type of ['work','opinion','case','viral','comment']){
   const candidates=all.filter(x=>x.material.type===type&&x.eligible).map(x=>{const performance=type==='work'?gradePerformance(x.material):null,valueWeight=performance?.factor??1,raw=types[type].points*x.value/100*valueWeight;return {...x,performance,valueWeight,raw};}).sort((a,b)=>b.raw-a.raw||b.value-a.value||a.material.id.localeCompare(b.material.id));
   const best=candidates[0],points=best?Math.round(best.raw*10)/10:0;total+=points;
   reasons.push({type,points,cap:types[type].points,label:types[type].short,material_id:best?.material.id||null,selected:best||null,candidates,explain:best?`相关性 ${best.value}/100 × 价值权重 ${best.valueWeight} × 类型上限 ${types[type].points} = ${points} 分；仅取本类最高贡献，同类不叠加。`:`暂无达到 ${threshold} 分的素材，本类不加分。`});
  }
  const s=signals(n),cs=p.companies.filter(c=>s.companies.includes(c)),ds=p.domains.filter(d=>contains(s.text,d)||s.themes.some(t=>contains(t.name,d)||t.words.some(w=>contains(d,w))));
  const focus=cs.length>0||ds.length>0;total+=focus?10:0;reasons.push({type:'focus',points:focus?10:0,cap:10,label:'长期关注',explain:focus?'命中：'+[...cs,...ds].join('、')+'。':'未命中已设置的长期关注。'});
  return {total:Math.min(100,Math.round(total*10)/10),reasons,label:total>=70?'有较充分的相关积累':total>=30?'有部分相关积累可调用':'个人积累证据较少'};
 }
 function historyReference(all){
  const works=all.filter(x=>x.material.type==='work'&&x.eligible),strong=works.filter(x=>x.value>=80),over50=strong.filter(x=>typeof x.material.fields.views==='number'&&x.material.fields.views>=500000),good=works.filter(x=>['S','A','B'].includes(gradePerformance(x.material).grade));
  let summary=works.length?`你记录过 ${works.length} 条相关性至少60分的作品（其中 ${strong.length} 条强相关，${over50.length} 条强相关作品播放达到50万）；`:'暂无达到60分的相关历史作品，不能从低相关或缺少的数据推断账号表现。';
  if(works.length)summary+=good.length?`其中 ${good.length} 条表现为 S/A/B，值得回看具体复盘；历史表现不代表未来播放量。`:works.some(x=>gradePerformance(x.material).grade)?'已有成绩整体未达到 B 级，建议谨慎判断，不要仅因为熟悉就做。':'播放数据未填写，暂不能判断历史表现。';
  return {count:works.length,summary,items:works.slice(0,3).map(x=>({...x,performance:gradePerformance(x.material)}))};
 }
 const riskExpressions=[['未证实的幕后操控',['幕后操控','幕后操纵','暗中操控']],['利益输送的指控',['利益输送']],['人物动机推测',['动机推测','别有用心','故意收割','幕后黑手']]];
 function contentRisk(n,all){
  const source=signals(n).text,items=[];
  for(const x of all){
   if(x.material.type!=='work')continue;
   const status=contentStatus(x.material);if(!['removed','limited','complaint'].includes(status))continue;
   const sameContext=x.breakdown.some(b=>['topic','product'].includes(b.key)&&b.points>0),expressions=riskExpressions.filter(([,words])=>words.some(w=>contains(source,w))&&words.some(w=>contains([materialContext(x.material),x.material.fields.review,x.material.fields.risk_note].join(' '),w))).map(([name])=>name);
   if(!(sameContext&&x.value>=40)&&!expressions.length)continue;
   const level=status==='removed'?'高':'中',note=x.material.fields.risk_note||'';
   items.push({id:x.material.id,title:x.material.title,relevance:x.value,status,label:contentStatuses[status],level,expressions,note,reason:expressions.length?'当前文字与作品记录有相似表达线索：'+expressions.join('、'):'命中相似产品 / 事件主题；相关性 '+x.value+'/100。'});
  }
  items.sort((a,b)=>(b.level==='高')-(a.level==='高')||b.relevance-a.relevance||a.id.localeCompare(b.id));
  return {level:items.some(x=>x.level==='高')?'高':items.length?'中':'低',count:items.length,items:items.slice(0,3),note:items.length?'依据你手动记录的状态与相似题材 / 表达提示；不能确定平台处理原因。请核对原文、平台规则与复盘，区分事实、推测和观点，避免未经证实的指控。':'未命中已记录的平台风险；不代表题材安全，也不是平台审核预测。'};
 }
 function angles(n,all){
  all=all.filter(x=>x.eligible);
  const best=t=>t==='work'?all.filter(x=>x.material.type==='work').sort((a,b)=>b.value*gradePerformance(b.material).factor-a.value*gradePerformance(a.material).factor||b.value-a.value||a.material.id.localeCompare(b.material.id))[0]:all.find(x=>x.material.type===t),a=best('opinion'),c=best('case'),w=best('work'),q=best('comment'),v=best('viral'),result=[];
  const build=(line,refs,structure,why)=>({line,why,materials:refs.filter(Boolean).map(x=>({id:x.material.id,title:x.material.title,type:x.material.type})),structure});
  if(a||c){const refs=[a,c].filter(Boolean);result.push(build(a?`用我的观点「${a.material.title}」检验这条新闻`:`从我经历过的「${c.material.title}」切入这条新闻`,refs,'我的问题或判断 → 本次来源事实 → 我的经历（如有）→ 相同与不同 → 条件和反例',refs.map(x=>types[x.material.type].short+'命中'+x.tokens.join('、')).join('；')+'。素材与新闻只是规则相关，不能直接证明结论。'));}
  if(q||w){const refs=[q,w].filter(Boolean);result.push(build(q?`回应我记录的用户问题：「${q.material.fields.question||q.material.title}」`:`回看「${w.material.title}」：这次有哪些可核实的新变化？`,refs,q?'用户疑问 → 本次新闻证据 → 对照已有作品（如有）→ 具体适用条件 → 留下讨论问题':'旧作品问题 → 本次真实变化 → 哪些判断保留/需修改 → 我的复盘 → 观众如何选择',refs.map(x=>types[x.material.type].short+'命中'+x.tokens.join('、')).join('；')+'。没有填写过的成绩或用户需求不会补写。'));}
  if(v)result.push(build(`借鉴「${v.material.title}」的组织方式，讲清这条新闻`,[v,...[a,c,q,w].filter(Boolean).slice(0,2)],v.material.fields.borrow||v.material.fields.structure||'开场生活问题 → 本次新闻事实 → 核心冲突 → 对普通人的影响 → 边界与讨论',`结构案例命中${v.tokens.join('、')}。这里只借鉴结构，不复制案例原文；未填结构时使用通用框架。`));
  return result.slice(0,3);
 }
 function analyse(n,state){const raw=matches(n,state.materials,true),all=raw.filter(x=>x.value>0);return {matches:all.slice(0,5).map(x=>({...x,use:uses[x.material.type]})),matchedCount:all.length,personal:personal(n,all,state.profile),angles:angles(n,all),history:historyReference(all),risk:contentRisk(n,raw),threshold};}
 function materialTime(m){const original=m.type==='case'?m.fields.date:m.type==='work'?m.fields.published:null;return Date.parse(original||m.created_at);}
 function filter(materials,{query='',type='all',tag='',sort='newest'}={}){const key=query.trim().toLowerCase();return materials.filter(m=>(type==='all'||m.type===type)&&(!tag||m.tags.includes(tag))&&textOf(m).toLowerCase().includes(key)).slice().sort((a,b)=>(sort==='oldest'?1:-1)*(materialTime(a)-materialTime(b))||a.id.localeCompare(b.id));}
 function performance(materials){return materials.filter(m=>m.type==='work'&&typeof m.fields.views==='number').slice().sort((a,b)=>b.fields.views-a.fields.views||Date.parse(b.updated_at)-Date.parse(a.updated_at)).slice(0,3);}
 return {types,companyAliases,people,themes,tags,textOf,validate,validateState,profile,defaultState,validURL,signals,related,matches,personal,analyse,angles,filter,materialTime,performance,uses,products,topics,interests,narratives,threshold,contentStatuses,contentStatus,gradePerformance,historyReference,contentRisk,validateGeneration};
});
