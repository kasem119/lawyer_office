import hashlib
import http.client
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from retrieval import CorpusStore, build_index, parse_corpus
from server import PrivateServer

FIXTURE = '''LAW_START::قانون المرور
[PAGE 1]
مادة )1(
يحظر قيادة المركبة بدون رخصة قيادة، ويعاقب مخالف أحكام المرور.
[PAGE 2]
ويجب أن تكون الرخصة صالحة وسارية المفعول.
المادة (2)
يلتزم قائد المركبة بقواعد المرور وحقوق المارة في الطريق العام.
LAW_END::قانون المرور
LAW_START::القانون المدني
[PAGE 1]
مادة )563(
يلتزم المؤجر بتسليم العين المؤجرة للمستأجر وصيانتها أثناء الإيجار.
LAW_END::القانون المدني
'''


class RetrievalTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.data = Path(self.temp.name)
        (self.data / 'clean_law_preprocessed.txt').write_text(FIXTURE, encoding='utf-8')
        (self.data / 'pdfs').mkdir()
        (self.data / 'pdfs' / 'قانون المرور.pdf').write_bytes(b'%PDF-1.4 fixture')
        self.manifest = build_index(self.data)
        self.store = CorpusStore(self.data)

    def tearDown(self):
        self.temp.cleanup()

    def test_parser_keeps_article_continuation_page_and_law(self):
        laws, chunks = parse_corpus(FIXTURE)
        self.assertEqual(len(laws), 2)
        self.assertEqual([c['article'] for c in chunks], ['1', '1', '2', '563'])
        self.assertEqual([c['page'] for c in chunks], [1, 2, 2, 1])

    def test_search_relevance_and_citations(self):
        sources = self.store.search('ما التزامات المؤجر في عقد الإيجار؟')
        self.assertEqual(sources[0]['law_title'], 'القانون المدني')
        self.assertEqual(sources[0]['article'], '563')
        self.assertEqual(sources[0]['page'], 1)
        self.assertIn('العين المؤجرة', sources[0]['excerpt'])

    def test_search_unknown_returns_no_sources(self):
        self.assertEqual(self.store.search('بطريق فضائي كواكب'), [])

    def test_search_syntax_is_data_and_limits(self):
        self.store.search('" OR NEAR(*) المرور')
        for query in ['', None, 'a' * 16001, ['مرور']]:
            with self.assertRaises(ValueError):
                self.store.search(query)
        for limit in [0, 11, True, '6']:
            with self.assertRaises(ValueError):
                self.store.search('مرور', limit)

    def test_manifest_stable_and_mismatch_fails(self):
        first = self.store.search('قيادة')
        self.assertEqual(build_index(self.data), self.manifest)
        self.assertEqual(CorpusStore(self.data).search('قيادة'), first)
        (self.data / 'clean_law_preprocessed.txt').write_text(FIXTURE + '\nchanged', encoding='utf-8')
        with self.assertRaises(ValueError):
            CorpusStore(self.data)

    def test_pdf_allowlist(self):
        law = next(l for l in self.store.catalog() if l['title'] == 'قانون المرور')
        self.assertTrue(self.store.pdf_path(law['id']).name.endswith('.pdf'))
        for path in ['../secrets', '%2e%2e', 'a' * 20]:
            self.assertIsNone(self.store.pdf_path(path))

    def test_no_laws_or_pages_rejected(self):
        with self.assertRaises(ValueError):
            parse_corpus('random text')


class ApiTests(RetrievalTests):
    def setUp(self):
        super().setUp()
        self.token = 'test-internal-token-' + 'x' * 32
        self.service = PrivateServer(('127.0.0.1', 0), self.store, self.token)
        self.thread = threading.Thread(target=self.service.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.service.shutdown()
        self.service.server_close()
        self.thread.join(timeout=2)
        super().tearDown()

    def request(self, method, path, payload=None, token=True, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.service.server_port, timeout=5)
        actual_headers = {'Content-Type': 'application/json'}
        if token:
            actual_headers['Authorization'] = 'Bearer ' + self.token
        actual_headers.update(headers or {})
        connection.request(method, path, body=json.dumps(payload) if payload is not None else None, headers=actual_headers)
        response = connection.getresponse()
        result = response.status, response.read()
        connection.close()
        return result

    def test_auth_and_health(self):
        self.assertEqual(self.request('GET', '/health', token=False)[0], 401)
        code, raw = self.request('GET', '/health')
        self.assertEqual(code, 200)
        self.assertEqual(json.loads(raw)['corpus']['law_count'], 2)

    def test_search_http_validation(self):
        self.assertEqual(self.request('POST', '/search', {'query': 'الإيجار'})[0], 200)
        for payload in [{'query': ''}, {'query': 'x' * 16001}, {'query': 'مرور', 'max_results': True}, {'query': 'مرور', 'history': []}, []]:
            self.assertEqual(self.request('POST', '/search', payload)[0], 400)
        self.assertEqual(self.request('POST', '/search', {'query': 'x' * 66000})[0], 413)

    def test_traversal_and_catalog(self):
        self.assertEqual(self.request('GET', '/laws/../../.env/pdf')[0], 404)
        self.assertEqual(self.request('GET', '/laws/%2e%2e/pdf')[0], 404)
        code, raw = self.request('GET', '/laws')
        law = next(l for l in json.loads(raw)['laws'] if l['has_pdf'])
        self.assertEqual(code, 200)
        code, raw = self.request('GET', f'/laws/{law["id"]}/pdf')
        self.assertEqual(code, 200)
        self.assertTrue(raw.startswith(b'%PDF'))

    def test_invalid_bind_and_token(self):
        with self.assertRaises(ValueError):
            PrivateServer(('0.0.0.0', 0), self.store, self.token)
        with self.assertRaises(ValueError):
            PrivateServer(('127.0.0.1', 0), self.store, 'short')


class RealCorpusTests(unittest.TestCase):
    @unittest.skipUnless((Path(__file__).resolve().parents[1] / 'data' / 'clean_law_preprocessed.txt').is_file(), 'Local supplied corpus not installed')
    def test_source_corpus_coverage_and_real_questions(self):
        store = CorpusStore(Path(__file__).resolve().parents[1] / 'data')
        self.assertEqual(store.manifest['law_count'], 45)
        self.assertEqual(store.manifest['page_count'], 1879)
        self.assertEqual(store.manifest['pdf_count'], 45)
        # The supplied labor corpus has only the enactment page. Do not return
        # annual-leave rules from a different security-agency legal regime.
        self.assertEqual(store.search('ما حقوق العامل في الإجازة السنوية؟'), [])
        exact = store.search('القانون المدني المادة 497', 4)
        self.assertTrue(exact)
        self.assertTrue(all(r['article'] == '497' and r['law_title'] == 'القانون المدني' for r in exact))
        self.assertEqual(store.search('القانون المدني المادة 99999'), [])
        for query, law_fragment in [('ما عقوبة السرقة؟', 'العقوبات'), ('ما التزامات المؤجر والمستأجر في عقد الإيجار؟', 'المدني'), ('ما الأحكام المنظمة للإجازات في قانون علاقات العمل؟', 'العمل'), ('ما عقوبة القيادة بدون رخصة؟', 'المرور')]:
            with self.subTest(query=query):
                results = store.search(query)
                self.assertTrue(results)
                self.assertTrue(any(law_fragment in r['law_title'] for r in results), results)
                self.assertTrue(all(r['page'] > 0 and r['law_id'] and r['excerpt'] for r in results))


if __name__ == '__main__':
    unittest.main()
