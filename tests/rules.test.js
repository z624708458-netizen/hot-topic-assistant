'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const r=require('../assets/rules.js'),v2=require('../scripts/legacy_rules_v2.js');
const now=Date.parse('2026-10-10T03:00:00Z');
const item=(id='test',age=1,o={})=>({id,title:'小米手机降价2000元，销量创纪录',published:new Date(now-age*3600000).toISOString(),company:'小米',companies:['小米'],source:'测试来源，不是真实新闻',source_id:'test',summary:'',...o});
test('V3 caps are 25/25/20/20/10; deductions sum to displayed total',()=>{
 assert.deepEqual(r.dimensions.map(d=>d.max),[25,25,20,20,10]);
 for(const title of ['小米手机降价2000元，裁员并回应隐私争议，销量创纪录','苹果iOS更新版本','字节跳动API更新版本','苹果产品停止支持']){
  const s=r.score(item('x',1,{title}),now);assert.equal(s.total,s.values.reduce((a,b)=>a+b,0));s.values.forEach((v,i)=>assert.ok(v>=0&&v<=r.dimensions[i].max));assert.equal(s.penaltyApplied,s.rawTotal-s.total);
 }
 assert.equal(r.score(item('full',1,{title:'小米手机降价2000元，裁员并回应隐私争议，销量创纪录'}),now).total,100);
});
test('public brand and known person recognition is highest only, never additive',()=>{
 assert.equal(r.score(item('mi'),now).values[0],25);
 assert.equal(r.score(item('oa',1,{title:'OpenAI 消息',company:'OpenAI',companies:['OpenAI']}),now).values[0],18);
 assert.equal(r.score(item('gpt',1,{title:'ChatGPT 消息',company:'OpenAI',companies:['OpenAI']}),now).values[0],22);
 assert.equal(r.score(item('person',1,{title:'马斯克回应工资争议',company:'人物热点',companies:['人物热点']}),now).values[0],25);
 assert.equal(r.score(item('cartoon',1,{title:'奥特曼动画',company:'其他',companies:['其他']}),now).values[0],8);
});
test('repeated category keywords cannot inflate score',()=>{
 assert.deepEqual(r.score(item('a',1,{title:'小米手机降价'}),now).values,r.score(item('b',1,{title:'小米手机手机降价降价'}),now).values);
});
test('consumer price/jobs/rights beat routine API/version/spec/support/feature news',()=>{
 const strong=r.score(item(),now);assert.ok(strong.total>=80);assert.equal(strong.stop.level,'较强');
 for(const title of ['苹果iOS系统更新版本','字节跳动TRAE IDE推出新模式','苹果老产品停止支持','苹果智能家居中枢渲染图曝光：8GB内存','苹果Home应用新特性：iPhone靠近门铃','苹果iPhone独有彩蛋：首次开机自定义用户名']){
  const s=r.score(item('weak',1,{title}),now);assert.ok(s.total<=46,title);assert.ok(s.penalties.length,title);assert.equal(s.recommendable,false,title);
 }
});
test('developer price changes stay downweighted; documented major impact can exempt',()=>{
 const weak=r.score(item('api',1,{title:'OpenAI API降价50%',company:'OpenAI',companies:['OpenAI']}),now);assert.ok(weak.penalties.length);assert.equal(weak.recommendable,false);
 const strong=r.score(item('recall',1,{title:'小米手机系统更新引发电池事故并召回'}),now);assert.equal(strong.penalties.length,0);assert.ok(strong.exemption);assert.equal(strong.recommendable,true);
});
test('title stop-scroll requires headline life stakes; summary cannot invent a hook',()=>{
 const a=r.score(item('empty',1,{title:'OpenAI 新进展',company:'OpenAI',companies:['OpenAI'],summary:'裁员涨价工资隐私事故'}),now);
 assert.equal(a.stop.level,'较弱');assert.equal(a.recommendable,false);
 const b=r.score(item('work',1,{title:'腾讯回应工资奖金争议',company:'腾讯',companies:['腾讯']}),now);assert.equal(b.stop.level,'较强');assert.ok(b.total>=80);assert.ok(b.stop.reasons.every(t=>!t.includes('发布距今')));
});
test('freshness boundaries, future and invalid dates',()=>{
 [[0,10],[12,10],[12.01,9],[24,9],[24.01,7],[48,7],[48.01,3],[168,3],[168.01,0],[-1,0]].forEach(([age,s])=>assert.equal(r.freshness(item('x',age),now),s));assert.equal(r.freshness(item('bad',0,{published:'invalid'}),now),0);
});
test('China calendar today and 48h/7d retain exact boundaries',()=>{
 const n=Date.parse('2026-10-10T00:30:00+08:00');
 assert.equal(r.inPeriod(item('y',0,{published:'2026-10-09T23:30:00+08:00'}),'today',n),false);
 assert.equal(r.inPeriod(item('t',0,{published:'2026-10-10T00:01:00+08:00'}),'today',n),true);
 assert.equal(r.inPeriod(item('48',48),'48h',now),true);assert.equal(r.inPeriod(item('49',49),'48h',now),false);
 assert.equal(r.inPeriod(item('old',167),'7d',now),true);assert.equal(r.inPeriod(item('future',-1),'7d',now),false);
});
test('company/person affiliation, query, score filter and deterministic sorting',()=>{
 const a=item('a'),b=item('b',2,{title:'小米普通信息'}),c=item('c',100);
 assert.deepEqual(r.rank([a,b,c],{},now).map(n=>n.id),['a','b']);assert.equal(r.rank([a,b],{minimum:80},now).length,1);
 assert.equal(r.rank([a,b],{query:'降价'},now).length,1);
 assert.equal(r.rank([item('person',1,{company:'人物热点',companies:['人物热点'],associated_companies:['特斯拉']})],{company:'特斯拉'},now).length,1);
 assert.equal(r.rank([item('multi',1,{companies:['苹果','OpenAI'],company:'苹果'})],{company:'OpenAI'},now).length,1);
 assert.deepEqual(r.rank([item('z'),item('a')],{},now).map(n=>n.id),['a','z']);
});
const diversified=()=>['小米','小米','小米','苹果','腾讯','华为','阿里巴巴'].map((c,i)=>item('div'+i,i+1,{title:c+'手机降价2000元，销量创纪录',company:c,companies:[c],publisher_id:'pub'+(i%3)}));
test('Top 5 sorts input and caps company at two, media normally at two',()=>{
 const selected=r.selectTop(diversified().reverse(),{},now);assert.equal(selected.news.length,5);assert.equal(selected.news.filter(n=>n.company==='小米').length,2);
 for(const key of new Set(selected.news.map(r.sourceKey)))assert.ok(selected.news.filter(n=>r.sourceKey(n)===key).length<=2);
 assert.equal(selected.policy.maxPerSource,2);
});
test('single publisher is at most three; no weak filler; same company still at most two',()=>{
 const all=diversified().map(n=>({...n,publisher_id:'same'}));const s=r.selectTop(all,{},now);assert.equal(s.news.length,3);assert.equal(s.policy.maxPerSource,3);
 assert.equal(r.selectTop([item('weak',1,{title:'小米API版本更新'})],{},now).news.length,0);
 assert.equal(r.selectTop([item('1'),item('2'),item('3')],{},now).news.length,2);
});
test('all companies in joint story and publisher identity count toward caps',()=>{
 const items=diversified();items[0].companies=['小米','苹果'];const chosen=r.selectTop(items,{},now).news;
 for(const c of r.companies)assert.ok(chosen.filter(n=>r.entityKeys(n).includes(c)).length<=2);
 const many=diversified().map((n,i)=>({...n,source_id:'sina-channel'+i,publisher_id:'sina'}));assert.equal(r.selectTop(many,{},now).news.length,3);
});
test('creative output gives ordinary-person perspective, 3 factual directions and placeholders',()=>{
 const n=item(),c=r.creative(n,now);assert.equal(c.titles.length,3);assert.equal(c.angle,'钱袋子与消费');
 ['0–10秒','10–30秒','30–55秒','55–75秒','75–90秒','[谁，在什么时间','不是已核验的成稿'].forEach(t=>assert.ok(c.framework.includes(t)));
 assert.ok(c.why.includes('不保证'));assert.ok(!c.framework.includes('销量为1000万'));
});
test('English substrings do not trigger price/free groups',()=>{
 const s=r.score(item('eng',1,{title:'OpenAI carefree pricingstest',company:'OpenAI',companies:['OpenAI']}),now);assert.equal(s.values[1],2);assert.equal(s.values[2],4);
});
test('frozen V2 reproduces previous 20-point caps and freshness for fair comparison',()=>{
 assert.deepEqual(v2.score(item('v2',1,{title:'小米首次免费开源新纪录意外涨价，隐私监管裁员争议，手机用户工作'}),now).values,[20,20,20,20,20]);assert.equal(v2.freshness(item(),now),20);
});
