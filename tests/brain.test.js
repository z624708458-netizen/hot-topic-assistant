'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),B=require('../assets/brain-rules.js');
const material=(type='case',o={})=>({id:'kb-test',type,title:'小米手机消费测试素材',body:'仅测试，真实个人知识库不包含示例数据。',fields:{},tags:['小米'],created_at:'2026-10-10T01:00:00Z',updated_at:'2026-10-10T01:00:00Z',...o});
const news={title:'小米手机降价，雷军回应用户争议',company:'小米',companies:['小米'],people:['雷军'],summary:'售价和消费者权益情况以原文为准。'};
test('all five material schemas and optional fields; zero metrics retained',()=>{
 assert.equal(Object.keys(B.types).length,5);
 for(const type of Object.keys(B.types))assert.equal(B.validate(material(type)).type,type);
 assert.equal(B.validate(material('work',{fields:{views:0,likes:null}})).fields.views,0);
 assert.equal(B.types.work.fields.find(f=>f[0]==='published')[2],'datetime-local');
});
test('reject unknown type, oversized/malformed fields, unsafe links and invalid metrics',()=>{
 for(const override of [{type:'unknown'},{body:'x'.repeat(50001)},{tags:['x'.repeat(101)]},{fields:{unknown:'x'}},{type:'viral',fields:{url:'javascript:alert(1)'}},{type:'work',fields:{views:-1}},{type:'work',fields:{views:1.5}},{created_at:'bad'}])assert.throws(()=>B.validate(material('case',override)));
 assert.throws(()=>B.validateState({...B.defaultState(),materials:[material(),material()]}));
});
test('company aliases and people use the exact V3 public tables',()=>{
 const config=require('../config/sources.json');assert.deepEqual(B.companyAliases,config.company_aliases);assert.deepEqual(B.people,config.public_people);
 assert.ok(B.related({...news,title:'Redmi 新手机',companies:['小米']},material()).reasons.some(t=>t.includes('小米')));
 const p=B.related({...news,title:'雷军测试表态'},material('case',{title:'雷军让我想到的经历',tags:[],body:''}));assert.ok(p.reasons.some(t=>t.includes('人物名称')));
});
test('tag, direct company/person and configured topic are explicit; unrelated stays absent',()=>{
 const m=material('opinion',{title:'房地产中的职场观察',tags:['房地产'],body:''});
 assert.equal(B.related({title:'苹果手机系统更新',companies:['苹果'],summary:''},m).value,0);
 assert.ok(B.related({title:'房地产公司裁员',company:'其他',summary:''},m).reasons.some(t=>t.includes('标签')));
 assert.equal(B.related(news,material('work',{title:'旅行记录',tags:[],body:'',fields:{views:100000}})).value,0,'large view count cannot create relevance');
 assert.equal(B.contains,undefined,'helper remains internal');
});
test('English boundaries prevent AI inside unrelated English words',()=>{
 const m=material('case',{title:'painting seaside',body:'',tags:[]});assert.equal(B.related({title:'OpenAI模型',companies:['OpenAI']},m).value,0);
});
test('personal points across all five categories, once per type, maximum100',()=>{
 const ms=Object.keys(B.types).map((type,i)=>material(type,{id:'kb-'+i}));const state={...B.defaultState(),materials:ms};
 assert.equal(B.analyse(news,state).personal.total,100);
 const repeated={...state,materials:[...ms,...ms.map(m=>({...m,id:m.id+'x'}))]};assert.equal(B.analyse(news,repeated).personal.total,100);assert.equal(B.analyse(news,repeated).matches.length,5);
 assert.equal(B.analyse(news,{...state,materials:[],profile:{companies:[],domains:[]}}).personal.total,0);
 assert.equal(B.analyse(news,B.defaultState()).personal.total,10);
});
test('best five matches are deterministic, categories outside top5 still explain their points',()=>{
 const materials=Array.from({length:7},(_,i)=>material(i<6?'case':'work',{id:'kb-'+i}));const a=B.analyse(news,{...B.defaultState(),materials});
 assert.equal(a.matches.length,5);assert.equal(a.matchedCount,7);assert.equal(a.personal.total,50);assert.ok(a.personal.reasons.find(r=>r.type==='work').material_id);
 assert.deepEqual(a.matches.map(x=>x.material.id),B.analyse(news,{...B.defaultState(),materials:materials.slice().reverse()}).matches.map(x=>x.material.id));
});
test('max3 angles cite only stored material IDs and use entered structure',()=>{
 const materials=Object.keys(B.types).map((type,i)=>material(type,{id:'kb-'+i,...(type==='viral'?{fields:{borrow:'测试结构：疑问→证据→边界'}}:{})}));const a=B.analyse(news,{...B.defaultState(),materials});
 assert.equal(a.angles.length,3);assert.equal(a.angles[2].structure,'测试结构：疑问→证据→边界');
 for(const angle of a.angles){assert.ok(angle.line);assert.ok(angle.why);assert.ok(angle.structure);assert.ok(angle.materials.every(m=>materials.some(x=>x.id===m.id)));}
 assert.equal(B.analyse(news,B.defaultState()).angles.length,0);
});
test('fulltext, tags, types and source date ordering independent of update date',()=>{
 const a=material('case',{id:'kb-a',title:'楼市案例',body:'房地产工作',tags:['职场'],fields:{date:'2020-01-01'}}),b=material('work',{id:'kb-b',title:'别的作品',body:'AI',fields:{review:'小米复盘',published:'2026-10-09T00:00:00Z'}});
 assert.equal(B.filter([a,b],{query:'小米'})[0].id,'kb-b');assert.equal(B.filter([a,b],{query:'房地产'})[0].id,'kb-a');
 assert.deepEqual(B.filter([a,b],{sort:'newest'}).map(m=>m.id),['kb-b','kb-a']);assert.deepEqual(B.filter([a,b],{sort:'oldest'}).map(m=>m.id),['kb-a','kb-b']);
 assert.equal(B.filter([a,b],{type:'case',tag:'职场'}).length,1);
});
test('unknown work data is not treated as zero; performance uses known values only',()=>{
 const unknown=material('work',{id:'kb-unknown',fields:{views:null}}),zero=material('work',{id:'kb-zero',fields:{views:0}}),high=material('work',{id:'kb-high',fields:{views:100}});
 assert.deepEqual(B.performance([unknown,zero,high]).map(m=>m.id),['kb-high','kb-zero']);
});
test('profile validation and tags are bounded and reusable',()=>{
 assert.deepEqual(B.tags('AI，小米,AI\n房地产'),['AI','小米','房地产']);assert.throws(()=>B.profile({companies:['未知公司'],domains:[]}));assert.throws(()=>B.profile({companies:[],domains:['x'.repeat(101)]}));
 const s=B.defaultState();s.materials=[material()];assert.equal(B.validateState(s),s);
});
