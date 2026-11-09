const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('github.js', 'utf8');
class Element {
  constructor() { this.children = []; this.dataset = {}; this.attrs = {}; this.events = {}; this.style = { setProperty() {} }; this.textContent = ''; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(key, value) { this.attrs[key] = value; }
  addEventListener(key, handler) { this.events[key] = handler; }
}
async function setup({ fail = false, empty = false, cached = null } = {}) {
  const nodes = new Map();
  const get = (id) => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); };
  const periods = [7, 14, 30].map(days => Object.assign(new Element(), { dataset: { days: String(days) } }));
  const calls = [];
  const profile = { login: 'pontesmateuss', name: 'Mateus', avatar_url: 'https://avatars.githubusercontent.com/u/1', public_repos: 9, followers: 4 };
  const events = empty ? [] : [0, 10, 29, 40].map((age, id) => ({ id, type: 'PushEvent', created_at: new Date(Date.now() - age * 86400000).toISOString(), repo: { name: 'pontesmateuss/projeto' } }));
  vm.runInNewContext(source, {
    document: { querySelector: () => get('panel'), getElementById: get, createElement: () => new Element(), querySelectorAll: () => periods, addEventListener() {} },
    localStorage: { getItem: () => cached && JSON.stringify(cached), setItem() {} },
    fetch: async url => { calls.push(url); return { ok: !fail, status: fail ? 403 : 200, headers: { get: () => null }, json: async () => url.includes('/events/') ? events : url.includes('/repos?') ? [{ stargazers_count: 3 }, { stargazers_count: 2 }] : profile }; },
    Date, Intl, URL, AbortSignal, setInterval() {}, console
  });
  await new Promise(resolve => setImmediate(resolve));
  return { get, periods, calls };
}
test('agrega métricas e eventos por período, ignorando eventos antigos', async () => {
  const { get, periods } = await setup();
  assert.equal(get('gh-stars').textContent, '5');
  assert.equal(get('gh-events').textContent, '3');
  assert.equal(get('gh-chart').children[0].children.length, 30);
  periods[0].events.click();
  assert.equal(get('gh-events').textContent, '1');
  assert.equal(get('gh-chart').children[0].children.length, 7);
  assert.equal(periods[0].attrs['aria-pressed'], 'true');
  periods[1].events.click();
  assert.equal(get('gh-events').textContent, '2');
  assert.equal(get('panel').attrs['aria-busy'], 'false');
});
test('atividade vazia é apresentada sem dados inventados', async () => {
  const { get } = await setup({ empty: true });
  assert.equal(get('gh-events').textContent, '0');
  assert.match(get('gh-chart-summary').textContent, /Nenhum evento/);
});
test('limite da API informa falha, libera botão e bloqueia novas consultas imediatas', async () => {
  const { get, calls } = await setup({ fail: true });
  assert.match(get('gh-status').textContent, /Limite de consultas/);
  assert.equal(get('gh-refresh').disabled, false);
  const count = calls.length;
  await get('gh-refresh').events.click();
  assert.equal(calls.length, count);
});
test('cache recente evita novas consultas', async () => {
  const { get, calls } = await setup({ cached: { profile: { login: 'pontesmateuss', avatar_url: 'https://avatars.githubusercontent.com/u/1', public_repos: 9, followers: 4 }, stars: 5, events: [], savedAt: Date.now() } });
  assert.equal(calls.length, 0);
  assert.equal(get('gh-stars').textContent, '5');
});
