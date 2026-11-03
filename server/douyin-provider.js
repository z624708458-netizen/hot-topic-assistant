/* Official-only Douyin adapter. No cookies, crawling, video download or arbitrary upstream. */
(function(root){
 'use strict';
 const B=root.RadarBlogger,API='https://open.douyin.com';
 const scopes={billboard_hot_video:'data.external.billboard_hot_video'};
 const tokens=new Map();
 function status(env){
  const selected=(env.DOUYIN_SCOPES||'').split(/[ ,]+/).filter(Boolean);
  const reasons=[];if(env.DOUYIN_ENABLED!=='true')reasons.push('抖音官方发现尚未启用');
  if(!env.DOUYIN_CLIENT_KEY||!env.DOUYIN_CLIENT_SECRET)reasons.push('尚未配置抖音应用服务端凭据');
  if(!selected.includes(scopes.billboard_hot_video))reasons.push('尚未登记已获批的热门视频榜权限');
  if(env.DOUYIN_DATA_POLICY_CONFIRMED!=='true')reasons.push('需先核对应用获批权限、接口字段及数据展示/保留规则');
  return {provider:'douyin_official',configured:!reasons.length,authorization_verified:false,message:reasons.join('；')||'服务端配置已齐备；实际权限以官方接口返回为准',capabilities:{hot_videos:{configured:!reasons.length,scope:scopes.billboard_hot_video,path:'/data/extern/billboard/hot_video/',window:'最近24小时离线统计，不是实时数据'},hot_words:{configured:false,message:'热点词/上升词及按词查视频的官方参数与权限尚待核对，未启用'},video_search:{configured:false,message:'通用视频搜索未获验证，不启用；品牌关键词管理不等于全站搜索'}},retention:'session_only',full_account_monitoring:false};
 }
 function identifier(v){return typeof v==='string'&&v.length>0&&v.length<=200?v:typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?String(v):null;}
 function failure(code){const e=new Error(code);e.safe=true;return e;}
 async function json(response){if(!response.ok)throw failure('官方服务请求失败，请核对权限或稍后重试');try{return await response.json();}catch{throw failure('官方服务未返回有效JSON');}}
 async function clientToken(env,fetcher){
  const key=env.DOUYIN_CLIENT_KEY+'|'+env.DOUYIN_CLIENT_SECRET,cached=tokens.get(key);if(cached&&cached.until>Date.now())return cached.value;
  const body=await json(await fetcher(API+'/oauth/client_token/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_key:env.DOUYIN_CLIENT_KEY,client_secret:env.DOUYIN_CLIENT_SECRET,grant_type:'client_credential'}),signal:AbortSignal.timeout(12000)}));
  const d=body.data;if(!d||d.error_code!==0||typeof d.access_token!=='string'||!d.access_token)throw failure('抖音client_token获取失败；请在控制台核对应用配置');
  const seconds=Number(d.expires_in);if(Number.isFinite(seconds)&&seconds>120){tokens.clear();tokens.set(key,{value:d.access_token,until:Date.now()+Math.min(seconds-60,7200)*1000});}return d.access_token;
 }
 function normalizeVideo(raw,at){
  if(!raw||typeof raw!=='object')return null;
  // Accept only returned fields, with explicit field provenance; absent values stay null.
  const used=[];const pick=(obj,keys,prefix='')=>{for(const k of keys)if(obj&&obj[k]!==undefined&&obj[k]!==null){used.push(prefix+k);return obj[k];}return null;};
  const title=B.text(pick(raw,['title','video_title']),600),url=B.link(pick(raw,['link','share_url']));if(!title)return null;
  const authorObject=raw.author&&typeof raw.author==='object'?raw.author:raw.author_info&&typeof raw.author_info==='object'?raw.author_info:{};
  const authorPrefix=raw.author&&typeof raw.author==='object'?'author.':'author_info.';
  let nickname=pick(authorObject,['nickname'],authorPrefix);if(!nickname&&typeof raw.author==='string'){nickname=raw.author;used.push('author');}
  const platformID=identifier(pick(authorObject,['open_id','author_id'],authorPrefix)??pick(raw,['author_id','open_id']));
  const avatar=pick(authorObject,['avatar','avatar_url'],authorPrefix);
  const create=pick(raw,['create_time','publish_time']);let published=null;
  if(typeof create==='number'&&create>0&&create<8640000000000)published=B.stamp(new Date(create*1000).toISOString());else if(typeof create==='string'&&/^\d+$/.test(create)&&Number(create)>0&&Number(create)<8640000000000)published=B.stamp(new Date(Number(create)*1000).toISOString());else if(typeof create==='string'&&/(Z|[+-]\d\d:\d\d)$/.test(create))published=B.stamp(create);
  const rawID=identifier(pick(raw,['item_id','video_id']));const hot=pick(raw,['hot_words','hot_word']);
  const keywords=(Array.isArray(hot)?hot:typeof hot==='string'?[hot]:[]).filter(x=>typeof x==='string').map(x=>B.text(x,150));
  const metrics={views:B.number(pick(raw,['play_count'])),likes:B.number(pick(raw,['digg_count','like_count'])),comments:B.number(pick(raw,['comment_count'])),shares:B.number(pick(raw,['share_count']))};
  return {id:rawID===null?'observed:'+B.hash(url||title+'|'+nickname):String(rawID),title,url:url||null,cover:B.link(pick(raw,['cover','cover_url']))||null,published,metrics,keywords,author:{platform_id:platformID===null?null:String(platformID),nickname:B.text(nickname,300)||null,avatar:B.link(avatar)||null},source:{name:'抖音官方热门视频榜',api:'/data/extern/billboard/hot_video/',scope:scopes.billboard_hot_video,fetched_at:at,window:'last_24h_offline',available_fields:used},text_kind:'title_or_excerpt_not_transcript'};
 }
 async function hotVideos(env,fetcher=fetch){
  const s=status(env);if(!s.configured)return {status:'unconfigured',message:s.message,works:[],fetched_at:null,source:s.capabilities.hot_videos};
  const token=await clientToken(env,fetcher);
  const payload=await json(await fetcher(API+'/data/extern/billboard/hot_video/',{method:'GET',headers:{'client-token':token},signal:AbortSignal.timeout(12000)}));
  const d=payload.data;if(!d||d.error_code!==0)throw failure('抖音热门视频榜未获授权或调用失败；不展示模拟结果');
  const list=Array.isArray(d.list)?d.list:Array.isArray(d.video_list)?d.video_list:null;if(!list)throw failure('官方榜单字段与当前适配器不一致，已停止解析，请核对最新文档');
  const fetched_at=new Date().toISOString(),works=list.slice(0,1000).map(x=>normalizeVideo(x,fetched_at)).filter(Boolean);
  return {status:'ok',message:'最近24小时离线热门榜单；仅筛选榜内已返回作品，不是全站搜索或实时监控',works,fetched_at,source:s.capabilities.hot_videos,retention:'session_only'};
 }
 async function discover(env,fetcher=fetch){const result=await hotVideos(env,fetcher);return {...result,candidates:B.candidates(result.works),strategy:'authorized_hot_video_fallback',steps:[{step:'热点词/上升词',status:'not_enabled',reason:'文档参数与权限待核对，未调用'},{step:'领域筛选',status:result.status==='ok'?'ok':'not_run',reason:'仅匹配官方榜单已返回标题和热度词'},{step:'提取作者与去重',status:result.status==='ok'?'ok':'not_run',reason:'稳定ID优先；昵称与头像只作低可信辅助；不猜主页'}]};}
 root.RadarDouyin={status,hotVideos,discover,normalizeVideo};
})(globalThis);
