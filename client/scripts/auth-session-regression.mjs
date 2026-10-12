import assert from 'node:assert/strict';

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key)
};
let reloads = 0;
globalThis.window = {
  location: { protocol: 'http:', hostname: 'localhost', origin: 'http://localhost:3000', reload: () => reloads++ },
  dispatchEvent() {}
};
const { apiFetch, setServerUrl } = await import('../src/api/client.js');
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
const expired = () => json({ code: 'TOKEN_EXPIRED' }, 401);
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const reset = () => {
  values.clear();
  localStorage.setItem('access_token', 'old-access');
  localStorage.setItem('refresh_token', 'old-refresh');
  reloads = 0;
  setServerUrl('http://localhost:3000');
};

async function pendingRefresh(mutate, response, expectedAccess, expectedRefresh) {
  reset();
  const responseGate = deferred();
  const started = deferred();
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls++;
    if (url.endsWith('/auth/refresh')) { started.resolve(); return responseGate.promise; }
    return expired();
  };
  const request = apiFetch('/cases');
  await started.promise;
  mutate();
  responseGate.resolve(response);
  assert.equal((await request).status, 401);
  assert.equal(localStorage.getItem('access_token'), expectedAccess);
  assert.equal(localStorage.getItem('refresh_token'), expectedRefresh);
  assert.equal(reloads, 0);
  assert.equal(calls, 2, 'An obsolete request must never retry in another session');
}

await pendingRefresh(() => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}, json({ accessToken: 'revived-access', refreshToken: 'revived-refresh' }), null, null);
await pendingRefresh(() => {
  localStorage.setItem('access_token', 'other-access');
  localStorage.setItem('refresh_token', 'other-refresh');
}, json({ accessToken: 'revived-access', refreshToken: 'revived-refresh' }), 'other-access', 'other-refresh');
await pendingRefresh(() => {
  localStorage.setItem('access_token', 'other-access');
  localStorage.setItem('refresh_token', 'other-refresh');
}, json({}, 403), 'other-access', 'other-refresh');
await pendingRefresh(() => setServerUrl('http://localhost:4000'),
  json({ accessToken: 'revived-access', refreshToken: 'revived-refresh' }), 'old-access', 'old-refresh');

reset();
let refreshCalls = 0;
const refreshed = deferred();
const refreshStarted = deferred();
globalThis.fetch = async (url, options) => {
  if (url.endsWith('/auth/refresh')) {
    refreshCalls++;
    refreshStarted.resolve();
    await refreshed.promise;
    return json({ accessToken: 'new-access', refreshToken: 'new-refresh' });
  }
  return options.headers.Authorization === 'Bearer new-access' ? json({ success: true }) : expired();
};
const parallel = [apiFetch('/cases'), apiFetch('/clients'), apiFetch('/notifications')];
await refreshStarted.promise;
await new Promise((resolve) => setImmediate(resolve));
refreshed.resolve();
assert.ok((await Promise.all(parallel)).every((response) => response.ok));
assert.equal(refreshCalls, 1, 'Parallel expired requests share one refresh');
assert.equal(localStorage.getItem('access_token'), 'new-access');

reset();
globalThis.fetch = async (url) => url.endsWith('/auth/refresh') ? json({}, 403) : expired();
await apiFetch('/cases');
assert.equal(localStorage.getItem('access_token'), null);
assert.equal(localStorage.getItem('refresh_token'), null);
assert.equal(reloads, 1, 'An invalid current refresh session still logs out');
console.log('PASS: 6 auth refresh/session regression scenarios');
