"""V5.1 LLM browser contract. Model replies are TEST ONLY mocked JSON, never real API calls."""
import json
import pathlib
import unittest
import test_demo as base
import test_brain41 as v41

class SpeechTest(unittest.TestCase):
    setUpClass=classmethod(base.DemoTest.setUpClass.__func__)
    tearDownClass=classmethod(base.DemoTest.tearDownClass.__func__)
    brain=v41.Brain41Test.brain
    add=v41.Brain41Test.add
    strong=v41.Brain41Test.strong
    state=v41.Brain41Test.state
    recommend=v41.Brain41Test.recommend

    def setUp(self):
        v41.Brain41Test.setUp(self)
        self.calls=[];self.failure=False;self.health_failure=False;self.hold=False;self.pending=None
        self.page.route('**/llm-test/**',self.provider)

    tearDown=base.DemoTest.tearDown

    def provider(self,route):
        if route.request.url.endswith('/health'):
            route.fulfill(status=503 if self.health_failure else 200,json={'error':'当前未连接大模型，无法生成高质量口播'} if self.health_failure else {'configured':True,'provider':'openai','model':'TEST_ONLY_MODEL'});return
        payload=route.request.post_data_json;self.calls.append(payload)
        if self.hold:self.pending=route;return
        if self.failure:route.fulfill(status=502,json={'error':'仅测试模型服务失败，旧稿保留'});return
        n=payload['current_news'];action=payload['action']
        paragraphs=[{'text':'仅测试模型开头：Vision Pro岗位要怎么看？','kind':'judgment','references':[]},
                    {'text':n['title'],'kind':'news','references':[{'source':'news','id':n['id'],'field':'title','quote':n['title']}]},
                    {'text':'仅测试模型判断：先看岗位条件，再看公司名气。','kind':'judgment','references':[]},
                    {'text':'仅测试模型收尾：你会先问什么？','kind':'judgment','references':[]}]
        if payload['duration']==90:paragraphs.insert(-1,{'text':'仅测试90秒模型段落：请以实际新闻为准，这段仅为协议验收。','kind':'judgment','references':[]})
        if action not in ['generate','opening']:
            body=payload['existing_draft']
            if action=='risk':body=body.replace('特斯拉出事将负全责。','仅测试：责任等待核实。')
            paragraphs=[{'text':body+'\n\n仅测试模型改稿：'+action,'kind':'judgment','references':[]}]
        count=len(self.calls)
        output={'angle':'仅测试模型视角：'+action,'structure':'D' if action!='angle' else 'B','structure_label':'仅测试模型自由结构',
                'paragraphs':paragraphs,'openings':[{'kind':k,'text':f'仅测试不同开头{count}：{t}'} for k,t in [('冲突','名气和岗位条件能放一起看吗？'),('利益','找工作该先问什么？'),('反差','产品光环和个人处境有什么差别？')]],
                'titles':['仅测试标题：岗位选择','仅测试标题：条件比较','仅测试标题：品牌光环'],
                'used_material_ids':[m['id'] for m in payload['style_works']],
                'why':['仅测试：事件事实来自输入。','仅测试：先比较岗位条件。','仅测试：不宣称真实风格已经学会。']}
        route.fulfill(json={'provider':'openai','model':'TEST_ONLY_MODEL','output':output})

    def connect(self):
        p=self.page;p.locator('.speech-generator [data-speech-connect]').click()
        p.locator('#speech-endpoint').fill(self.url+'/llm-test');p.locator('#speech-access-token').fill('TEST_ONLY_APPLICATION_ACCESS_12345')
        p.locator('#speech-connect-submit').click();p.wait_for_selector('#speech-connect-dialog',state='hidden')

    def generate(self,connect=True):
        if connect:self.connect()
        self.page.locator('.speech-generator [data-speech-generate]').click()
        self.page.wait_for_selector('.speech-generator [data-speech-main]')

    def main(self):return self.page.locator('.speech-generator [data-speech-main]')
    def drafts(self):return self.page.evaluate("JSON.parse(localStorage.getItem('radar-speech-v5'))")
    def action(self,key):
        before=len(self.calls);self.page.locator(f'.speech-generator [data-speech-action="{key}"]').click()
        self.page.wait_for_function("!document.querySelector('.speech-generator [data-speech-generate]').disabled")
        self.assertEqual(len(self.calls),before+1);self.assertEqual(self.calls[-1]['action'],key)
    def open_saved(self):
        self.page.locator('.speech-generator [data-speech-library]').click();self.page.locator('#speech-drafts-list [data-speech-load]').first.click();return self.page.locator('#speech-draft-body')

    def test_no_model_is_explicit_no_rule_fallback_no_network_or_old_data_write(self):
        p=self.page;before=p.locator('#topic-list .score strong').all_text_contents();kb=p.evaluate("localStorage.getItem('radar-brain-v4')")
        self.assertIn('当前未连接大模型，无法生成高质量口播',p.locator('.speech-generator').inner_text());self.assertTrue(p.locator('[data-speech-generate]').is_disabled())
        self.assertEqual(p.locator('[data-speech-main]').count(),0);self.assertEqual(self.calls,[]);self.assertEqual(p.evaluate("localStorage.getItem('radar-brain-v4')"),kb);self.assertEqual(p.locator('#topic-list .score strong').all_text_contents(),before)

    def test_connection_never_accepts_model_key_and_token_never_persisted(self):
        p=self.page;p.locator('[data-speech-connect]').click();p.locator('#speech-endpoint').fill(self.url+'/llm-test');p.locator('#speech-access-token').fill('sk-TEST_ONLY_NOT_REAL')
        p.locator('#speech-connect-submit').click();p.wait_for_function("document.querySelector('#speech-connect-status').textContent.includes('不是OpenAI')")
        self.assertEqual(self.calls,[]);p.locator('#speech-connect-close').click();self.connect()
        stored=p.evaluate('JSON.stringify(localStorage)');self.assertNotIn('TEST_ONLY_APPLICATION_ACCESS',stored);self.assertNotIn('sk-TEST_ONLY',stored)
        p.reload();p.wait_for_selector('#topic-list .topic-card');self.assertTrue(p.locator('[data-speech-generate]').is_disabled());self.assertEqual(p.locator('[data-speech-main]').count(),0)

    def test_unconfigured_server_health_disables_generation(self):
        self.health_failure=True;p=self.page;p.locator('[data-speech-connect]').click();p.locator('#speech-endpoint').fill(self.url+'/llm-test');p.locator('#speech-access-token').fill('TEST_ONLY_ACCESS_TOKEN_12345');p.locator('#speech-connect-submit').click()
        p.wait_for_function("document.querySelector('#speech-connect-status').textContent.includes('当前未连接大模型')");p.locator('#speech-connect-close').click();self.assertTrue(p.locator('[data-speech-generate]').is_disabled());self.assertEqual(self.calls,[])

    def test_real_provider_request_fulltext_samples_opinions_preferences_risks_only(self):
        p=self.page;self.brain()
        self.strong(title='仅测试A：Vision Pro苹果裁员',fields={'views':'5806000','copy':'仅测试全文首段：Vision Pro苹果裁员。\n仅测试全文末段。'})
        self.strong(title='仅测试B：Vision Pro苹果裁员',fields={'views':'600000','copy':'仅测试第二条完整样稿。'})
        self.strong(kind='opinion',fields={'point':'岗位条件值得先看。'})
        self.strong(kind='opinion',title='仅测试：Vision Pro口播偏好',fields={'point':'科技内容不要只讲技术参数，优先从普通人利益切入。'})
        self.strong(title='仅测试被屏蔽稿',fields={'views':'5806000','status':'removed','copy':'仅测试风险表达：资本早就安排好了。','risk_note':'仅测试状态，无真实处理原因。'})
        before=self.state();self.recommend();self.assertIn('高风险内容相似',p.locator('.speech-generator').inner_text())
        self.generate();r=self.calls[-1];self.assertEqual(len(r['style_works']),2);self.assertIn('全文末段',r['style_works'][0]['text']);self.assertEqual(len(r['opinions']),1);self.assertEqual(len(r['writing_preferences']),1);self.assertEqual(len(r['risk_records']),1);self.assertEqual(self.state(),before)
        p.locator('.speech-materials').evaluate('(e)=>e.open=true');self.assertIn('历史表现 S',p.locator('.speech-materials').inner_text());self.assertNotIn('我以前记过一个观点',self.main().input_value())

    def test_generation_model_only_with_source_and_three_openings_titles(self):
        before=self.page.locator('#topic-list .score strong').all_text_contents();self.generate();self.assertIn('仅测试模型开头',self.main().input_value());self.assertEqual(self.calls[-1]['duration'],60)
        self.assertEqual(self.page.locator('.speech-generator .speech-option').count(),6);self.assertIn('TEST_ONLY_MODEL',self.page.locator('.speech-generator').inner_text());self.assertGreater(self.page.locator('.speech-check[data-check-kind="news"]').count(),0);self.assertEqual(self.page.locator('#topic-list .score strong').all_text_contents(),before)

    def test_fulltext_paste_sent_as_facts_does_not_modify_news_json_or_original_snapshot(self):
        p=self.page;p.locator('.speech-source-input').evaluate('(e)=>e.open=true');p.locator('[data-speech-fulltext]').fill('仅测试：完整原文从第一句到最后一句，不截断。');self.generate()
        self.assertEqual(self.calls[-1]['current_news']['body'],'仅测试：完整原文从第一句到最后一句，不截断。');self.assertEqual(self.calls[-1]['current_news']['fulltext_origin'],'user_paste');self.assertNotIn('body',self.data['news'][0])

    def test_all_edit_buttons_request_model_and_only_opening_preserves_manual_body(self):
        self.generate();self.main().fill(self.main().input_value()+'\n\n手动输入仅测试。');body=self.main().input_value()
        self.action('opening');self.assertEqual(self.main().input_value(),body)
        for action in ['human','conflict','angle','risk']:
            body=self.main().input_value();self.action(action);self.assertEqual(self.calls[-1]['existing_draft'],body);self.assertIn('仅测试模型改稿',self.main().input_value())
        self.page.locator('[data-speech-undo]').click();self.assertNotEqual(self.main().input_value(),body+'\n\n仅测试模型改稿：risk')

    def test_model_failure_keeps_current_unsaved_draft_no_template_fallback(self):
        self.generate();self.main().fill(self.main().input_value()+'\n\n保留手动输入。');before=self.main().input_value();self.failure=True;self.action('human')
        self.assertEqual(self.main().input_value(),before);self.assertIn('旧稿保留',self.page.locator('[data-speech-error]').inner_text());self.assertTrue(self.page.locator('[data-speech-generate]').is_enabled())

    def test_duration_switch_does_not_trigger_paid_request_and_versions_kept(self):
        p=self.page;self.generate();short=self.main().input_value();count=len(self.calls);p.locator('[data-speech-duration]').select_option('90');self.assertEqual(len(self.calls),count);self.assertEqual(p.locator('[data-speech-main]').count(),0)
        self.generate(connect=False);self.assertEqual(self.calls[-1]['duration'],90);p.locator('[data-speech-duration]').select_option('60');self.assertEqual(self.main().input_value(),short)

    def test_manual_risk_marking_model_risk_edit_and_copy(self):
        p=self.page;self.generate();self.main().fill(self.main().input_value()+'\n\n特斯拉出事将负全责。');self.assertIn('负全责','\n'.join(p.locator('.speech-check[data-check-kind="review"]').all_text_contents()));self.action('risk');self.assertNotIn('负全责',self.main().input_value())
        self.context.grant_permissions(['clipboard-read','clipboard-write']);p.locator('[data-speech-copy="main"]').click();self.assertEqual(p.evaluate('navigator.clipboard.readText()'),self.main().input_value())

    def test_draft_refresh_legacy_coexistence_backup_and_archived_news(self):
        p=self.page;self.generate();self.main().fill(self.main().input_value()+'\n\n仅测试保存正文。');text=self.main().input_value();p.locator('[data-speech-save]').click()
        p.evaluate("()=>{const s=JSON.parse(localStorage.getItem('radar-speech-v5')),d=structuredClone(s.drafts[0]);d.id='speech-legacy-test';d.result.version='5.0.0';d.result.provider='rules';d.result.used_materials=[];s.drafts.push(d);localStorage.setItem('radar-speech-v5',JSON.stringify(s));}")
        raw=p.evaluate("localStorage.getItem('radar-speech-v5')");p.reload();p.wait_for_selector('#topic-list .topic-card');self.assertEqual(p.evaluate("localStorage.getItem('radar-speech-v5')"),raw)
        body=self.open_saved();self.assertEqual(body.locator('[data-speech-main]').input_value(),text);self.assertTrue(body.locator('[data-speech-action="human"]').is_disabled());p.locator('[data-speech-load="speech-legacy-test"]').click();self.assertIn('旧版规则草稿',body.inner_text())
        with p.expect_download() as event:p.locator('#speech-drafts-export').click()
        backup=pathlib.Path(event.value.path());p.locator('#speech-drafts-file').set_input_files(str(backup));p.wait_for_function("document.querySelector('#speech-drafts-file').value===''");self.assertEqual(len(self.drafts()['drafts']),2)
        p.locator('#speech-drafts-close').click();self.data['news']=[];p.locator('#reload-news').click();p.wait_for_selector('#reload-news:not([disabled])');self.brain();p.locator('#brain-view [data-speech-library]').click();p.locator('[data-speech-load]').first.click();self.assertIn('保存时的新闻快照',p.locator('#speech-draft-body').inner_text())

    def test_generated_work_records_llm_and_refs_unknown_metrics_edit_compatible(self):
        p=self.page;self.generate();text=self.main().input_value();p.locator('[data-speech-work]').click();self.assertEqual(p.locator('[data-field="copy"]').input_value(),text);self.assertEqual(p.locator('[data-field="views"]').input_value(),'');self.assertEqual(p.locator('[data-field="published"]').input_value(),'')
        p.locator('#brain-form [type="submit"]').click();self.brain();m=self.state()['materials'][0];self.assertEqual(m['generation']['provider'],'openai');self.assertEqual(m['generation']['version'],'5.1.0');self.assertIsNone(m['fields']['views']);self.assertIn('OpenAI模型',p.locator('#brain-material-detail').inner_text())
        old=m['generation'];p.locator('#brain-material-detail [data-brain-edit]').click();p.locator('#brain-extra').evaluate('(e)=>e.open=true');p.locator('[data-field="views"]').fill('5806000');p.locator('#brain-form [type="submit"]').click();self.assertEqual(self.state()['materials'][0]['generation'],old)

    def test_corrupt_store_quota_and_bad_backup_preserve_old_data_and_input(self):
        p=self.page;p.evaluate("localStorage.setItem('radar-speech-v5','broken-private-TEST')");p.reload();p.wait_for_selector('#topic-list .topic-card');self.generate();text=self.main().input_value();p.locator('[data-speech-save]').click();self.assertEqual(self.main().input_value(),text);self.assertEqual(p.evaluate("localStorage.getItem('radar-speech-v5')"),'broken-private-TEST')
        p.evaluate("localStorage.setItem('radar-speech-v5',JSON.stringify({schema_version:1,drafts:[]}))");p.reload();p.wait_for_selector('#topic-list .topic-card');self.generate();p.evaluate("()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='radar-speech-v5')throw new DOMException('quota','QuotaExceededError');return set.call(this,k,v)}}")
        text=self.main().input_value();p.locator('[data-speech-save]').click();self.assertEqual(self.main().input_value(),text);self.assertEqual(self.drafts()['drafts'],[]);self.assertIn('空间不足',p.locator('[data-speech-error]').inner_text())
        p.locator('.speech-generator [data-speech-library]').click();p.locator('#speech-drafts-file').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{"schema_version":99}'});p.wait_for_function("document.querySelector('#speech-drafts-status').textContent.includes('导入未完成')");self.assertEqual(self.drafts()['drafts'],[])

    def test_first_model_failure_produces_no_output_and_no_rule_fallback(self):
        self.connect();self.failure=True;self.page.locator('[data-speech-generate]').click();self.page.wait_for_function("document.querySelector('[data-speech-error]').textContent.includes('旧稿保留')")
        self.assertEqual(self.page.locator('[data-speech-main]').count(),0);self.assertIsNone(self.drafts());self.assertTrue(self.page.locator('[data-speech-generate]').is_enabled())

    def test_concurrent_save_rejects_overwrite_and_keeps_current_input(self):
        p=self.page;self.generate();p.locator('[data-speech-save]').click();p.evaluate("()=>{const s=JSON.parse(localStorage.getItem('radar-speech-v5'));s.drafts[0].updated_at='2026-10-10T01:59:00Z';s.drafts[0].result.main='仅测试其他窗口正文';localStorage.setItem('radar-speech-v5',JSON.stringify(s))}")
        self.main().fill(self.main().input_value()+'\n\n保留当前未保存稿。');text=self.main().input_value();p.locator('[data-speech-save]').click();self.assertEqual(self.main().input_value(),text);self.assertIn('另一窗口',p.locator('[data-speech-error]').inner_text());self.assertEqual(self.drafts()['drafts'][0]['result']['main'],'仅测试其他窗口正文')

    def test_pending_model_request_survives_tab_navigation_and_prevents_lost_edits(self):
        p=self.page;self.generate();self.hold=True;p.locator('[data-speech-action="human"]').click();self.assertIsNotNone(self.pending)
        p.locator('.tab[data-tab="titles"]').click();p.locator('.tab[data-tab="overview"]').click();self.assertTrue(self.main().is_disabled());self.assertTrue(p.locator('[data-speech-generate]').is_disabled())
        self.hold=False;self.provider(self.pending);p.wait_for_function("!document.querySelector('[data-speech-generate]').disabled");self.assertTrue(self.main().is_enabled());self.assertIn('仅测试模型改稿',self.main().input_value())

    def test_mobile_connection_generation_edits_drafts_backflow_no_horizontal_overflow(self):
        p=self.page;p.set_viewport_size({'width':390,'height':844});self.generate();self.assertTrue(p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        for action in ['opening','human','conflict','angle','risk']:self.action(action)
        p.locator('[data-speech-save]').click();body=self.open_saved();self.assertTrue(p.evaluate('document.documentElement.scrollWidth<=innerWidth'));body.locator('[data-speech-work]').click();self.assertTrue(p.locator('#brain-dialog').is_visible());self.assertTrue(p.evaluate('document.documentElement.scrollWidth<=innerWidth'))

if __name__=='__main__':unittest.main(verbosity=2)
