let serverUrl = (localStorage.getItem('server_url') || 'http://localhost:3000')
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/api\/?$/, '');

export function setServerUrl(url) {
  serverUrl = (url || 'http://localhost:3000')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api\/?$/, '');
  localStorage.setItem('server_url', serverUrl);
}

export function getServerUrl() {
  return serverUrl;
}

export async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('access_token');
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

  // Normalize endpoint to prevent duplicate /api or missing slashes
  const baseUrl = (serverUrl || 'http://localhost:3000')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api\/?$/, '');

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
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
          });
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            localStorage.setItem('access_token', refreshData.accessToken);
            localStorage.setItem('refresh_token', refreshData.refreshToken);

            // Retry original request with new token
            headers['Authorization'] = `Bearer ${refreshData.accessToken}`;
            response = await fetch(url, { ...config, headers });
          } else {
            // Refresh failed, logout
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            window.location.reload();
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
