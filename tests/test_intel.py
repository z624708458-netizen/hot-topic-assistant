"""V6 browser contract; vendor/model data is isolated TEST ONLY. SQLite API tested in Node."""
import json
import unittest
import test_demo as base

class IntelTest(unittest.TestCase):
    setUpClass=classmethod(base.DemoTest.setUpClass.__func__)
    tearDownClass=classmethod(base.DemoTest.tearDownClass.__func__)
    tearDown=base.DemoTest.tearDown

    def setUp(self):
        base.DemoTest.setUp(self)
        self.config=self.page.evaluate('RadarIntel.defaults()');self.authors=[];self.topics=[];self.calls=[];self.model=False;self.database=True;self.collected=False;self.failed=False
        self.page.route('**/v6-test/intel/**',self.provider)
        self.page.locator('.nav[data-view="viral"]').click()

    def fixture(self):
        now=base.dt.datetime.now(base.UTC).isoformat()
        def item(i,views,ratio):
            return {'id':'douyin:TEST'+str(i),'platform':'douyin','platform_id':'TEST'+str(i),'title':'仅测试：AI裁员与程序员就业 '+str(i),'description':'仅测试文本，不是真实自媒体作品。这段文字讨论职场变化和普通人收入，仅用于软件验收。','url':'https://www.douyin.com/video/TEST_ONLY_'+str(i),'published':now,'expires_at':now,'author':{'id':'TEST_AUTHOR','name':'仅测试作者，非真实博主','homepage':None,'followers':None},'metrics':{'views':views,'likes':100,'comments':None,'saves':None,'shares':None},'source':{'kind':'socialdatax','tool':'TEST_ONLY_MOCK','fetched_at':now,'available_fields':['title','views']},'score':{'total':72 if views else 30,'available':100 if views else 40,'grade':'B' if views else None,'ratio_label':'超级异常表现' if ratio else '无法评估','baseline':{'median':20000 if ratio else None,'count':20 if ratio else 0,'multiplier':ratio,'label':'仅测试历史样本'},'parts':[{'name':'相对历史表现','points':20 if ratio else None,'max':20}],'domains':['科技AI']},'raw':{'TEST_ONLY':True}}
        return [item(1,200000,10),item(2,None,None)] if self.collected else []

    def provider(self,route):
        path=route.request.url.split('/intel/')[-1];body=route.request.post_data_json if route.request.method=='POST' else None
        self.calls.append((path,body))
        if path=='status':route.fulfill(json={'version':'6.0.0','database_bound':self.database,'source':{'configured':False,'message':'尚未开通SocialDataX（仅测试）'},'model':{'configured':self.model,'provider':'deepseek'},'automation_enabled':False});return
        if path=='settings':
            if body:self.config=body['settings']
            route.fulfill(json={'settings':self.config});return
        if path=='works':route.fulfill(json={'works':self.fixture()});return
        if path=='authors':
            if body:
                if body.get('action')=='delete':self.authors=[a for a in self.authors if a['id']!=body['id']]
                else:
                    a=body['author'];a['id']=a.get('id') or 'manual:TEST'+str(len(self.authors));self.authors=[x for x in self.authors if x['id']!=a['id']]+[a]
            route.fulfill(json={'authors':self.authors});return
        if path=='topics':
            if body:
                t=body['topic'];t['id']=t.get('id') or 'topic:TEST'+str(len(self.topics));self.topics=[x for x in self.topics if x['id']!=t['id']]+[t]
            route.fulfill(json={'topics':self.topics});return
        if path=='trends':route.fulfill(json={'rules':[],'semantic':[]});return
        if path=='usage':route.fulfill(json={'usage':[],'logs':[]});return
        if path=='report':route.fulfill(json={'day':'TEST_DAY','topics':[],'count':0,'message':'暂无足够优质数据，不凑数'});return
        if path=='collect':
            if self.failed:route.fulfill(status=503,json={'error':'仅测试权限不足，原结果保留'});return
            self.collected=True;route.fulfill(json={'count':2,'skipped':0,'next_page_token':'TEST_OPAQUE_CURSOR' if not body.get('cursor') else '', 'message':'仅测试本页，不是真实采集','cache_hit':False});return
        if path=='script':
            route.fulfill(json={'provider':'deepseek','output':{'main':'仅测试独立原创口播稿，不是真实模型质量验收。','core_view':'仅测试判断','openings':['仅测试冲突','仅测试利益','仅测试反差'],'titles':['仅测试标题甲','仅测试标题乙','仅测试标题丙'],'needs_verification':['仅测试核实事实'],'source_ids':['douyin:TEST1']},'source_works':[{'id':'douyin:TEST1','title':'仅测试作品','url':'https://www.douyin.com/video/TEST_ONLY_1'}]});return
        if path=='enrich':route.fulfill(json={'job':{'job_id':'TEST_JOB'},'message':'仅测试转写待完成，不重复提交'});return
        if path=='export':route.fulfill(json={'schema_version':1,'settings':self.config,'authors':self.authors,'works':self.fixture(),'topics':self.topics});return
        if path=='import':route.fulfill(json={'imported':True});return
        route.fulfill(status=503,json={'error':'TEST ONLY 模型未连接'})

    def settings_page(self):self.page.locator('.nav[data-view="intel-settings"]').click()
    def connect(self):
        self.settings_page();p=self.page;p.locator('#intel-endpoint').fill(self.url+'/v6-test');p.locator('#intel-access').fill('TEST_ONLY_APP_ACCESS_CODE_123456');p.locator('#intel-connect-form [type="submit"]').click();p.wait_for_function("!document.querySelector('#intel-connect-form [type=submit]').disabled")
    def collect(self):
        self.connect();p=self.page;p.locator('#intel-keyword').fill('AI裁员');p.locator('#intel-search-form [type="submit"]').click();p.wait_for_function("document.querySelector('#intel-collect-status').textContent.includes('本页2条')")

    def test_default_home_is_v6_and_unconnected_has_no_fake_data_or_paid_requests(self):
        p=self.page;p.goto(self.url);self.assertTrue(p.locator('#viral-view').is_visible());self.assertIn('没有真实采集',p.locator('#intel-home-status').inner_text());self.assertEqual(self.calls,[]);self.assertEqual(p.locator('#intel-work-list .intel-card').count(),0)
        p.locator('.nav[data-view="recommend"]').click();self.assertTrue(p.locator('#recommend-view').is_visible());self.assertEqual(p.locator('#topic-list .topic-card').count(),5)

    def test_missing_database_clearly_blocks_connection_and_api_key_is_not_accepted(self):
        self.database=False;self.connect();p=self.page;self.assertIn('数据库尚未绑定',p.locator('#intel-connect-status').inner_text());self.assertTrue(p.locator('#intel-enabled').is_disabled())
        p.locator('#intel-access').fill('sk-TEST_ONLY_FAKE');before=len(self.calls);p.locator('#intel-connect-form [type="submit"]').click();self.assertIn('不能输入模型API Key',p.locator('#intel-connect-status').inner_text());self.assertEqual(len(self.calls),before)

    def test_connected_real_contract_cards_preserve_missing_metrics_ratios_and_source_evidence(self):
        self.collect();p=self.page;p.locator('.nav[data-view="viral"]').click();cards=p.locator('#intel-work-list .intel-card');self.assertEqual(cards.count(),2);self.assertIn('10.00×',cards.first.inner_text());self.assertIn('播放 暂无数据',cards.last.inner_text());self.assertIn('无法评估',cards.last.inner_text())
        cards.first.locator('[data-intel-work]').first.click();detail=p.locator('#intel-research-detail');self.assertIn('粉丝：暂无数据',detail.inner_text());self.assertIn('标题/描述不冒充完整字幕',detail.inner_text());self.assertIn('暂无真实评论内容',detail.inner_text());self.assertIn('SocialDataX（第三方',detail.inner_text());self.assertTrue(detail.locator('[data-intel-action="script"]').is_disabled());self.assertTrue(detail.locator('[data-intel-action="analyze"]').is_disabled());self.assertIn('未连接大模型',detail.inner_text())

    def test_keyword_settings_edit_and_opaque_cursor_continuation(self):
        self.connect();p=self.page;p.locator('[data-intel-keywords="科技AI"]').fill('人工智能\n仅测试新增关键词');p.locator('#intel-daily').fill('12');p.locator('#intel-config-form [type="submit"]').click();p.wait_for_timeout(100);self.assertEqual(self.config['daily_limit'],12);self.assertIn('仅测试新增关键词',self.config['keywords']['科技AI'])
        p.locator('#intel-keyword').fill('AI裁员');p.locator('#intel-search-form [type="submit"]').click();p.wait_for_function("!document.querySelector('#intel-next-page').disabled");p.locator('#intel-next-page').click();p.wait_for_function("document.querySelector('#intel-next-page').disabled");queries=[body for path,body in self.calls if path=='collect'];self.assertEqual(queries[1]['cursor'],'TEST_OPAQUE_CURSOR');self.assertNotIn('page',queries[1])

    def test_author_add_pause_resume_and_delete_are_explicit_management_not_fake_monitoring(self):
        self.connect();p=self.page;p.locator('.nav[data-view="creators"]').click();p.locator('#intel-author-add').click();p.locator('#intel-author-name').fill('仅测试手动作者');p.locator('#intel-author-domains').fill('职场，科技');p.locator('#intel-author-form [type="submit"]').click();p.wait_for_selector('[data-intel-author-pause]');self.assertIn('粉丝：暂无数据',p.locator('#intel-author-list').inner_text());self.assertTrue(p.locator('[data-intel-author-collect]').is_disabled());self.assertEqual(self.authors[0]['platform_id'],None)
        p.locator('[data-intel-author-pause]').click();p.wait_for_function("document.querySelector('[data-intel-author-pause]').textContent.includes('恢复')");self.assertTrue(self.authors[0]['paused']);p.locator('[data-intel-author-pause]').click();p.wait_for_function("document.querySelector('[data-intel-author-pause]').textContent.includes('暂停')");p.locator('[data-intel-author-delete]').click();p.wait_for_function("!document.querySelector('[data-intel-author-delete]')");self.assertEqual(self.authors,[])

    def test_library_publication_metrics_and_old_private_data_are_preserved(self):
        p=self.page;p.evaluate("localStorage.setItem('radar-brain-v4',JSON.stringify(RadarBrain.defaultState()));localStorage.setItem('radar-speech-v5',JSON.stringify({schema_version:1,drafts:[]}))")
        before=p.evaluate("JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k])=>k!=='radar-intel-connection-v1')))");self.collect();p.locator('.nav[data-view="viral"]').click();p.locator('#intel-work-list [data-intel-save]').first.click();p.wait_for_timeout(100);p.locator('.nav[data-view="library"]').click();p.locator('[data-intel-topic-status]').select_option('已发布');p.locator('[data-intel-topic-notes]').fill('仅测试自己的原创稿与复盘');p.locator('[data-intel-topic-metric="views"]').fill('5806000');p.locator('[data-intel-topic-save]').click();p.wait_for_timeout(100);self.assertEqual(self.topics[0]['published_metrics']['views'],5806000);self.assertEqual(self.topics[0]['published_metrics']['likes'],None)
        after=p.evaluate("JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k])=>k!=='radar-intel-connection-v1')))");self.assertEqual(json.loads(before),json.loads(after));self.assertNotIn('TEST_ONLY_APP_ACCESS',p.evaluate('JSON.stringify(localStorage)'))

    def test_model_script_three_openings_titles_sources_and_save_without_replacing_v5_drafts(self):
        self.model=True;self.collect();p=self.page;p.locator('.nav[data-view="viral"]').click();p.locator('#intel-work-list [data-intel-work]').first.click();p.locator('[data-intel-action="script"]').click();p.wait_for_selector('#intel-script-text');self.assertIn('仅测试独立原创口播稿',p.locator('#intel-script-text').input_value());self.assertIn('不同开头 × 3',p.locator('#intel-research-detail').inner_text());p.locator('#intel-script-text').fill('仅测试我手改后的原创稿。');p.locator('#intel-script-save').click();p.wait_for_timeout(100);self.assertEqual(self.topics[0]['notes'],'仅测试我手改后的原创稿。');self.assertIsNone(p.evaluate("localStorage.getItem('radar-speech-v5')"))

    def test_failed_collection_preserves_older_evidence_and_no_mock_success(self):
        self.collect();self.failed=True;p=self.page;p.locator('#intel-search-form [type="submit"]').click();p.wait_for_function("document.querySelector('#intel-settings-error').textContent.includes('权限不足')");p.locator('.nav[data-view="viral"]').click();self.assertEqual(p.locator('#intel-work-list .intel-card').count(),2)

    def test_mobile_390px_and_desktop_no_horizontal_page_overflow(self):
        self.collect();p=self.page;p.set_viewport_size({'width':390,'height':844});p.locator('.nav[data-view="viral"]').click();self.assertTrue(p.evaluate('document.documentElement.scrollWidth<=innerWidth'));p.locator('#intel-work-list [data-intel-work]').first.click();self.assertTrue(p.evaluate('document.documentElement.scrollWidth<=innerWidth'));p.screenshot(path='/tmp/v6-mobile.png',full_page=True)
        self.settings_page();self.assertTrue(p.evaluate('document.documentElement.scrollWidth<=innerWidth'));p.set_viewport_size({'width':1440,'height':1050});self.assertTrue(p.evaluate('document.documentElement.scrollWidth<=innerWidth'));p.screenshot(path='/tmp/v6-desktop.png',full_page=True)

if __name__=='__main__':unittest.main(verbosity=2)
