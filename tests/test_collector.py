"""RSS fixtures are synthetic test inputs only and are never shipped as news."""
import datetime as dt
import importlib.util
import json
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('collector',ROOT/'scripts/collect_news.py')
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
NOW=dt.datetime(2026,10,10,3,0,tzinfo=dt.timezone.utc)
CONFIG={'sources':[{'id':'test','name':'测试媒体（仅测试）','url':'https://example.com/feed','article_domains':['example.com'],'type':'media_rss','enabled':True}], 'company_aliases':{'小米':['小米','Xiaomi'],'苹果':['苹果','Apple'],'OpenAI':['OpenAI','ChatGPT']}}
SOURCE=CONFIG['sources'][0]

def feed(items):
    return ('<rss version="2.0"><channel>'+''.join(items)+'</channel></rss>').encode()

def item(title='小米测试新闻', date='Sat, 10 Oct 2026 10:00:00 +0800', link='https://example.com/story?utm_source=rss', description='&lt;p&gt;测试摘要，并非真实新闻。&lt;/p&gt;'):
    return f'<item><title>{title}</title><pubDate>{date}</pubDate><link>{link}</link><description>{description}</description></item>'

class CollectorTest(unittest.TestCase):
    def test_rss_fields_dates_and_html(self):
        result,count,rejected=c.parse_feed(feed([item()]),SOURCE,CONFIG,NOW)
        self.assertEqual((count,rejected),(1,0))
        n=result[0]
        self.assertEqual(n['published'],'2026-10-10T02:00:00Z')
        self.assertEqual(n['url'],'https://example.com/story')
        self.assertEqual(n['source'],SOURCE['name'])
        self.assertEqual(n['company'],'小米')
        self.assertEqual(n['summary'],'测试摘要，并非真实新闻。')
        self.assertEqual(n['kind'],'rss')
        self.assertEqual(c.plain('<script>alert(1)</script><style>x</style><p>事实</p>'),'事实')

    def test_atom_requires_publication_not_update(self):
        atom=b'<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>OpenAI test</title><published>2026-10-10T02:00:00Z</published><updated>2026-10-10T03:00:00Z</updated><link rel="alternate" href="https://example.com/atom"/><summary>Test, not real news.</summary></entry></feed>'
        n,count,rejected=c.parse_feed(atom,SOURCE,CONFIG,NOW)
        self.assertEqual(n[0]['published'],'2026-10-10T02:00:00Z')
        without=atom.replace(b'<published>2026-10-10T02:00:00Z</published>',b'')
        self.assertEqual(c.parse_feed(without,SOURCE,CONFIG,NOW)[0],[])

    def test_invalid_future_old_missing_dates_and_external_links(self):
        dates=['','2026-10-10T03:01:00Z','2026-10-01T00:00:00Z','2026-10-10','not a date']
        self.assertEqual(c.parse_feed(feed([item(date=d) for d in dates]),SOURCE,CONFIG,NOW)[0],[])
        for url in ['javascript:alert(1)','http://127.0.0.1/news','https://other.example/story','https://u:secret@example.com/story']:
            self.assertEqual(c.parse_feed(feed([item(link=url)]),SOURCE,CONFIG,NOW)[0],[])

    def test_matching_title_only_and_english_boundaries(self):
        self.assertEqual(c.parse_feed(feed([item(title='Other company',description='小米 footer')]),SOURCE,CONFIG,NOW)[0],[])
        self.assertEqual(c.match_companies('Pineapple is a fruit',CONFIG,SOURCE),[])
        self.assertEqual(c.match_companies('Apple and OpenAI test',CONFIG,SOURCE),['苹果','OpenAI'])

    def test_missing_summary_is_not_invented_and_long_excerpt(self):
        n=c.parse_feed(feed([item(description='')]),SOURCE,CONFIG,NOW)[0][0]
        self.assertEqual(n['summary'],'');self.assertEqual(n['summary_status'],'missing')
        n=c.parse_feed(feed([item(description='测'*500)]),SOURCE,CONFIG,NOW)[0][0]
        self.assertEqual(n['summary_status'],'excerpt');self.assertEqual(len(n['summary']),361)

    def test_malformed_html_and_entity_payload_rejected(self):
        for payload in [b'<!DOCTYPE html><html>blocked</html>',b'<rss><channel>',b'<!DOCTYPE rss [<!ENTITY x "boom">]><rss/>']:
            with self.assertRaises((ValueError,c.ET.ParseError)):
                c.parse_feed(payload,SOURCE,CONFIG,NOW)

    def test_cache_survives_total_failure_without_redating(self):
        good=c.collect(CONFIG,now=NOW,fetcher=lambda s:feed([item()]))
        def fail(s):raise OSError('test network unavailable')
        failed=c.collect(CONFIG,previous=good,now=NOW+dt.timedelta(hours=2),fetcher=fail)
        self.assertEqual(failed['collection_status'],'error')
        self.assertEqual(failed['news'][0]['published'],good['news'][0]['published'])
        self.assertEqual(failed['news'][0]['fetched_at'],good['news'][0]['fetched_at'])
        self.assertEqual(failed['last_success_at'],good['last_success_at'])
        expired=c.collect(CONFIG,previous=good,now=NOW+dt.timedelta(days=8),fetcher=fail)
        self.assertEqual(expired['news'],[])

    def test_rolloff_and_dedup_retains_source(self):
        first=c.collect(CONFIG,now=NOW,fetcher=lambda s:feed([item(),item(link='https://example.com/copy')]))
        self.assertEqual(len(first['news']),1)
        self.assertEqual(len(first['news'][0]['alternate_sources']),1)
        next_run=c.collect(CONFIG,previous=first,now=NOW+dt.timedelta(hours=1),fetcher=lambda s:feed([]))
        self.assertEqual(len(next_run['news']),1)
        self.assertEqual(next_run['sources'][0]['accepted'],0)

    def test_ads_roundups_and_rumors(self):
        for title in ['国补后 1999 → 999 元：小米测试','IT早报 1010：苹果和小米','小米新品优惠券限时抢购']:
            self.assertEqual(c.parse_feed(feed([item(title=title)]),SOURCE,CONFIG,NOW)[0],[])
        rumor=c.parse_feed(feed([item(title='消息称苹果有望发布测试产品')]),SOURCE,CONFIG,NOW)[0][0]
        self.assertEqual(rumor['report_type'],'unconfirmed')

    def test_partial_failure_and_official_fixed_company(self):
        config=json.loads(json.dumps(CONFIG))
        config['sources'].append({**SOURCE,'id':'official','name':'测试官方','company':'苹果','type':'official_rss'})
        def get(s):
            if s['id']=='test':raise OSError('fixture failure')
            return feed([item(title='Official test without brand')])
        result=c.collect(config,now=NOW,fetcher=get)
        self.assertEqual(result['collection_status'],'partial');self.assertEqual(len(result['news']),1)
        self.assertEqual(result['news'][0]['company'],'苹果')

if __name__=='__main__':unittest.main(verbosity=2)
