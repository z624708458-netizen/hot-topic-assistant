"""Real Chromium acceptance tests. Test-only news is served through a route mock;
it is never saved to the production data files. One test also loads actual data.
"""
import datetime as dt
import functools
import http.server
import json
import pathlib
import shutil
import threading
import unittest
from playwright.sync_api import sync_playwright

ROOT=pathlib.Path(__file__).resolve().parents[1]
UTC=dt.timezone.utc

def dataset():
    now=dt.datetime.now(UTC)
    titles=['小米首次免费开源新纪录意外涨价：隐私监管裁员争议，手机用户工作测试',
            '苹果手机涨价测试','华为手机降价测试','腾讯微信收费争议测试',
            'OpenAI 裁员岗位测试','阿里巴巴淘宝涨价测试','特斯拉汽车召回测试','百度裁员岗位测试']
    companies=['小米','苹果','华为','腾讯','OpenAI','阿里巴巴','特斯拉','百度']
    ages=[.01,2,3,4,5,30,100,167]
    news=[{'id':'test-'+str(i),'title':'仅测试数据：'+title,'published':(now-dt.timedelta(hours=ages[i])).isoformat(),
           'company':companies[i],'companies':[companies[i]],'source':'测试来源，不是真实新闻',
           'source_id':'test'+str(i%3),'publisher_id':'test'+str(i%3),'source_type':'media_rss','url':'https://example.com/test/'+str(i),
           'summary':'测试摘要，仅供浏览器验收，不是真实新闻。','kind':'rss','fetched_at':now.isoformat()}
          for i,title in enumerate(titles)]
    return {'schema_version':2,'updated_at':now.isoformat(),'last_success_at':now.isoformat(),
            'collection_status':'ok','sources':[{'id':'test','name':'测试来源，不是真实新闻',
            'type':'media_rss','status':'ok','accepted':len(news),'last_success_at':now.isoformat(),
            'last_attempt_at':now.isoformat(),'url':'https://example.com/feed'}],'news':news}

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass

class DemoTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT)))
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
        cls.url=f'http://127.0.0.1:{cls.server.server_port}'
        cls.pw=sync_playwright().start()
        executable=shutil.which('chromium') or shutil.which('google-chrome')
        cls.browser=cls.pw.chromium.launch(**({'executable_path':executable} if executable else {}),headless=True,args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.pw.stop();cls.server.shutdown();cls.server.server_close()

    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':1440,'height':1050})
        self.page=self.context.new_page();self.errors=[];self.data=dataset()
        self.page.on('pageerror',lambda e:self.errors.append(str(e)))
        self.page.route('**/data/news.json',lambda route:route.fulfill(json=self.data))
        self.page.goto(self.url);self.page.wait_for_selector('#topic-list .topic-card')

    def tearDown(self):
        self.assertEqual(self.errors,[],'Browser JavaScript exceptions');self.context.close()

    def test_ranking_fields_sources_titles_framework(self):
        p=self.page;cards=p.locator('#topic-list .topic-card')
        self.assertEqual(cards.count(),5)
        self.assertEqual(p.locator('#time-filter').input_value(),'48h')
        self.assertEqual(p.locator('#candidate-count').inner_text(),'6 条')
        scores=[int(s) for s in p.locator('#topic-list .score strong').all_text_contents()]
        self.assertEqual(scores,sorted(scores,reverse=True))
        self.assertNotIn('历史样例',p.locator('#topic-list').inner_text())
        self.assertEqual(p.locator('#detail-panel .dimension').count(),5)
        self.assertEqual([int(v.split(' / ')[1]) for v in p.locator('.dimension-label b').all_text_contents()],[25,25,20,20,10])
        self.assertIn('标题停留',cards.first.inner_text())
        self.assertEqual(sum(int(s.split(' / ')[0]) for s in p.locator('.dimension-label b').all_text_contents()),scores[0])
        self.assertIn('北京时间',cards.first.locator('time').inner_text())
        p.locator('.tab[data-tab="titles"]').click();self.assertEqual(p.locator('.title-item').count(),3)
        p.locator('.tab[data-tab="script"]').click()
        for text in ['0–10秒','10–30秒','75–90秒','不是已核验的成稿','[谁，在什么时间']:
            self.assertIn(text,p.locator('.script-text').inner_text())
        p.locator('.tab[data-tab="source"]').click();link=p.locator('#detail-panel .source-link').first
        self.assertEqual(link.get_attribute('href'),'https://example.com/test/0')
        self.assertEqual(link.get_attribute('rel'),'noopener noreferrer')
        self.assertIn('非 AI 改写',p.locator('#detail-panel').inner_text())

    def test_filters_all_candidates_sort_minimum_and_time(self):
        p=self.page
        p.locator('#toggle-all').click();self.assertEqual(p.locator('#topic-list .topic-card').count(),6)
        p.locator('#high-score').check();self.assertGreater(p.locator('#topic-list .topic-card').count(),0)
        self.assertTrue(all(int(v)>=80 for v in p.locator('#topic-list .score strong').all_text_contents()))
        p.locator('#high-score').uncheck()
        p.locator('#time-filter').select_option('7d');self.assertEqual(p.locator('#topic-list .topic-card').count(),8)
        p.locator('[data-company="特斯拉"]').click();self.assertEqual(p.locator('#topic-list .topic-card').count(),1)
        p.locator('#time-filter').select_option('48h');self.assertEqual(p.locator('#topic-list .topic-card').count(),0)
        p.locator('[data-reset]').click()
        p.locator('#search').fill('OpenAI');self.assertEqual(p.locator('#topic-list .topic-card').count(),1)
        p.locator('#search').fill('');p.locator('#sort-order').select_option('published')
        self.assertIn('小米',p.locator('#topic-list h3').first.inner_text())
        low={**self.data['news'][0],'id':'test-low','title':'仅测试低分新条目','company':'其他','companies':['其他'],'summary':'','url':'https://example.com/low','published':dt.datetime.now(UTC).isoformat()}
        self.data['news'].append(low)
        p.locator('#reload-news').click();p.wait_for_selector('#reload-news:not([disabled])')
        self.assertNotIn('低分新条目',p.locator('#topic-list').inner_text(), 'Sort by time must not replace score-selected Top 5')
        p.locator('#time-filter').select_option('today')
        china_day=(dt.datetime.now(UTC)+dt.timedelta(hours=8)).date()
        for value in p.locator('#topic-list time').evaluate_all('(es)=>es.map(e=>e.dateTime)'):
            self.assertEqual((dt.datetime.fromisoformat(value)+dt.timedelta(hours=8)).date(),china_day)

    def test_saved_snapshot_and_clipboard(self):
        p=self.page;p.locator('#topic-list .save-button').first.click();p.reload()
        p.locator('.nav[data-view="saved"]').click();self.assertEqual(p.locator('#saved-list .topic-card').count(),1)
        p.locator('#saved-list [data-select]').first.click();self.context.grant_permissions(['clipboard-read','clipboard-write'])
        p.locator('.tab[data-tab="script"]').click();expected=p.locator('.script-text').inner_text()
        p.locator('[data-copy="script"]').click();self.assertEqual(p.evaluate('navigator.clipboard.readText()'),expected)
        p.locator('.tab[data-tab="titles"]').click();expected=p.locator('.title-item h3').first.inner_text()
        p.locator('[data-copy="title-0"]').click();self.assertEqual(p.evaluate('navigator.clipboard.readText()'),expected)
        self.data['news']=[];p.locator('#reload-news').click();p.wait_for_selector('#reload-news:not([disabled])')
        p.locator('.nav[data-view="saved"]').click();self.assertEqual(p.locator('#saved-list .topic-card').count(),1)
        p.locator('#saved-list [data-select]').first.click();self.assertIn('小米',p.locator('.detail-heading').inner_text())

    def fill_news(self,title='小米用户新闻测试',url='https://example.com/manual'):
        p=self.page;p.locator('#add-news').click();p.locator('[name="title"]').fill(title)
        p.locator('[name="company"]').select_option('小米');p.locator('[name="url"]').fill(url)
        p.locator('[name="facts"]').fill('这是测试输入，并非真实新闻。用户提供的文字不自动成为事实。发布前请打开原始来源核对消息的时间、适用范围与相关条件，再决定是否发布给观众。工具只依据输入生成规则分数和口播框架。')

    def test_manual_is_separate_persistent_and_html_is_safe(self):
        p=self.page;payload='<img src=x onerror="window.XSS=1">小米用户测试'
        self.fill_news(payload);p.locator('#news-form [type="submit"]').click()
        self.assertFalse(p.locator('#news-dialog').is_visible());self.assertTrue(p.locator('#include-manual').is_checked())
        self.assertIn(payload,p.locator('.detail-heading h2').inner_text());self.assertIsNone(p.evaluate('window.XSS'))
        p.reload();self.assertFalse(p.locator('#include-manual').is_checked())
        p.locator('[data-company="小米"]').click();self.assertEqual(p.locator('#topic-list .topic-card').count(),1)
        p.locator('#include-manual').check();p.locator('#toggle-all').click();self.assertEqual(p.locator('#topic-list .topic-card').count(),2)
        self.assertIsNone(p.evaluate('window.XSS'))

    def test_invalid_urls_future_dates(self):
        p=self.page;self.fill_news(url='javascript:alert(1)');p.locator('#news-form [type="submit"]').click()
        self.assertTrue(p.locator('#news-dialog').is_visible());self.assertIn('http 或 https',p.locator('#form-error').inner_text())
        p.locator('[name="url"]').fill('https://example.com/manual');p.locator('[name="published"]').fill('2099-01-01T12:00')
        p.locator('#news-form [type="submit"]').click();self.assertFalse(p.locator('[name="published"]').evaluate('(e)=>e.validity.valid'))
        self.assertTrue(p.locator('#news-dialog').is_visible())

    def test_failed_load_uses_cache_without_redating(self):
        p=self.page;before=p.locator('#topic-list time').first.get_attribute('datetime')
        p.unroute('**/data/news.json');p.route('**/data/news.json',lambda r:r.abort());p.reload()
        p.wait_for_selector('#topic-list .topic-card');self.assertIn('本机缓存',p.locator('#data-status-title').inner_text())
        self.assertEqual(p.locator('#topic-list time').first.get_attribute('datetime'),before)
        p.evaluate('localStorage.clear()');p.reload();p.wait_for_selector('#reload-news:not([disabled])')
        self.assertEqual(p.locator('#topic-list .topic-card').count(),0)
        self.assertIn('数据加载失败',p.locator('#data-status-title').inner_text())
        self.assertNotIn('GPT-4o',p.locator('#topic-list').inner_text())

    def test_source_status_staleness_and_unknown_summary(self):
        p=self.page
        self.data['last_success_at']=(dt.datetime.now(UTC)-dt.timedelta(hours=7)).isoformat()
        self.data['collection_status']='partial';self.data['sources'][0]['status']='error';self.data['sources'][0]['error']='test source unavailable'
        self.data['news'][0]['summary']='';p.locator('#reload-news').click();p.wait_for_selector('#reload-news:not([disabled])')
        self.assertIn('更新延迟',p.locator('#data-status-title').inner_text());self.assertIn('未提供摘要',p.locator('#topic-list').inner_text())
        p.locator('.nav[data-view="sources"]').click();self.assertEqual(p.locator('.method-row').count(),5)
        self.assertIn('读取失败',p.locator('.source-directory').inner_text())
        self.assertIn('test source unavailable',p.locator('.source-directory').inner_text())

    def test_mobile_no_external_fetch_and_corrupt_storage(self):
        p=self.page;p.set_viewport_size({'width':390,'height':844})
        self.assertTrue(p.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
        p.locator('#topic-list [data-select]').first.click();p.locator('.tab[data-tab="script"]').click()
        self.assertTrue(p.locator('.script-text').is_visible());self.assertTrue(p.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
        p.locator('#add-news').click();self.assertTrue(p.locator('#news-dialog').is_visible());p.locator('#close-dialog').click()
        requests=[];p.on('request',lambda r:requests.append(r.url))
        p.evaluate("localStorage.setItem('radar-news-v2','not-json');localStorage.setItem('radar-saved-v2','{}')")
        p.reload();p.wait_for_selector('.topic-card');self.assertTrue(all(u.startswith(self.url) for u in requests),requests)
        self.assertEqual(p.locator('#saved-count').inner_text(),'0')

    def test_production_json_and_real_data_page(self):
        p=self.page;p.unroute('**/data/news.json');p.evaluate('localStorage.clear()');p.reload()
        p.wait_for_selector('#reload-news:not([disabled])')
        actual=json.loads((ROOT/'data/news.json').read_text())
        now=dt.datetime.now(UTC)
        recent=[n for n in actual['news'] if dt.timedelta(0)<=now-dt.datetime.fromisoformat(n['published'].replace('Z','+00:00'))<=dt.timedelta(hours=48)]
        expected=p.evaluate('(news)=>RadarRules.selectTop(RadarRules.rank(news)).news.length',actual['news'])
        self.assertEqual(p.locator('#topic-list .topic-card').count(),expected)
        if expected:
            self.assertTrue(p.locator('#topic-list .card-original').first.get_attribute('href').startswith('https://'))
            self.assertNotIn('测试来源',p.locator('#topic-list').inner_text())
        else:
            self.assertEqual(p.locator('#topic-list .topic-card').count(),0)
        self.assertNotIn('历史样例',p.locator('#topic-list').inner_text())
        for path in ['/assets/style.css','/assets/rules.js','/assets/app.js','/data/news.json']:
            self.assertEqual(self.context.request.get(self.url+path).status,200)

if __name__=='__main__':unittest.main(verbosity=2)
