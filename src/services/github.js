
// Imports skills + projects from a public GitHub profile.
// Uses a Personal Access Token when available to increase API rate limits.

const { extractSkills } = require('./extractor');

const LANG_MAP = {
  Shell: 'Linux',
  Dockerfile: 'Docker',
  'Jupyter Notebook': 'Python',
  Vue: 'Vue.js',
  HCL: 'Terraform',
  SCSS: 'CSS',
  Makefile: 'Linux',
  TSX: 'TypeScript'
};

async function gh(path) {
  const headers = {
    'User-Agent': 'skillgraph',
    Accept: 'application/vnd.github+json'
  };

  // Authenticate GitHub API requests using the environment token.
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const res = await fetch(`https://api.github.com${path}`, {
    headers
  });

  if (res.status === 404) {
    const e = new Error('GitHub user not found');
    e.status = 404;
    throw e;
  }

  if (res.status === 403 || res.status === 429) {
    const e = new Error(
      'GitHub rate limit reached. Please try again later.'
    );
    e.status = 429;
    throw e;
  }

  if (!res.ok) {
    const e = new Error(`GitHub error ${res.status}`);
    e.status = 502;
    throw e;
  }

  return res.json();
}

async function importGithub(username, matchers, byName) {
  if (!/^[A-Za-z0-9-]{1,39}$/.test(username || '')) {
    const e = new Error('Invalid GitHub username');
    e.status = 400;
    throw e;
  }

  const [user, repos] = await Promise.all([
    gh(`/users/${username}`),
    gh(`/users/${username}/repos?per_page=100&sort=pushed`)
  ]);

  const own = repos.filter((r) => !r.fork);

  const langCount = new Map();

  for (const r of own) {
    if (r.language) {
      langCount.set(
        r.language,
        (langCount.get(r.language) || 0) + 1
      );
    }
  }

  const acc = new Map();

  const bump = (name, level, evidence) => {
    const sk = byName.get(name);

    if (!sk) return;

    const id = String(sk._id);
    const cur = acc.get(id);

    if (!cur || cur.level < level) {
      acc.set(id, {
        skillId: id,
        name: sk.name,
        domain: sk.domain,
        level,
        confidence: 0.8,
        mentions: 1,
        evidence,
        sources: ['github']
      });
    }
  };

  // Identify skills from repository programming languages.
  for (const [lang, n] of langCount) {
    const level = n >= 6 ? 3 : n >= 2 ? 2 : 1;
    const name = LANG_MAP[lang] || lang;

    bump(
      name,
      level,
      `${n} public repo${n > 1 ? 's' : ''} written mainly in ${lang}`
    );

    const found = extractSkills(name, matchers, {
      source: 'github'
    });

    for (const f of found) {
      bump(
        f.name,
        level,
        `${n} public repo${n > 1 ? 's' : ''} written mainly in ${lang}`
      );
    }
  }

  // Analyse the top 12 repositories.
  const top = own
    .sort(
      (a, b) =>
        b.stargazers_count - a.stargazers_count ||
        new Date(b.pushed_at) - new Date(a.pushed_at)
    )
    .slice(0, 12);

  const projects = top.map((r) => {
    const text = `${r.name.replace(/[-_]/g, ' ')}
${r.description || ''}
${(r.topics || []).join(' ')}
${r.language || ''}`;

    const found = extractSkills(text, matchers, {
      source: 'github'
    });

    for (const f of found) {
      bump(f.name, 1, `Used in GitHub repo "${r.name}"`);
    }

    const lang = LANG_MAP[r.language] || r.language;
    const names = new Set(found.map((f) => f.name));

    if (lang && byName.has(lang)) {
      names.add(lang);
    }

    return {
      title: r.name,
      description: r.description || '',
      url: r.html_url,
      repo: r.html_url,
      stars: r.stargazers_count,
      skills: [...names]
    };
  });

  return {
    profile: {
      name: user.name || username,
      bio: user.bio || '',
      location: user.location || '',
      github: username
    },

    skills: [...acc.values()].sort(
      (a, b) =>
        b.level - a.level ||
        a.name.localeCompare(b.name)
    ),

    projects,

    stats: {
      publicRepos: user.public_repos,
      analysed: own.length,
      languages: Object.fromEntries(langCount)
    }
  };
}

module.exports = { importGithub };
