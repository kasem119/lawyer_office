function normalizeServerUrl(url) {
  return (url || 'http://localhost:3000')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api\/?$/, '');
}

function isLocalhostUrl(url) {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return /localhost|127\.0\.0\.1/.test(url || '');
  }
}

function pageOrigin() {
  if (typeof window === 'undefined' || !window.location?.protocol?.startsWith('http')) {
    return '';
  }
  return window.location.origin;
}

function defaultServerUrl() {
  const stored = localStorage.getItem('server_url');
  const origin = pageOrigin();
  const pageHost = typeof window !== 'undefined' ? window.location.hostname : '';
  const configuredOrigin = localStorage.getItem('server_url_origin');

  // On a hosted web app, ignore legacy device-specific server addresses. They can
  // silently send a phone to an old office database while the laptop uses this site.
  // Keep a manual override only when it was explicitly selected on this same origin.
  const keepStoredServer = !origin || isLocalhostUrl(origin) || configuredOrigin === origin;
  if (stored && keepStoredServer) {
    const cleaned = normalizeServerUrl(stored);
    const staleLocalhost =
      isLocalhostUrl(cleaned) &&
      pageHost &&
      pageHost !== 'localhost' &&
      pageHost !== '127.0.0.1' &&
      pageHost !== '::1';
    if (!staleLocalhost) {
      return cleaned;
    }
  }

  if (origin) {
    return origin;
  }
  return 'http://localhost:3000';
}

let serverUrl = defaultServerUrl();
const pendingRefreshes = new Map();

function refreshAccessToken(baseUrl, accessToken, refreshToken) {
  const key = JSON.stringify([baseUrl, accessToken, refreshToken]);
  if (pendingRefreshes.has(key)) return pendingRefreshes.get(key);

  const refresh = (async () => {
    const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    const refreshData = refreshRes.ok ? await refreshRes.json() : null;
    // A completed refresh must never restore a logged-out session or overwrite a new login.
    if (normalizeServerUrl(serverUrl) !== baseUrl ||
        localStorage.getItem('access_token') !== accessToken ||
        localStorage.getItem('refresh_token') !== refreshToken) return null;

    if (refreshData?.accessToken && refreshData?.refreshToken) {
      localStorage.setItem('access_token', refreshData.accessToken);
      localStorage.setItem('refresh_token', refreshData.refreshToken);
      return refreshData.accessToken;
    }

    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.reload();
    return null;
  })().finally(() => pendingRefreshes.delete(key));

  pendingRefreshes.set(key, refresh);
  return refresh;
}

export function setServerUrl(url) {
  serverUrl = normalizeServerUrl(url);
  localStorage.setItem('server_url', serverUrl);
  const origin = pageOrigin();
  if (origin) localStorage.setItem('server_url_origin', origin);
}

export function getServerUrl() {
  return serverUrl;
}

export async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('access_token');
  const sessionRefreshToken = localStorage.getItem('refresh_token');
  const headers = {
    ...options.headers
  };

  // Don't set Content-Type if FormData (browser sets boundary automatically)
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers
  };

  const baseUrl = normalizeServerUrl(serverUrl);

  let cleanPath = endpoint;
  if (cleanPath.startsWith(baseUrl)) {
    cleanPath = cleanPath.slice(baseUrl.length);
  }
  if (cleanPath.startsWith('/api/')) {
    cleanPath = cleanPath.slice(4);
  } else if (cleanPath === '/api') {
    cleanPath = '';
  } else if (cleanPath.startsWith('api/')) {
    cleanPath = cleanPath.slice(3);
  }

  const formattedPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
  const url = `${baseUrl}/api${formattedPath === '/' ? '' : formattedPath}`;

  try {
    let response = await fetch(url, config);

    // Auto Refresh token if 403 or 401 TOKEN_EXPIRED
    if (response.status === 403 || response.status === 401) {
      const data = await response.clone().json().catch(() => ({}));
      if (data.code === 'TOKEN_EXPIRED') {
        if (sessionRefreshToken && localStorage.getItem('access_token') === token &&
            localStorage.getItem('refresh_token') === sessionRefreshToken &&
            normalizeServerUrl(serverUrl) === baseUrl) {
          const newToken = await refreshAccessToken(baseUrl, token, sessionRefreshToken);
          if (newToken && localStorage.getItem('access_token') === newToken &&
              normalizeServerUrl(serverUrl) === baseUrl) {
            headers['Authorization'] = `Bearer ${newToken}`;
            response = await fetch(url, { ...config, headers });
          }
        }
      }
    }

    return response;
  } catch (error) {
    console.error('API Fetch error:', error);
    // Notify connection context of network failure
    if (typeof window !== 'undefined' && (error.name === 'TypeError' || !navigator.onLine)) {
      window.dispatchEvent(new CustomEvent('server-disconnected'));
    }
    throw error;
  }
}
