'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),B=require('../assets/brain-rules.js');
// Fixtures are test-only, never inserted into private storage or production RSS.
const n={title:'仅测试：苹果 Vision Pro 团队裁员',companies:['苹果'],summary:'仅测试，未声称真实发生。'};
const m=(o={})=>({id:'kb-41',type:'work',title:'仅测试：Vision Pro 团队即将裁员',body:'仅测试苹果 Vision Pro 业务调整，员工岗位变化。',fields:{},tags:['苹果','Vision Pro'],created_at:'2026-10-10T00:00:00Z',updated_at:'2026-10-10T00:00:00Z',...o});
const state=materials=>({...B.defaultState(),materials,profile:{companies:[],domains:[]}});
const grade=fields=>B.gradePerformance(m({fields}));
test('Vision Pro layoffs strong; Apple Home/iPhone sales and Apple-only tags stay below threshold',()=>{
 const exact=B.related(n,m());assert.equal(exact.value,100);assert.equal(exact.band,'强相关');assert.ok(exact.eligible);
 for(const title of ['苹果智能家居','苹果 iPhone 销量','国产手机首销下滑']){
  const x=B.related(n,m({title,body:'',tags:['苹果']}));assert.ok(x.value<40,title+' must stay extension-only');assert.ok(!x.eligible);
 }
 const hardware=B.related(n,m({title:'苹果硬件业务调整',body:'',tags:[]}));assert.equal(hardware.value,70);assert.ok(hardware.eligible);
});
test('all six dimensions capped once even when several companies and tags overlap',()=>{
 const x=B.related({...n,title:n.title+' 小米 雷军'},m({title:'苹果 Vision Pro 裁员与小米雷军调整',tags:['苹果','Vision Pro','小米','裁员']}));
 assert.equal(x.value,100);assert.deepEqual(x.breakdown.map(b=>b.points),[25,25,20,15,10,5]);
});
test('company tags alone do not grant company points; numbers, URLs, platform and review do not create event context',()=>{
 const x=B.related(n,m({title:'国产手机首销下滑',body:'',tags:['苹果','Vision Pro'],fields:{platform:'苹果 Vision Pro 裁员',review:'苹果 Vision Pro 裁员',views:5806000}}));
 assert.equal(x.value,5);assert.equal(x.breakdown[0].points,0);assert.equal(B.analyse(n,state([x.material])).personal.total,0);
});
test('core title company and product outrank incidental names and products in the body',()=>{
 const x=B.related(n,m({title:'小米 SU7 首销',body:'顺带比较苹果 iPhone，但不是 Vision Pro 的事件',tags:[]}));assert.equal(x.breakdown.find(b=>b.key==='entity').points,0);assert.equal(x.breakdown.find(b=>b.key==='product').points,0);
 const news={title:'苹果 Vision Pro 裁员',summary:'对比 iPhone 的其他业务',companies:['苹果']};
 assert.equal(B.related(news,m({title:'苹果 iPhone 销量',body:'',tags:[]})).breakdown.find(b=>b.key==='product').points,0);
});
test('threshold and band boundaries have explicit meaning',()=>{
 assert.equal(B.threshold,60);
 const company=B.related(n,m({title:'苹果',body:'',tags:[]}));assert.equal(company.band,'扩展素材');
 const weak=B.related({title:'苹果裁员',companies:['苹果']},m({title:'苹果工资',body:'',tags:[]}));assert.equal(weak.value,40);assert.equal(weak.band,'弱相关');assert.ok(!weak.eligible);
 const medium=B.related(n,m({title:'苹果业务调整',body:'',tags:[]}));assert.equal(medium.band,'中高相关');
});
test('grade bands D C B A S use true view counts at defined boundaries',()=>{
 for(const [views,g] of [[0,'D'],[9999,'D'],[10000,'C'],[99999,'C'],[100000,'B'],[499999,'B'],[500000,'A'],[999999,'A'],[1000000,'S'],[5806000,'S']])assert.equal(grade({views}).grade,g);
});
test('interactions can promote one grade; complete near-zero interactions lower one; partial cannot lower',()=>{
 assert.equal(grade({views:12000,likes:600}).grade,'B');
 assert.equal(grade({views:1000,likes:500}).grade,'D','small sample cannot become a hit');
 assert.equal(grade({views:1000000,likes:0,comments:0,saves:0}).grade,'A');
 assert.equal(grade({views:1000000,likes:0}).grade,'S');
 assert.equal(grade({views:5806000,likes:13000,comments:686,saves:1177}).grade,'S');
});
test('missing metrics remain unknown; zero and inconsistent counts never produce false interaction boosts',()=>{
 assert.equal(grade({likes:10000}).grade,null);assert.equal(grade({}).views,null);assert.equal(grade({}).rate,null);
 assert.equal(grade({views:0,likes:5}).rate,null);assert.equal(grade({views:0,likes:5}).grade,'D');
 const x=grade({views:12000,likes:13000});assert.equal(x.grade,'C');assert.equal(x.rate,null);assert.match(x.explain,/不一致/);
 assert.equal(grade({views:12000,likes:0,comments:0,saves:0}).grade,'D');
});
test('same strong relevance: 5.806M S contributes20, 12K C10, unknown8, poor6',()=>{
 const score=fields=>B.analyse(n,state([m({fields})])).personal.total;
 assert.equal(score({views:5806000,likes:13000,comments:686,saves:1177}),20);
 assert.equal(score({views:12000}),10);assert.equal(score({}),8);assert.equal(score({views:0}),6);
});
test('irrelevant viral history cannot score; hundreds of company-only or weak records cannot stack',()=>{
 const weak=Array.from({length:100},(_,i)=>m({id:'kb-weak-'+i,title:'苹果工资',body:'',tags:[],fields:{views:5806000}}));
 assert.equal(B.analyse({title:'苹果裁员',companies:['苹果']},state(weak)).personal.total,0);
 assert.equal(B.analyse(n,state([m({title:'苹果智能家居',body:'',tags:[],fields:{views:5806000}})])).personal.total,0);
});
test('best contribution per type, not highest relevance; duplicate materials do not inflate score',()=>{
 const s=m({id:'kb-s',title:'苹果硬件业务调整',body:'',tags:[],fields:{views:5806000}}),d=m({id:'kb-d',fields:{views:0}});
 const a=B.analyse(n,state([s,d]));assert.equal(a.personal.total,14);assert.equal(a.personal.reasons[0].material_id,'kb-s');assert.equal(a.angles[0].materials[0].id,'kb-s','angle also uses the best quality reference');
 assert.equal(B.analyse(n,state([s,d,{...s,id:'kb-repeat'}])).personal.total,14);
 const selected=a.personal.reasons[0].selected;assert.equal(selected.value,70);assert.equal(selected.performance.grade,'S');assert.equal(selected.raw,14);
});
test('all fully relevant categories with S history and focus reach100; no class exceeds its cap',()=>{
 const ms=Object.keys(B.types).map((type,i)=>m({id:'kb-all-'+i,type,fields:type==='work'?{views:5806000}:{}}));
 const a=B.analyse(n,{...B.defaultState(),materials:ms});assert.equal(a.personal.total,100);
 for(const r of a.personal.reasons)assert.ok(r.points>=0&&r.points<=r.cap);
});
test('history reference at most3 by relevance; summary uses all qualified records and excludes irrelevant million-view clips',()=>{
 const ms=Array.from({length:4},(_,i)=>m({id:'kb-history-'+i,fields:{views:i<2?5806000:12000}}));
 ms.push(m({id:'kb-other',title:'苹果智能家居',body:'',tags:[],fields:{views:99999999}}));
 const h=B.analyse(n,state(ms)).history;assert.equal(h.items.length,3);assert.equal(h.count,4);assert.match(h.summary,/4 条相关性/);assert.match(h.summary,/2 条强相关作品播放达到50万/);
 assert.ok(h.items.every(x=>x.material.id!=='kb-other'));
});
test('history summaries distinguish unknown from normal/poor; unfamiliar content no evidence claim',()=>{
 assert.match(B.analyse(n,state([m()])).history.summary,/未填写/);
 assert.match(B.analyse(n,state([m({fields:{views:12000}})])).history.summary,/建议谨慎/);
 assert.match(B.analyse(n,state([])).history.summary,/暂无/);
});
test('old V4 raw state remains byte-for-byte unchanged; default normal and grade calculated from old numbers',()=>{
 const legacy=state([m({fields:{views:5806000,likes:13000,comments:686,saves:1177}})]),before=JSON.stringify(legacy);
 B.validateState(legacy);B.analyse(n,legacy);assert.equal(JSON.stringify(legacy),before);assert.equal(B.contentStatus(legacy.materials[0]),'normal');assert.equal(B.gradePerformance(legacy.materials[0]).grade,'S');
});
test('each optional content state accepted; unknown state rejected; empty old state defaults normal',()=>{
 for(const status of Object.keys(B.contentStatuses))assert.equal(B.validate(m({fields:{status}})).fields.status,status);
 assert.equal(B.contentStatus(m({fields:{status:''}})),'normal');assert.throws(()=>B.validate(m({fields:{status:'invented'}})));
});
test('removed similar event raises high independent risk; limited/complaint medium; own deletion and normal not platform risk',()=>{
 for(const [status,level] of [['removed','高'],['limited','中'],['complaint','中'],['deleted','低'],['normal','低']]){
  const a=B.analyse(n,state([m({fields:{status,views:5806000}})]));assert.equal(a.risk.level,level);assert.equal(a.personal.total,20,'risk is separate from degree and V3 value');
 }
});
test('same company only never triggers risk, including a removed unrelated viral work',()=>{
 const a=B.analyse(n,state([m({title:'苹果智能家居',body:'',tags:['苹果'],fields:{status:'removed',views:5806000}})]));assert.equal(a.risk.level,'低');assert.equal(a.risk.count,0);
});
test('capital-market blocked record triggers documented context; never invents the platform cause',()=>{
 const news={title:'苹果股价暴跌',companies:['苹果']},work=m({title:'苹果股价暴跌回顾',body:'',tags:[],fields:{status:'removed',risk_note:'仅测试：我记录了资本市场表达被屏蔽，原因未知。'}});
 const risk=B.analyse(news,state([work])).risk;assert.equal(risk.level,'高');assert.match(risk.note,/不能确定平台处理原因/);assert.deepEqual(risk.items[0].expressions,[]);assert.equal(risk.items[0].note,work.fields.risk_note);
});
test('same explicitly risky expression triggers independently; absence of expression does not fabricate it',()=>{
 const work=m({title:'旧作品',body:'仅测试文本：幕后操控',tags:[],fields:{status:'removed'}});
 const a=B.analyse({title:'仅测试文本：幕后操控',companies:[]},state([work]));assert.equal(a.matches.length,0);assert.equal(a.risk.level,'高');assert.deepEqual(a.risk.items[0].expressions,['未证实的幕后操控']);
 assert.equal(B.analyse({title:'普通公告',companies:[]},state([work])).risk.level,'低');
});
test('risk max3 deterministic; angles only cite threshold-qualified material; state and scores not mutated',()=>{
 const ms=Array.from({length:5},(_,i)=>m({id:'kb-risk-'+i,fields:{status:'removed',views:5806000}}));ms.push(m({id:'kb-weak-angle',type:'case',title:'苹果智能家居',body:'',tags:[]}));
 const s=state(ms),before=JSON.stringify(s),a=B.analyse(n,s);assert.equal(a.risk.items.length,3);assert.equal(a.risk.count,5);assert.ok(a.angles.every(x=>x.materials.every(y=>y.id!=='kb-weak-angle')));assert.equal(JSON.stringify(s),before);
});
