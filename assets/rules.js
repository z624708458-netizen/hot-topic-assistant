/* Shared, deterministic rules: browser and daily snapshot use the same functions. */
(function (root, factory) {
  const rules = factory();
  if (typeof module === 'object' && module.exports) module.exports = rules;
  else root.RadarRules = rules;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const companies = ['小米','华为','腾讯','字节跳动','阿里巴巴','百度','OpenAI','苹果','特斯拉'];
  const version = '3.0.0';
  const companyRecognition = {'小米':25,'华为':25,'苹果':25,'腾讯':24,'字节跳动':24,'阿里巴巴':24,'百度':22,'特斯拉':24,'OpenAI':18};
  const publicPeople = [
    {name:'雷军',company:'小米',points:25,aliases:['雷军','Lei Jun']},
    {name:'任正非',company:'华为',points:25,aliases:['任正非','Ren Zhengfei']},
    {name:'余承东',company:'华为',points:24,aliases:['余承东','Richard Yu']},
    {name:'马化腾',company:'腾讯',points:24,aliases:['马化腾','Pony Ma']},
    {name:'张一鸣',company:'字节跳动',points:22,aliases:['张一鸣','Zhang Yiming']},
    {name:'马云',company:'阿里巴巴',points:25,aliases:['马云','Jack Ma']},
    {name:'李彦宏',company:'百度',points:22,aliases:['李彦宏','Robin Li']},
    {name:'马斯克',company:'特斯拉',points:25,aliases:['马斯克','Elon Musk']},
    {name:'库克',company:'苹果',points:23,aliases:['库克','Tim Cook']},
    {name:'萨姆·奥特曼',company:'OpenAI',points:20,aliases:['萨姆·奥特曼','山姆·奥特曼','Sam Altman']}
  ];
  const groups = {
    conflict: [
      ['裁员','工资','奖金','降薪','欠薪','年终奖','失业','layoff','job cuts','salary','bonus'],
      ['降价','涨价','暴跌','暴涨','价格战','大跌','大涨','亏损','price cut','price hike','plunge','surge'],
      ['翻车','争议','回应','道歉','处罚','起诉','封禁','事故','召回','罚款','诉讼','抵制','维权','被判','判决','不正当竞争','lawsuit','recall','apology','controversy','ban'],
      ['销量','创纪录','行业第一','全球第一','卖爆','销量第一','record-breaking','sales record'],
      ['旗舰手机','年度旗舰','旗舰新机','新车上市','新车发布','新机发布','发布会','重大新品','重磅新品','开启交付','首批交付','新一代 iPhone','launch event','flagship phone']
    ],
    interest: [
      ['价格','降价','涨价','工资','奖金','年终奖','降薪','收费','免费','售价','万元起','元起售','会员','退款','购买','price','salary','bonus','refund','subscription'],
      ['手机','汽车','新品','空调','家电','语音指令','充电','续航','电池','iPhone','微信','抖音','淘宝','外卖','购物','打车','phone','car','battery','charging'],
      ['裁员','失业','就业','岗位','招聘','办公','学习','教育','layoff','job cuts','education'],
      ['隐私','事故','召回','处罚','封禁','起诉','用户权益','消费者','维权','被骗','支付','个人信息','privacy','consumer','recall','payment']
    ],
    contrast: [['却','反而','竟然','不再','意外','首次','逆转','反转','unexpected','surprise']],
    majorImpact: [['裁员','降薪','欠薪','事故','召回','处罚','起诉','封禁','大规模泄露','隐私泄露','layoff','recall','lawsuit']],
    majorConsumer: [['价格战','大降价','大涨价','重大新品','重磅新品','旗舰手机','年度旗舰','新车上市','新车发布','发布会']]
  };
  const downgradeRules = [
    {id:'routine-update',label:'普通软件/系统版本更新',amount:20,cap:42,test:t=>/版本|补丁|固件|Beta|(?:HarmonyOS|鸿蒙|澎湃).{0,24}(?:升级|更新)|(?:软件|系统|iOS|App).{0,10}(?:更新|升级)|(?:更新|升级).{0,10}(?:系统|软件|版本)/i.test(t)},
    {id:'developer',label:'API或开发者工具内容',amount:22,cap:43,test:t=>/\b(?:API|SDK|IDE|TRAE|TraeCode|TraeWork)\b|开发者工具|编程助手|代码补全|编译器|开发者预览|Agent\s*\/\s*IDE/i.test(t)},
    {id:'end-support',label:'老产品停止支持/普通停更',amount:24,cap:40,test:t=>/停止支持|停止维护|不再支持|过时.{0,3}产品|停更|停止更新|end of support|obsolete/i.test(t)},
    {id:'spec-leak',label:'普通参数/渲染图曝光',amount:22,cap:42,test:t=>/渲染图|谍照|(?:参数|规格|内存|显存|跑分).{0,12}(?:曝光|泄露|爆料)|(?:曝光|爆料).{0,16}(?:内存|参数|规格|GB)|specs? leak/i.test(t)},
    {id:'single-feature',label:'单一功能或交互小更新',amount:20,cap:43,test:t=>/独有彩蛋|首次开机|自定义用户名|新特性|新功能|新增.{0,8}(?:功能|模式)|上线.{0,8}功能|支持.{0,14}(?:模式|切换|预览|功能)|(?:优化|焕新).{0,8}界面|界面.{0,8}(?:优化|焕新)/i.test(t)},
    {id:'specialist',label:'专业研究/性能评测，生活关联有限',amount:18,cap:46,test:t=>/数学研究|数学.{0,8}成果|模型性能|基准测试|跑分|研究论文|训练框架|benchmark/i.test(t)}
  ];
  const dimensions = [
    {name:'大众认知度',max:25,explain:'华为/小米/苹果25；腾讯/字节/阿里/特斯拉24；百度22；OpenAI18（标题明确ChatGPT22）；知名人物按20–25等公开配置取最高值，不叠加。'},
    {name:'冲突/争议/反差',max:25,explain:'标题命中裁员收入、价格剧变、问责冲突、销量纪录、重大新品组：一组17，二组22，三组以上25。仅摘要命中则6–12；无命中2。'},
    {name:'普通人利益相关',max:20,explain:'钱袋子、常用消费场景、就业教育、用户权益：标题一组12，每多一组+4；仅摘要命中6/9/12/15；无命中4。'},
    {name:'社交传播潜力',max:20,explain:'标题基础4；大众对象+3，明确事件+8，生活利益+3，有意义的金额/人数等数字+3，反差+2，知名人物公开表态+3，上限20。英文/技术密集-4。'},
    {name:'时效性',max:10,explain:'≤12小时10，≤24小时9，≤48小时7，≤7天3，更早/未来0。低价值降权从中间三项扣除，认知与原始时间不改写。'}
  ];
  function matchesWord(text,word) {
    if (/^[a-z -]+$/i.test(word)) {
      const escaped=word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      return new RegExp('(^|[^a-z])'+escaped+'([^a-z]|$)','i').test(text);
    }
    return text.toLowerCase().includes(word.toLowerCase());
  }
  function hits(text,grouped) {return grouped.map(group=>group.find(w=>matchesWord(text,w))).filter(Boolean);}
  function peopleIn(title) {return publicPeople.filter(p=>p.aliases.some(a=>matchesWord(title,a)));}
  function ageHours(news,now=Date.now()) {return (now-Date.parse(news.published))/3600000;}
  function freshness(news,now=Date.now()) {
    const age=ageHours(news,now);return !Number.isFinite(age)||age<0?0:age<=12?10:age<=24?9:age<=48?7:age<=168?3:0;
  }
  function score(news,now=Date.now()) {
    const title=news.title,summary=news.summary||'';
    const people=peopleIn(title);
    const recognition=Math.max(8,...(news.companies||[news.company]).map(c=>companyRecognition[c]||8),...people.map(p=>p.points),matchesWord(title,'ChatGPT')?22:0);
    const events=hits(title,groups.conflict),summaryEvents=hits(summary,groups.conflict);
    const life=hits(title,groups.interest),summaryLife=hits(summary,groups.interest);
    const headlineKnown=companies.some(c=>title.includes(c))||/iPhone|微信|抖音|淘宝|ChatGPT|Tesla|Huawei|Xiaomi|鸿蒙智行|智界|问界|Redmi|红米/i.test(title)||people.length>0;
    const contrast=hits(title,groups.contrast);
    const number=events.length>0&&/\d+(?:[.,]\d+)?\s*(?:%|％|元|万元|亿元|人|万人|辆|台|倍)|[一二三四五六七八九十百千万亿]+(?:元|人|辆|倍)/.test(title);
    const statement=people.length>0&&/回应|道歉|宣布|表示|公开|称|said|announced/i.test(title);
    const technicalDense=(title.match(/[A-Za-z]/g)||[]).length/Math.max(1,(title.match(/[A-Za-z\u4e00-\u9fff]/g)||[]).length)>.45;
    let conflict=events.length?Math.min(25,12+5*events.length):summaryEvents.length?Math.min(12,3+3*summaryEvents.length):2;
    let interest=life.length?Math.min(20,8+4*life.length):summaryLife.length?Math.min(15,3+3*summaryLife.length):4;
    let social=Math.max(0,Math.min(20,4+(headlineKnown?3:0)+(events.length?8:0)+(life.length?3:0)+(number?3:0)+(contrast.length?2:0)+(statement?3:0))-(technicalDense?4:0));
    const rawValues=[recognition,conflict,interest,social,freshness(news,now)];
    const low= downgradeRules.filter(rule=>rule.test(title));
    const directImpact=hits(title,groups.majorImpact).length>0;
    const consumerImpact=hits(title,groups.majorConsumer).length>0&&life.length>0&&!low.some(r=>r.id==='developer')&&news.report_type!=='unconfirmed';
    const exemption=low.length>0&&(directImpact||consumerImpact);
    const penalties=exemption?[]:low.map(({id,label,amount,cap})=>({id,label,amount,cap}));
    const values=rawValues.slice();
    const rawTotal=values.reduce((s,n)=>s+n,0);
    const deduction=penalties.length?Math.max(...penalties.map(p=>p.amount)):0;
    const cap=penalties.length?Math.min(...penalties.map(p=>p.cap)):100;
    const target=Math.max(recognition+values[4],Math.min(rawTotal-deduction,cap));
    // Put every deduction into the named dimensions so the five bars still sum to total.
    let remaining=rawTotal-target;
    for(const index of [3,1,2]) {const take=Math.min(values[index],remaining);values[index]-=take;remaining-=take;}
    const total=values.reduce((s,n)=>s+n,0);
    const stop=penalties.length?'较弱':values[3]>=15&&values[1]>=14&&values[2]>=10?'较强':headlineKnown&&(life.length>0||(people.length>0&&events.length>0))&&values[3]>=10?'中等':'较弱';
    const stopReasons=penalties.length?low.map(r=>r.label):[
      ...(headlineKnown?['标题有大众熟悉的公司/人物']:['标题对象认知较弱']),
      ...(events.length?['明确事件词：'+events.join('、')]:['缺少明确冲突或结果']),
      ...(life.length?['生活关联：'+life.join('、')]:['标题未说清普通人为什么要关心'])
    ];
    const reasons=[
      `取公司/人物最高认知分${recognition}。${people.length?'人物：'+people.map(p=>p.name).join('、')+'。':''}这是编辑规则，不是知名度调查。`,
      events.length?'标题事件组：'+events.join('、')+'。词语不证明冲突事实。':summaryEvents.length?'仅摘要命中：'+summaryEvents.join('、')+'，标题停留钩子偏弱。':'未命中明确事件组，基础2分。',
      life.length?'标题生活利益组：'+life.join('、')+'。':summaryLife.length?'仅摘要生活关联：'+summaryLife.join('、')+'。':'未识别直接生活利益，基础4分。',
      `标题停留判断：${stop}。${stopReasons.join('；')}。不是播放量预测。`,
      Number.isFinite(ageHours(news,now))&&ageHours(news,now)>=0?'发布距今约'+Math.floor(ageHours(news,now))+'小时，最高10分。':'日期无效或在未来，不计时效分。'
    ];
    [1,2,3].forEach(i=>{if(values[i]<rawValues[i])reasons[i]+=` 低价值扣${rawValues[i]-values[i]}分。`;});
    return {version,values,rawValues,total,rawTotal,reasons,matched:[events,contrast,life],penalties,penaltyApplied:rawTotal-total,exemption:exemption?'标题含重大现实影响线索，豁免普通更新降权；仍需核对原文。':null,stop:{level:stop,reasons:stopReasons,titleOnly:true},recommendable:total>=60&&stop!=='较弱'};
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
    return news.filter(n=>inPeriod(n,period,now)&&(company==='全部'||[...(n.companies||[n.company]),...(n.associated_companies||[])].includes(company))&&(`${n.title} ${n.summary||''} ${n.company} ${n.source}`).toLowerCase().includes(key)&&score(n,now).total>=minimum).sort((a,b)=>sort==='published'?Date.parse(b.published)-Date.parse(a.published)||a.id.localeCompare(b.id):score(b,now).total-score(a,now).total||Date.parse(b.published)-Date.parse(a.published)||a.id.localeCompare(b.id));
  }
  function sourceKey(n) {return n.publisher_id||n.source_id||n.source||'unknown';}
  function entityKeys(n) {
    const keys=(n.companies||[n.company]).filter(c=>c!=='人物热点');
    const associated=n.associated_companies||[];
    if(keys.length||associated.length)return [...new Set([...keys,...associated])];
    const people=peopleIn(n.title);
    return people.length?people.map(p=>'人物:'+p.name):[n.company||'其他'];
  }
  function selectTop(candidates,options={},now=Date.now()) {
    const limit=options.limit||5, maxCompany=2;
    const eligible=candidates.filter(n=>score(n,now).recommendable).slice().sort((a,b)=>score(b,now).total-score(a,now).total||Date.parse(b.published)-Date.parse(a.published)||a.id.localeCompare(b.id));
    function pick(maxSource) {
      const chosen=[],companyCounts=new Map(),sourceCounts=new Map();
      for(const n of eligible) {
        const entities=entityKeys(n),source=sourceKey(n);
        if(entities.some(c=>(companyCounts.get(c)||0)>=maxCompany)||(sourceCounts.get(source)||0)>=maxSource)continue;
        chosen.push(n);entities.forEach(c=>companyCounts.set(c,(companyCounts.get(c)||0)+1));sourceCounts.set(source,(sourceCounts.get(source)||0)+1);
        if(chosen.length===limit)break;
      }
      return chosen;
    }
    const strict=pick(2),relaxed=strict.length<limit?pick(3):strict;
    // Relax media concentration only to 3, and only when it increases useful coverage.
    const result=relaxed.length>strict.length?relaxed:strict;
    const sourceCap=result===strict?2:3;
    return {news:result,eligible:eligible.length,excluded:candidates.length-eligible.length,
      policy:{minimumScore:60,minimumStop:'中等',maxPerCompany:maxCompany,maxPerSource:sourceCap},
      explanation:`仅推荐≥60分且标题停留判断不低于中等的候选；同公司最多2条，同一媒体${sourceCap===2?'最多2条':'因合格来源不足放宽至最多3条'}；不足5条不补编。`};
  }
  function creative(news,now=Date.now()) {
    const s=score(news,now),text=news.title;
    let angle='普通人的选择',perspective='从一个观众熟悉的选择切入：这件事对买东西、用产品或工作有什么可核实的影响？';
    if(/裁员|工资|奖金|降薪|欠薪|年终奖|失业/.test(text)) {angle='饭碗与收入';perspective='先问工资、岗位或收入会受什么影响，再核对涉及的人群、金额、时间和条件；不要替原文扩大影响范围。';}
    else if(hits(text,[groups.interest[0]]).length) {angle='钱袋子与消费';perspective='先讲要多花还是少花多少钱，以及适用地区、型号和资格；金额只能引用原文，不把优惠当普遍降价。';}
    else if(/被判|判决|不正当竞争/.test(text)) {angle='熟悉品牌与真假辨认';perspective='从观众熟悉的品牌或使用场景切入；核对谁被判、依据是什么。标题提到某品牌不代表该品牌被处罚，不扩大司法结论。';}
    else if(hits(text,[groups.interest[3]]).length) {angle='安全与用户权益';perspective='从普通人需要知道或采取的行动切入：谁受到影响、是否涉及你、来源确认了哪些保护或处理措施？';}
    else if(hits(text,[groups.conflict[3]]).length) {angle='熟悉品牌的竞争';perspective='从为什么大家会买、会比较切入；销量/第一/纪录要说明统计口径、地区和周期，不据此推导市场结论。';}
    else if(hits(text,[groups.conflict[4]]).length) {angle='新品与购买选择';perspective='用一个日常场景讲清新品解决什么问题，再确认价格、可用时间和范围，不只念配置参数。';}
    const person=peopleIn(text)[0];
    const subject=person?person.name:news.company;
    const brief=text.length>55?text.slice(0,55)+'…':text;
    const why=`标题停留规则判断为「${s.stop.level}」：${s.stop.reasons.join('；')}。建议从${angle}切入。`+(s.penalties.length?'此条已因'+s.penalties.map(p=>p.label).join('、')+'降权，更适合放在候选区，优先寻找重大现实影响证据。':'分数只是优先级，不保证播放量或爆款。');
    const titles=[`${brief}：这件事和你有什么关系？`,`${subject}这条消息，真正该问的是什么？`,`${brief}：谁受影响，哪些条件别漏看？`];
    const framework=[
      `【0–10秒 · 停留钩子】\n用${angle}里的一个真实问题开场。参考原标题：「${brief}」。不要把传闻或尚未证实的影响当结论。`,
      `【10–30秒 · 新闻事实】\n打开原文填入：[谁，在什么时间，宣布或发生了什么]、[关键数据与适用范围]。涉及回应、起诉或处罚，要区分各方说法和已确认事实。`,
      `【30–55秒 · 普通人视角】\n${perspective}选一个普通人能理解的场景，区分现实结果与可能影响。没有证据不补写。`,
      `【55–75秒 · 反差与边界】\n填入[前后变化或真实分歧]和[地区、时间、人群、统计口径等限制]。注明来源为「${news.source}」。不要把小功能更新包装成行业颠覆。`,
      `【75–90秒 · 评论入口】\n提出[你会因为这条消息改变哪个选择？]，鼓励讨论已核实的问题，不制造对立。填好后朗读计时；这是规则模板框架，不是已核验的成稿。`
    ].join('\n\n');
    return {angle,perspective,why,titles,framework,stop:s.stop};
  }
  return {version,companies,companyRecognition,publicPeople,dimensions,groups,score,freshness,ageHours,inPeriod,rank,creative,selectTop,entityKeys,sourceKey};
});
