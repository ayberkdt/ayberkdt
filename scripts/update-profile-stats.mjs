import { mkdir, rename, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const root = new URL('../', import.meta.url);
const colors = ['#67e8f9', '#a78bfa', '#fbbf24', '#5eead4', '#fb7185', '#94a3b8'];
const number = (value) => new Intl.NumberFormat('en-US').format(value);
const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
}[c]));

export async function githubRequest(path, { fetcher = fetch, sleep = delay } = {}) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ayberkdt-profile-stats',
    'X-GitHub-Api-Version': '2026-03-10',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response;
    try {
      response = await fetcher(`https://api.github.com${path}`, {
        headers, signal: AbortSignal.timeout(30_000),
      });
    } catch {
      if (attempt === 2) throw new Error(`GitHub request failed: ${path}`);
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (response.ok) return response.json();
    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    throw new Error(`GitHub returned HTTP ${response.status}: ${path}. Existing cards are kept.`);
  }
}

function count(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid GitHub count: ${field}`);
  return value;
}

export async function collectSnapshot(username, request = githubRequest, now = new Date()) {
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(username)) throw new Error('Invalid GitHub username');
  const userPath = `/users/${encodeURIComponent(username)}`;
  const profile = await request(userPath);
  const repos = [];
  for (let page = 1; ; page += 1) {
    const batch = await request(`${userPath}/repos?type=owner&sort=full_name&per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error('GitHub repository response is not an array');
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  // Keep public-only semantics even when a token can see additional data.
  const publicRepos = repos.filter((repo) => repo.private === false
    && repo.owner?.login?.toLowerCase() === username.toLowerCase());
  const originalRepos = publicRepos.filter((repo) => !repo.fork);
  const sourceRepos = originalRepos.filter((repo) => !repo.archived
    && repo.name.toLowerCase() !== username.toLowerCase());
  const totals = new Map();
  // A failed or partial language request aborts before any generated files are written.
  for (const repo of sourceRepos) {
    const languages = await request(`/repos/${encodeURIComponent(username)}/${encodeURIComponent(repo.name)}/languages`);
    if (!languages || Array.isArray(languages) || typeof languages !== 'object') {
      throw new Error(`Invalid language response for ${repo.name}`);
    }
    for (const [language, bytes] of Object.entries(languages)) {
      count(bytes, `language bytes in ${repo.name}`);
      if (language === 'Jupyter Notebook' || bytes === 0) continue;
      totals.set(language, (totals.get(language) ?? 0) + bytes);
    }
  }
  const languages = [...totals].map(([name, bytes]) => ({ name, bytes }))
    .sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name));
  return {
    username,
    updated: now.toISOString().slice(0, 10),
    source: 'GitHub REST API: public owned repositories and repository language bytes',
    publicRepositories: publicRepos.length,
    stars: originalRepos.reduce((sum, repo) => sum + count(repo.stargazers_count, 'stars'), 0),
    followers: count(profile.followers, 'followers'),
    languageRepositories: sourceRepos.map((repo) => repo.name).sort(),
    languageExclusions: ['forks', 'archived repositories', 'profile repository', 'Jupyter Notebook'],
    languages,
  };
}

function card(title, description, updated, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="280" viewBox="0 0 440 280" role="img" aria-labelledby="title desc">
  <title id="title">${escape(title)}</title>
  <desc id="desc">${escape(description)}</desc>
  <defs><linearGradient id="accent"><stop stop-color="#67e8f9"/><stop offset="1" stop-color="#a78bfa"/></linearGradient></defs>
  <rect x="0.5" y="0.5" width="439" height="279" rx="18" fill="#0b1220" stroke="#263449"/>
  <path d="M24 1h392" stroke="url(#accent)" stroke-width="2"/>
  <g font-family="Segoe UI, Arial, sans-serif">
    <text x="24" y="38" font-size="19" font-weight="700" fill="#e2e8f0">${escape(title)}</text>
    ${body}
    <path d="M24 242h392" stroke="#263449"/>
    <circle cx="28" cy="260" r="3" fill="#5eead4"/>
    <text x="39" y="264" font-size="11" fill="#94a3b8">PUBLIC DATA · ${escape(updated)} UTC</text>
    <text x="416" y="264" text-anchor="end" font-size="11" fill="#94a3b8">@ayberkdt</text>
  </g>
</svg>
`;
}

export function renderOverview(snapshot) {
  const metrics = [
    ['Public repositories', snapshot.publicRepositories],
    ['Stars earned', snapshot.stars],
    ['Followers', snapshot.followers],
    ['Source languages', snapshot.languages.length],
  ];
  const body = metrics.map(([label, value], index) => {
    const x = 24 + (index % 2) * 212;
    const y = 99 + Math.floor(index / 2) * 89;
    return `<text x="${x}" y="${y}" font-size="34" font-weight="700" fill="${colors[index]}">${number(value)}</text>
    <text x="${x}" y="${y + 24}" font-size="13" fill="#cbd5e1">${label}</text>`;
  }).join('\n    ');
  return card('GitHub at a glance', metrics.map(([label, value]) => `${label}: ${value}`).join('. '), snapshot.updated, body);
}

export function renderLanguages(snapshot) {
  const total = snapshot.languages.reduce((sum, language) => sum + language.bytes, 0);
  const visible = snapshot.languages.slice(0, 5);
  if (snapshot.languages.length > 5) visible.push({
    name: 'Other', bytes: snapshot.languages.slice(5).reduce((sum, language) => sum + language.bytes, 0),
  });
  let offset = 24;
  const segments = visible.map((language, index) => {
    const width = language.bytes / total * 392;
    const segment = `<rect x="${offset.toFixed(3)}" y="64" width="${width.toFixed(3)}" height="12" fill="${colors[index]}"/>`;
    offset += width;
    return segment;
  }).join('\n    ');
  const rows = visible.map((language, index) => {
    const y = 103 + index * 21;
    const share = language.bytes / total * 100;
    const percentage = share < 0.1 ? '&lt;0.1%' : `${share.toFixed(1)}%`;
    return `<circle cx="29" cy="${y - 4}" r="4" fill="${colors[index]}"/>
    <text x="42" y="${y}" font-size="13" fill="#e2e8f0">${escape(language.name)}</text>
    <text x="416" y="${y}" text-anchor="end" font-size="13" fill="#cbd5e1">${percentage}</text>`;
  }).join('\n    ');
  const body = total ? `${segments}\n    ${rows}`
    : '<text x="24" y="120" font-size="14" fill="#cbd5e1">No public source-language data yet.</text>';
  return card('Source languages', 'Share of public source code by bytes. Forks, archives, the profile repository, and notebooks excluded.', snapshot.updated,
    `${body}\n    <text x="24" y="230" font-size="11" fill="#94a3b8">CODE BYTES · NOTEBOOKS EXCLUDED</text>`);
}

export async function updateStats({ username = 'ayberkdt', request = githubRequest, output = new URL('assets/stats/', root) } = {}) {
  const snapshot = await collectSnapshot(username, request);
  const files = {
    'overview.svg': renderOverview(snapshot),
    'languages.svg': renderLanguages(snapshot),
    'snapshot.json': `${JSON.stringify(snapshot, null, 2)}\n`,
  };
  await mkdir(output, { recursive: true });
  for (const [filename, content] of Object.entries(files)) {
    const target = new URL(filename, output);
    const temporary = new URL(`${filename}.tmp`, output);
    await writeFile(temporary, content, 'utf8');
    await rename(temporary, target);
  }
  console.log(`Updated ${snapshot.username}: ${snapshot.publicRepositories} public repos, ${snapshot.languages.length} source languages (${snapshot.updated}).`);
  return snapshot;
}

if (import.meta.main) {
  updateStats().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
