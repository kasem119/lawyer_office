import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'office-legal-assistant-'));
Object.assign(process.env, {
  NODE_ENV: 'test', DB_PATH: ':memory:',
  UPLOADS_DIR: path.join(temporaryRoot, 'uploads'), BACKUPS_DIR: path.join(temporaryRoot, 'backups'),
  JWT_SECRET: 'legal-assistant-test-access-secret', JWT_REFRESH_SECRET: 'legal-assistant-test-refresh-secret',
  ENCRYPTION_KEY: 'legal-assistant-test-encryption-key',
  AI_PROVIDER: 'mustashar', LEGAL_RETRIEVAL_URL: 'http://127.0.0.1:8100',
  LEGAL_RETRIEVAL_TOKEN: 'integration-test-private-token-at-least-32', GEMINI_API_KEY: 'integration-test-not-a-real-key',
  GEMINI_MODEL: 'gemini-test',
});

const originalFetch = globalThis.fetch;
const upstreamCalls = [];
let retrievalReply;
let generationReply;
let generationGate;
let passed = 0;
let failed = 0;
const checks = [];
const check = (name, run) => checks.push({ name, run });
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json' },
});
const corpus = { sha256: 'a'.repeat(64), schema_version: 1, law_count: 1, page_count: 4, chunk_count: 2, pdf_count: 1 };
const source = { id: 'b'.repeat(24), law_id: 'c'.repeat(20), law_title: 'قانون الاختبار', page: 2, article: '7', excerpt: 'المادة 7: هذه مادة اختبار تتعلق بحقوق المؤجر والمستأجر.', score: 1 };
const generated = { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ title: 'مسودة اختبار', content: 'يستند هذا التحليل إلى المقتطف المتاح [1].', advice: 'MODEL ADVICE MUST NOT REPLACE NOTICE' }) }] } }] };
const defaultRetrieval = (url, init) => {
  if (url.pathname === '/health') return json({ status: 'ok', ready: true, corpus });
  if (url.pathname === '/laws') return json({ laws: [{ id: source.law_id, title: source.law_title, page_count: 4, has_pdf: true }], corpus });
  if (url.pathname === '/search') {
    const body = JSON.parse(init.body);
    assert.ok(typeof body.query === 'string' && body.query.length <= 2000);
    assert.equal(body.max_results, 4);
    return json({ sources: [source], corpus });
  }
  if (url.pathname === `/laws/${source.law_id}/pdf`) return new Response('%PDF-1.7\nTEST ONLY', { headers: { 'Content-Type': 'application/pdf' } });
  return json({ detail: 'Not found' }, 404);
};

// Deny all network except the two explicitly mocked service hosts.
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  upstreamCalls.push({ url: url.href, init });
  if (url.origin === process.env.LEGAL_RETRIEVAL_URL) {
    assert.equal(new Headers(init.headers).get('authorization'), `Bearer ${process.env.LEGAL_RETRIEVAL_TOKEN}`);
    return retrievalReply(url, init);
  }
  if (url.origin === 'https://generativelanguage.googleapis.com') {
    assert.equal(url.search, '', 'Provider credential must not be placed in query strings');
    assert.equal(new Headers(init.headers).get('x-goog-api-key'), process.env.GEMINI_API_KEY);
    if (generationGate) await generationGate;
    return generationReply(url, init);
  }
  throw new Error(`Unmocked network request forbidden: ${url.origin}`);
};

try {
  const { default: app } = await import('../index.js');
  const { default: db } = await import('../database/db.js');
  const { DB_PATH, JWT_SECRET } = await import('../config.js');
  const { generateTokens } = await import('../middleware/auth.js');
  assert.equal(DB_PATH, ':memory:', 'Refuse to test against a persistent office database');
  db.prepare("INSERT INTO tenants(id,slug,name,owner_name,email,status,is_active) VALUES(902,'legal-other','Other','Owner','legal-other@test.invalid','active',1)").run();
  for (const [id, role, tenant] of [[901, 'admin', 1], [902, 'lawyer', 1], [903, 'lawyer', 902], [904, 'super_admin', 1]]) {
    db.prepare('INSERT INTO users(id,name,email,password_hash,role,tenant_id,is_active) VALUES(?,?,?,?,?,?,1)').run(id, `Legal Test ${id}`, `${id}@legal.invalid`, 'unused', role, tenant);
  }
  for (let id = 910; id < 940; id++) {
    db.prepare('INSERT INTO users(id,name,email,password_hash,role,tenant_id,is_active) VALUES(?,?,?,?,?,1,1)').run(id, `Legal Test ${id}`, `${id}@legal.invalid`, 'unused', 'lawyer');
  }
  db.prepare("INSERT INTO clients(id,name,created_by,tenant_id) VALUES(901,'PRIVATE CLIENT MARKER',901,1)").run();
  db.prepare("INSERT INTO clients(id,name,created_by,tenant_id) VALUES(902,'FOREIGN CLIENT MARKER',903,902)").run();
  for (const [id, tenant, lead, client] of [[901, 1, 902, 901], [902, 1, 901, 901], [903, 902, 903, 902]]) {
    db.prepare('INSERT INTO cases(id,case_number,title,client_id,lead_lawyer_id,tenant_id,opponent_name) VALUES(?,?,?,?,?,?,?)')
      .run(id, `PRIVATE CASE NUMBER ${id}`, `Case ${id}`, client, lead, tenant, 'PRIVATE OPPONENT MARKER');
    db.prepare('INSERT INTO case_lawyers(case_id,user_id,role_in_case) VALUES(?,?,?)').run(id, lead, 'lead');
  }
  const token = id => generateTokens(db.prepare('SELECT * FROM users WHERE id=?').get(id)).accessToken;
  const portalToken = jwt.sign({ id: 902, role: 'client', tenant_id: 1 }, JWT_SECRET);
  const call = (id, method, route, body) => {
    let req = request(app)[method](route);
    if (id) req = req.set('Authorization', `Bearer ${typeof id === 'number' ? token(id) : id}`);
    return body === undefined ? req : req.send(body);
  };
  const assist = (id, body = { prompt: 'ما هي أحكام عقد الإيجار؟' }) => call(id, 'post', '/api/ai/assist', body);
  const providerCalls = () => upstreamCalls.filter(({ url }) => url.startsWith('https://generativelanguage.googleapis.com/'));

  check('Every AI endpoint requires office authentication; portal and platform accounts are denied', async () => {
    for (const [method, url, body] of [
      ['post', '/api/ai/assist', { prompt: 'سؤال قانوني' }],
      ['get', '/api/ai/status'], ['get', '/api/ai/laws'], ['get', '/api/ai/laws/test-law/pdf'],
    ]) {
      assert.equal((await call(null, method, url, body)).status, 401);
      assert.equal((await call(portalToken, method, url, body)).status, 403);
      assert.equal((await call(904, method, url, body)).status, 403);
    }
    assert.equal(upstreamCalls.length, 0, 'Denied caller reached an upstream service');
  });

  check('Foreign-office and same-office unassigned cases are rejected before retrieval or generation', async () => {
    for (const case_id of [902, 903]) {
      assert.equal((await assist(902, { mode: 'summarize_case', case_id })).status, 404);
    }
    assert.equal(upstreamCalls.length, 0);
  });

  check('Malformed modes, case IDs and oversized prompts are rejected before provider work', async () => {
    for (const body of [
      { prompt: {} }, { prompt: 42 }, { prompt: 'x', mode: 'unknown' }, { prompt: '   ' },
      { prompt: 'x'.repeat(16001) }, { prompt: 'x'.repeat(4001) }, { mode: 'summarize_case' },
      { mode: 'summarize_case', case_id: '../secret' }, { mode: 'summarize_case', case_id: -1 },
    ]) assert.equal((await assist(910, body)).status, 400, JSON.stringify(body).slice(0, 100));
    assert.equal(upstreamCalls.length, 0);
  });

  check('PDF identifiers reject encoded traversal and filesystem names', async () => {
    for (const lawId of ['%2E%2E%2Fsecret', '%2E%2E%5Csecret', 'secret.env', 'C%3A%5Csecret', '%00']) {
      const res = await call(911, 'get', `/api/ai/laws/${lawId}/pdf`);
      assert.ok([400, 404].includes(res.status), `Unsafe PDF identifier returned ${res.status}`);
    }
    assert.equal(providerCalls().length, 0);
  });

  check('Authenticated status and law catalog report actual retrieval readiness without generating answers', async () => {
    const status = await call(912, 'get', '/api/ai/status');
    assert.equal(status.status, 200);
    assert.equal(status.body.data.ready, true);
    assert.equal(status.body.data.corpus.law_count, 1);
    const laws = await call(912, 'get', '/api/ai/laws');
    assert.equal(laws.status, 200);
    assert.equal(laws.body.data.laws[0].id, source.law_id);
    assert.equal(providerCalls().length, 0);
    assert.ok(!JSON.stringify(status.body).includes(process.env.LEGAL_RETRIEVAL_TOKEN));
  });

  check('Missing private service token fails readiness and assistant requests before network', async () => {
    const saved = process.env.LEGAL_RETRIEVAL_TOKEN;
    delete process.env.LEGAL_RETRIEVAL_TOKEN;
    try {
      const status = await call(913, 'get', '/api/ai/status');
      assert.equal(status.status, 200);
      assert.equal(status.body.data.ready, false);
      assert.equal((await assist(913)).status, 503);
      assert.equal(upstreamCalls.length, 0);
    } finally { process.env.LEGAL_RETRIEVAL_TOKEN = saved; }
  });

  check('No retrieved evidence returns an explicit result without any generation or invented references', async () => {
    retrievalReply = () => json({ sources: [], corpus });
    const res = await assist(914);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.source, 'mustashar');
    assert.equal(res.body.data.no_evidence, true);
    assert.deepEqual(res.body.data.sources, []);
    assert.equal(providerCalls().length, 0);
  });

  check('Authorized case summary minimizes identifiers and performs one bounded generation with trusted sources', async () => {
    const res = await assist(902, { mode: 'summarize_case', case_id: 901 });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.source, 'mustashar');
    assert.equal(res.body.data.no_evidence, false);
    assert.equal(providerCalls().length, 1);
    assert.equal(res.body.data.sources[0].law_id, source.law_id);
    assert.equal(res.body.data.sources[0].page, source.page);
    assert.notEqual(res.body.data.advice, 'MODEL ADVICE MUST NOT REPLACE NOTICE');
    const bodies = upstreamCalls.map(({ init }) => init.body || '').join('\n');
    for (const marker of ['PRIVATE CLIENT MARKER', 'PRIVATE OPPONENT MARKER', 'PRIVATE CASE NUMBER']) assert.ok(!bodies.includes(marker), `Sent identifying case field ${marker}`);
    const generation = JSON.parse(providerCalls()[0].init.body);
    assert.equal(generation.generationConfig.maxOutputTokens, 1200);
    assert.equal(generation.generationConfig.responseMimeType, 'application/json');
    assert.ok(!JSON.stringify(res.body).includes(process.env.GEMINI_API_KEY));
  });

  check('Identical questions from different offices are independently retrieved and generated', async () => {
    const first = await assist(915);
    const second = await assist(903);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(providerCalls().length, 2, 'Shared answer cache reused another caller response');
    assert.equal(upstreamCalls.filter(({ url }) => url.endsWith('/search')).length, 2);
  });

  check('Provider failure is explicit and never falls back to local template success', async () => {
    generationReply = () => json({ error: { message: 'PRIVATE PROVIDER ERROR integration-test-not-a-real-key' } }, 500);
    const res = await assist(916);
    assert.equal(res.status, 502);
    assert.equal(res.body.success, false);
    assert.ok(!JSON.stringify(res.body).includes('PRIVATE PROVIDER ERROR'));
    assert.ok(!JSON.stringify(res.body).includes(process.env.GEMINI_API_KEY));
    assert.equal(res.body.data, undefined);
  });

  check('Malformed retrieval sources and malformed generation fail closed', async () => {
    retrievalReply = () => json({ sources: [{ ...source, law_id: '../secrets' }], corpus });
    assert.equal((await assist(917)).status, 502);
    assert.equal(providerCalls().length, 0);
    retrievalReply = defaultRetrieval;
    generationReply = () => json({ candidates: [{ content: { parts: [{ text: 'unstructured response' }] } }] });
    assert.equal((await assist(917)).status, 502);
    for (const content of ['مصدر مختلق [99]', 'تنص المادة 999 على حكم غير موجود [1]']) {
      generationReply = () => json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ title: 'اختبار', content, advice: '' }) }] } }] });
      assert.equal((await assist(917)).status, 502, 'Unverified model citation was accepted');
    }
  });

  check('Law PDFs use the authenticated fixed identifier route', async () => {
    const res = await call(918, 'get', `/api/ai/laws/${source.law_id}/pdf`);
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /application\/pdf/);
    assert.equal(upstreamCalls[0].url, `${process.env.LEGAL_RETRIEVAL_URL}/laws/${source.law_id}/pdf`);
    assert.equal(providerCalls().length, 0);
  });

  check('Per-user AI quota limits ten requests per minute without blocking another user', async () => {
    retrievalReply = () => json({ sources: [], corpus });
    for (let i = 0; i < 10; i++) assert.equal((await assist(920)).status, 200, `Request ${i + 1}`);
    const limited = await assist(920);
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers['retry-after']) > 0);
    assert.equal(upstreamCalls.length, 10, 'Rate-limited request reached retrieval');
    assert.equal((await assist(921)).status, 200);
  });

  check('Global generation concurrency is capped at four and slots recover after completion', async () => {
    let release;
    generationGate = new Promise(resolve => { release = resolve; });
    const pending = [930, 931, 932, 933].map(id => assist(id).then(res => res));
    try {
      const deadline = Date.now() + 3000;
      while (providerCalls().length < 4 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
      assert.equal(providerCalls().length, 4, 'Four requests did not reach the generation barrier');
      const overflow = await assist(934);
      assert.equal(overflow.status, 429);
      assert.equal(providerCalls().length, 4, 'Overflow request started generation');
    } finally { release(); generationGate = null; }
    for (const result of await Promise.all(pending)) assert.equal(result.status, 200);
    assert.equal((await assist(935)).status, 200, 'Completed requests did not release capacity');
  });

  for (const { name, run } of checks) {
    upstreamCalls.length = 0;
    retrievalReply = defaultRetrieval;
    generationReply = () => json(generated);
    try { await run(); passed++; console.log(`PASS ${name}`); }
    catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
  }
} catch (error) {
  failed++;
  console.error(error);
} finally {
  globalThis.fetch = originalFetch;
  const resolved = path.resolve(temporaryRoot);
  if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('office-legal-assistant-')) {
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
console.log(`Legal assistant: ${passed} passed, ${failed} failed. Memory database, mocked retrieval and generation, no paid provider calls.`);
process.exit(failed ? 1 : 0);
