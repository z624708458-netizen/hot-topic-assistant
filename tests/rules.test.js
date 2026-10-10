'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const r=require('../assets/rules.js');
const now=Date.parse('2026-10-10T03:00:00Z');
const item=(id='test',age=1,overrides={})=>({id,title:'小米测试信息',published:new Date(now-age*3600000).toISOString(),company:'小米',companies:['小米'],source:'测试来源，不是真实新闻',summary:'',...overrides});
test('five dimensions are bounded at 20 and total is their sum',()=>{
 const s=r.score(item('strong',1,{title:'小米首次免费开源新纪录意外涨价，隐私监管裁员争议，手机用户工作'}),now);
 assert.deepEqual(s.values,[20,20,20,20,20]);assert.equal(s.total,100);
 assert.equal(r.score(item('other',1,{company:'其他',companies:['其他']}),now).values[0],8);
});
test('repeated keywords never inflate the same category',()=>{
 const once=r.score(item('a',1,{title:'小米价格隐私'}),now);
 const many=r.score(item('b',1,{title:'小米价格价格隐私隐私价格'}),now);
 assert.deepEqual(once.values,many.values);
});
test('all freshness boundaries, future, invalid date',()=>{
 [[0,20],[12,20],[12.01,18],[24,18],[24.01,14],[48,14],[48.01,6],[168,6],[168.01,0],[-1,0]].forEach(([age,s])=>assert.equal(r.freshness(item('n',age),now),s));
 assert.equal(r.freshness(item('invalid',0,{published:'invalid'}),now),0);
});
test('today means China day, not rolling 24 hours',()=>{
 const n=Date.parse('2026-10-10T00:30:00+08:00');
 assert.equal(r.inPeriod(item('yesterday',0,{published:'2026-10-09T23:30:00+08:00'}),'today',n),false);
 assert.equal(r.inPeriod(item('today',0,{published:'2026-10-10T00:01:00+08:00'}),'today',n),true);
});
test('48h and 7d windows exclude future; boundary is included',()=>{
 assert.equal(r.inPeriod(item('48',48),'48h',now),true);assert.equal(r.inPeriod(item('49',49),'48h',now),false);
 assert.equal(r.inPeriod(item('old',167),'7d',now),true);assert.equal(r.inPeriod(item('future',-1),'7d',now),false);
});
test('rank score, time, company, search, minimum and deterministic tie',()=>{
 const a=item('a',1),b=item('b',2,{title:'小米首次免费用户手机涨价隐私监管工作'}),c=item('c',100);
 const list=[a,b,c];assert.deepEqual(r.rank(list,{},now).map(n=>n.id),['b','a']);
 assert.equal(r.rank(list,{minimum:80},now).length,1);
 assert.equal(r.rank(list,{company:'华为'},now).length,0);
 assert.equal(r.rank(list,{query:'首次'},now)[0].id,'b');
 assert.equal(r.rank(list,{sort:'published'},now)[0].id,'a');
 assert.deepEqual(r.rank([item('z'),item('a')],{},now).map(n=>n.id),['a','z']);
});
test('multiple company filters use every matched company',()=>{
 assert.equal(r.rank([item('multi',1,{companies:['苹果','OpenAI'],company:'苹果'})],{company:'OpenAI'},now).length,1);
});
test('creative output has three directions and timed factual placeholders',()=>{
 const n=item('frame',1,{title:'小米手机价格测试',summary:'测试文字，不是真实新闻。'}),c=r.creative(n);
 assert.equal(c.titles.length,3);assert.equal(c.angle,'消费决策');
 ['0–10秒','10–30秒','30–55秒','55–75秒','75–90秒','[谁，在什么时间','不是已核验的成稿'].forEach(text=>assert.ok(c.framework.includes(text)));
 assert.ok(!c.framework.includes('测试文字，不是真实新闻。'));
});
test('English partial words do not trigger price or free',()=>{
 const s=r.score(item('eng',1,{title:'OpenAI carefree pricingstest',company:'OpenAI',companies:['OpenAI']}),now);
 assert.equal(s.values[1],4);assert.equal(s.values[2],4);
});
