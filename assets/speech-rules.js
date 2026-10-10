/* Legacy draft compatibility and provenance only. Rule writing has been removed. */
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
 function snapshot(n){const result={};for(const k of ['id','title','published','company','source','url','summary','kind','report_type','summary_status'])if(n[k]!==undefined)result[k]=n[k];result.companies=(n.companies||[n.company]).slice();for(const k of ['body','content','fulltext_origin'])if(typeof n[k]==='string')result[k]=n[k];return result;}
 function validateNews(n){
  if(!n||['id','title','published','company','source','url'].some(k=>typeof n[k]!=='string'||!n[k])||n.title.length>600||typeof n.summary!=='string'||n.summary.length>1600||!B.validURL(n.url)||!Number.isFinite(Date.parse(n.published)))throw new Error('新闻来源或字段不完整，不能生成');
  if(['body','content'].some(k=>n[k]!==undefined&&(typeof n[k]!=='string'||n[k].length>50000)))throw new Error('新闻全文字段无效');
  return n;
 }
 function materialValue(x){return x.value*(x.material.type==='work'?B.gradePerformance(x.material).factor:1);}
 function context(n,state){
  const all=B.matches(n,state.materials),eligible=all.filter(x=>x.value>=60),safe=eligible.filter(x=>x.material.type!=='work'||['normal','deleted'].includes(B.contentStatus(x.material)));
  const priority=x=>x.material.type==='work'&&x.value>=80&&['S','A'].includes(B.gradePerformance(x.material).grade)?0:x.value>=80?({opinion:1,comment:2,case:3,viral:4,work:5}[x.material.type]):({work:6,opinion:7,comment:8,case:9,viral:10}[x.material.type]);
  safe.sort((a,b)=>priority(a)-priority(b)||materialValue(b)-materialValue(a)||a.material.id.localeCompare(b.material.id));
  const selected=[];for(const x of safe)if(!selected.some(y=>y.material.type===x.material.type))selected.push(x);
  return {eligible,selected,risk:B.analyse(n,state).risk,focus:B.personal(n,all,state.profile).reasons.find(x=>x.type==='focus'),focusDomains:state.profile.domains.slice()};
 }
 function timing(text,target){const count=words(text);return {characters:count,from:Math.round(count/4.5),to:Math.round(count/3.5),target,note:'按每秒3.5–4.5字粗估（含英文字符）；实际以朗读为准，目标时长不是保证。'};}
 function check(text,g){
  if(g.provider==='openai'){const C=typeof module==='object'&&module.exports?require('./speech-contract.js'):globalThis.RadarSpeechContract;return C.check(text,g,hazards);}
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
 function revise(){throw new Error('当前未连接大模型，无法生成高质量口播');}
 function applyOpening(g,index){const hook=g.openings[index];if(!hook)throw new Error('开头不存在');const at=g.main.indexOf('\n\n'),body=at>=0?g.main.slice(at):'';const segments=[{text:hook.text,kind:'judgment',evidence:null,role:'hook'},...g.segments.filter(s=>s.role!=='hook')],main=hook.text+body;return {...g,main,segments,checks:check(main,{...g,segments}),timing:timing(main,g.duration)};}
 function validateResult(g){
  if(!g||!((g.version===version&&g.provider==='rules')||(g.version==='5.1.0'&&g.provider==='openai'))||![60,90].includes(g.duration)||!Object.hasOwn(structures,g.structure)||typeof g.main!=='string'||g.main.length>50000||!Number.isFinite(Date.parse(g.generated_at)))throw new Error('口播草稿格式无效');
  validateNews(g.news);
  if(!Array.isArray(g.segments)||g.segments.length>500||g.segments.some(s=>!s||typeof s.text!=='string'||s.text.length>50000||!Object.hasOwn(labels,s.kind)))throw new Error('口播来源记录无效');
  if(g.provider==='openai'&&g.segments.some(s=>s.evidence?.references!==undefined&&(!Array.isArray(s.evidence.references)||s.evidence.references.length>8||s.evidence.references.some(r=>!r||!['news','material'].includes(r.source)||typeof r.id!=='string'||!['title','summary','body','content','copy','point'].includes(r.field)||typeof r.quote!=='string'||r.quote.length>3000))))throw new Error('模型证据记录无效');
  if(!Array.isArray(g.used_materials)||g.used_materials.length>(g.provider==='openai'?7:5)||g.used_materials.some(m=>!m||typeof m.id!=='string'||!Object.hasOwn(B.types,m.type)||typeof m.title!=='string'||m.title.length>300||!Number.isFinite(m.relevance)||m.relevance<60||m.relevance>100||!(m.performance===null||['S','A','B','C','D'].includes(m.performance))||typeof m.role!=='string'))throw new Error('调用素材记录无效');
  if(!Array.isArray(g.openings)||g.openings.length!==3||g.openings.some(x=>!x||typeof x.text!=='string'||x.text.length>300||typeof x.kind!=='string')||!Array.isArray(g.titles)||g.titles.length!==3||g.titles.some(t=>typeof t!=='string'||t.length>800)||!Array.isArray(g.why)||g.why.length>5||g.why.some(t=>typeof t!=='string'||t.length>2000)||typeof g.contextNote!=='string'||g.contextNote.length>2000||!Number.isInteger(g.angleIndex)||g.angleIndex<0||!Number.isInteger(g.hookVersion)||g.hookVersion<0)throw new Error('口播输出字段无效');
  if(!g.risk||!['低','中','高'].includes(g.risk.level)||!Array.isArray(g.risk.items)||g.risk.items.length>3||g.risk.items.some(x=>!x||typeof x.title!=='string'||typeof x.id!=='string'))throw new Error('风险记录无效');
  return g;
 }
 function validateDraftState(s){
  if(!s||s.schema_version!==1||!Array.isArray(s.drafts)||s.drafts.length>500)throw new Error('草稿备份格式无效（最多500条）');
  const ids=new Set();for(const d of s.drafts){if(!d||typeof d.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(d.id)||ids.has(d.id)||!Number.isFinite(Date.parse(d.created_at))||!Number.isFinite(Date.parse(d.updated_at)))throw new Error('草稿编号或保存时间无效');validateResult(d.result);ids.add(d.id);}return s;
 }
 function workGeneration(g){return {version:g.version,provider:g.provider,generated_at:g.generated_at,news_id:g.news.id,duration:g.duration,structure:g.structure,used_materials:g.used_materials.map(m=>({...m})),checks:check(g.main,g).map(({sentence,kind})=>({sentence,kind}))};}
 function generate(){throw new Error('当前未连接大模型，无法生成高质量口播');}
 return {version,structures,labels,generate,revise,applyOpening,context,check,hazards,words,timing,snapshot,validateResult,validateDraftState,workGeneration,sentences};
});
