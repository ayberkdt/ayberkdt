import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { collectSnapshot, githubRequest, renderLanguages, renderOverview, updateStats } from './update-profile-stats.mjs';

const repo = (name, extra = {}) => ({
  name, owner: { login: 'ayberkdt' }, private: false, fork: false, archived: false,
  stargazers_count: 0, ...extra,
});

test('counts only public owned data and applies language exclusions', async () => {
  const queried = [];
  const snapshot = await collectSnapshot('ayberkdt', async (path) => {
    queried.push(path);
    if (path === '/users/ayberkdt') return { followers: 4 };
    if (path.includes('/repos?')) return [
      repo('sunumatik', { stargazers_count: 3 }), repo('lunaris'), repo('ayberkdt'),
      repo('fork', { fork: true, stargazers_count: 100 }),
      repo('archive', { archived: true, stargazers_count: 2 }),
      repo('secret', { private: true, stargazers_count: 999 }),
      repo('elsewhere', { owner: { login: 'someone-else' }, stargazers_count: 999 }),
    ];
    if (path.includes('/sunumatik/')) return { JavaScript: 150, Python: 50 };
    if (path.includes('/lunaris/')) return { Python: 250, 'Jupyter Notebook': 50000, CSS: 0 };
    throw new Error(`Unexpected request: ${path}`);
  }, new Date('2026-09-11T23:30:00Z'));
  assert.equal(snapshot.publicRepositories, 5);
  assert.equal(snapshot.stars, 5);
  assert.equal(snapshot.followers, 4);
  assert.equal(snapshot.updated, '2026-09-11');
  assert.deepEqual(snapshot.languageRepositories, ['lunaris', 'sunumatik']);
  assert.deepEqual(snapshot.languages, [{ name: 'Python', bytes: 300 }, { name: 'JavaScript', bytes: 150 }]);
  assert.equal(queried.filter((path) => path.endsWith('/languages')).length, 2);
});

test('paginates beyond the first 100 repositories', async () => {
  const pages = [];
  const snapshot = await collectSnapshot('ayberkdt', async (path) => {
    if (path === '/users/ayberkdt') return { followers: 0 };
    const page = Number(new URL(`https://api.github.com${path}`).searchParams.get('page'));
    pages.push(page);
    return Array.from({ length: page === 1 ? 100 : 1 }, (_, index) => repo(`fork-${page}-${index}`, { fork: true }));
  });
  assert.deepEqual(pages, [1, 2]);
  assert.equal(snapshot.publicRepositories, 101);
  assert.deepEqual(snapshot.languages, []);
});

test('handles an empty language set and escapes SVG labels', () => {
  const snapshot = { updated: '2026-09-11', publicRepositories: 0, stars: 0, followers: 0, languages: [] };
  assert.match(renderLanguages(snapshot), /No public source-language data yet/);
  assert.doesNotMatch(renderLanguages(snapshot), /NaN|Infinity/);
  assert.match(renderOverview(snapshot), /Public repositories: 0/);
  snapshot.languages = Array.from({ length: 7 }, (_, index) => ({ name: `A<&${index}`, bytes: 100 - index }));
  const svg = renderLanguages(snapshot);
  assert.match(svg, /A&lt;&amp;0/);
  assert.match(svg, />Other</);
  assert.doesNotMatch(svg, /A&lt;&amp;5/);
  const widths = [...svg.matchAll(/width="([\d.]+)" height="12"/g)].map((match) => Number(match[1]));
  assert.ok(Math.abs(widths.reduce((sum, width) => sum + width, 0) - 392) < 0.01);
});

test('retries transient server errors and fails clearly on rate-limit denial', async () => {
  let calls = 0;
  const result = await githubRequest('/users/ayberkdt', {
    sleep: async () => {},
    fetcher: async () => ++calls < 3 ? { ok: false, status: 503 } : { ok: true, json: async () => ({ followers: 4 }) },
  });
  assert.equal(calls, 3);
  assert.equal(result.followers, 4);
  await assert.rejects(githubRequest('/users/ayberkdt', {
    sleep: async () => {}, fetcher: async () => ({ ok: false, status: 403 }),
  }), /HTTP 403/);
});

test('failed language collection preserves all previously generated files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'profile-stats-test-'));
  const filenames = ['overview.svg', 'languages.svg', 'snapshot.json'];
  try {
    for (const filename of filenames) await writeFile(join(directory, filename), 'last successful snapshot');
    await assert.rejects(updateStats({
      output: pathToFileURL(`${directory}/`),
      request: async (path) => {
        if (path === '/users/ayberkdt') return { followers: 4 };
        if (path.includes('/repos?')) return [repo('lunaris')];
        throw new Error('Simulated language API failure');
      },
    }), /Simulated language API failure/);
    for (const filename of filenames) assert.equal(await readFile(join(directory, filename), 'utf8'), 'last successful snapshot');
  } finally {
    // This directory is the unique test-owned directory returned by mkdtemp above.
    await rm(directory, { recursive: true, force: true });
  }
});

test('invalid counts fail instead of silently generating incorrect statistics', async () => {
  await assert.rejects(collectSnapshot('ayberkdt', async (path) => {
    if (path === '/users/ayberkdt') return { followers: 4 };
    if (path.includes('/repos?')) return [repo('lunaris')];
    return { Python: -1 };
  }), /Invalid GitHub count/);
});
