// TEST ONLY normalized fixtures. Not production data, not a captured official response.
const B=require('../assets/blogger-rules.js');
const at=()=>new Date().toISOString();
function work(over={}){return {id:'TEST_WORK_1',title:'仅测试：就业工资加班与人口养老',url:'https://www.douyin.com/video/TEST_ONLY',cover:null,published:at(),metrics:{views:null,likes:1000,comments:20,shares:10},keywords:['就业','人口'],author:{platform_id:'TEST_AUTHOR',nickname:'仅测试博主，不是真实账号',avatar:null},source:{name:'抖音官方热门视频榜（测试模拟）',api:'/data/extern/billboard/hot_video/',scope:'data.external.billboard_hot_video',fetched_at:at(),window:'last_24h_offline',available_fields:['title','author','digg_count']},text_kind:'title_or_excerpt_not_transcript',...over};}
function raw(over={}){return {item_id:'TEST_WORK_1',title:'仅测试：就业工资加班与人口养老',author:{open_id:'TEST_AUTHOR',nickname:'仅测试博主，不是真实账号'},link:'https://www.douyin.com/video/TEST_ONLY',digg_count:1000,comment_count:20,share_count:10,create_time:Math.floor(Date.now()/1000),...over};}
function reference(over={}){return {...B.reference({id:'manual:TEST',nickname:'仅测试手动博主',domains:['就业']}),...over};}
function output(){return {opening:'仅测试：从就业问题切入，依据来自粘贴文本。',viewpoint:'仅测试核心观点。',structure:'仅测试：提问、事例、判断。',emotion:'仅测试文字中的焦虑，不推测画面或声音。',controversy:'仅测试，需核对事实。',audience:'仅测试普通人工资利益。',inspiration:'仅测试借鉴提问结构，不复制原文。',comment_needs:'暂无真实评论数据，无法分析评论区需求',limitations:'仅基于粘贴文本，不能替代观看原视频或事实核查。'};}
module.exports={work,raw,reference,output};
