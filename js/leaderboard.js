/* Flappy Grey — route records (top score + 4-letter name per route).
 *
 * Online mode: Firebase Firestore via its REST API (no SDK, no build step). One document per
 * route in the "leaderboard" collection: { name: "JACK", score: 42 }. Firestore security
 * rules (README) only accept a write that beats the stored score, so a stale client can't
 * overwrite a better record.
 * Local mode (no config): records are kept on this device in localStorage.
 */
(function () {
  'use strict';
  const FG = window.FG;
  const { storage } = FG.util;
  const cfg = FG.LEADERBOARD_CONFIG || {};
  const online = !!(cfg.projectId && cfg.apiKey);
  const BASE = online
    ? `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(cfg.projectId)}/databases/(default)/documents/leaderboard`
    : null;
  const LOCAL_KEY = 'flappygrey.records';
  const NAME_KEY = 'flappygrey.lastName';
  const cache = {};
  let status = online ? 'loading' : 'local'; // loading | online | offline | local

  function cleanName(s) {
    return String(s || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  }

  function timedFetch(url, opts, ms) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = ctl ? setTimeout(() => ctl.abort(), ms || 6000) : null;
    return fetch(url, Object.assign({}, opts, ctl ? { signal: ctl.signal } : {})).finally(() => t && clearTimeout(t));
  }

  function parseDoc(d) {
    const f = d.fields || {};
    const name = f.name && f.name.stringValue;
    const score = f.score && parseInt(f.score.integerValue, 10);
    if (!name || !Number.isFinite(score)) return null;
    return { name: cleanName(name), score };
  }

  async function refresh() {
    if (!online) {
      Object.assign(cache, storage.get(LOCAL_KEY, {}));
      return cache;
    }
    try {
      const res = await timedFetch(`${BASE}?pageSize=20&key=${encodeURIComponent(cfg.apiKey)}`, {}, 6000);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      for (const d of json.documents || []) {
        const id = d.name.split('/').pop();
        const rec = parseDoc(d);
        if (rec) cache[id] = rec;
      }
      status = 'online';
    } catch (e) {
      status = 'offline';
    }
    return cache;
  }

  function get(routeId) {
    return cache[routeId] || null;
  }

  /** True when this score would take the route record (as far as we currently know). */
  function qualifies(routeId, score) {
    if (score <= 0 || status === 'offline' || status === 'loading') return false;
    const r = cache[routeId];
    return !r || score > r.score;
  }

  async function submit(routeId, name, score) {
    name = cleanName(name);
    if (name.length !== 4) return { ok: false, reason: 'name' };
    storage.set(NAME_KEY, name);
    if (!online) {
      const all = storage.get(LOCAL_KEY, {});
      if (all[routeId] && all[routeId].score >= score) return { ok: false, reason: 'beaten', record: all[routeId] };
      all[routeId] = { name, score };
      storage.set(LOCAL_KEY, all);
      cache[routeId] = { name, score };
      return { ok: true };
    }
    try {
      const body = { fields: { name: { stringValue: name }, score: { integerValue: String(score) } } };
      const res = await timedFetch(`${BASE}/${encodeURIComponent(routeId)}?key=${encodeURIComponent(cfg.apiKey)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }, 8000);
      if (res.ok) {
        cache[routeId] = { name, score };
        return { ok: true };
      }
      // Rejected by the rules: most likely someone else set a higher score meanwhile
      await refresh();
      return { ok: false, reason: 'beaten', record: cache[routeId] || null };
    } catch (e) {
      return { ok: false, reason: 'network' };
    }
  }

  FG.Leaderboard = {
    refresh,
    get,
    qualifies,
    submit,
    cleanName,
    lastName: () => cleanName(storage.get(NAME_KEY, '')),
    get online() { return online; },
    get status() { return status; },
    label: () => (online ? 'World record' : 'Device record'),
  };
})();
