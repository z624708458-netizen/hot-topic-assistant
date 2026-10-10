"""V4.1 Chromium acceptance. All personal material and news are isolated TEST ONLY."""
import json
import pathlib
import unittest
import test_brain as v4
import test_demo as base

class Brain41Test(unittest.TestCase):
    setUpClass=classmethod(base.DemoTest.setUpClass.__func__)
    tearDownClass=classmethod(base.DemoTest.tearDownClass.__func__)
    tearDown=base.DemoTest.tearDown
    brain=v4.BrainTest.brain
    state=v4.BrainTest.state
    add=v4.BrainTest.add

    def setUp(self):
        base.DemoTest.setUp(self)
        n=self.data['news'][0]
        n.update(title='仅测试：苹果 Vision Pro 团队裁员，员工岗位调整',company='苹果',companies=['苹果'],summary='仅测试夹具，并非真实新闻。')
        self.data['news']=[n]
        self.page.reload();self.page.wait_for_selector('[data-select="test-0"]')

    def recommend(self):
        self.page.locator('.nav[data-view="recommend"]').click()
        self.page.locator('[data-select="test-0"]').first.click()

    def strong(self,title='仅测试：Vision Pro 团队裁员复盘',fields=None,kind='work'):
        self.add(kind=kind,title=title,body='仅测试：苹果 Vision Pro 团队裁员，员工岗位调整。',tags='苹果，Vision Pro',fields=fields)

    def test_relevance_performance_history_and_best_personal_contribution(self):
        p=self.page;before=p.locator('#topic-list .score strong').all_text_contents();self.brain()
        self.strong(fields={'views':'5806000','likes':'13000','comments':'686','saves':'1177'})
        self.strong(title='仅测试：Vision Pro 裁员普通作品',fields={'views':'12000'})
        self.add(kind='work',title='仅测试：苹果智能家居',body='',tags='苹果',fields={'views':'5806000'})
        self.recommend()
        self.assertTrue(p.locator('.personal-fit-score').inner_text().startswith('30 /'))
        self.assertEqual(p.locator('.brain-related .brain-match').count(),3)
        self.assertEqual(p.locator('.brain-history-item').count(),2)
        self.assertIn('580.6 万',p.locator('.brain-history').inner_text())
        self.assertIn('13,000',p.locator('.brain-history').inner_text())
        self.assertIn('100 / 100 · 强相关',p.locator('.brain-history').inner_text())
        self.assertIn('历史表现：S',p.locator('.brain-history').inner_text())
        self.assertIn('历史表现：C',p.locator('.brain-history').inner_text())
        weak=p.locator('.brain-related .brain-match').filter(has_text='苹果智能家居')
        self.assertIn('25 / 100',weak.inner_text());self.assertIn('不参与个人加分',weak.inner_text())
        self.assertEqual(p.locator('#topic-list .score strong').all_text_contents(),before)
        self.assertIn('不代表未来播放量预测',p.locator('.personal-fit').inner_text())

    def test_click_score_accessible_calculation_shows_actual_selected_material(self):
        p=self.page;self.brain();self.strong(fields={'views':'12000'})
        self.recommend();score=p.locator('[data-brain-score]');score.click()
        self.assertTrue(p.locator('#brain-calculations').get_attribute('open') is not None)
        self.assertEqual(score.get_attribute('aria-expanded'),'true')
        detail=p.locator('.brain-calculation').first
        self.assertIn('相关性 100/100 × 价值权重 0.5 × 类型上限 20 = 10 分',detail.inner_text())
        self.assertIn('具体产品 / 项目：+25',detail.inner_text())
        self.assertIn('历史表现：C',detail.inner_text())
        detail.locator('[data-brain-jump]').click();self.assertTrue(p.locator('#brain-view').is_visible())
        self.assertIn('Vision Pro',p.locator('#brain-material-detail h2').inner_text())

    def test_old_storage_untouched_default_status_and_grade_without_reentry(self):
        p=self.page;old={'schema_version':1,'profile':{'companies':['苹果'],'domains':[]},'materials':[{'id':'kb-legacy','type':'work','title':'仅测试：Vision Pro 裁员','body':'仅测试苹果 Vision Pro 员工裁员','fields':{'views':5806000,'likes':13000,'comments':686,'saves':1177},'tags':['苹果','Vision Pro'],'created_at':'2026-10-10T00:00:00Z','updated_at':'2026-10-10T00:00:00Z'}]}
        raw=json.dumps(old,ensure_ascii=False)
        p.evaluate('(s)=>localStorage.setItem("radar-brain-v4",s)',raw);p.reload();p.wait_for_selector('.personal-fit')
        self.assertEqual(p.evaluate("localStorage.getItem('radar-brain-v4')"),raw)
        self.brain();self.assertIn('S · 正常',p.locator('.brain-material-card').inner_text())
        p.locator('#brain-material-detail [data-brain-edit]').click();p.locator('#brain-extra').evaluate('(e)=>e.open=true')
        self.assertEqual(p.locator('[data-field="status"]').input_value(),'normal')
        p.locator('#brain-close').click();self.assertEqual(p.evaluate("localStorage.getItem('radar-brain-v4')"),raw)
        self.assertIn('历史表现：S',p.locator('#brain-material-detail').inner_text())

    def test_status_risk_edit_persistence_and_no_invented_platform_reason(self):
        p=self.page;self.brain()
        self.strong(fields={'views':'5806000','status':'removed','risk_note':'仅测试：平台未告知原因 <img src=x onerror="window.BAD=1">'})
        self.assertIn('S · 被下架 / 屏蔽',p.locator('.brain-material-card').inner_text())
        self.recommend();risk=p.locator('.brain-content-risk')
        self.assertEqual(risk.get_attribute('data-risk-level'),'高')
        self.assertIn('不能确定平台处理原因',risk.inner_text());self.assertNotIn('利益输送',risk.inner_text())
        self.assertIsNone(p.evaluate('window.BAD'))
        self.assertTrue(p.locator('.personal-fit-score').inner_text().startswith('30 /'))
        p.reload();p.wait_for_selector('.brain-content-risk');self.assertEqual(p.locator('.brain-content-risk').get_attribute('data-risk-level'),'高')
        self.brain();p.locator('#brain-material-detail [data-brain-edit]').click();p.locator('#brain-extra').evaluate('(e)=>e.open=true')
        p.locator('[data-field="status"]').select_option('normal');p.locator('#brain-form [type="submit"]').click()
        self.recommend();self.assertEqual(p.locator('.brain-content-risk').get_attribute('data-risk-level'),'低')
        self.assertEqual(len(self.state()['materials']),1)

    def test_weak_company_only_removed_work_no_personal_points_or_risk(self):
        p=self.page;self.brain()
        for title in ['苹果智能家居','苹果 iPhone 销量','国产手机首销下滑']:
            self.add(kind='work',title='仅测试：'+title,body='',tags='苹果',fields={'views':'5806000','status':'removed'})
        self.recommend();self.assertTrue(p.locator('.personal-fit-score').inner_text().startswith('10 /'))
        self.assertEqual(p.locator('.brain-content-risk').get_attribute('data-risk-level'),'低')
        self.assertEqual(p.locator('.brain-history-item').count(),0)
        self.assertEqual(p.locator('.brain-angle').count(),0)

    def test_status_roundtrip_backup_unknown_and_zero_metrics_remain_distinct(self):
        p=self.page;self.brain();self.strong(fields={'status':'complaint'})
        self.recommend();self.assertIn('历史表现：数据不足',p.locator('.brain-history').inner_text())
        self.assertIn('播放：未填',p.locator('.brain-history').inner_text());self.assertEqual(p.locator('.brain-content-risk').get_attribute('data-risk-level'),'中')
        self.brain()
        with p.expect_download() as event:p.locator('#brain-export').click()
        data=json.loads(pathlib.Path(event.value.path()).read_text());self.assertEqual(data['materials'][0]['fields']['status'],'complaint')
        data['materials'][0]['id']='kb-import-zero';data['materials'][0]['fields'].update(views=0,status='deleted')
        p.locator('#brain-import-file').set_input_files({'name':'test-41.json','mimeType':'application/json','buffer':json.dumps(data).encode()})
        p.wait_for_function("JSON.parse(localStorage.getItem('radar-brain-v4')).materials.length===2")
        self.assertEqual(len(self.state()['materials']),2)
        self.recommend();self.assertIn('播放：0',p.locator('.brain-history').inner_text());self.assertIn('历史表现：D',p.locator('.brain-history').inner_text())
        self.assertIn('播放：未填',p.locator('.brain-history').inner_text())

    def test_mobile_scores_history_risk_and_edit_no_horizontal_overflow(self):
        p=self.page;self.brain();self.strong(fields={'views':'5806000','likes':'13000','comments':'686','saves':'1177','status':'removed'})
        p.set_viewport_size({'width':390,'height':844});self.recommend()
        p.locator('[data-brain-score]').click()
        self.assertEqual(p.locator('[data-brain-score]').get_attribute('aria-expanded'),'true')
        self.assertTrue(p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        p.locator('.brain-history-item [data-brain-jump]').click()
        p.locator('#brain-material-detail [data-brain-edit]').click();p.locator('#brain-extra').evaluate('(e)=>e.open=true')
        self.assertEqual(p.locator('[data-field="status"]').input_value(),'removed')
        self.assertTrue(p.evaluate('document.documentElement.scrollWidth<=innerWidth'))

if __name__=='__main__':unittest.main(verbosity=2)
