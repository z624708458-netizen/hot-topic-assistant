#!/usr/bin/env python3
"""Read explicitly configured public RSS/Atom only; never scrape article pages.

No dependencies, credentials, CORS proxy, fabricated summaries or dates.
"""
import argparse
import concurrent.futures
import datetime as dt
import email.utils
import hashlib
from html.parser import HTMLParser
import ipaddress
import json
import os
from pathlib import Path
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
UTC = dt.timezone.utc
MAX_BYTES = 3 * 1024 * 1024
RETENTION_DAYS = 7
USER_AGENT = 'HotTopicAssistant/3.0 (public RSS reader; https://github.com/z624708458-netizen/hot-topic-assistant)'


def iso(value):
    return value.astimezone(UTC).isoformat(timespec='seconds').replace('+00:00', 'Z')


class PlainText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.blocked = 0

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.blocked += 1
        elif tag in ('p', 'br', 'div', 'li'):
            self.parts.append(' ')

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.blocked = max(0, self.blocked - 1)
        elif tag in ('p', 'div', 'li'):
            self.parts.append(' ')

    def handle_data(self, text):
        if not self.blocked:
            self.parts.append(text)


def plain(text):
    parser = PlainText()
    parser.feed(text or '')
    return re.sub(r'\s+', ' ', ''.join(parser.parts)).strip()


def parse_date(text):
    """Reject missing/ambiguous dates; do not replace publication with fetch time."""
    if not text:
        raise ValueError('missing publication time')
    try:
        value = dt.datetime.fromisoformat(text.strip().replace('Z', '+00:00'))
    except ValueError:
        value = email.utils.parsedate_to_datetime(text.strip())
    if value is None or value.tzinfo is None:
        raise ValueError('publication timezone missing')
    return value.astimezone(UTC)


def safe_url(text, domains=None):
    try:
        p = urllib.parse.urlsplit(text.strip())
        if p.scheme not in ('http', 'https') or not p.hostname or p.username or p.password:
            return None
        if p.port not in (None, 80, 443):
            return None
        host = p.hostname.lower()
        if host == 'localhost' or '.' not in host or host.endswith(('.local', '.internal')):
            return None
        try:
            if not ipaddress.ip_address(host).is_global:
                return None
        except ValueError:
            pass
        if domains and not any(host == d or host.endswith('.' + d) for d in domains):
            return None
        query = [(k, v) for k, v in urllib.parse.parse_qsl(p.query, keep_blank_values=True)
                 if not k.lower().startswith('utm_') and k.lower() not in ('fbclid', 'gclid')]
        return urllib.parse.urlunsplit((p.scheme.lower(), p.netloc.lower(), p.path or '/', urllib.parse.urlencode(query), ''))
    except (ValueError, TypeError, AttributeError):
        return None


def local_name(tag):
    return tag.rsplit('}', 1)[-1]


def child_text(node, names):
    for child in node:
        if local_name(child.tag) in names:
            return ''.join(child.itertext()).strip()
    return ''


def match_companies(title, config, source):
    # Headlines only: avoids matching company names from RSS footers/advertisements.
    matches = []
    if source.get('company'):
        matches.append(source['company'])
    for company, aliases in config['company_aliases'].items():
        for alias in aliases:
            pattern = re.escape(alias)
            if alias.isascii():
                pattern = r'(?<![A-Za-z0-9])' + pattern + r'(?![A-Za-z0-9])'
            if re.search(pattern, title, re.IGNORECASE):
                if company not in matches:
                    matches.append(company)
                break
    return matches


def match_people(title, config):
    result = []
    for person in config.get('public_people', []):
        if any(re.search(r'(?<![A-Za-z])' + re.escape(alias) + r'(?![A-Za-z])' if alias.isascii() else re.escape(alias), title, re.I) for alias in person['aliases']):
            result.append(person)
    return result


def excluded_headline(title):
    # RSS also contains shopping adverts and multi-event roundups. They are not
    # individual editorial news topics; do not let combined keywords inflate scores.
    return bool(re.search(r'国补后|到手价|领券|优惠券|券后|限时抢购|[0-9]\s*→|IT早报|早报|晚报|极客早知道|新闻早知道|一周新闻汇总', title, re.I)) or title.count('；') >= 2


def parse_feed(payload, source, config, now):
    if len(payload) > MAX_BYTES or re.search(br'<!\s*(DOCTYPE|ENTITY)', payload, re.I):
        raise ValueError('oversized feed or prohibited XML declaration')
    root = ET.fromstring(payload)
    if local_name(root.tag) not in ('rss', 'feed', 'RDF'):
        raise ValueError('response is not RSS/Atom')
    entries = [e for e in root.iter() if local_name(e.tag) in ('item', 'entry')]
    result, rejected = [], 0
    for entry in entries:
        try:
            title = plain(child_text(entry, ('title',)))
            companies = match_companies(title, config, source)
            people = match_people(title, config)
            person_only = not companies and bool(people)
            if person_only:
                companies = ['人物热点']
            if not title or len(title) > 600 or not companies or excluded_headline(title):
                rejected += 1
                continue
            # Updated is NOT publication; require published/pubDate/dc:date.
            published = parse_date(child_text(entry, ('pubDate', 'published', 'date')))
            if published > now or now - published > dt.timedelta(days=RETENTION_DAYS):
                rejected += 1
                continue
            link = ''
            for child in entry:
                if local_name(child.tag) == 'link':
                    if child.get('href') and child.get('rel', 'alternate') == 'alternate':
                        link = child.get('href')
                        break
                    if child.text and not child.get('rel'):
                        link = child.text
            url = safe_url(link, source['article_domains'])
            if not url:
                rejected += 1
                continue
            summary = plain(child_text(entry, ('description', 'summary')))
            # Do not distribute full article content when a feed supplies only content:encoded.
            # Missing summary stays explicitly empty; UI directs readers to the original.
            truncated = len(summary) > 360
            summary = summary[:360] + ('…' if truncated else '')
            result.append({
                'id': 'rss-' + hashlib.sha256(url.encode()).hexdigest()[:20],
                'title': title, 'published': iso(published), 'company': companies[0],
                'companies': companies, 'source': source['name'], 'source_id': source['id'],
                'publisher_id': source.get('publisher_id', source['id']),
                'people': [p['name'] for p in people],
                'associated_companies': list(dict.fromkeys(p['company'] for p in people)) if person_only else [],
                'company_match_basis': 'person_affiliation' if person_only else 'official_source' if source.get('company') else 'headline',
                'source_type': source['type'], 'url': url, 'summary': summary,
                'summary_status': 'excerpt' if truncated else 'source' if summary else 'missing',
                'fetched_at': iso(now), 'kind': 'rss',
                'report_type': 'unconfirmed' if re.search(r'消息称|据传|传闻|曝光|爆料|被曝|传\s*(?:OpenAI|苹果|华为|小米)|有望|rumou?r|reportedly|may ', title, re.I) else 'report',
            })
        except (ValueError, TypeError, OverflowError):
            rejected += 1
    return result, len(entries), rejected


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        original = urllib.parse.urlsplit(req.full_url).hostname
        target = urllib.parse.urlsplit(newurl)
        if target.scheme != 'https' or target.hostname != original or not safe_url(newurl):
            raise ValueError('redirect outside configured HTTPS feed host; review source configuration')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fetch(source):
    url = safe_url(source['url'])
    if not url or not url.startswith('https://'):
        raise ValueError('feed must use public HTTPS')
    opener = urllib.request.build_opener(SafeRedirect())
    for attempt in range(2):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT, 'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml'})
            with opener.open(request, timeout=20) as response:
                payload = response.read(MAX_BYTES + 1)
                if len(payload) > MAX_BYTES:
                    raise ValueError('feed exceeded size limit')
                return payload
        except urllib.error.HTTPError as error:
            # Never evade authentication, robots restrictions, or anti-bot 403.
            if attempt == 0 and error.code in (429, 500, 502, 503, 504):
                time.sleep(2)
                continue
            raise


def cached_items(previous, sources, now):
    ids = {s['id']: s for s in sources}
    result = []
    for n in previous.get('news', []):
        try:
            source = ids.get(n.get('source_id'))
            if (not source or n.get('kind') != 'rss' or not n.get('title')
                    or excluded_headline(n.get('title', ''))
                    or not safe_url(n.get('url'), source['article_domains'])
                    or n.get('source') != source['name'] or not n.get('company')):
                continue
            age = now - parse_date(n['published'])
            if dt.timedelta(0) <= age <= dt.timedelta(days=RETENTION_DAYS):
                result.append({**n, 'publisher_id': source.get('publisher_id', source['id'])})
        except (ValueError, TypeError, KeyError):
            continue
    return result


def deduplicate(items):
    result, by_url, by_title = [], {}, {}
    # Prefer official feeds over media if exact titles coincide; preserve alternative sources.
    for item in sorted(items, key=lambda n: (n.get('source_type') != 'official_rss', n['url'], n['published'])):
        key = (re.sub(r'\s+', '', item['title']).casefold(), tuple(sorted(item['companies'])))
        existing = by_url.get(item['url']) or by_title.get(key)
        if existing is not None:
            if existing['url'] != item['url']:
                alternate = {'source': item['source'], 'url': item['url'], 'published': item['published']}
                if alternate not in existing.setdefault('alternate_sources', []):
                    existing['alternate_sources'].append(alternate)
            continue
        by_url[item['url']] = item
        by_title[key] = item
        result.append(item)
    return sorted(result, key=lambda n: (n['published'], n['id']), reverse=True)


def collect(config, previous=None, now=None, fetcher=fetch):
    now = now or dt.datetime.now(UTC)
    previous = previous or {}
    sources = [s for s in config['sources'] if s.get('enabled')]
    if not sources:
        raise ValueError('no enabled RSS sources')
    cached = cached_items(previous, sources, now)
    statuses, items = [], []
    def read(source):
        try:
            news, count, rejected = parse_feed(fetcher(source), source, config, now)
            # An empty feed can be legitimate; visibly report zero items.
            return source, news, {'status': 'ok', 'feed_items': count, 'accepted': len(news), 'skipped': rejected, 'last_success_at': iso(now)}
        except Exception as error:
            old = next((s for s in previous.get('sources', []) if s.get('id') == source['id']), {})
            # Fixed destination, never user credentials; keep error message bounded.
            return source, [], {'status': 'error', 'error': str(error)[:240], 'accepted': 0, 'last_success_at': old.get('last_success_at')}
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        outcomes = list(pool.map(read, sources))
    for source, news, status in outcomes:
        statuses.append({**source, **status, 'last_attempt_at': iso(now)})
        if status['status'] == 'ok':
            items.extend(news)
        # Keep still-valid items when a feed fails, or rolls old entries off its RSS window.
        new_urls = {n['url'] for n in news}
        items.extend(n for n in cached if n['source_id'] == source['id'] and n['url'] not in new_urls)
    any_success = any(s['status'] == 'ok' for s in statuses)
    return {
        'schema_version': 2, 'updated_at': iso(now),
        'last_success_at': iso(now) if any_success else previous.get('last_success_at'),
        'retention_days': RETENTION_DAYS, 'sources': statuses,
        'disabled_sources': [s for s in config['sources'] if not s.get('enabled')],
        'news': deduplicate(items),
        'collection_status': 'ok' if all(s['status'] == 'ok' for s in statuses) else 'partial' if any_success else 'error',
    }


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    os.replace(temporary, path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', type=Path, default=ROOT / 'config/sources.json')
    parser.add_argument('--output', type=Path, default=ROOT / 'data/news.json')
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding='utf-8'))
    previous = json.loads(args.output.read_text(encoding='utf-8')) if args.output.exists() else {}
    if previous and (previous.get('schema_version') != 2 or not isinstance(previous.get('news'), list)):
        raise ValueError('invalid previous dataset; refusing to overwrite')
    result = collect(config, previous)
    atomic_json(args.output, result)
    for source in result['sources']:
        print(f"{source['name']}: {source['status']}, accepted={source['accepted']}" + (f", {source['error']}" if source.get('error') else ''))
    print(f"Saved {len(result['news'])} real RSS items to {args.output}")
    return 2 if result['collection_status'] == 'error' else 0


if __name__ == '__main__':
    raise SystemExit(main())
