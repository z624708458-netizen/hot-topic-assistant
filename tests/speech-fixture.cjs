// TEST ONLY: no live model or real news. Synthetic model output for protocol tests.
const B=require('../assets/brain-rules.js'),L=require('../assets/speech-llm.js');
const news=(o={})=>({id:'test-v5',title:'仅测试：苹果 Vision Pro 团队裁员',summary:'仅测试：团队岗位调整。没有说明人数。',company:'苹果',companies:['苹果'],source:'仅测试来源',url:'https://example.com/n',published:'2026-10-10T00:00:00Z',kind:'rss',...o});
const material=(type='work',o={})=>({id:'kb-v5',type,title:'仅测试：苹果 Vision Pro 团队裁员',body:'仅测试苹果 Vision Pro 裁员与员工岗位变化。',tags:['苹果','Vision Pro'],fields:{},created_at:'2026-10-10T00:00:00Z',updated_at:'2026-10-10T00:00:00Z',...o});
const brain=materials=>({...B.defaultState(),materials});
function output(p){return {angle:'仅测试：岗位选择',structure:'D',structure_label:'仅测试：职场切口',paragraphs:[{text:'仅测试开头：Vision Pro的岗位，现在该怎么看？',kind:'judgment',references:[]},{text:p.current_news.title,kind:'news',references:[{source:'news',id:p.current_news.id,field:'title',quote:p.current_news.title}]},{text:'仅测试判断：选工作时，我会把岗位条件摆在公司名气前面。',kind:'judgment',references:[]},{text:'仅测试收尾：你会先问什么？',kind:'judgment',references:[]}],openings:[{kind:'冲突',text:'仅测试：大厂光环和岗位条件怎么选？'},{kind:'利益',text:'仅测试：如果你正在找工作，先问哪件事？'},{kind:'反差',text:'仅测试：产品名字很响，工作体验呢？'}],titles:['仅测试：Vision Pro岗位','仅测试：工作条件怎么选','仅测试：苹果这次调整'],used_material_ids:p.style_works.map(x=>x.id),why:['仅测试：选岗位角度。','仅测试：当前事实来自标题。','仅测试：样稿不足，不推断已学会风格。']};}
const request=(n=news(),ms=[])=>L.buildRequest({news:n,brain:brain(ms)});
module.exports={news,material,brain,output,request};
