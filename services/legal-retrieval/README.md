# Private Libyan law retrieval

Python 3.11+ standard library only, with SQLite FTS5. This replaces the source
project's heavy Chroma/PyTorch runtime with Arabic-normalized lexical BM25
retrieval. It does not reproduce semantic embeddings or generate answers.
Express remains responsible for office authorization, quotas and Gemini calls.

## Data and build

Place the supplied `clean_law_preprocessed.txt` in `data/` and the 45 original
PDFs in `data/pdfs/`. This directory is ignored by Git. Do not copy `.env`,
the source virtualenv, answer caches, Chroma databases or client applications.

```sh
python retrieval.py build --data-dir data
python -m unittest discover -s tests -v
```

The build creates an atomic `index.sqlite3`, preserving source law names, PDF
pages, article identifiers and unmodified excerpts. Identifiers are deterministic.
Startup verifies the source digest and schema; it never rebuilds or deletes data.
Rebuild and restart the service explicitly after a corpus update. PDF paths use a
fixed allowlist generated during ingestion, never user-provided filenames.

The supplied corpus contains 45 law sections, 1,879 extracted page markers and
8,232 excerpts. These are dataset counts, not a completeness or currency claim.
OCR errors and missing substantive provisions remain: `قانون علاقات العمل`, for
example, contains only the enactment page. Base laws and amendments remain
separate; this service does not determine amendment precedence or current law.

## Run

Configure process environment from `.env.example` using your service manager;
this service does not implicitly load `.env`. Set a random shared
`LEGAL_RETRIEVAL_TOKEN` of at least 32 characters, then run `python server.py`.
The default listener is `127.0.0.1:8100`; non-loopback binding is rejected.
No public reverse-proxy location should expose this port. Restart after changing
data or environment. Requests do not persist queries or answers and are not logged.
Four concurrent requests are permitted by default, bounded at 16.

All endpoints require `Authorization: Bearer <internal token>`:

- `GET /health`: `{status:"ok",ready:true,corpus:{sha256,schema_version,law_count,page_count,chunk_count,pdf_count}}`
- `POST /search`: `{query,max_results:6}` → `{sources:[{id,law_id,law_title,page,article,excerpt,score}],corpus}`. `article` is a string or null. No matching texts returns an empty list.
- `GET /laws`: `{laws:[{id,title,page_count,has_pdf}],corpus}`.
- `GET /laws/{law_id}/pdf`: the mapped original PDF or 404.

Query limits: 1..16,000 characters, 64 KiB JSON bodies, 1..10 results. Excerpts
are at most 5,000 characters. Arabic normalization and a small audited synonym
set affect only search fields; returned source excerpts remain original.
Unknown parameters, malformed JSON and invalid limits fail with 400, missing
authentication with 401, oversized bodies with 413, unavailable capacity with 503.

The API provides retrieved evidence, not a confidence score or a guarantee of
legal relevance. The generation layer must abstain when evidence does not answer
the requested question and must cite only returned identifiers and excerpts.
