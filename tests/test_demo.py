"""Functional acceptance tests against the actual static app in Chromium."""
import functools
import http.server
import pathlib
import threading
import unittest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

class DemoTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}'
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1440, 'height': 1050})
        self.page = self.context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))
        self.page.goto(self.url)
        self.page.wait_for_selector('.topic-card')

    def tearDown(self):
        self.assertEqual(self.errors, [], 'Browser JavaScript errors')
        self.context.close()

    def test_ranking_details_sources_and_script(self):
        p = self.page
        cards = p.locator('#topic-list .topic-card')
        self.assertEqual(cards.count(), 5)
        self.assertIn('2024/05/13', cards.first.locator('.card-footer').inner_text())
        scores = [int(s) for s in p.locator('#topic-list .score strong').all_text_contents()]
        self.assertEqual(scores, sorted(scores, reverse=True))
        self.assertIn('历史新闻样例', p.locator('.notice').inner_text())
        self.assertEqual(p.locator('#detail-panel .dimension').count(), 5)
        self.assertIn('0 / 10', p.locator('.dimension').last.inner_text())
        for i in range(5):
            cards.nth(i).locator('[data-select]').first.click()
            self.assertIn(cards.nth(i).locator('h3').inner_text(), p.locator('.detail-heading h2').inner_text())
            p.locator('.tab[data-tab="titles"]').click()
            self.assertEqual(p.locator('.title-item').count(), 3)
            p.locator('.tab[data-tab="script"]').click()
            count = len(''.join(p.locator('.script-text').inner_text().split()))
            self.assertGreaterEqual(count, 300)
            self.assertLessEqual(count, 540)
            p.locator('.tab[data-tab="source"]').click()
            link = p.locator('#detail-panel .source-link')
            self.assertTrue(link.get_attribute('href').startswith('https://'))
            self.assertEqual(link.get_attribute('rel'), 'noopener noreferrer')
            self.assertIn('未能联网复核', p.locator('#detail-panel').inner_text())
            p.locator('.tab[data-tab="overview"]').click()
            values = [int(s.split(' / ')[0]) for s in p.locator('.dimension-label b').all_text_contents()]
            weighted = int(sum(v*w for v,w in zip(values,[.25,.2,.2,.2,.15]))*10 + .5)
            self.assertEqual(weighted, int(cards.nth(i).locator('.score strong').inner_text()))

    def test_filter_empty_search_and_recent(self):
        p=self.page
        p.locator('[data-company="华为"]').click()
        self.assertEqual(p.locator('#topic-list .topic-card').count(), 0)
        self.assertIn('没有匹配', p.locator('#topic-list').inner_text())
        p.locator('[data-reset]').click()
        self.assertEqual(p.locator('#topic-list .topic-card').count(),5)
        p.locator('#search').fill('Sora')
        self.assertEqual(p.locator('#topic-list .topic-card').count(),1)
        p.locator('#search').fill('')
        p.locator('#time-filter').select_option('24h')
        self.assertEqual(p.locator('#topic-list .topic-card').count(),0)
        self.assertIn('不自动抓取',p.locator('#topic-list').inner_text())
        p.locator('[data-reset]').click()
        p.locator('#platform').select_option('视频号')
        p.locator('.tab[data-tab="script"]').click()
        self.assertIn('语气稳健',p.locator('.script-meta').inner_text())

    def test_saved_persistence_navigation_and_copy(self):
        p=self.page
        p.locator('#topic-list .save-button').first.click()
        self.assertEqual(p.locator('#saved-count').inner_text(),'1')
        p.reload()
        p.locator('.nav[data-view="saved"]').click()
        self.assertEqual(p.locator('#saved-list .topic-card').count(),1)
        p.locator('#saved-list [data-select]').first.click()
        self.assertTrue(p.locator('#recommend-view').is_visible())
        self.context.grant_permissions(['clipboard-read','clipboard-write'])
        p.locator('.tab[data-tab="script"]').click()
        expected=p.locator('.script-text').inner_text()
        p.locator('[data-copy="script"]').click()
        self.assertEqual(p.evaluate('navigator.clipboard.readText()'), expected)
        p.locator('.tab[data-tab="titles"]').click()
        expected=p.locator('.title-item h3').first.inner_text()
        p.locator('[data-copy="title-0"]').click()
        self.assertEqual(p.evaluate('navigator.clipboard.readText()'),expected)
        p.locator('.nav[data-view="sources"]').click()
        self.assertEqual(p.locator('.method-row').count(),5)
        self.assertEqual(p.locator('.source-entry').count(),5)

    def fill_news(self, title='小米新消息：用户工作体验变化', url='https://example.com/official-news'):
        p=self.page
        p.locator('#add-news').click()
        p.locator('[name="title"]').fill(title)
        p.locator('[name="company"]').select_option('小米')
        p.locator('[name="url"]').fill(url)
        p.locator('[name="facts"]').fill('这是测试输入，并非真实新闻。用户手动提供的文字不会自动成为事实。请先打开原始来源核对消息的发布时间、适用范围与相关条件，再决定是否发布给观众。工具只依据输入生成参考评分。')

    def test_add_news_persistence_recent_and_input_safety(self):
        p=self.page
        payload='<img src=x onerror="window.XSS=1">小米用户新产品'
        self.fill_news(payload)
        p.locator('#news-form [type="submit"]').click()
        self.assertFalse(p.locator('#news-dialog').is_visible())
        self.assertEqual(p.locator('#candidate-count').inner_text(),'6 条')
        self.assertIn(payload,p.locator('.detail-heading h2').inner_text())
        self.assertIsNone(p.evaluate('window.XSS'))
        p.locator('#time-filter').select_option('24h')
        self.assertEqual(p.locator('#topic-list .topic-card').count(),1)
        self.assertEqual(p.locator('.dimension-label b').last.inner_text(),'10 / 10')
        p.locator('.tab[data-tab="source"]').click()
        self.assertIn('未独立核验',p.locator('#detail-panel').inner_text())
        p.reload()
        p.locator('[data-company="小米"]').click()
        self.assertEqual(p.locator('#topic-list .topic-card').count(),1)
        self.assertIsNone(p.evaluate('window.XSS'))

    def test_invalid_dates_and_urls(self):
        p=self.page
        self.fill_news(url='javascript:alert(1)')
        p.locator('#news-form [type="submit"]').click()
        self.assertTrue(p.locator('#news-dialog').is_visible())
        self.assertIn('http 或 https',p.locator('#form-error').inner_text())
        p.locator('[name="url"]').fill('https://example.com/news')
        p.locator('[name="published"]').fill('2099-01-01T12:00')
        p.locator('#news-form [type="submit"]').click()
        self.assertTrue(p.locator('#news-dialog').is_visible())
        self.assertFalse(p.locator('[name="published"]').evaluate('(e)=>e.validity.valid'))
        self.assertEqual(p.locator('#candidate-count').inner_text(),'5 条')

    def test_mobile_and_static_assets(self):
        p=self.page
        p.set_viewport_size({'width':390,'height':844})
        self.assertTrue(p.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
        p.locator('#topic-list [data-select]').first.click()
        p.locator('.tab[data-tab="script"]').click()
        self.assertTrue(p.locator('.script-text').is_visible())
        self.assertTrue(p.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
        p.locator('#add-news').click()
        self.assertTrue(p.locator('#news-dialog').is_visible())
        p.locator('#close-dialog').click()
        requests = []
        p.on('request', lambda r: requests.append(r.url))
        p.reload()
        p.wait_for_selector('#topic-list .topic-card')
        self.assertEqual(p.locator('#topic-list .topic-card').count(),5)
        self.assertTrue(all(u.startswith(self.url) for u in requests), requests)
        for path in ['/index.html','/assets/style.css','/assets/app.js']:
            self.assertEqual(self.context.request.get(self.url + path).status, 200)

    def test_corrupt_storage_is_recoverable(self):
        p=self.page
        p.evaluate("localStorage.setItem('radar-news-v1','not-json');localStorage.setItem('radar-saved-v1','{}')")
        p.reload()
        self.assertEqual(p.locator('#topic-list .topic-card').count(),5)
        self.assertEqual(p.locator('#saved-count').inner_text(),'0')

if __name__=='__main__':
    unittest.main(verbosity=2)
