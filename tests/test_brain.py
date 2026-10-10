"""V4 browser acceptance; all private content here is TEST ONLY, in isolated contexts."""
import json
import pathlib
import unittest
import test_demo as base

class BrainTest(unittest.TestCase):
    setUpClass=classmethod(base.DemoTest.setUpClass.__func__)
    tearDownClass=classmethod(base.DemoTest.tearDownClass.__func__)
    setUp=base.DemoTest.setUp
    tearDown=base.DemoTest.tearDown

    def brain(self):
        self.page.locator('.nav[data-view="brain"]').click()
        self.assertTrue(self.page.locator('#brain-view').is_visible())

    def state(self):
        return self.page.evaluate("JSON.parse(localStorage.getItem('radar-brain-v4'))")

    def add(self,kind='case',body='仅测试个人经历：小米手机降价后，我反思消费预算。',title='',tags='小米，消费',fields=None):
        p=self.page;p.locator('#brain-add').click();p.locator('#brain-editor-type').select_option(kind)
        p.locator('#brain-form [name="brain-title"]').fill(title);p.locator('#brain-form [name="brain-body"]').fill(body)
        p.locator('#brain-form [name="brain-tags"]').fill(tags)
        if fields:
            p.locator('#brain-extra').evaluate('(e)=>e.open=true')
            for key,value in fields.items():
                field=p.locator(f'#brain-extra-fields [data-field="{key}"]')
                if key=='status':field.select_option(value)
                else:field.fill(value)
        p.locator('#brain-form [type="submit"]').click()
        self.assertFalse(p.locator('#brain-dialog').is_visible(),p.locator('#brain-form-error').inner_text())

    def test_quick_paste_persistence_and_no_old_data_changes(self):
        p=self.page;p.locator('#topic-list .save-button').first.click()
        before=p.evaluate("Object.fromEntries(['radar-saved-v2','radar-snapshots-v2','radar-rss-v2'].map(k=>[k,localStorage.getItem(k)]))")
        self.brain();self.add()
        self.assertEqual(len(self.state()['materials']),1)
        self.assertIn('个人经历',p.locator('#brain-list').inner_text())
        p.reload();self.brain();self.assertEqual(p.locator('.brain-material-card').count(),1)
        for key in ['radar-saved-v2','radar-snapshots-v2']:
            self.assertEqual(p.evaluate('(k)=>localStorage.getItem(k)',key),before[key])
        self.assertEqual(p.locator('#saved-count').inner_text(),'1')
        self.assertEqual(p.locator('#brain-count').inner_text(),'1')

    def test_five_structured_types_optional_metrics_and_china_time(self):
        self.brain()
        fields={'case':{'date':'2020-04-03','event':'仅测试：房地产工作与小米消费观察','conflict':'仅测试冲突'},'opinion':{'point':'仅测试观点','background':'仅测试背景','reason':'仅测试理由','counter':'仅测试反例'},'viral':{'original':'仅测试案例原题','url':'https://example.com/structure','borrow':'仅测试：问题→证据→条件'},'comment':{'comment':'仅测试原评论','likes':'0','question':'仅测试：为何涨价？'},'work':{'published':'2026-10-09T18:30','platform':'视频号','views':'1234','likes':'0','review':'仅测试复盘'}}
        for kind,values in fields.items():self.add(kind=kind,title='小米 '+kind+' 测试素材',fields=values)
        materials=self.state()['materials'];self.assertEqual(len(materials),5)
        work=next(m for m in materials if m['type']=='work');self.assertEqual(work['fields']['published'],'2026-10-09T10:30:00.000Z')
        self.assertIsNone(work['fields']['comments']);self.assertEqual(work['fields']['likes'],0)
        self.assertIn('1,234',self.page.locator('#brain-performance-list').inner_text())
        self.page.locator('#brain-type').select_option('case');self.assertNotIn('08:00',self.page.locator('.brain-material-meta').first.inner_text())

    def test_fulltext_type_tag_and_time_filters(self):
        p=self.page;self.brain()
        self.add(title='仅测试楼市经历',body='房地产工作观察',tags='房地产，职场',fields={'date':'2020-01-01'})
        self.add(kind='opinion',title='仅测试AI观点',body='人工智能观点',tags='AI',fields={'reason':'小米这个关键词仅在理由字段中'})
        self.add(kind='work',title='仅测试作品',body='作品内容',tags='复盘',fields={'published':'2024-01-01T10:00'})
        p.locator('#brain-search').fill('小米');self.assertEqual(p.locator('.brain-material-card').count(),1)
        self.assertIn('AI观点',p.locator('#brain-list').inner_text())
        p.locator('#brain-search').fill('房地产');self.assertEqual(p.locator('.brain-material-card').count(),1)
        p.locator('#brain-search').fill('');p.locator('#brain-type').select_option('work');self.assertEqual(p.locator('.brain-material-card').count(),1)
        p.locator('#brain-type').select_option('all');p.locator('#brain-tag').select_option('AI');self.assertEqual(p.locator('.brain-material-card').count(),1)
        p.locator('#brain-tag').select_option('');p.locator('#brain-sort').select_option('oldest');self.assertIn('楼市经历',p.locator('.brain-material-card h3').first.inner_text())
        p.locator('#brain-sort').select_option('newest');self.assertIn('AI观点',p.locator('.brain-material-card h3').first.inner_text())

    def test_related_matches_weighted_personal_and_three_angles_without_changing_v3(self):
        p=self.page;before=p.locator('#topic-list .score strong').all_text_contents();self.brain()
        for kind in ['case','opinion','viral','comment','work']:
            self.add(kind=kind,title='仅测试小米 '+kind,fields={'borrow':'仅测试专属结构'} if kind=='viral' else None)
        self.add(title='完全无关的主题',body='仅测试：太平洋海边旅行',tags='旅行')
        p.locator('.nav[data-view="recommend"]').click()
        self.assertEqual(p.locator('.personal-fit-score').inner_text().split(' / ')[0],'64.6')
        self.assertEqual(p.locator('.brain-match').count(),5);self.assertEqual(p.locator('.brain-angle').count(),3)
        self.assertNotIn('完全无关',p.locator('.brain-match').all_text_contents()[0])
        self.assertIn('核心公司',p.locator('.brain-match').first.inner_text())
        self.assertIn('专属结构',p.locator('.brain-angle').last.inner_text())
        self.assertEqual(p.locator('#topic-list .score strong').all_text_contents(),before)
        p.locator('.brain-match [data-brain-jump]').first.click();self.assertTrue(p.locator('#brain-view').is_visible())
        self.assertIn('小米',p.locator('#brain-material-detail h2').inner_text())

    def test_profile_no_evidence_no_fabricated_angles(self):
        p=self.page;self.assertEqual(p.locator('.brain-match').count(),0);self.assertEqual(p.locator('.brain-angle').count(),0)
        self.brain();p.locator('.brain-settings').evaluate('(e)=>e.open=true')
        for box in p.locator('#brain-profile-companies input').all():box.uncheck()
        p.locator('#brain-profile-domains').fill('');p.locator('#brain-profile-form [type="submit"]').click()
        p.locator('.nav[data-view="recommend"]').click();self.assertTrue(p.locator('.personal-fit-score').inner_text().startswith('0 /'))
        p.reload();self.brain();p.locator('.brain-settings').evaluate('(e)=>e.open=true');self.assertEqual(p.locator('#brain-profile-companies input:checked').count(),0)
        p.locator('#brain-profile-domains').fill('职场');p.locator('#brain-profile-form [type="submit"]').click()
        p.locator('.nav[data-view="recommend"]').click();self.assertTrue(p.locator('.personal-fit-score').inner_text().startswith('10 /'))

    def test_saved_conversion_metrics_and_reflection_remain_editable(self):
        p=self.page;p.locator('#topic-list .save-button').first.click();snap=p.evaluate("localStorage.getItem('radar-snapshots-v2')")
        p.locator('.nav[data-view="saved"]').click();p.locator('[data-to-work]').first.click()
        self.assertEqual(p.locator('#brain-editor-type').input_value(),'work')
        self.assertEqual(p.locator('[name="brain-body"]').input_value(),'')
        p.locator('[name="brain-body"]').fill('仅测试：这是我自己的口播，不是新闻摘要。')
        p.locator('[data-field="views"]').fill('2000');p.locator('[data-field="review"]').fill('仅测试：生活问题开头值得复盘')
        p.locator('#brain-form [type="submit"]').click();self.brain()
        m=self.state()['materials'][0];self.assertEqual(m['type'],'work');self.assertEqual(m['origin']['news_id'],'test-0')
        self.assertEqual(m['fields']['views'],2000);self.assertEqual(p.evaluate("localStorage.getItem('radar-snapshots-v2')"),snap)
        p.locator('#brain-material-detail [data-brain-edit]').click();p.locator('#brain-extra').evaluate('(e)=>e.open=true')
        p.locator('[data-field="views"]').fill('3000');p.locator('#brain-form [type="submit"]').click()
        self.assertEqual(len(self.state()['materials']),1);self.assertEqual(self.state()['materials'][0]['fields']['views'],3000)
        p.reload();self.brain();self.assertIn('3,000',p.locator('#brain-performance-list').inner_text())

    def test_backup_roundtrip_merges_without_overwriting_changed_material(self):
        p=self.page;self.brain();self.add(title='仅测试原素材')
        with p.expect_download() as download:p.locator('#brain-export').click()
        path=pathlib.Path(download.value.path());data=json.loads(path.read_text())
        self.assertEqual(data['schema_version'],1)
        p.locator('#brain-import-file').set_input_files(str(path));p.wait_for_function("document.querySelector('#brain-import-file').value==='' ")
        self.assertEqual(len(self.state()['materials']),1,'identical backup should not duplicate')
        data['materials'][0]['body']='仅测试：备份中不同的内容'
        p.locator('#brain-import-file').set_input_files({'name':'changed.json','mimeType':'application/json','buffer':json.dumps(data).encode()})
        p.wait_for_function("JSON.parse(localStorage.getItem('radar-brain-v4')).materials.length===2")
        self.assertEqual(self.state()['materials'][0]['body'],'仅测试个人经历：小米手机降价后，我反思消费预算。')
        self.assertNotEqual(self.state()['materials'][0]['id'],self.state()['materials'][1]['id'])
        before=p.evaluate("localStorage.getItem('radar-brain-v4')")
        p.locator('#brain-import-file').set_input_files({'name':'invalid.json','mimeType':'application/json','buffer':b'{"schema_version":999}'})
        p.wait_for_selector('#brain-storage-error:not([hidden])');self.assertEqual(p.evaluate("localStorage.getItem('radar-brain-v4')"),before)

    def test_html_inputs_safe_and_invalid_source_url_not_saved(self):
        p=self.page;self.brain();payload='<img src=x onerror="window.XSS=1">小米测试'
        self.add(title=payload,body=payload,tags=payload)
        self.assertIn(payload,p.locator('#brain-material-detail h2').inner_text());self.assertIsNone(p.evaluate('window.XSS'))
        p.locator('#brain-add').click();p.locator('#brain-editor-type').select_option('viral');p.locator('[name="brain-body"]').fill('仅测试链接检查')
        p.locator('#brain-extra').evaluate('(e)=>e.open=true');p.locator('[data-field="url"]').fill('javascript:alert(1)')
        p.locator('#brain-form [type="submit"]').click();self.assertTrue(p.locator('#brain-dialog').is_visible());self.assertEqual(len(self.state()['materials']),1)

    def test_storage_quota_preserves_input_and_prior_records(self):
        p=self.page;self.brain();self.add(title='已保存的测试素材');before=p.evaluate("localStorage.getItem('radar-brain-v4')")
        p.evaluate("()=>{const original=Storage.prototype.setItem; Storage.prototype.setItem=function(k,v){if(k==='radar-brain-v4')throw new DOMException('quota','QuotaExceededError');return original.call(this,k,v)}}")
        p.locator('#brain-add').click();p.locator('[name="brain-body"]').fill('未保存的测试草稿：不能丢失')
        p.locator('#brain-form [type="submit"]').click();self.assertTrue(p.locator('#brain-dialog').is_visible())
        self.assertIn('空间不足',p.locator('#brain-form-error').inner_text());self.assertIn('不能丢失',p.locator('[name="brain-body"]').input_value())
        self.assertEqual(p.evaluate("localStorage.getItem('radar-brain-v4')"),before)

    def test_corrupt_library_not_reset_and_v3_still_works(self):
        p=self.page;p.evaluate("localStorage.setItem('radar-brain-v4','corrupt-private-data')");p.reload();p.wait_for_selector('#reload-news:not([disabled])')
        self.assertEqual(p.locator('#topic-list .topic-card').count(),5)
        self.brain();self.assertIn('没有被清空',p.locator('#brain-storage-error').inner_text())
        p.locator('#brain-add').click();p.locator('[name="brain-body"]').fill('仅测试输入')
        p.locator('#brain-form [type="submit"]').click();self.assertTrue(p.locator('#brain-dialog').is_visible())
        self.assertEqual(p.evaluate("localStorage.getItem('radar-brain-v4')"),'corrupt-private-data')

    def test_type_switch_retains_optional_draft_fields_and_mobile_navigation(self):
        p=self.page;self.brain();p.set_viewport_size({'width':390,'height':844})
        self.assertTrue(p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        p.locator('#brain-add').click();p.locator('#brain-extra').evaluate('(e)=>e.open=true');p.locator('[data-field="event"]').fill('仅测试：切换分类不丢草稿')
        p.locator('#brain-editor-type').select_option('opinion');p.locator('[data-field="point"]').fill('仅测试观点草稿')
        p.locator('#brain-editor-type').select_option('case');self.assertEqual(p.locator('[data-field="event"]').input_value(),'仅测试：切换分类不丢草稿')
        p.locator('[name="brain-body"]').fill('小米手机消费测试');p.locator('#brain-form [type="submit"]').click()
        self.assertFalse(p.locator('#brain-dialog').is_visible());self.assertTrue(p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        p.locator('.nav[data-view="recommend"]').click();self.assertTrue(p.locator('.personal-fit').is_visible())
        self.assertTrue(p.evaluate('document.documentElement.scrollWidth<=innerWidth'))

if __name__=='__main__':unittest.main(verbosity=2)
