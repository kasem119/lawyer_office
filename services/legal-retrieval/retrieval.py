"""Read-only, source-preserving search over the supplied Libyan law corpus."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sqlite3
import tempfile
from contextlib import closing
import unicodedata
from pathlib import Path

SCHEMA_VERSION = 1
MAX_EXCERPT = 5000
ARTICLE = re.compile(r"^\s*(?:المادة|مادة)\s*[()\[\]﴾﴿]*\s*([0-9٠-٩۰-۹]{1,4})\s*[()\[\]﴾﴿]*\s*(.*)$")
PAGE = re.compile(r"^\[PAGE\s+(\d+)\]$")
STOP_WORDS = set("ما ماذا هل كيف من في على الي عن مع ان اذا او و لا هو هي هذا هذه ذلك تلك كل كان يكون يمكن لم لنا هناك قانون ماده عقوبه عقاب سؤال اريد اود بشأن الخاص خاص رقم لسنه سنة حقوق التزامات عقد".split())
OCR_FIXES = {"الرتخيص": "الترخيص", "الرشوط": "الشروط", "الرشكة": "الشركة", "رسق": "سرق", "رشك": "شرك", "رشط": "شرط", "مبارشة": "مباشرة", "مرشوع": "مشروع", "زناع": "نزاع", "أكرث": "أكثر", "ثماين": "ثماني", "للرشطة": "للشرطة", "للرشكة": "للشركة"}
ALIASES = {
    "سرقه": ["سرق", "سرقه", "رسق"], "سرق": ["سرق", "سرقه", "رسق"],
    "رشوه": ["رشوه", "راشي", "مرتشي"], "طلاق": ["طلاق", "تطليق"],
    "ايجار": ["ايجار", "مؤجر", "مستاجر", "اجره"],
    "تسول": ["تسول", "استجداء", "شحاذه"], "شحات": ["تسول", "استجداء"],
    "احتيال": ["احتيال", "احتياليه", "نصب"], "نصب": ["نصب", "احتيال", "احتياليه"],
    "قتل": ["قتل", "قاتل"], "عمل": ["عمل", "عامل", "عمال"], "عامل": ["عامل", "عمل", "عمال"],
    "مرور": ["مرور", "مركبه", "قياده"], "تعويض": ["تعويض", "ضرر", "اضرار"],
    "اجازه": ["اجازه", "اجازات", "اجاز"],
}


def normalized(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    # PDF OCR repeatedly duplicates the alef before a hamza-bearing alef.
    text = text.replace('اإ', 'إ').replace('اأ', 'أ').replace('اآ', 'آ')
    for bad, good in OCR_FIXES.items():
        text = text.replace(bad, good)
    text = re.sub(r"[\u064b-\u065f\u0670\u0640]", "", text)
    text = text.translate(str.maketrans("أإآٱىة٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "اااايه01234567890123456789"))
    return " ".join(re.findall(r"[\w]+", text.lower(), re.UNICODE))


def tokens(text: str) -> list[str]:
    result = []
    for token in normalized(text).split():
        if token.startswith("وال") and len(token) > 5:
            token = token[3:]
        elif token.startswith("ال") and len(token) > 4:
            token = token[2:]
        elif token.startswith("و") and len(token) > 5:
            token = token[1:]
        if len(token) >= 2:
            result.append(token)
    return result


def law_id(title: str) -> str:
    return hashlib.sha256(title.encode("utf-8")).hexdigest()[:20]


def parse_corpus(text: str) -> tuple[list[dict], list[dict]]:
    """Keep articles on each PDF page separate; continuation retains article id."""
    laws, chunks = [], []
    current = None
    page = 0
    article = None
    lines = []
    ordinal = 0

    def flush():
        nonlocal lines, ordinal
        content = "\n".join(lines).strip()
        lines = []
        if current is None or len(content) < 20 or page < 1:
            return
        # Bound long excerpts without assigning a different article or page.
        for offset in range(0, len(content), MAX_EXCERPT - 300):
            part = content[offset:offset + MAX_EXCERPT]
            if len(part.strip()) < 20:
                continue
            ordinal += 1
            ident = hashlib.sha256(f"{current['id']}:{page}:{article}:{ordinal}:{part}".encode()).hexdigest()[:24]
            chunks.append({"id": ident, "law_id": current["id"], "law_title": current["title"], "page": page, "article": article, "excerpt": part})

    for raw in text.splitlines():
        line = raw.strip()
        if line.startswith("LAW_START::"):
            flush()
            title = line.partition("::")[2].strip()
            if not title:
                raise ValueError("Corpus has an empty law title")
            current = {"id": law_id(title), "title": title, "page_count": 0}
            laws.append(current)
            page, article, ordinal = 0, None, 0
        elif line.startswith("LAW_END::"):
            flush()
            current = None
        elif current is not None:
            page_match = PAGE.fullmatch(line)
            article_match = ARTICLE.match(line)
            if page_match:
                flush()
                page = int(page_match.group(1))
                current["page_count"] = max(current["page_count"], page)
            elif article_match and page:
                flush()
                article = str(int(normalized(article_match.group(1))))
                lines.append(raw)
            elif page and not re.fullmatch(r"=+|-+", line) and not line.startswith("مصدر القانون:"):
                if line != f"[{current['title']}]":
                    lines.append(raw)
    flush()
    if not laws or not chunks or len({l['id'] for l in laws}) != len(laws):
        raise ValueError("Corpus missing unique laws and usable page text")
    return laws, chunks


def map_pdfs(laws: list[dict], pdf_dir: Path) -> dict[str, str]:
    """Build a fixed allowlist. Never derive a filesystem path from HTTP input."""
    candidates = list(pdf_dir.glob("*.pdf")) if pdf_dir.is_dir() else []
    mapping = {}
    for law in laws:
        title = normalized(law["title"]).replace("المجمع القانوني الليبي", "").strip()
        exact = [p for p in candidates if normalized(p.stem) == title]
        if not exact:
            exact = [p for p in candidates if normalized(p.stem).startswith(title) or title.startswith(normalized(p.stem))]
        if len(exact) == 1:
            mapping[law["id"]] = exact[0].name
    return mapping


def build_index(data_dir: Path) -> dict:
    data_dir = data_dir.resolve()
    source = data_dir / "clean_law_preprocessed.txt"
    raw = source.read_bytes()
    laws, chunks = parse_corpus(raw.decode("utf-8-sig"))
    pdf_mapping = map_pdfs(laws, data_dir / "pdfs")
    manifest = {"sha256": hashlib.sha256(raw).hexdigest(), "schema_version": SCHEMA_VERSION, "law_count": len(laws), "page_count": sum(l['page_count'] for l in laws), "chunk_count": len(chunks), "pdf_count": len(pdf_mapping)}
    data_dir.mkdir(parents=True, exist_ok=True)
    handle, temp_name = tempfile.mkstemp(prefix="index-", suffix=".sqlite3", dir=data_dir)
    os.close(handle)
    try:
        connection = sqlite3.connect(temp_name)
        with connection:
            connection.execute("CREATE TABLE metadata(value TEXT NOT NULL)")
            connection.execute("INSERT INTO metadata VALUES (?)", (json.dumps(manifest),))
            connection.execute("CREATE TABLE laws(id TEXT PRIMARY KEY,title TEXT NOT NULL,page_count INTEGER NOT NULL,pdf TEXT)")
            connection.executemany("INSERT INTO laws VALUES(?,?,?,?)", [(law['id'], law['title'], law['page_count'], pdf_mapping.get(law['id'])) for law in laws])
            connection.execute("CREATE TABLE chunks(id TEXT PRIMARY KEY,law_id TEXT NOT NULL,law_title TEXT NOT NULL,page INTEGER NOT NULL,article TEXT,excerpt TEXT NOT NULL)")
            connection.execute("CREATE VIRTUAL TABLE search USING fts5(chunk_id UNINDEXED, title, text, tokenize='unicode61')")
            connection.executemany("INSERT INTO chunks VALUES (?,?,?,?,?,?)", [(c['id'], c['law_id'], c['law_title'], c['page'], c['article'], c['excerpt']) for c in chunks])
            connection.executemany("INSERT INTO search VALUES (?,?,?)", [(c['id'], ' '.join(tokens(c['law_title'])), ' '.join(tokens(c['excerpt']))) for c in chunks])
        connection.close()
        os.replace(temp_name, data_dir / "index.sqlite3")
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)
    return manifest


class CorpusStore:
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir.resolve()
        self.path = self.data_dir / "index.sqlite3"
        self.manifest = self._load_manifest()

    def connect(self):
        db = sqlite3.connect(f"{self.path.as_uri()}?mode=ro", uri=True)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA query_only=ON")
        return db

    def _load_manifest(self):
        if not self.path.is_file():
            raise ValueError("Index missing; run explicit build command")
        with closing(self.connect()) as db:
            manifest = json.loads(db.execute("SELECT value FROM metadata").fetchone()[0])
        source = self.data_dir / "clean_law_preprocessed.txt"
        if manifest.get("schema_version") != SCHEMA_VERSION or not source.is_file() or hashlib.sha256(source.read_bytes()).hexdigest() != manifest.get("sha256"):
            raise ValueError("Corpus/index mismatch; rebuild explicitly")
        if manifest.get("chunk_count", 0) < 1:
            raise ValueError("Corpus index empty")
        return manifest

    def catalog(self):
        with closing(self.connect()) as db:
            return [{"id": r['id'], "title": r['title'], "page_count": r['page_count'], "has_pdf": bool(r['pdf'])} for r in db.execute("SELECT * FROM laws ORDER BY title")]

    def pdf_path(self, ident: str):
        if not re.fullmatch(r"[a-f0-9]{20}", ident):
            return None
        with closing(self.connect()) as db:
            row = db.execute("SELECT pdf FROM laws WHERE id=?", (ident,)).fetchone()
        if row is None or not row['pdf']:
            return None
        root = (self.data_dir / "pdfs").resolve()
        path = (root / row['pdf']).resolve()
        return path if path.parent == root and path.is_file() else None

    def search(self, query: str, max_results: int = 6):
        if not isinstance(query, str) or not query.strip() or len(query) > 16000:
            raise ValueError("query must contain 1..16000 characters")
        if isinstance(max_results, bool) or not isinstance(max_results, int) or not 1 <= max_results <= 10:
            raise ValueError("max_results must be an integer in 1..10")
        primary = list(dict.fromkeys(t for t in tokens(query) if t not in STOP_WORDS and not t.isdigit()))[:40]
        if not primary:
            return []
        expanded = list(dict.fromkeys(t for token in primary for t in ALIASES.get(token, [token])))[:64]
        # Terms come only from normalized alphanumeric tokens, never FTS syntax.
        expression = " OR ".join('"' + t + '"*' for t in expanded)
        requested = ARTICLE.search(query) or re.search(r"(?:الماده|ماده)\s+(\d+)", normalized(query))
        requested_article = str(int(normalized(requested.group(1)))) if requested else None
        with closing(self.connect()) as db:
            # Respect an explicitly named law, and distinguish ordinary workers
            # from the separate special regimes for intelligence/security staff.
            laws = db.execute('SELECT id,title FROM laws').fetchall()
            query_normal = normalized(query)
            selected = [law['id'] for law in laws if normalized(law['title']) in query_normal]
            if not selected and 'عامل' in primary:
                selected = [law['id'] for law in laws if 'عمل' in tokens(law['title'])]
            restriction = ' AND c.law_id IN (' + ','.join('?' for _ in selected) + ')' if selected else ''
            if requested_article:
                # Exact legal references must not be excluded by the lexical
                # candidate limit, or replaced with a different article.
                rows = db.execute("SELECT c.*,0.0 rank FROM chunks c WHERE c.article = ?" + restriction + " LIMIT 150", (requested_article, *selected)).fetchall()
            else:
                rows = db.execute("SELECT c.*,bm25(search,0,2,1) rank FROM search JOIN chunks c ON c.id=search.chunk_id WHERE search MATCH ?" + restriction + " ORDER BY rank LIMIT 150", (expression, *selected)).fetchall()
        scored = []
        for row in rows:
            text_tokens = set(tokens(row['excerpt']))
            title_tokens = set(tokens(row['law_title']))
            hits = sum(any(any(word.startswith(alias) for word in text_tokens) for alias in ALIASES.get(term, [term])) for term in primary)
            if hits == 0 and not (requested_article and selected):
                continue
            if 'سنويه' in primary and not any(t.startswith('سنوي') for t in text_tokens):
                continue
            title_hits = sum(any(alias in title_tokens for alias in ALIASES.get(term, [term])) for term in primary)
            coverage = hits / len(primary)
            score = coverage + 0.20 * title_hits + min(0.30, max(0, -row['rank']) / 30)
            if requested_article and row['article'] == requested_article:
                score += 1.5
            result = {k: row[k] for k in ('id', 'law_id', 'law_title', 'page', 'article', 'excerpt')}
            result['score'] = round(score, 4)
            scored.append(result)
        scored.sort(key=lambda item: (-item['score'], item['id']))
        return scored[:max_results]


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Explicitly build law corpus index")
    parser.add_argument('command', choices=['build'])
    parser.add_argument('--data-dir', type=Path, default=Path(__file__).parent / 'data')
    args = parser.parse_args()
    print(json.dumps(build_index(args.data_dir), ensure_ascii=False))
