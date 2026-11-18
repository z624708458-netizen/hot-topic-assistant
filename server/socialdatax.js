/* Small native Streamable-HTTP MCP client. No CLI installs, cookies or media downloads. */
(function(root){
 'use strict';
 const I=root.RadarIntel;
 const tools={
  douyin:{search:['douyin_search_videos','keyword'],posts:['douyin_get_user_posted_videos_by_profile_url','profile_url'],profile:['douyin_get_user_info_by_profile_url','profile_url'],detail:['douyin_get_video_detail_by_url','url'],comments:['douyin_get_video_comments_by_url','url'],transcript:['douyin_submit_video_speech_text_by_video_url','video_url'],job:['douyin_get_video_speech_text_job','job_id']},
  bilibili:{search:['bilibili_search_videos','keyword'],posts:['bilibili_get_user_posted_videos_by_profile_url','profile_url'],profile:['bilibili_get_user_info_by_profile_url','profile_url'],detail:['bilibili_get_content_detail_by_url','url'],comments:['bilibili_get_content_comments_by_url','url'],transcript:['bilibili_submit_video_speech_text_by_video_url','video_url'],job:['bilibili_get_video_speech_text_job','job_id']},
  xhs:{search:['xhs_search_notes','keyword'],posts:['xhs_get_user_posted_notes_by_profile_url','profile_url'],profile:['xhs_get_user_info_by_profile_url','profile_url'],detail:['xhs_get_note_detail_by_note_url','note_url'],comments:['xhs_get_note_comments_by_note_url','note_url'],transcript:['xhs_submit_video_speech_text_by_note_url','note_url'],job:['xhs_get_video_speech_text_job','job_id']}
 };
 function safe(code){const e=new Error(code);e.public=true;return e;}
 function enabled(env){return env.SOCIALDATAX_ENABLED==='true'&&env.SOCIALDATAX_TERMS_CONFIRMED==='true'&&env.SOCIALDATAX_BILLING_APPROVED==='true'&&!!env.SOCIALDATAX_API_KEY;}
 function parseRPC(text,id){let candidates=[];try{candidates=[JSON.parse(text)];}catch{for(const block of text.split(/\r?\n\r?\n/)){const value=block.split(/\r?\n/).filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trimStart()).join('\n');if(value)try{candidates.push(JSON.parse(value));}catch{}}}const item=candidates.find(x=>x.id===id);if(!item||item.error)throw safe('SOCIALDATAX_RPC_FAILED');return item.result;}
 async function call(platform,operation,value,pageToken,env,fetcher=fetch,beforeCall=async()=>{}){
  if(!enabled(env))throw safe('SOCIALDATAX_NOT_CONFIGURED');if(!tools[platform]?.[operation])throw safe('UNSUPPORTED_OPERATION');
  const endpoint='https://mcp.socialdatax.com/'+platform+'/mcp';let session='',serial=0,protocol='2025-03-26';
  async function rpc(method,params,notify=false){const id=++serial;const response=await fetcher(endpoint,{method:'POST',headers:{Authorization:'Bearer '+env.SOCIALDATAX_API_KEY,Accept:'application/json, text/event-stream','Content-Type':'application/json',...(session?{'Mcp-Session-Id':session}:{}),'MCP-Protocol-Version':protocol},body:JSON.stringify({jsonrpc:'2.0',...(notify?{}:{id}),method,params}),signal:AbortSignal.timeout(operation==='transcript'?55000:20000)});
   if(response.status===401||response.status===403)throw safe('SOCIALDATAX_AUTH_REQUIRED');if(response.status===429)throw safe('SOCIALDATAX_RATE_LIMITED');if(!response.ok)throw safe('SOCIALDATAX_UPSTREAM_FAILED');session=response.headers.get('Mcp-Session-Id')||session;
   if(notify)return null;const text=await response.text();if(text.length>3000000)throw safe('SOCIALDATAX_RESPONSE_TOO_LARGE');return parseRPC(text,id);
  }
  try{const init=await rpc('initialize',{protocolVersion:protocol,capabilities:{},clientInfo:{name:'hot-topic-assistant',version:'6.0.0'}});protocol=init.protocolVersion||protocol;await rpc('notifications/initialized',{},true);
   const catalog=await rpc('tools/list',{}),[name,argument]=tools[platform][operation],tool=catalog.tools?.find(x=>x.name===name);if(!tool)throw safe('SOCIALDATAX_CAPABILITY_UNAVAILABLE');
   const args={[argument]:value,...(pageToken?{page_token:pageToken}:{})},schema=tool.inputSchema;
   if(operation==='search'&&schema?.properties?.publish_time_range?.enum?.includes('week'))args.publish_time_range='week';if(operation==='search'&&schema?.properties?.sort_type?.enum?.includes('time_descending'))args.sort_type='time_descending';
   if(!schema||Object.keys(args).some(k=>!schema.properties?.[k])||(schema.required||[]).some(k=>!Object.hasOwn(args,k))||Object.keys(args).some(k=>schema.properties[k].type&&schema.properties[k].type!=='string'&&!(Array.isArray(schema.properties[k].type)&&schema.properties[k].type.includes('string'))))throw safe('SOCIALDATAX_SCHEMA_CHANGED');
   await beforeCall();const result=await rpc('tools/call',{name,arguments:args});if(result.isError)throw safe('SOCIALDATAX_TOOL_FAILED');
   let data=result.structuredContent;if(!data){const content=(result.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('\n');try{data=JSON.parse(content);}catch{throw safe('SOCIALDATAX_SCHEMA_CHANGED');}}
   if(data?.error||data?.success===false||data?.status==='error'||data?.error_code&&Number(data.error_code)!==0)throw safe('SOCIALDATAX_TOOL_FAILED');
   return {data:data?.data&&typeof data.data==='object'?data.data:data,tool:name};
  }finally{if(session)try{await fetcher(endpoint,{method:'DELETE',headers:{Authorization:'Bearer '+env.SOCIALDATAX_API_KEY,'Mcp-Session-Id':session,'MCP-Protocol-Version':protocol},signal:AbortSignal.timeout(3000)});}catch{/* Session cleanup never retries a paid call. */}}
 }
 function clean(raw,env){const secretValues=['SOCIALDATAX_API_KEY','DEEPSEEK_API_KEY','OPENAI_API_KEY','APP_ACCESS_TOKEN'].map(k=>env[k]).filter(Boolean);return JSON.parse(JSON.stringify(raw, (k,v)=>/authorization|api[_-]?key|client_secret|access_token|cookie/i.test(k)?'[REDACTED]':typeof v==='string'?secretValues.reduce((s,secret)=>s.split(secret).join('[REDACTED]'),v):v));}
 function field(obj,keys){for(const k of keys)if(obj?.[k]!==undefined&&obj[k]!==null)return obj[k];return null;}
 function ident(v){return typeof v==='string'&&v.length>0&&v.length<=300?v:typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?String(v):null;}
 function normalize(raw,platform,tool,kind='search',fetched=new Date().toISOString()){
  const r=raw?.aweme_info||raw?.note_card||raw,stats=r?.metrics||r?.statistics||r?.stats||r?.stat||r?.interact_info||r,author=r?.author||r?.user||r?.owner||{};
  const id=ident(field(r,['aweme_id','bvid','note_id','content_id','id'])),title=field(r,['title','desc','display_title']);if(!id||typeof title!=='string'||!title.trim())return null;
  const timestamp=field(r,['published_at','publish_time','create_time','pubdate']);const seconds=typeof timestamp==='number'&&timestamp>0&&timestamp<1e11?I.date(new Date(timestamp*1000).toISOString()):null;
  const w={id:platform+':'+id,platform,platform_id:id,title:title.slice(0,1000),description:typeof r.description==='string'?r.description.slice(0,10000):'',url:I.url(field(r,['note_url','share_url','work_url','url','link']))||null,published:seconds||I.date(timestamp),author:{id:ident(field(author,['sec_user_id','user_id','uid','mid','id'])),name:typeof field(author,['nickname','name','nick_name'])==='string'?field(author,['nickname','name','nick_name']).slice(0,300):null,homepage:I.url(field(author,['profile_url','homepage']))||null,followers:I.finite(field(author,['follower_count','followers_count','fans_count','fans','followers']))},metrics:{views:I.finite(field(stats,['play_count','view_count','views','view','play'])),likes:I.finite(field(stats,['digg_count','like_count','likes','like','liked_count'])),comments:I.finite(field(stats,['comment_count','comments','reply'])),saves:I.finite(field(stats,['collect_count','favorite_count','favorites','favorite','collected_count'])),shares:I.finite(field(stats,['share_count','shares','share']))},collection_kind:kind,source:{kind:'socialdatax',tool,fetched_at:fetched,available_fields:Object.keys(r),transcript_status:'not_requested'},raw};return I.validateWork(w);
 }
 root.RadarSocialDataX={tools,enabled,call,clean,normalize,parseRPC,safe};
})(globalThis);
