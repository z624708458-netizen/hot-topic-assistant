/* V5 free, deterministic speech provider. No network calls and no inferred facts. */
(function(root,factory){const B=typeof module==='object'&&module.exports?require('./brain-rules.js'):root.RadarBrain,api=factory(B);if(typeof module==='object'&&module.exports)module.exports=api;else root.RadarSpeech=api;})(typeof globalThis!=='undefined'?globalThis:this,function(B){
 'use strict';
 const version='5.0.0';
 const structures={
  A:{label:'高点击反差型',angle:'名气与实际变化',flow:'熟悉的印象 → 来源里的新变化 → 两者有什么差别 → 普通人如何看',words:['裁员','取消','砍掉','失败','暴跌','下滑','收缩','退出','停产']},
  B:{label:'普通人利益型',angle:'钱袋子与生活选择',flow:'这条新闻 → 钱 / 时间 / 工作 → 适用条件 → 我的判断',words:['工资','双休','福利','价格','降价','涨价','就业','社保','奖金','裁员','收费','万元','交付','免费']},
  C:{label:'消费者争议型',angle:'值不值得买和怎么选',flow:'已报道的变化 → 消费者的问题 → 可比较的条件 → 购买判断',words:['手机','汽车','家电','涨价','价格','高端','iPhone','车主','购车','试驾','Vision Pro','万元']},
  D:{label:'职场 / 大厂祛魅型',angle:'岗位与大厂光环',flow:'新闻里的争议 → 大厂印象 → 工作场景的问题 → 观点收束',words:['裁员','管理层','大厂文化','跳槽','岗位','工资','职场','降薪']}
 };
 const riskPatterns=[
  ['未证实指控',/利益输送|黑幕|幕后[^。！？\n]{0,12}(?:操控|操纵|大佬|黑手)|资本[^。！？\n]{0,12}(?:安排|操控|操纵)|暗中操控|造假|诈骗/],
  ['人物动机推测',/别有用心|故意收割|为了收割|动机推测|早就安排好了|肯定想|一定想/],
  ['法律责任或法规解释',/全责|负全责|违法|犯法|法律规定|法律要求|必须赔|必须承担|一定坐牢/],
  ['绝对化承诺',/绝对|百分之百|100%|永远|必然|保证|所有人|没有任何|(?<!不)一定(?:会|能|是|要)/]
 ];
 const labels={news:'已有新闻来源支持',history:'第二大脑历史观点 / 经历',judgment:'我的判断 / 推演',review:'需要核实'};
 function hazards(text){return riskPatterns.filter(([,re])=>re.test(text)).map(([label])=>label);}
 function sentences(text){return String(text||'').match(/[^。！？\n]+[。！？]?/g)?.map(t=>t.trim()).filter(t=>/[\p{L}\p{N}]/u.test(t))||[];}
 function normalize(text){return String(text).replace(/[\s“”"「」『』]/g,'').trim();}
 function words(text){return Array.from(String(text).replace(/\s/g,'')).length;}
 function snapshot(n){const result={};for(const k of ['id','title','published','company','source','url','summary','kind','report_type','summary_status'])if(n[k]!==undefined)result[k]=n[k];result.companies=(n.companies||[n.company]).slice();for(const k of ['body','content'])if(typeof n[k]==='string')result[k]=n[k];return result;}
 function validateNews(n){
  if(!n||['id','title','published','company','source','url'].some(k=>typeof n[k]!=='string'||!n[k])||n.title.length>600||typeof n.summary!=='string'||n.summary.length>1600||!B.validURL(n.url)||!Number.isFinite(Date.parse(n.published)))throw new Error('新闻来源或字段不完整，不能生成');
  return n;
 }
 function detectStructure(m){
  const f=m.fields||{},text=[f.borrow,f.structure,f.review,f.copy,m.body].filter(Boolean).join(' ');
  if(/大厂文化|职场|跳槽|管理层|祛魅/.test(text))return 'D';
  if(/昔日|曾经|从爆火|巨大反差|高光|跌落/.test(text))return 'A';
  if(/消费者|怎么选|值不值|横向对比|偏贵|价格/.test(text))return 'C';
  if(/工资|双休|福利|社保|钱袋子|普通人利益/.test(text))return 'B';
  return null;
 }
 function materialValue(x){return x.value*(x.material.type==='work'?B.gradePerformance(x.material).factor:1);}
 function context(n,state){
  const all=B.matches(n,state.materials),eligible=all.filter(x=>x.value>=60),safe=eligible.filter(x=>x.material.type!=='work'||['normal','deleted'].includes(B.contentStatus(x.material)));
  const priority=x=>x.material.type==='work'&&x.value>=80&&['S','A'].includes(B.gradePerformance(x.material).grade)?0:x.value>=80?({opinion:1,comment:2,case:3,viral:4,work:5}[x.material.type]):({work:6,opinion:7,comment:8,case:9,viral:10}[x.material.type]);
  safe.sort((a,b)=>priority(a)-priority(b)||materialValue(b)-materialValue(a)||a.material.id.localeCompare(b.material.id));
  const selected=[];for(const x of safe)if(!selected.some(y=>y.material.type===x.material.type))selected.push(x);
  return {eligible,selected,risk:B.analyse(n,state).risk,focus:B.personal(n,all,state.profile).reasons.find(x=>x.type==='focus'),focusDomains:state.profile.domains.slice()};
 }
 function chooseStructures(n,c){
  const text=[n.title,n.summary].join(' ');let keys=Object.keys(structures).filter(k=>structures[k].words.some(w=>text.toLowerCase().includes(w.toLowerCase())));
  if(!keys.length)keys=['B','A']; // Distinct general perspectives, no invented impact or past glory.
  else if(keys.length===1)keys.push(keys[0]==='A'?'B':'A');
  let reference=null;
  const successes=c.selected.filter(x=>x.material.type==='work'&&x.value>=80&&['S','A'].includes(B.gradePerformance(x.material).grade));
  for(const x of successes){const k=detectStructure(x.material);if(k&&keys.includes(k)){keys=[k,...keys.filter(t=>t!==k)];reference=x;break;}}
  if(!reference){const v=c.selected.find(x=>x.material.type==='viral'&&keys.includes(detectStructure(x.material)));if(v){const k=detectStructure(v.material);keys=[k,...keys.filter(t=>t!==k)];reference=v;}}
  if(!reference&&c.focus?.points){const preferred=c.focusDomains.some(t=>/职场|工作|就业/.test(t))?'D':c.focusDomains.some(t=>/消费|收入|福利/.test(t))?'B':null;if(preferred&&keys.includes(preferred))keys=[preferred,...keys.filter(k=>k!==preferred)];}
  return {keys,reference};
 }
 function safeExcerpt(text,max=110){return sentences(text).find(s=>s.length<=max&&s.length>=4&&!hazards(s).length)||'';}
 function openings(n,key,revision=0,oral=''){
  const pool={
   A:[['名气是一回事。这次发生了什么，是另一回事。','如果只看这家公司的名气，很容易漏掉这条消息里的变化。','这条消息值得停一下：光环和现实，得分开看。'],['别只追着热闹跑。这次变化会碰到你的哪个选择？','品牌的故事再大，也得落到普通人的选择上。','你关心品牌输赢，我更想问：普通人该看什么？'],['我们习惯看大厂的高光。今天，换个角度看它的变化。','熟悉的名字，不等于熟悉的结果。先把这次新闻看清楚。','印象可以很稳定，新闻却在变。这两件事别混着说。']],
   B:[['这条消息，别只听公司的说法。也问问普通人能得到什么。','宏观新闻听着很大，落到自己身上才知道要问什么。','如果新闻只剩品牌名，普通人真正关心的问题就被盖住了。'],['这条新闻跟你有什么关系？我想从钱、时间和选择聊。','先别研究技术参数。我们先聊自己的成本。','看这条消息，我想先问一句：我的选择要不要变？'],['公司看的是业务，普通人看的是日子。看新闻的角度可以不同。','一边是公司的大故事，一边是自己的小账本。先把小账本看清楚。','同一条消息，站在普通人的位置看，问题就变了。']],
   C:[['牌子越响，就越值得买吗？先别急着掏钱。','一条产品消息，为什么能让人争起来？先问消费者在意什么。','产品讲得很热闹，消费者该问的东西却不能省。'],['如果你准备花钱，这条消息该怎么看？先盯自己的需求。','买东西之前，我更关心适不适合自己，而不是谁喊得响。','这次别替品牌站队。先替自己的钱包问几个问题。'],['品牌追求高光，消费者追求合适。这两笔账可能不同。','纸面参数是一回事，自己怎么用，是另一回事。','一个产品的故事，可以从发布会讲，也可以从钱包讲。']],
   D:[['大厂两个字，就等于岗位稳吗？先看这条消息。','聊大厂，别只聊光环。工作这件事，得把条件讲清楚。','公司名气很大，普通人的工作选择也不能被省略。'],['如果你在考虑工作，这条消息值得从自己的位置看。','别急着替公司算输赢。先想想岗位、收入和选择。','职场新闻，我想先问：普通人该盯住什么条件？'],['大厂的光环，和一个人的工作体验，是两件事。','别人看到公司名字，打工人更想看自己的处境。','聊大厂容易谈理想，聊工作还得回到具体条件。']]
  };
  return pool[key].map((xs,i)=>({kind:['强冲突','强利益','强反差'][i],text:(oral&&i===0?oral+'，':'')+xs[(revision+i)%xs.length]}));
 }
 function titles(n,key){
  const name=(n.companies||[n.company]).join(' / '),short=n.title.length<=70?n.title:`${name}这条新闻`;
  const endings={A:['熟悉的光环之外，该看什么？','变化该怎么理解？','普通人该问哪些问题？'],B:['和你的生活选择有什么关系？','这次先替自己算账','哪些条件不能漏看？'],C:['买之前，先问这几个问题','品牌故事之外，消费者该看什么？','你会因此改变购买选择吗？'],D:['大厂光环之外，工作该看什么？','普通人的岗位选择怎么想？','别漏掉新闻里的条件']};
  return [`${short}：${endings[key][0]}`,`${name}这条消息，${endings[key][1]}`,`${name}：${endings[key][2]}`];
 }
 function generateRules(request){
  const {news:n,brain:state}=request;validateNews(n);B.validateState(state);
  const duration=request.duration??60;if(![60,90].includes(duration))throw new Error('仅支持60秒或90秒');
  const c=context(n,state),selection=chooseStructures(n,c),index=(request.angleIndex||0)%selection.keys.length,key=selection.keys[index],used=[],segments=[];
  const use=(x,role)=>{if(x&&!used.some(y=>y.id===x.material.id))used.push({id:x.material.id,type:x.material.type,title:x.material.title,relevance:x.value,performance:x.material.type==='work'?B.gradePerformance(x.material).grade:null,role});};
  const add=(text,kind='judgment',evidence=null,role='body')=>{if(text)segments.push({text,kind,evidence,role});};
  let oral='';const success=c.selected.find(x=>x.material.type==='work'&&['S','A'].includes(B.gradePerformance(x.material).grade));
  if(success&&(success.material.fields.copy||success.material.body).trim()){const text=success.material.fields.copy||success.material.body;const choices=['说真的','讲真','先别急','你敢信吗','我去','家人们'].filter(w=>text.includes(w));use(success,choices.length?'参考已记录的口语开场词，不复用旧事实':'参考相关作品的题材与成绩，不复用旧事实；短句采用默认口语规则');if(choices.length&&Array.from(n.id).reduce((v,ch)=>v+ch.codePointAt(0),0)%3===0)oral=choices[(request.hookVersion||0)+index<choices.length?(request.hookVersion||0)+index:0];}
  if(selection.reference&&index===0)use(selection.reference,'参考已记录的结构线索');
  const hooks=openings(n,key,request.hookVersion||0,oral);add(hooks[index%3].text,'judgment',null,'hook');
  const source={url:n.url,published:n.published,source:n.source,news_id:n.id};
  const headline=!hazards(n.title).length&&n.title.length<=140?n.title:'';
  const fact=headline||safeExcerpt(n.summary,duration===60?120:170);
  if(fact)add(`据${n.source}，报道里提到：“${fact}”`,'news',{...source,quote:fact,field:headline?'title':'summary'},'fact');
  else add(`这条来自${n.source}的新闻涉及${n.company}。原题中的表述需要核实，我先不把它讲成结论。`,'review',source,'fact');
  if(duration===90&&headline){const extra=safeExcerpt(n.summary,120);if(extra&&normalize(extra)!==normalize(headline)&&words(segments.map(s=>s.text).join(''))+words(extra)<260)add(`来源摘要还写到：“${extra}”`,'news',{...source,quote:extra,field:'summary'},'fact');}
  const impacts={A:'我想聊的不是品牌突然行不行，而是这次变化该怎么看。别把一次新闻，讲成整家公司的最终结局。',B:'普通人看这条消息，可以先问：自己的成本、时间或者选择，有没有需要重新考虑的地方？影响要看具体条件。',C:'消费者不用替品牌争输赢。我更想问：适不适合自己？价格、使用场景和可核实的条件，要放在一起看。',D:'站在工作的角度，我更看重岗位、收入和具体条件。公司的名气，可以参考，但不能替一个人作决定。'};
  add(impacts[key]);
  const opinion=c.selected.find(x=>x.material.type==='opinion'),point=opinion&&safeExcerpt(opinion.material.fields.point||opinion.material.body,85);
  if(point){use(opinion,'引用旧观点，明确是历史判断而非当前事实');add(`我以前记过一个观点：“${point}”`,'history',{material_id:opinion.material.id,quote:point},'view');add('这次我想拿它来提问，不把它当成新闻证据。');}
  else add({A:'我的判断是：大厂也要面对具体业务的取舍。谈变化，比急着贴输赢标签更有用。',B:'我的看法是：先弄清消息里的条件，再决定跟不跟。没说清适用范围的好处，我会先打个问号。',C:'我的判断很简单：先看实际需要，再看品牌光环。新闻没给出的比较结果，我不替它补出来。',D:'我的观点是：聊工作，要把人的选择放进来。光看公司名字，很难替自己作判断。'}[key]);
  const comment=c.selected.find(x=>x.material.type==='comment'),question=comment&&safeExcerpt(comment.material.fields.question||comment.material.fields.comment||comment.material.body,60);
  if(question&&duration===90){use(comment,'用已记录的一个问题组织观众视角，不代表所有人');add(`我还记过一个用户问题：“${question}”这是一个提问，不是所有人的结论。`,'history',{material_id:comment.material.id,quote:question},'audience');}
  const personal=c.selected.find(x=>x.material.type==='case'),experience=personal&&safeExcerpt(personal.material.fields.event||personal.material.body,65);
  if(experience&&duration===90&&!question&&words(segments.map(s=>s.text).join(''))<300){use(personal,'引用已有个人经历，并区分经历与新闻事实');add(`我过去记录过一段经历：“${experience}”它可以作类比，不能证明这次新闻的结论。`,'history',{material_id:personal.material.id,quote:experience},'case');}
  const contrast={A:'反差不在于喊得多响，而在于熟悉的印象，能不能经得起这次事实的检验。',B:'公司讲的是发展，普通人关心的是自己的日子。两种角度，都得回到能核实的事情上。',C:'品牌想讲一个大故事，消费者要作一个小决定。两边的标准，不必一样。',D:'公司有公司的业务选择，个人也有自己的生活选择。别把其中一边的账，算成另一边的结论。'};
  add(contrast[key]);
  if(request.conflict)add('真正值得争的，是判断标准：你在看品牌的声量，还是自己的成本和条件？先把证据摆出来，再谈输赢。');
  if(duration===90)add('还有个边界得说清：新闻里提到一家公司，不代表每个人都受影响。来源没确认的原因和后果，我也先不替它下结论。');
  add({A:'你更想看品牌的光环，还是这次具体发生的变化？评论区聊聊。',B:'如果是你，这条消息会改变哪个选择？说说你的理由。',C:'换成你掏钱，你最想先核实什么？评论区聊聊。',D:'看一份工作，你会先看公司名字，还是具体条件？'}[key]);
  const extraQuestions={A:['我更想追问：变化发生在哪一块，来源确认到了哪一步？如果只看到公司名字，很容易跟着情绪走。','如果你正好在作相关选择，先看原报道，再看自己的条件。一个标题，还不足以替你把结果算出来。'],B:['你可以把自己的需求列出来，再去对照新闻。哪些条件适用于你，哪些只是别人的情况，分开看更有用。','如果你正好在作相关选择，先看原报道，再看自己的条件。别拿一句标题，替自己把决定作完。'],C:['我会把预算和使用场景摆出来，再核对来源里的条件。没有相同的比较口径，就先不急着说谁赢谁输。','比较的时候也问一句：什么是我真会用的，什么只是听着热闹？这里说的是选择标准，不是新的产品结论。'],D:['如果我在选工作，会把岗位内容、收入和工作条件列出来比较。这是我的选择标准，不是新闻确认的待遇变化。','所谓好工作，也得说明对谁好、在什么条件下好。把具体条件讲清楚，比围着大厂两个字争论更有用。']};
  for(const text of extraQuestions[key]){if(words(segments.map(s=>s.text).join(''))>=duration*3.8)break;segments.splice(segments.length-1,0,{text,kind:'judgment',evidence:null,role:'context'});}
  // Keep quotes whole: drop optional additions rather than truncate facts or qualifiers.
  const cap=duration===60?340:500;
  while(words(segments.map(s=>s.text).join('\n\n'))>cap){const at=segments.findIndex(s=>['case','audience'].includes(s.role));if(at<0)break;const old=segments.splice(at,1)[0];const ref=old.evidence?.material_id;for(let i=used.length-1;i>=0;i--)if(used[i].id===ref&&!segments.some(s=>s.evidence?.material_id===ref))used.splice(i,1);}
  const result={version,provider:'rules',news:snapshot(n),duration,angleIndex:index,availableStructures:selection.keys,structure:key,structureLabel:structures[key].label,angle:structures[key].angle,hookVersion:request.hookVersion||0,conflict:!!request.conflict,conversational:false,lowRisk:!!request.lowRisk,generated_at:request.generated_at||new Date().toISOString(),segments,main:segments.map(s=>s.text).join('\n\n'),openings:hooks,titles:titles(n,key),used_materials:used,risk:c.risk,contextNote:used.length?'本次只调用能用于当前表达的相关素材，不把旧事实当新事实。':'本次主要基于当前新闻生成，第二大脑可调用素材较少。',why:[`选择「${structures[key].label}」，切入点是${structures[key].angle}，先回答普通人该关心什么。`,`开头采用疑问或标准对照，不把未报道的结果、原因写成事实。`,selection.reference&&index===0?`结构参考「${selection.reference.material.title}」，相关性${selection.reference.value}分${selection.reference.material.type==='work'?'、历史表现'+B.gradePerformance(selection.reference.material).grade:''}；只借用结构线索。`:'没有命中可用于此结构的强相关S/A历史作品，结构由新闻关键词与默认口语规则选择。',used.some(m=>m.type==='opinion')?'历史观点单独归类，用于提问和判断，不为新闻事实背书。':'没有安全且简短的相关观点时，使用明确标为判断的通用表达。',c.risk.count?'相关风险记录已继承；风险作品的原稿不用于模仿，未经证实的指控默认避开。':'依据已保存的新闻标题与RSS摘要写初稿，不宣称已核对新闻原文。'+(c.focus?.points?'命中已设置的长期关注；同等可用结构下参考关注领域。':'')]};
  result.checks=check(result.main,result);result.timing=timing(result.main,duration);return result;
 }
 function timing(text,target){const count=words(text);return {characters:count,from:Math.round(count/4.5),to:Math.round(count/3.5),target,note:'按每秒3.5–4.5字粗估（含英文字符）；实际以朗读为准，目标时长不是保证。'};}
 function check(text,g){
  const known=g.segments.flatMap(s=>sentences(s.text).map(t=>({...s,sentence:t})));
  return sentences(text).map((sentence,index)=>{
   const match=known.find(s=>normalize(s.sentence)===normalize(sentence)),flags=hazards(sentence);let kind=match?.kind||'review',reason=match?'按生成时的来源记录归类。':'句子经过手动修改或没有来源记录，需要人工核实。';
   if(flags.length){kind='review';reason='规则命中：'+flags.join('、')+'；不代表已证明违规或虚假。';}
   if(match?.kind==='news'){
    const quote=match.evidence?.quote,field=match.evidence?.field;
    if(!quote||!['title','summary'].includes(field)||!g.news[field]?.includes(quote)||!['据'+g.news.source+'，报道里提到：“'+quote+'”','来源摘要还写到：“'+quote+'”'].some(t=>normalize(t)===normalize(match.text))){kind='review';reason='引用与保存的来源文字不一致。';}
    else if(g.news.kind==='manual'||g.news.report_type==='unconfirmed'){kind='review';reason=g.news.kind==='manual'?'用户提供内容未独立核验。':'原新闻含传闻 / 可能性表述，不能当成确认。';}
    else if(!flags.length)reason='保存的原标题 / RSS摘要中有逐字引用；未独立核对原文，仍需确认语境。';
   }
   return {index,sentence,kind,label:labels[kind],reason,evidence:match?.evidence||null,flags};
  });
 }
 function revise(g,action,brain){
  if(action==='opening'){const next={...g,hookVersion:g.hookVersion+1,openings:openings(g.news,g.structure,g.hookVersion+1)};return {...next,checks:check(next.main,next)};}
  if(action==='angle')return generateRules({news:g.news,brain,duration:g.duration,angleIndex:g.angleIndex+1,hookVersion:g.hookVersion,conflict:g.conflict,lowRisk:g.lowRisk});
  if(action==='conflict'){const alternatives=['真正值得争的，是判断标准：你在看品牌的声量，还是自己的成本和条件？先把证据摆出来，再谈输赢。','我更想把冲突讲清楚：公司的业务账，和普通人的生活账，可能不是同一个问题。哪一条有证据，就谈哪一条。'];const level=(g.conflictLevel||0)+1,text=alternatives[(level-1)%alternatives.length],parts=g.main.split(/\n\s*\n/);if(g.conflictText){const at=parts.indexOf(g.conflictText);if(at>=0)parts.splice(at,1);}parts.splice(Math.max(1,parts.length-1),0,text);const segments=[...g.segments,{text,kind:'judgment',evidence:null,role:'conflict'}],main=parts.join('\n\n');return {...g,segments,main,conflict:true,conflictText:text,conflictLevel:level,checks:check(main,{...g,segments}),timing:timing(main,g.duration)};}
  if(action==='human'){
   const soften=t=>t.replace(/首先[，、：]?|其次[，、：]?|最后[，、：]?/g,'').replace(/因此/g,'所以').replace(/然而/g,'但').replace(/此外/g,'还有').replace(/与此同时/g,'还有个事').replace(/对于/g,'说到').replace(/，/g,'，\n');
   const segs=g.segments.map(s=>s.kind==='judgment'?{...s,text:soften(s.text)}:s),known=new Map(g.segments.map((s,i)=>[s.text,segs[i].text]));
   const main=g.main.split(/\n\s*\n/).map(t=>known.has(t)?known.get(t):soften(t)).join('\n\n');
   return {...g,segments:segs,main,conversational:true,checks:check(main,{...g,segments:segs}),timing:timing(main,g.duration)};
  }
  if(action==='risk'){
   const safe=g.main.split(/\n\s*\n/).map(text=>{if(hazards(text).length)return {text:'这句话涉及未经充分核实的原因、责任或承诺。我先保留问题，不把它讲成结论。',kind:'judgment',evidence:null,role:'risk-edit'};const match=g.segments.find(s=>normalize(s.text)===normalize(text));return match?{...match,text}:{text,kind:'review',evidence:null,role:'body'};});
   const main=safe.map(s=>s.text).join('\n\n');return {...g,segments:safe,main,lowRisk:true,checks:check(main,{...g,segments:safe}),timing:timing(main,g.duration)};
  }
  throw new Error('未知编辑操作');
 }
 function applyOpening(g,index){const hook=g.openings[index];if(!hook)throw new Error('开头不存在');const at=g.main.indexOf('\n\n'),body=at>=0?g.main.slice(at):'';const segments=[{text:hook.text,kind:'judgment',evidence:null,role:'hook'},...g.segments.filter(s=>s.role!=='hook')],main=hook.text+body;return {...g,main,segments,checks:check(main,{...g,segments}),timing:timing(main,g.duration)};}
 function validateResult(g){
  if(!g||g.version!==version||g.provider!=='rules'||![60,90].includes(g.duration)||!Object.hasOwn(structures,g.structure)||typeof g.main!=='string'||g.main.length>50000||!Number.isFinite(Date.parse(g.generated_at)))throw new Error('口播草稿格式无效');
  validateNews(g.news);
  if(!Array.isArray(g.segments)||g.segments.length>500||g.segments.some(s=>!s||typeof s.text!=='string'||s.text.length>50000||!Object.hasOwn(labels,s.kind)))throw new Error('口播来源记录无效');
  if(!Array.isArray(g.used_materials)||g.used_materials.length>5||g.used_materials.some(m=>!m||typeof m.id!=='string'||!Object.hasOwn(B.types,m.type)||typeof m.title!=='string'||m.title.length>300||!Number.isFinite(m.relevance)||m.relevance<60||m.relevance>100||!(m.performance===null||['S','A','B','C','D'].includes(m.performance))||typeof m.role!=='string'))throw new Error('调用素材记录无效');
  if(!Array.isArray(g.openings)||g.openings.length!==3||g.openings.some(x=>!x||typeof x.text!=='string'||x.text.length>300||typeof x.kind!=='string')||!Array.isArray(g.titles)||g.titles.length!==3||g.titles.some(t=>typeof t!=='string'||t.length>800)||!Array.isArray(g.why)||g.why.length>5||g.why.some(t=>typeof t!=='string'||t.length>2000)||typeof g.contextNote!=='string'||g.contextNote.length>2000||!Number.isInteger(g.angleIndex)||g.angleIndex<0||!Number.isInteger(g.hookVersion)||g.hookVersion<0)throw new Error('口播输出字段无效');
  if(!g.risk||!['低','中','高'].includes(g.risk.level)||!Array.isArray(g.risk.items)||g.risk.items.length>3||g.risk.items.some(x=>!x||typeof x.title!=='string'||typeof x.id!=='string'))throw new Error('风险记录无效');
  return g;
 }
 function validateDraftState(s){
  if(!s||s.schema_version!==1||!Array.isArray(s.drafts)||s.drafts.length>500)throw new Error('草稿备份格式无效（最多500条）');
  const ids=new Set();for(const d of s.drafts){if(!d||typeof d.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(d.id)||ids.has(d.id)||!Number.isFinite(Date.parse(d.created_at))||!Number.isFinite(Date.parse(d.updated_at)))throw new Error('草稿编号或保存时间无效');validateResult(d.result);ids.add(d.id);}return s;
 }
 function workGeneration(g){return {version,provider:'rules',generated_at:g.generated_at,news_id:g.news.id,duration:g.duration,structure:g.structure,used_materials:g.used_materials.map(m=>({...m})),checks:check(g.main,g).map(({sentence,kind})=>({sentence,kind}))};}
 // Provider interface deliberately has no API key field or external fetch. Add opt-in providers later.
 const providers={rules:generateRules};
 function generate(request){const provider=request.provider||'rules';if(!Object.hasOwn(providers,provider))throw new Error('当前只启用免费规则生成器');return providers[provider](request);}
 return {version,structures,labels,providers,generate,revise,applyOpening,context,chooseStructures,check,hazards,words,timing,snapshot,validateResult,validateDraftState,workGeneration,sentences};
});
