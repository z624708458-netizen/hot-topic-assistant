'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),S=require('../assets/speech-rules.js'),B=require('../assets/brain-rules.js'),R=require('../assets/rules.js');
const news=(o={})=>({id:'test-v5',title:'仅测试：苹果 Vision Pro 团队裁员',summary:'仅测试消息：团队岗位调整。仅为fixture，未声称真实新闻。',company:'苹果',companies:['苹果'],source:'仅测试来源',url:'https://example.com/n',published:'2026-10-10T00:00:00Z',kind:'rss',...o});
const material=(type='work',o={})=>({id:'kb-v5',type,title:'仅测试：苹果 Vision Pro 团队裁员',body:'仅测试苹果 Vision Pro 裁员与员工岗位变化。',tags:['苹果','Vision Pro'],fields:{},created_at:'2026-10-10T00:00:00Z',updated_at:'2026-10-10T00:00:00Z',...o});
const brain=materials=>({...B.defaultState(),materials});
const generate=(n=news(),materials=[],duration=60)=>S.generate({news:n,brain:brain(materials),duration,generated_at:'2026-10-10T01:00:00Z'});
test('free provider generates complete editable drafts, 3 distinct openings/titles and 3–5 explanation sentences',()=>{
 const g=generate();assert.equal(g.provider,'rules');assert.equal(g.version,'5.0.0');assert.equal(g.openings.length,3);assert.equal(new Set(g.openings.map(o=>o.text)).size,3);assert.equal(new Set(g.titles).size,3);assert.ok(g.why.length>=3&&g.why.length<=5);assert.ok(!g.main.includes('[谁'));assert.equal(S.validateResult(g),g);assert.match(g.contextNote,/主要基于当前新闻/);assert.ok(g.main.includes(news().title));
 assert.throws(()=>S.generate({news:news(),brain:brain([]),provider:'ai'}));
});
test('60/90 seconds have different lengths; display estimate never promises exact duration',()=>{
 const short=generate(),long=generate(news(),[],90);assert.equal(short.duration,60);assert.equal(long.duration,90);assert.ok(long.timing.characters>short.timing.characters);assert.match(long.timing.note,/实际以朗读/);assert.throws(()=>generate(news(),[],75));assert.ok(short.timing.to>=60);assert.ok(long.timing.to>=90);
});
test('>=60 threshold excludes company-only matches, and input news/brain/V3 scores are unchanged',()=>{
 const n=news(),ms=[material('work',{title:'苹果智能家居',body:'',tags:['苹果'],fields:{views:5806000}})],state=brain(ms),before=JSON.stringify(state),score=JSON.stringify(R.score(n));const g=S.generate({news:n,brain:state});assert.equal(g.used_materials.length,0);assert.equal(JSON.stringify(state),before);assert.equal(JSON.stringify(R.score(n)),score);
});
test('strong S/A work priority, strongest usable material per type, no historical numbers in current facts',()=>{
 const ms=[material('work',{id:'kb-old',fields:{views:5806000,copy:'讲真，旧作品记录：2023年999亿元，只是测试。昔日高光，今天的反差。'}}),material('work',{id:'kb-normal',fields:{views:12000,copy:'仅测试普通稿'}}),material('opinion',{id:'kb-point',fields:{point:'品牌光环不能替普通人作选择。'}})];
 const c=S.context(news(),brain(ms));assert.equal(c.selected[0].material.id,'kb-old');const g=generate(news(),ms);assert.ok(g.used_materials.some(m=>m.id==='kb-old'&&m.performance==='S'));assert.ok(!g.used_materials.some(m=>m.id==='kb-normal'));assert.ok(!g.main.includes('999亿元'));assert.ok(g.checks.some(c=>c.kind==='history'));
});
test('only explicitly recorded compatible successful structure guides writing; grade without copy has no style evidence',()=>{
 const m=material('work',{fields:{views:5806000,copy:'仅测试：大厂文化、职场、跳槽，最后回到岗位条件。'}}),g=generate(news(),[m]);assert.equal(g.structure,'D');assert.ok(g.why.some(s=>s.includes('历史表现S')));
 const incompatible=material('work',{fields:{views:5806000,copy:'仅测试昔日高光、巨大反差'}}),n=news({title:'苹果 iPhone 手机涨价',summary:'价格调整仅测试'});const c=S.context(n,brain([incompatible]));assert.ok(!S.chooseStructures(n,c).reference);
 const noCopy=material('work',{body:'',fields:{views:5806000}});assert.equal(generate(news(),[noCopy]).used_materials.length,0);
});
test('B/C/D alternatives reflect actual event keywords; structure fallback does not invent a past peak',()=>{
 const c=generate(news({title:'苹果 iPhone 手机涨价',summary:'仅测试价格'}));assert.ok(c.availableStructures.includes('B'));assert.ok(c.availableStructures.includes('C'));
 const d=generate(news({title:'苹果管理层与岗位调整',summary:'仅测试职场'}));assert.ok(d.availableStructures.includes('D'));
 const generic=generate(news({title:'苹果公告',summary:''}));assert.ok(!generic.main.includes('曾经爆火'));assert.ok(!generic.main.includes('销量暴跌'));
});
test('viral structure reference borrows pattern, not original copy',()=>{
 const m=material('viral',{fields:{structure:'仅测试昔日高光 → 巨大反差',copy:'禁止照搬的原文：8888亿元'}}),g=generate(news(),[m]);assert.ok(g.used_materials.some(x=>x.type==='viral'));assert.ok(!g.main.includes('8888'));
});
test('90s uses recorded user question or case where it fits; omissions are not falsely listed as used',()=>{
 const q=material('comment',{id:'kb-q',fields:{question:'为什么要看员工的岗位条件？'}}),c=material('case',{id:'kb-case',fields:{event:'我过去在岗位变化时先检查自己的生活预算。'}});
 const g=generate(news(),[q,c],90);assert.ok(g.used_materials.some(m=>m.id==='kb-q'));assert.ok(!g.used_materials.some(m=>m.id==='kb-case'));assert.ok(g.checks.some(x=>x.kind==='history'));
 const caseOnly=generate(news(),[c],90);assert.ok(caseOnly.used_materials.some(m=>m.id==='kb-case'));
});
test('old opinions marked history, news exact quotes marked source support with URL/time and explicit unverified context',()=>{
 const g=generate(news(),[material('opinion',{fields:{point:'我过去认为，消费选择要看自己的预算。'}})]);const history=g.checks.find(c=>c.kind==='history'),fact=g.checks.find(c=>c.kind==='news');assert.ok(history);assert.ok(fact);assert.equal(fact.evidence.url,news().url);assert.equal(fact.evidence.published,news().published);assert.match(fact.reason,/未独立核对原文/);assert.ok(history.sentence.includes('我以前'));
});
test('manual/unconfirmed source stays needs-review, absent summary never fabricated',()=>{
 for(const override of [{kind:'manual'},{report_type:'unconfirmed'}]){const g=generate(news(override));assert.ok(g.checks.some(x=>x.kind==='review'));assert.ok(!g.checks.some(x=>x.kind==='news'));}
 const g=generate(news({summary:''}),[],90);assert.ok(g.segments.filter(x=>x.kind==='news').every(x=>x.evidence.field==='title'));
});
test('manual edited unsupported sentence including Tesla full liability is flagged, not adopted as a fact',()=>{
 const g=generate(),text=g.main+'\n\n特斯拉出事将负全责。\n\n这次新闻已经证明利润翻了999倍。';const checks=S.check(text,g);assert.equal(checks.at(-1).kind,'review');assert.equal(checks.at(-2).kind,'review');assert.ok(checks.at(-2).flags.includes('法律责任或法规解释'));
});
test('tampered source quote or forged fact sentence cannot claim source support',()=>{
 const g=generate(),fact=g.segments.find(s=>s.kind==='news');const forged={...g,segments:[{...fact,text:'该公司利润增加了1234亿元。'}],main:'该公司利润增加了1234亿元。'};assert.equal(S.check(forged.main,forged)[0].kind,'review');
 const altered={...g,news:{...g.news,title:'另一条新闻'}};assert.ok(S.check(g.main,altered).some(x=>x.reason.includes('引用与保存')));
});
test('risk history inherited before generation, removed/limited texts not mimicked; unsafe opinions omitted',()=>{
 const risky=material('work',{fields:{views:5806000,status:'removed',copy:'幕后大佬操控，资本早就安排好了。'}}),point=material('opinion',{id:'kb-risk-point',fields:{point:'这是利益输送。'}}),g=generate(news(),[risky,point]);assert.equal(g.risk.level,'高');assert.ok(!g.used_materials.some(x=>x.id===risky.id));assert.ok(!g.main.includes('幕后'));assert.ok(!g.main.includes('利益输送'));
});
test('default risky headline not repeated; a safe short source excerpt can be used, unsafe source needs review',()=>{
 const g=generate(news({title:'仅测试：苹果资本早就安排好了，幕后大佬操控',summary:''}));assert.ok(!g.main.includes('幕后大佬'));assert.ok(g.checks.some(x=>x.kind==='review'));
});
test('only opening revision generates 3 new choices while preserving editable main exactly',()=>{
 const g=generate();g.main+='\n\n仅测试手动补充。';const next=S.revise(g,'opening',brain([]));assert.equal(next.main,g.main);assert.notDeepEqual(next.openings,g.openings);assert.deepEqual(next.segments,g.segments);
});
test('angle changes core perspective and structure, not just adjectives, and preserves actual source title',()=>{
 const g=generate(),next=S.revise(g,'angle',brain([]));assert.notEqual(next.angle,g.angle);assert.notEqual(next.structure,g.structure);assert.notEqual(next.main,g.main);assert.ok(next.main.includes(news().title));
});
test('strengthen conflict keeps manual edits and source facts, introduces no unsupported outcome',()=>{
 const g=generate();g.main+='\n\n保留我的手动修改。';const next=S.revise(g,'conflict',brain([]));assert.ok(next.main.includes('保留我的手动修改'));assert.ok(next.main.includes(news().title));assert.ok(next.main.includes('判断标准'));assert.ok(!next.main.includes('内幕'));
});
test('more human adds short pauses only, source quote unchanged and supported; manual text still reviewed',()=>{
 const g=generate();g.main+='\n\n首先，然而，对于这条消息，这是我的手动文字。';const next=S.revise(g,'human',brain([]));assert.ok(!next.main.includes('首先'));assert.ok(next.main.includes('\n'));assert.ok(next.main.includes(news().title));assert.ok(next.checks.some(x=>x.kind==='news'));assert.ok(next.checks.some(x=>x.kind==='review'));
});
test('lower risk removes unverified accusation, motivation, legal error and absolute claims, preserving source support',()=>{
 const g=generate();g.main+='\n\n幕后大佬操控，资本早就安排好了。\n\n故意收割。\n\n法律规定必须赔，全责。\n\n所有人一定会成功。';const next=S.revise(g,'risk',brain([]));assert.deepEqual(S.hazards(next.main),[]);assert.ok(next.checks.some(x=>x.kind==='news'));assert.ok(!next.main.includes('全责'));assert.ok(next.lowRisk);
});
test('apply alternative opener changes only the first paragraph, including manually edited body',()=>{
 const g=generate();g.main+='\n\n测试手动正文。';const next=S.applyOpening(g,1);assert.equal(next.main.slice(next.main.indexOf('\n\n')),g.main.slice(g.main.indexOf('\n\n')));assert.ok(next.main.startsWith(g.openings[1].text));
});
test('draft schema roundtrip preserves complete provenance; rejects malformed/duplicate/unsafe data',()=>{
 const g=generate(),d={id:'speech-test',created_at:g.generated_at,updated_at:g.generated_at,result:g},s={schema_version:1,drafts:[d]},raw=JSON.stringify(s);assert.equal(JSON.stringify(S.validateDraftState(JSON.parse(raw))),raw);
 for(const state of [{schema_version:99,drafts:[]},{...s,drafts:[d,d]},{...s,drafts:[{...d,result:{...g,news:{...g.news,url:'javascript:alert(1)'}}}]},{...s,drafts:[{...d,result:{...g,main:'x'.repeat(50001)}}]}])assert.throws(()=>S.validateDraftState(state));
});
test('work backflow metadata saves time/references/checks without fake performance or publication and survives V4 validation',()=>{
 const g=generate(news(),[material('opinion',{fields:{point:'购买选择要看自己的条件。'}})]),generation=S.workGeneration(g),m=material('work',{fields:{copy:g.main,views:null,published:''},body:g.main,generation});B.validate(m);assert.equal(m.fields.views,null);assert.equal(m.fields.published,'');assert.equal(generation.news_id,news().id);assert.equal(generation.generated_at,g.generated_at);assert.deepEqual(generation.used_materials,g.used_materials);const state=brain([m]),raw=JSON.stringify(state);B.analyse(news(),state);assert.equal(JSON.stringify(state),raw);
});

test('configured long-term interest is a lower-priority tie-breaker, never overrides compatible S/A structure evidence',()=>{
 const state={...brain([]),profile:{companies:['苹果'],domains:['职场']}},g=S.generate({news:news(),brain:state});assert.equal(g.structure,'D');assert.ok(g.why.some(t=>t.includes('长期关注')));
 const m=material('work',{fields:{views:5806000,copy:'昔日高光 → 巨大反差'}}),withSuccess=S.generate({news:news(),brain:{...state,materials:[m]}});assert.equal(withSuccess.structure,'A');
});
