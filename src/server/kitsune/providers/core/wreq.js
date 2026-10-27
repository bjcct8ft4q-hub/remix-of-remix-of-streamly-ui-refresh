// The original used wreq-js (a native browser-impersonating client), which cannot run on this host.
// Falls back to standard fetch; providers that require impersonation may be blocked by their sites.
export async function wreqFetch(url, options = {}) {
  const { session, browser, os, warm = [], ...request } = options;
  for (const item of warm) {
    try { await fetch(item.url, { method: item.method ?? "GET", headers: item.headers, body: item.body, redirect: item.redirect ?? "follow" }); } catch {}
  }
  return fetch(url, request);
}
