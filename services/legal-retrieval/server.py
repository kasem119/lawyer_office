"""Private authenticated HTTP adapter. No generation, prompt cache, or public UI."""
from __future__ import annotations

import hmac
import ipaddress
import json
import os
import re
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from retrieval import CorpusStore

MAX_BODY = 65536


class PrivateServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, store, token, concurrency=4):
        if not ipaddress.ip_address(address[0]).is_loopback:
            raise ValueError('Retrieval must bind a loopback IP')
        if not isinstance(token, str) or len(token) < 32:
            raise ValueError('LEGAL_RETRIEVAL_TOKEN requires at least 32 characters')
        if not 1 <= concurrency <= 16:
            raise ValueError('Concurrency must be 1..16')
        self.store = store
        self.token = token
        self.slots = threading.BoundedSemaphore(concurrency)
        super().__init__(address, Handler)

    def process_request(self, request, client_address):
        if not self.slots.acquire(blocking=False):
            try:
                request.sendall(b'HTTP/1.0 503 Service Unavailable\r\nContent-Length: 0\r\nConnection: close\r\n\r\n')
            finally:
                self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self.slots.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.slots.release()

    def handle_error(self, request, client_address):
        # Do not print request paths, queries, bearer tokens, or exception text.
        print('Legal retrieval request failed', flush=True)


class Handler(BaseHTTPRequestHandler):
    server_version = 'LegalRetrieval/1'
    sys_version = ''

    def setup(self):
        super().setup()
        self.connection.settimeout(10)

    def log_message(self, format, *args):
        pass

    def respond(self, status, payload):
        raw = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(raw)

    def authorized(self):
        values = self.headers.get_all('Authorization', [])
        expected = 'Bearer ' + self.server.token
        if len(values) != 1 or not hmac.compare_digest(values[0].encode('utf-8'), expected.encode('utf-8')):
            self.respond(401, {'error': 'Unauthorized'})
            return False
        return True

    def do_GET(self):
        if not self.authorized():
            return
        parsed = urlsplit(self.path)
        if parsed.query or parsed.fragment:
            self.respond(404, {'error': 'Not found'})
            return
        if parsed.path == '/health':
            self.respond(200, {'status': 'ok', 'ready': True, 'corpus': self.server.store.manifest})
        elif parsed.path == '/laws':
            self.respond(200, {'laws': self.server.store.catalog(), 'corpus': self.server.store.manifest})
        else:
            match = re.fullmatch(r'/laws/([a-f0-9]{20})/pdf', parsed.path)
            path = self.server.store.pdf_path(match.group(1)) if match else None
            if path is None:
                self.respond(404, {'error': 'Not found'})
                return
            with path.open('rb') as stream:
                self.send_response(200)
                self.send_header('Content-Type', 'application/pdf')
                self.send_header('Content-Length', str(path.stat().st_size))
                self.send_header('Cache-Control', 'private, no-store')
                self.send_header('X-Content-Type-Options', 'nosniff')
                self.end_headers()
                while block := stream.read(65536):
                    self.wfile.write(block)

    def do_POST(self):
        if not self.authorized():
            return
        if self.path != '/search':
            self.respond(404, {'error': 'Not found'})
            return
        lengths = self.headers.get_all('Content-Length', [])
        if len(lengths) != 1 or not lengths[0].isdigit() or self.headers.get('Transfer-Encoding'):
            self.respond(400, {'error': 'A single Content-Length is required'})
            return
        size = int(lengths[0])
        if size < 1 or size > MAX_BODY:
            # Drain only a bounded amount already being sent by a local client,
            # so closing the socket does not discard the 413 response on Windows.
            self.rfile.read(min(size, MAX_BODY + 4096))
            self.respond(413, {'error': 'Request body exceeds limit'})
            return
        if self.headers.get_content_type() != 'application/json':
            self.respond(415, {'error': 'JSON required'})
            return
        try:
            raw = self.rfile.read(size)
            if len(raw) != size:
                raise ValueError('Incomplete request')
            request = json.loads(raw)
            if not isinstance(request, dict) or set(request) - {'query', 'max_results'}:
                raise ValueError('Invalid search fields')
            sources = self.server.store.search(request.get('query'), request.get('max_results', 6))
            self.respond(200, {'sources': sources, 'corpus': self.server.store.manifest})
        except (ValueError, UnicodeError):
            self.respond(400, {'error': 'Invalid search request'})
        except Exception:
            self.respond(503, {'error': 'Retrieval unavailable'})


def main():
    root = Path(__file__).resolve().parent
    configured = Path(os.getenv('LEGAL_RETRIEVAL_DATA_DIR', str(root / 'data')))
    data_dir = configured if configured.is_absolute() else root / configured
    token = os.getenv('LEGAL_RETRIEVAL_TOKEN', '')
    host = os.getenv('LEGAL_RETRIEVAL_HOST', '127.0.0.1')
    port = int(os.getenv('LEGAL_RETRIEVAL_PORT', '8100'))
    store = CorpusStore(data_dir)
    service = PrivateServer((host, port), store, token, int(os.getenv('LEGAL_RETRIEVAL_CONCURRENCY', '4')))
    print(f'Legal retrieval ready: {store.manifest["law_count"]} laws, {store.manifest["chunk_count"]} excerpts', flush=True)
    try:
        service.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        service.server_close()


if __name__ == '__main__':
    main()
