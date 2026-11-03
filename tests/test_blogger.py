"""Blogger V1 browser acceptance. All official/model replies are TEST ONLY mocks."""
import json
import unittest
import test_demo as base

class BloggerTest(unittest.TestCase):
    setUpClass=classmethod(base.DemoTest.setUpClass.__func__)
    tearDownClass=classmethod(base.DemoTest.tearDownClass.__func__)
    tearDown=base.DemoTest.tearDown

    def setUp(self):
        base.DemoTest.setUp(self)
        self.configured=False;self.calls=[];self.analyses=[];self.discovery_failure=False;self.malformed=False
        self.page.route('**/blogger-test/**',self.provider)
        self.page.locator('.nav[data-view="blogger"]').click()

    def provider(self,route):
        path=route.request.url.split('/blogger-test')[-1];self.calls.append(path)
        if path=='/douyin/status':
            route.fulfill(json={'provider':'douyin_official','configured':self.configured,'authorization_verified':False,'message':'TEST ONLY 已登记配置，未独立验证' if self.configured else '尚未开通抖音权限（仅测试）','capabilities':{'hot_videos':{'configured':self.configured,'scope':'data.external.billboard_hot_video'},'hot_words':{'configured':False,'message':'尚未启用'},'video_search':{'configured':False,'message':'尚未启用'}}});return
        if path=='/douyin/discover':
            if not self.configured or self.discovery_failure:route.fulfill(status=503,json={'message':'尚未授权或服务失败（仅测试）','works':[],'candidates':[]});return
            now=base.dt.datetime.now(base.UTC).isoformat()
            def work(i,author,title):
                return {'id':'TEST_WORK_'+str(i),'title':title,'url':'https://www.douyin.com/video/TEST_ONLY_'+str(i),'cover':None,'published':now if i<3 else None,'metrics':{'views':None,'likes':100 if i<3 else None,'comments':10 if i<3 else None,'shares':None},'keywords':['就业','人口'] if i<3 else ['职场'],'author':author,'source':{'name':'仅测试模拟官方接口，非真实账号','api':'/data/extern/billboard/hot_video/','scope':'data.external.billboard_hot_video','fetched_at':now,'window':'last_24h_offline','available_fields':['title','author','digg_count']}}
            author={'platform_id':'TEST_AUTHOR','nickname':'仅测试候选，不是真实博主','avatar':None}
            works=[work(1,author,'仅测试：就业工资与人口养老'),work(2,author,'仅测试：职场双休和人口退休'),work(3,{'platform_id':None,'nickname':'仅测试低可信作者','avatar':None},'仅测试：职场加班')]
            if self.malformed:works[0]['metrics'].pop('views')
            route.fulfill(json={'status':'ok','message':'仅测试24小时离线榜单，不是实时','works':works,'fetched_at':now});return
        if path=='/health':route.fulfill(json={'backend_ready':True,'configured':True,'access_verified':True,'provider':'openai','model':'TEST_ONLY_MODEL'});return
        if path=='/blogger/analyze':
            self.analyses.append(route.request.post_data_json)
            route.fulfill(json={'provider':'openai','model':'TEST_ONLY_MODEL','output':{'opening':'仅测试：从提问进入就业问题。','viewpoint':'仅测试核心观点。','structure':'仅测试：问题、例子、判断。','emotion':'仅测试文本情绪，不推断声音表演。','controversy':'仅测试，事实有待核实。','audience':'仅测试普通人工资利益。','inspiration':'仅测试借鉴结构，不复制文案。','comment_needs':'暂无真实评论数据，无法分析评论区需求','limitations':'仅基于粘贴文本，不能替代观看原视频或事实核查。'}});return
        route.abort()

    def connect(self):
        p=self.page;p.locator('#blogger-connect-form').evaluate('(e)=>e.parentElement.open=true')
        p.locator('#blogger-endpoint').fill(self.url+'/blogger-test')
        p.locator('#blogger-access-token').fill('TEST_ONLY_APP_ACCESS_TOKEN_123456')
        p.locator('#blogger-connect-form [type="submit"]').click()
        p.wait_for_function("!document.querySelector('#blogger-connect-form [type=submit]').disabled")

    def discover(self):
        self.configured=True;self.connect();self.page.locator('#blogger-discover').click();self.page.wait_for_selector('.blogger-card')

    def following(self):self.page.locator('[data-blogger-tab="following"]').click()
    def state(self):return self.page.evaluate("JSON.parse(localStorage.getItem('radar-blogger-v1'))")

    def add_manual(self,name='仅测试手动博主'):
        p=self.page;p.locator('#blogger-add').click();p.locator('#blogger-name').fill(name);p.locator('#blogger-editor-domains input[value="就业"]').check();p.locator('#blogger-editor-form [type="submit"]').click();self.following()

    def add_work(self):
        p=self.page;p.locator('[data-blogger-add-work]').click();p.locator('#blogger-work-url').fill('https://www.douyin.com/video/TEST_MANUAL')
        p.locator('#blogger-work-name').fill('仅测试手动引用')
        p.locator('#blogger-work-note').fill('仅测试的用户粘贴文字，普通人关心就业、工资和职场。这段文本只用于软件验收，不是真实博主文案。')
        p.locator('#blogger-work-form [type="submit"]').click()

    def test_unconfigured_explicit_no_fake_candidates_or_model_and_no_requests_until_clicked(self):
        p=self.page;self.assertIn('暂无候选',p.locator('#blogger-list').inner_text());self.assertEqual(self.calls,[])
        p.locator('#blogger-discover').click();self.assertIn('填写Worker地址',p.locator('#blogger-error').inner_text());self.assertEqual(self.calls,[])
        self.connect();self.assertIn('尚未开通',p.locator('#blogger-source-message').inner_text());p.locator('#blogger-discover').click();p.wait_for_function("!document.querySelector('#blogger-discover').disabled")
        self.assertEqual(p.locator('.blogger-card').count(),0);self.assertIn('尚未授权',p.locator('#blogger-error').inner_text())

    def test_real_response_contract_dedup_multidomain_missing_values_links_and_confidence(self):
        self.discover();p=self.page;self.assertEqual(p.locator('.blogger-card').count(),2);self.assertIn('2 位 / 最多30位',p.locator('#blogger-caption').inner_text())
        card=p.locator('.blogger-card').first;self.assertIn('就业',card.inner_text());self.assertIn('人口',card.inner_text());self.assertIn('播放 暂无数据',card.inner_text())
        card.locator('[data-blogger-show]').first.click();detail=p.locator('#blogger-detail');self.assertEqual(detail.locator('.blogger-work').count(),2);self.assertIn('主页：暂无数据',detail.inner_text())
        self.assertEqual(detail.locator('a[href*="/user/"]').count(),0);self.assertIn('发布时间',detail.inner_text());self.assertIn('实际返回字段',detail.inner_text())
        detail.locator('.blogger-analysis').first.evaluate('(e)=>e.open=true');self.assertEqual(detail.locator('[data-blogger-analyze]:enabled').count(),0);self.assertIn('尚未连接模型',detail.inner_text());self.assertIn('没有真实评论接口',detail.inner_text())
        p.locator('.blogger-card').last.locator('[data-blogger-show]').first.click();detail.locator('.blogger-evidence').evaluate('(e)=>e.open=true');self.assertIn('缺少稳定ID或头像',detail.inner_text());self.assertIn('无法评估',detail.inner_text())

    def test_follow_ignore_restore_unfollow_domain_and_no_platform_snapshot_in_storage(self):
        self.discover();p=self.page;p.locator('.blogger-card').first.locator('[data-blogger-action="follow"]').click();self.following();self.assertEqual(p.locator('.blogger-card').count(),1)
        saved=self.state()['authors'][0];self.assertEqual(saved['works'],[]);self.assertNotIn('metrics',saved);self.assertNotIn('avatar',saved)
        p.locator('#blogger-domain').select_option('社会热点');self.assertEqual(p.locator('.blogger-card').count(),0);p.locator('#blogger-domain').select_option('all')
        p.locator('[data-blogger-action="ignore"]').click();p.locator('[data-blogger-tab="ignored"]').click();self.assertEqual(p.locator('.blogger-card').count(),1)
        p.locator('[data-blogger-action="restore"]').click();self.assertEqual(p.locator('.blogger-card').count(),0)
        p.locator('[data-blogger-tab="today"]').click();p.locator('.blogger-card').first.locator('[data-blogger-action="follow"]').click();self.following();p.locator('[data-blogger-action="unfollow"]').click();self.assertEqual(p.locator('.blogger-card').count(),0)
        self.assertNotIn('TEST_ONLY_APP_ACCESS_TOKEN',json.dumps(self.state()))

    def test_manual_author_homepage_and_work_reference_persist_without_scraping(self):
        self.add_manual();p=self.page;self.assertIn('暂无数据',p.locator('.blogger-card').inner_text());self.assertIn('主页：暂无数据',p.locator('#blogger-detail').inner_text());self.add_work()
        self.assertEqual(self.calls,[]);self.assertEqual(self.state()['authors'][0]['works'][0]['origin'],'manual')
        p.locator('#blogger-detail [data-blogger-edit]').click();p.locator('#blogger-homepage').fill('https://www.douyin.com/user/TEST_MANUAL');p.locator('#blogger-editor-form [type="submit"]').click()
        raw=self.state();p.reload();p.locator('.nav[data-view="blogger"]').click();self.assertEqual(self.state(),raw);p.locator('[data-blogger-show]').first.click();self.assertIn('仅测试手动引用',p.locator('#blogger-detail').inner_text());self.assertEqual(self.calls,[])

    def test_export_import_dedup_invalid_import_and_original_storage_untouched(self):
        p=self.page;p.evaluate("localStorage.setItem('radar-brain-v4',JSON.stringify(RadarBrain.defaultState()));localStorage.setItem('radar-speech-v5',JSON.stringify({schema_version:1,drafts:[]}))")
        before=p.evaluate("JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k])=>k!=='radar-blogger-v1')))")
        self.add_manual();self.add_work()
        with p.expect_download() as info:p.locator('#blogger-export').click()
        data=json.loads(info.value.path().read_text()) if hasattr(info.value.path(),'read_text') else json.loads(open(info.value.path()).read())
        self.assertEqual(data,self.state());p.locator('#blogger-import-file').set_input_files({'name':'TEST.json','mimeType':'application/json','buffer':json.dumps(data).encode()});p.wait_for_function("document.querySelector('#blogger-error').textContent.includes('导入完成')")
        self.assertEqual(len(self.state()['authors']),1);self.assertEqual(len(self.state()['authors'][0]['works']),1);raw=self.state()
        p.locator('#blogger-import-file').set_input_files({'name':'BAD.json','mimeType':'application/json','buffer':b'{"schema_version":999}'});p.wait_for_function("document.querySelector('#blogger-error').textContent.includes('原数据保留')");self.assertEqual(self.state(),raw)
        after=p.evaluate("JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k])=>k!=='radar-blogger-v1')))");self.assertEqual(json.loads(before),json.loads(after))

    def test_corrupt_data_preserved_until_explicit_backup_restore(self):
        p=self.page;p.evaluate("localStorage.setItem('radar-blogger-v1','BROKEN_TEST_ONLY')");p.reload();p.locator('.nav[data-view="blogger"]').click();self.assertIn('已损坏',p.locator('#blogger-error').inner_text());self.assertTrue(p.locator('#blogger-add').is_disabled());self.assertEqual(p.evaluate("localStorage.getItem('radar-blogger-v1')"),'BROKEN_TEST_ONLY')
        backup={'schema_version':1,'authors':[],'filters':{'tab':'following','domain':'all','endpoint':''}}
        p.locator('#blogger-restore').check();p.once('dialog',lambda d:d.accept());p.locator('#blogger-import-file').set_input_files({'name':'restore.json','mimeType':'application/json','buffer':json.dumps(backup).encode()});p.wait_for_function("document.querySelector('#blogger-error').textContent.includes('导入完成')");self.assertEqual(self.state(),backup)

    def test_model_connected_analysis_uses_text_only_and_no_invented_comments(self):
        self.add_manual();self.add_work();p=self.page;p.locator('.blogger-analysis').evaluate('(e)=>e.open=true');p.locator('#blogger-detail [data-speech-connect]').click();p.locator('#speech-endpoint').fill(self.url+'/blogger-test');p.locator('#speech-access-token').fill('TEST_ONLY_MODEL_APP_TOKEN_123456');p.locator('#speech-connect-submit').click();p.wait_for_function("!document.querySelector('#speech-connect-dialog').open")
        p.locator('.blogger-analysis').evaluate('(e)=>e.open=true');p.locator('[data-blogger-analyze]').click();p.wait_for_function("document.querySelector('[data-blogger-analysis-result]').textContent.includes('仅测试：从提问')");self.assertEqual(len(self.analyses),1);self.assertEqual(self.analyses[0]['work']['text_source'],'user_paste');self.assertNotIn('comments',self.analyses[0]);self.assertIn('暂无真实评论数据',p.locator('[data-blogger-analysis-result]').inner_text())

    def test_failed_refresh_preserves_prior_timestamp_and_session_works_not_cached_on_reload(self):
        self.discover();p=self.page;before=p.locator('#blogger-updated').inner_text();self.discovery_failure=True;p.locator('#blogger-discover').click();p.wait_for_function("!document.querySelector('#blogger-discover').disabled");self.assertEqual(p.locator('.blogger-card').count(),2);self.assertEqual(p.locator('#blogger-updated').inner_text(),before)
        p.reload();p.locator('.nav[data-view="blogger"]').click();self.assertEqual(p.locator('.blogger-card').count(),0)

    def test_390px_manual_flow_and_official_detail_no_horizontal_overflow_or_xss(self):
        p=self.page;p.set_viewport_size({'width':390,'height':844});self.add_manual('<img src=x onerror="window.BLOGGER_XSS=1">');self.add_work();self.assertIsNone(p.evaluate('window.BLOGGER_XSS'));self.assertTrue(p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        self.discover();p.locator('[data-blogger-tab="today"]').click();p.locator('.blogger-card').first.locator('[data-blogger-show]').first.click();p.locator('.blogger-analysis').first.evaluate('(e)=>e.open=true');self.assertTrue(p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        p.screenshot(path='/tmp/blogger-mobile.png',full_page=True)

    def test_malformed_success_does_not_replace_previous_candidates_with_nan(self):
        self.discover();p=self.page;before=p.locator('#blogger-list').inner_text();self.malformed=True
        p.locator('#blogger-discover').click();p.wait_for_function("!document.querySelector('#blogger-discover').disabled")
        self.assertEqual(p.locator('#blogger-list').inner_text(),before);self.assertIn('字段不完整',p.locator('#blogger-error').inner_text());self.assertNotIn('NaN',p.locator('#blogger-list').inner_text())

if __name__=='__main__':unittest.main(verbosity=2)
