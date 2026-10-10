/* Shared, deterministic rules: browser and daily snapshot use the same functions. */
(function (root, factory) {
  const rules = factory();
  if (typeof module === 'object' && module.exports) module.exports = rules;
  else root.RadarRules = rules;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const companies = ['小米','华为','腾讯','字节跳动','阿里巴巴','百度','OpenAI','苹果','特斯拉'];
  const groups = {
    controversy: [
      ['涨价','降价','价格战','收费','订阅','付费','price','pricing','subscription'],
      ['隐私','泄露','安全','privacy','breach','security'],
      ['监管','诉讼','起诉','罚款','调查','垄断','lawsuit','antitrust','regulation'],
      ['裁员','失业','取代','layoff','job cuts'],
      ['争议','抵制','禁售','下架','召回','controversy','recall','ban']
    ],
    surprise: [
      ['首次','首款','首个','第一次','first-ever','first ever'],
      ['意外','突然','反转','取消','放弃','unexpected','surprise','cancel'],
      ['突破','颠覆','打破','新纪录','breakthrough','record-breaking'],
      ['免费','开源','不再','停产','停止','free','open-source','discontinue']
    ],
    interest: [
      ['价格','涨价','降价','收费','免费','订阅','售价','购买','price','pricing','free','cost','subscription'],
      ['手机','汽车','充电','续航','电池','电脑','iphone','ipad','phone','car','battery','charging'],
      ['工作','就业','裁员','办公','创作','视频','学习','教育','job','work','video','education'],
      ['用户','隐私','安全','消费者','个人','支付','退款','user','privacy','consumer','payment']
    ]
  };
  const dimensions = [
    {name:'大众认知度',explain:'九家重点公司或其明确产品别名命中，20分；其他手动公司8分。'},
    {name:'争议性',explain:'基础4分；每命中一组价格/隐私/监管/就业/争议关键词加4分，上限20。词语出现不证明存在争议。'},
    {name:'反常识/意外程度',explain:'基础4分；每命中一组首次/意外变化/突破/开放或停止关键词加4分，上限20。'},
    {name:'普通人利益相关',explain:'基础4分；每命中一组消费价格/常用设备/工作学习/用户权益关键词加4分，上限20。'},
    {name:'时效性',explain:'发布距今≤12小时20分，≤24小时18分，≤48小时14分，≤7天6分，更早或未来0分。'}
  ];
  function hits(text, grouped) {
    const value = text.toLowerCase();
    return grouped.map(group => group.find(word => {
      if (/^[a-z -]+$/.test(word)) {
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
        return new RegExp('(^|[^a-z])' + escaped + '([^a-z]|$)','i').test(value);
      }
      return value.includes(word.toLowerCase());
    })).filter(Boolean);
  }
  function ageHours(news, now = Date.now()) { return (now - Date.parse(news.published)) / 3600000; }
  function freshness(news, now = Date.now()) {
    const age = ageHours(news,now);
    return !Number.isFinite(age) || age < 0 ? 0 : age <= 12 ? 20 : age <= 24 ? 18 : age <= 48 ? 14 : age <= 168 ? 6 : 0;
  }
  function score(news, now = Date.now()) {
    const text = news.title + ' ' + (news.summary || '');
    const matched = [hits(text,groups.controversy),hits(text,groups.surprise),hits(text,groups.interest)];
    const known = (news.companies || [news.company]).some(c=>companies.includes(c));
    const values = [known?20:8,...matched.map(v=>Math.min(20,4+4*v.length)),freshness(news,now)];
    const age = ageHours(news,now);
    const reasons = [known?'命中重点公司或产品别名。此项不是阅读量或热搜统计。':'未命中重点公司，采用8分基础认知分。',...matched.map(v=>v.length?'命中关键词组：'+v.join('、')+'。每组只计一次；需核对原文语境。':'未命中本维度关键词，采用4分基础分。'),Number.isFinite(age)&&age>=0?'发布距今约 '+Math.floor(age)+' 小时，按原发布时间计分。':'日期无效或在未来，不计时效分。'];
    return {values,reasons,total:values.reduce((sum,n)=>sum+n,0),matched};
  }
  function inPeriod(news, period = '48h', now = Date.now()) {
    const published=Date.parse(news.published);
    if (!Number.isFinite(published)||published>now) return false;
    if(period==='today') {
      // China calendar day, independent of the viewer's local timezone.
      return new Date(published+28800000).toISOString().slice(0,10)===new Date(now+28800000).toISOString().slice(0,10);
    }
    return now-published <= (period==='7d'?168:48)*3600000;
  }
  function rank(news, options = {}, now = Date.now()) {
    const {period='48h',company='全部',query='',minimum=0,sort='score'}=options;
    const key=query.trim().toLowerCase();
    return news.filter(n=>inPeriod(n,period,now)&&(company==='全部'||(n.companies||[n.company]).includes(company))&&(`${n.title} ${n.summary||''} ${n.company} ${n.source}`).toLowerCase().includes(key)&&score(n,now).total>=minimum).sort((a,b)=>sort==='published'?Date.parse(b.published)-Date.parse(a.published)||a.id.localeCompare(b.id):score(b,now).total-score(a,now).total||Date.parse(b.published)-Date.parse(a.published)||a.id.localeCompare(b.id));
  }
  function creative(news) {
    const s=score(news), text=news.title+' '+(news.summary||'');
    let angle='信息核验';
    let perspective='普通用户该确认哪些适用条件？区分已公布、计划中与实际可用。';
    if(hits(text,[groups.interest[0]]).length) {angle='消费决策';perspective='从钱包和购买选择切入：原文给出的价格、条件，是否适用于你的地区和需求？';}
    else if(hits(text,[groups.interest[2]]).length) {angle='工作与学习';perspective='从一个日常任务切入：哪些步骤可能变化？效果、限制和适用范围需要哪些证据？';}
    else if(hits(text,[groups.interest[3]]).length) {angle='用户权益';perspective='从普通用户的权利和选择切入：需要确认什么规则、范围和保护措施？';}
    else if(hits(text,[groups.interest[1]]).length) {angle='日常使用';perspective='从每天使用手机、电脑或汽车的场景切入：新消息与你的实际需求有什么关系？';}
    const brief=news.title.length>55?news.title.slice(0,55)+'…':news.title;
    const why=`涉及大众熟悉的${news.company}，有${angle}切入点。`+(s.matched[2].length?'用户、消费或工作相关词命中，可进一步确认实际影响。':'摘要中的直接生活关联有限，请核实之后再决定。')+(s.matched[0].length?'出现讨论类词语，可以提出有依据的问题；不能仅凭关键词制造争议。':'宜用事实解释变化，避免强行制造冲突。');
    const titles=[`${brief}：普通人该关注什么？`,`${news.company}这条消息，先看清哪些条件？`,`${brief}：它会影响你的哪一个选择？`];
    // This is a timed framework, never a claimed summary/translation of the source.
    const framework=[
      `【0–10秒 · 开场】\n用普通人的问题开场：这条关于${news.company}的消息，和${angle}有什么关系？可参考标题：「${brief}」。不要预设已经发生的影响。`,
      `【10–30秒 · 新闻事实】\n打开下方原文，填入两条已核实的事实：[谁，在什么时间，宣布或发生了什么]、[关键条件与适用范围]。只使用原文明确的信息；摘要不完整时，不自行补写。`,
      `【30–55秒 · 普通人视角】\n${perspective}选一个你能解释清楚的生活场景，区分已经确认的变化与尚待验证的可能性。没有证据，不下结论。`,
      `【55–75秒 · 条件与边界】\n补充[地区/型号/价格/时间/资格等限制]，注明来源为「${news.source}」。如果原文是公司计划或观点，要说清楚，不把计划说成成绩。`,
      `【75–90秒 · 收尾提问】\n用一个实际问题收尾：[你会因为这条消息改变哪个选择？]。不引导未经证实的对立。发布前朗读计时；这是规则模板框架，不是已核验的成稿。`
    ].join('\n\n');
    return {angle,perspective,why,titles,framework};
  }
  return {companies,dimensions,groups,score,freshness,ageHours,inPeriod,rank,creative};
});
