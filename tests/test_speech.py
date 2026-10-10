"""V5 browser acceptance; news and private material are TEST ONLY in isolated contexts."""
import json
import pathlib
import unittest
import test_demo as base
import test_brain41 as v41

class SpeechTest(unittest.TestCase):
    setUpClass=classmethod(base.DemoTest.setUpClass.__func__)
    tearDownClass=classmethod(base.DemoTest.tearDownClass.__func__)
    setUp=v41.Brain41Test.setUp
    tearDown=base.DemoTest.tearDown
    brain=v41.Brain41Test.brain
    add=v41.Brain41Test.add
    strong=v41.Brain41Test.strong
    state=v41.Brain41Test.state
    recommend=v41.Brain41Test.recommend

    def generate(self):
        self.page.locator('.speech-generator [data-speech-generate]').click()
        self.assertTrue(self.page.locator('.speech-generator [data-speech-main]').is_visible())

    def main(self):return self.page.locator('.speech-generator [data-speech-main]')
    def drafts(self):return self.page.evaluate("JSON.parse(localStorage.getItem('radar-speech-v5'))")
    def action(self,key):self.page.locator(f'.speech-generator [data-speech-action="{key}"]').click()
    def open_saved(self):
        self.page.locator('.speech-generator [data-speech-library]').click()
        self.page.locator('#speech-drafts-list [data-speech-load]').first.click()
        return self.page.locator('#speech-draft-body')

    def test_news_only_complete_output_provenance_no_old_store_or_ranking_changes(self):
        p=self.page;before=p.locator('#topic-list .score strong').all_text_contents();kb=p.evaluate("localStorage.getItem('radar-brain-v4')");rss=p.evaluate("localStorage.getItem('radar-rss-v2')")
        self.generate();self.assertIn('Vision Pro',self.main().input_value());self.assertNotIn('[谁',self.main().input_value())
        self.assertEqual(p.locator('.speech-generator .speech-option').count(),6)
        p.locator('.speech-materials').evaluate('(e)=>e.open=true');self.assertIn('本次主要基于当前新闻生成',p.locator('.speech-materials').inner_text())
        self.assertGreater(p.locator('.speech-check[data-check-kind="news"]').count(),0)
        self.assertIn('未读取和核对原文全文',p.locator('.speech-facts').inner_text())
        self.assertEqual(p.locator('.speech-facts a').first.get_attribute('href'),'https://example.com/test/0')
        self.assertEqual(p.locator('#topic-list .score strong').all_text_contents(),before)
        self.assertEqual(p.evaluate("localStorage.getItem('radar-brain-v4')"),kb);self.assertEqual(p.evaluate("localStorage.getItem('radar-rss-v2')"),rss)
        self.assertIsNone(self.drafts())

    def test_seconds_switch_preserves_both_versions_and_in_page_navigation_edits(self):
        p=self.page;self.generate();self.main().fill(self.main().input_value()+'\n\n保留我的60秒修改。');short=self.main().input_value()
        p.locator('.speech-generator [data-speech-duration]').select_option('90');long=self.main().input_value();self.assertGreater(len(long),len(short)-20)
        p.locator('.speech-generator [data-speech-duration]').select_option('60');self.assertEqual(self.main().input_value(),short)
        p.locator('.tab[data-tab="titles"]').click();p.locator('.tab[data-tab="overview"]').click();self.assertEqual(self.main().input_value(),short)
        p.locator('#reload-news').click();p.wait_for_selector('#reload-news:not([disabled])');self.assertEqual(self.main().input_value(),short)

    def test_second_brain_used_performance_and_risk_inheritance_before_generation(self):
        p=self.page;self.brain();self.strong(fields={'views':'5806000','copy':'讲真，旧作品999亿元，仅测试。昔日高光到巨大反差。'})
        self.strong(kind='opinion',title='仅测试：Vision Pro观点',fields={'point':'品牌光环不能替普通人作选择。'})
        self.strong(title='仅测试：被屏蔽的Vision Pro原稿',fields={'status':'removed','views':'5806000','copy':'幕后大佬操控，资本早就安排好了。'})
        before=self.state();self.recommend();self.assertIn('该题材与你过去的高风险内容相似',p.locator('.speech-generator').inner_text())
        self.generate();self.assertNotIn('999亿元',self.main().input_value());self.assertNotIn('幕后',self.main().input_value())
        p.locator('.speech-materials').evaluate('(e)=>e.open=true');used=p.locator('.speech-materials').inner_text();self.assertIn('历史表现 S',used);self.assertIn('个人观点',used);self.assertNotIn('被屏蔽的Vision Pro原稿',used)
        self.assertGreater(p.locator('.speech-check[data-check-kind="history"]').count(),0);self.assertEqual(self.state(),before)

    def test_only_opening_keeps_main_angle_changes_and_undo_restores(self):
        p=self.page;self.generate();text=self.main().input_value();openings=p.locator('.speech-option').all_text_contents()[:3]
        self.action('opening');self.assertEqual(self.main().input_value(),text);self.assertNotEqual(p.locator('.speech-option').all_text_contents()[:3],openings)
        angle=p.locator('.speech-generator .speech-meta').all_text_contents()[-1]
        self.action('angle');self.assertNotEqual(self.main().input_value(),text);self.assertNotEqual(p.locator('.speech-generator .speech-meta').all_text_contents()[-1],angle)
        p.locator('.speech-generator [data-speech-undo]').click();self.assertEqual(self.main().input_value(),text)

    def test_manual_claim_flags_all_edits_risk_lowering_and_real_copy(self):
        p=self.page;self.generate();self.main().fill(self.main().input_value()+'\n\n特斯拉出事将负全责。\n\n首先，然而，对于此事，这是我手动增加的句子。')
        flags=p.locator('.speech-check[data-check-kind="review"]').inner_text() if p.locator('.speech-check[data-check-kind="review"]').count()==1 else '\n'.join(p.locator('.speech-check[data-check-kind="review"]').all_text_contents())
        self.assertIn('负全责',flags);self.assertIn('需要核实',flags)
        self.action('conflict');self.assertIn('手动增加',self.main().input_value());self.assertIn('判断标准',self.main().input_value())
        self.action('human');self.assertNotIn('首先',self.main().input_value());self.assertIn('手动增加',self.main().input_value())
        self.action('risk');self.assertNotIn('负全责',self.main().input_value());self.assertGreater(p.locator('.speech-check[data-check-kind="news"]').count(),0)
        self.context.grant_permissions(['clipboard-read','clipboard-write']);p.locator('.speech-generator [data-speech-copy="main"]').click();self.assertEqual(p.evaluate('navigator.clipboard.readText()'),self.main().input_value())

    def test_apply_opener_changes_only_first_paragraph(self):
        p=self.page;self.generate();self.main().fill(self.main().input_value()+'\n\n保留正文编辑。');text=self.main().input_value();body=text[text.index('\n\n'):]
        p.locator('.speech-generator [data-speech-opening="1"]').click();now=self.main().input_value();self.assertEqual(now[now.index('\n\n'):],body)

    def test_saved_draft_refresh_edit_and_archived_news_available_from_second_brain(self):
        p=self.page;self.generate();self.main().fill(self.main().input_value()+'\n\n仅测试保存的稿件。');text=self.main().input_value()
        p.locator('.speech-generator [data-speech-save]').click();self.assertEqual(len(self.drafts()['drafts']),1)
        p.reload();p.wait_for_selector('#topic-list .topic-card');body=self.open_saved();self.assertEqual(body.locator('[data-speech-main]').input_value(),text)
        body.locator('[data-speech-main]').fill(text+'\n\n二次编辑。');body.locator('[data-speech-save]').click();self.assertEqual(len(self.drafts()['drafts']),1)
        p.locator('#speech-drafts-close').click();self.data['news']=[];p.locator('#reload-news').click();p.wait_for_selector('#reload-news:not([disabled])')
        self.brain();self.assertEqual(p.locator('#speech-draft-count').inner_text(),'1');p.locator('#brain-view [data-speech-library]').click();p.locator('[data-speech-load]').first.click()
        self.assertIn('二次编辑',p.locator('#speech-draft-body [data-speech-main]').input_value());self.assertIn('保存时的新闻快照',p.locator('#speech-draft-body').inner_text())

    def test_generated_work_backflow_metadata_metrics_unknown_and_later_edit_retained(self):
        p=self.page;self.brain();self.strong(kind='opinion',fields={'point':'消费者应该看自己的需求。'});self.recommend();self.generate();main=self.main().input_value()
        p.locator('.speech-generator [data-speech-work]').click();self.assertTrue(p.locator('#brain-dialog').is_visible());self.assertEqual(p.locator('[name="brain-body"]').input_value(),main)
        self.assertEqual(p.locator('[data-field="copy"]').input_value(),main);self.assertEqual(p.locator('[data-field="published"]').input_value(),'')
        self.assertEqual(p.locator('[data-field="views"]').input_value(),'');p.locator('#brain-form [type="submit"]').click();self.brain()
        m=next(m for m in self.state()['materials'] if m['type']=='work');self.assertEqual(m['title'],self.data['news'][0]['title']);self.assertEqual(m['origin']['news_id'],'test-0');self.assertIsNone(m['fields']['views']);self.assertEqual(len(m['generation']['used_materials']),1)
        self.assertIn('口播生成记录',p.locator('#brain-material-detail').inner_text());self.assertIn('生成时间不等于发布时间',p.locator('#brain-material-detail').inner_text())
        before=m['generation'];p.locator('#brain-material-detail [data-brain-edit]').click();p.locator('#brain-extra').evaluate('(e)=>e.open=true');p.locator('[data-field="views"]').fill('5806000');p.locator('#brain-form [type="submit"]').click()
        m=next(m for m in self.state()['materials'] if m['type']=='work');self.assertEqual(m['generation'],before);self.assertEqual(m['fields']['views'],5806000)
        p.reload();self.brain();self.assertIn('S · 正常',p.locator('#brain-list').inner_text())

    def test_draft_backup_roundtrip_conflict_merge_and_invalid_import_untouched(self):
        p=self.page;self.generate();p.locator('.speech-generator [data-speech-save]').click();p.locator('.speech-generator [data-speech-library]').click()
        with p.expect_download() as event:p.locator('#speech-drafts-export').click()
        path=pathlib.Path(event.value.path());data=json.loads(path.read_text());p.locator('#speech-drafts-file').set_input_files(str(path));p.wait_for_function("document.querySelector('#speech-drafts-file').value===''")
        self.assertEqual(len(self.drafts()['drafts']),1)
        data['drafts'][0]['result']['main']+='\n\n仅测试不同备份内容。';p.locator('#speech-drafts-file').set_input_files({'name':'changed.json','mimeType':'application/json','buffer':json.dumps(data).encode()});p.wait_for_function("JSON.parse(localStorage.getItem('radar-speech-v5')).drafts.length===2")
        self.assertNotEqual(self.drafts()['drafts'][0]['id'],self.drafts()['drafts'][1]['id']);before=p.evaluate("localStorage.getItem('radar-speech-v5')")
        p.locator('#speech-drafts-file').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{"schema_version":99}'});p.wait_for_function("document.querySelector('#speech-drafts-status').textContent.includes('导入未完成')")
        self.assertEqual(p.evaluate("localStorage.getItem('radar-speech-v5')"),before)

    def test_corrupt_drafts_and_quota_do_not_reset_data_or_lose_generated_input(self):
        p=self.page;p.evaluate("localStorage.setItem('radar-speech-v5','broken-draft-TEST')");p.reload();p.wait_for_selector('#topic-list .topic-card');self.generate();text=self.main().input_value()
        p.locator('.speech-generator [data-speech-save]').click();self.assertIn('原数据未清空',p.locator('.speech-generator [data-speech-error]').inner_text());self.assertEqual(self.main().input_value(),text)
        self.assertEqual(p.evaluate("localStorage.getItem('radar-speech-v5')"),'broken-draft-TEST')
        # Reinitialize a separate valid test draft store, leaving private legacy keys untouched.
        p.evaluate("localStorage.setItem('radar-speech-v5',JSON.stringify({schema_version:1,drafts:[]}))");p.reload();p.wait_for_selector('#topic-list .topic-card');self.generate()
        p.evaluate("()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='radar-speech-v5')throw new DOMException('quota','QuotaExceededError');return set.call(this,k,v)}}")
        text=self.main().input_value();p.locator('.speech-generator [data-speech-save]').click();self.assertIn('空间不足',p.locator('.speech-generator [data-speech-error]').inner_text());self.assertEqual(self.main().input_value(),text);self.assertEqual(self.drafts()['drafts'],[])

    def test_corrupt_knowledge_base_news_only_generator_preserves_original_data(self):
        p=self.page;p.evaluate("localStorage.setItem('radar-brain-v4','broken-private-TEST')");p.reload();p.wait_for_selector('#topic-list .topic-card')
        self.generate();self.assertIn('第二大脑暂不可读',p.locator('.speech-generator').inner_text());self.assertEqual(p.evaluate("localStorage.getItem('radar-brain-v4')"),'broken-private-TEST')
        p.locator('.speech-generator [data-speech-save]').click();self.assertEqual(len(self.drafts()['drafts']),1)

    def test_concurrent_save_rejects_overwrite_and_preserves_current_input(self):
        p=self.page;self.generate();p.locator('.speech-generator [data-speech-save]').click()
        p.evaluate("()=>{const s=JSON.parse(localStorage.getItem('radar-speech-v5'));s.drafts[0].updated_at='2026-10-10T01:59:00Z';s.drafts[0].result.main='仅测试另一窗口修改';localStorage.setItem('radar-speech-v5',JSON.stringify(s));}")
        self.main().fill(self.main().input_value()+'\n\n当前窗口未保存输入。');text=self.main().input_value();p.locator('.speech-generator [data-speech-save]').click()
        self.assertIn('另一窗口',p.locator('.speech-generator [data-speech-error]').inner_text());self.assertEqual(self.main().input_value(),text);self.assertEqual(self.drafts()['drafts'][0]['result']['main'],'仅测试另一窗口修改')

    def test_news_material_html_escaped_and_no_external_requests(self):
        p=self.page;requests=[];p.on('request',lambda r:requests.append(r.url));self.brain()
        self.strong(kind='opinion',fields={'point':'<img src=x onerror="window.XSS5=1"> 消费者先看自己的需求。'})
        self.recommend();self.generate();self.assertIsNone(p.evaluate('window.XSS5'));self.assertIn('<img',self.main().input_value())
        self.assertTrue(all(url.startswith(self.url) for url in requests),requests)

    def test_mobile_generator_actions_save_library_and_conversion_no_overflow(self):
        p=self.page;p.set_viewport_size({'width':390,'height':844});self.generate()
        for action in ['opening','angle','conflict','human','risk']:self.action(action)
        self.assertTrue(p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        p.locator('.speech-generator [data-speech-save]').click();body=self.open_saved();self.assertTrue(p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        body.locator('[data-speech-work]').click();self.assertTrue(p.locator('#brain-dialog').is_visible());self.assertTrue(p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        p.locator('#brain-form [type="submit"]').click();self.brain();self.assertEqual(p.locator('.brain-material-card').count(),1)

if __name__=='__main__':unittest.main(verbosity=2)
