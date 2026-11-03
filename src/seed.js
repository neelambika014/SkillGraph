// Loads the dataset in /data into MongoDB:  catalogue (skills, careers, graph edges) + demo accounts + sample candidates.
//   npm run seed        (wipes and re-seeds)
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { User, Skill, Career, Project, Certification, Relationship, Recommendation, Roadmap } = require('./models');
const { readJson, resetContext } = require('./services/context');

const DEMO_PASSWORD = 'demo1234';

async function seed({ force = false } = {}) {
  if (!force && (await Skill.estimatedDocumentCount()) > 0) return false;
  const t0 = Date.now();
  console.log('[seed] loading dataset...');

  await Promise.all([User, Skill, Career, Project, Certification, Relationship, Recommendation, Roadmap].map((m) => m.deleteMany({})));
  await Promise.all([User, Skill, Career, Project, Certification, Relationship].map((m) => m.syncIndexes().catch(() => {})));

  const skillsJson = readJson('skills.json');
  const careersJson = readJson('careers.json');
  const candidates = readJson('candidates.json');
  const ideas = readJson('project_ideas.json');
  const certsCatalog = readJson('certifications.json');

  // --- skills
  const skillDocs = await Skill.insertMany(skillsJson.map((s) => ({ name: s.name, slug: s.slug, domain: s.domain, group: s.group, aliases: s.aliases, docs: s.docs })));
  const sid = new Map(skillDocs.map((s) => [s.name, s._id]));

  const edges = [];
  // --- PREREQUISITE edges (skill -> required earlier skill)
  for (const s of skillsJson) for (const p of s.prerequisites) {
    edges.push({ type: 'PREREQUISITE', fromKind: 'skill', fromId: sid.get(s.name), toKind: 'skill', toId: sid.get(p), weight: 1 });
  }

  // --- careers + REQUIRES edges + RELATED_TO (co-occurrence)
  const careerDocs = await Career.insertMany(careersJson.map((c) => ({ slug: c.slug, title: c.title, domain: c.domain, demand: c.demand, description: c.description })));
  const cid = new Map(careerDocs.map((c) => [c.slug, c._id]));
  const co = new Map();
  for (const c of careersJson) {
    for (const r of c.requirements) {
      edges.push({ type: 'REQUIRES', fromKind: 'career', fromId: cid.get(c.slug), toKind: 'skill', toId: sid.get(r.skill), weight: r.weight, meta: { level: r.level } });
    }
    const names = c.requirements.map((r) => r.skill).sort();
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      const k = `${names[i]}|${names[j]}`;
      co.set(k, (co.get(k) || 0) + 1);
    }
  }
  for (const [k, w] of co) {
    if (w < 2) continue;
    const [a, b] = k.split('|');
    edges.push({ type: 'RELATED_TO', fromKind: 'skill', fromId: sid.get(a), toKind: 'skill', toId: sid.get(b), weight: w });
  }

  // --- users
  const hash = await bcrypt.hash(DEMO_PASSWORD, 8);
  const users = [];
  users.push({
    name: 'Riya Demo', email: 'demo@skillgraph.dev', passwordHash: hash, role: 'candidate', headline: 'Final-year CS student exploring full-stack development',
    bio: 'I build small web apps and want to become a full stack developer.', location: 'Chennai', experienceYears: 0, interests: ['gaming', 'chess'], hobbies: ['cricket', 'photography'], goalCareer: 'full-stack-developer',
    links: { github: '' }, education: [{ school: 'Anna University', degree: 'B.E. Computer Science', year: '2027' }],
    _demo: {
      skills: { HTML: 3, CSS: 3, JavaScript: 3, React: 2, 'Node.js': 2, MongoDB: 2, Git: 2, Python: 2, 'Express.js': 1, 'Problem Solving': 3, 'Data Structures & Algorithms': 2 },
      projects: ['Personal Portfolio Website', 'Weather Dashboard'], certs: ['Meta Front-End Developer Certificate'],
    },
  });
  users.push({ name: 'Rohan Recruiter', email: 'recruiter@skillgraph.dev', passwordHash: hash, role: 'recruiter', headline: 'Talent Acquisition Lead', location: 'Bengaluru' });
  for (const c of candidates) {
    users.push({
      name: c.name, email: c.email, passwordHash: hash, role: 'candidate', headline: c.headline, location: c.location, experienceYears: c.experienceYears,
      interests: c.interests, goalCareer: c.targetCareer, synthetic: true, bio: '', _demo: {
        skills: Object.fromEntries(c.skills.map((s) => [s.name, s.level])), projects: c.projects, certs: c.certifications,
      },
    });
  }
  const userDocs = await User.insertMany(users.map(({ _demo, ...u }) => u));

  const projDocs = [];
  const certDocs = [];
  userDocs.forEach((u, i) => {
    const d = users[i]._demo;
    if (!d) return;
    for (const [name, level] of Object.entries(d.skills)) {
      if (!sid.has(name)) continue;
      edges.push({ type: 'HAS_SKILL', fromKind: 'user', fromId: u._id, toKind: 'skill', toId: sid.get(name), weight: level, meta: { level, sources: [u.synthetic ? 'seed' : 'manual'] } });
    }
    for (const p of d.projects) {
      const title = typeof p === 'string' ? p : p.title;
      const idea = ideas.find((x) => x.title === title) || (typeof p === 'object' ? p : null);
      if (!idea) continue;
      projDocs.push({ user: u._id, title: idea.title, description: idea.description, source: 'seed', skills: idea.skills.map((n) => sid.get(n)).filter(Boolean) });
    }
    for (const c of d.certs) {
      const cat = certsCatalog.find((x) => x.name === (c.name || c)) || c;
      if (!cat || !cat.name) continue;
      certDocs.push({ user: u._id, name: cat.name, issuer: cat.issuer || '', year: c.year || 2024, skills: (cat.skills || []).map((n) => sid.get(n)).filter(Boolean) });
    }
  });
  const insertedProjects = await Project.insertMany(projDocs);
  const insertedCerts = await Certification.insertMany(certDocs);
  const skillsOfUser = new Map();
  for (const e of edges) if (e.type === 'HAS_SKILL') {
    const k = String(e.fromId);
    if (!skillsOfUser.has(k)) skillsOfUser.set(k, new Set());
    skillsOfUser.get(k).add(String(e.toId));
  }
  for (const p of insertedProjects) for (const s of p.skills) edges.push({ type: 'USES', fromKind: 'project', fromId: p._id, toKind: 'skill', toId: s, weight: 1 });
  for (const c of insertedCerts) for (const s of c.skills) edges.push({ type: 'VALIDATES', fromKind: 'cert', fromId: c._id, toKind: 'skill', toId: s, weight: 1 });

  // make sure every project/cert skill is also a HAS_SKILL edge for its owner
  const seen = new Set(edges.filter((e) => e.type === 'HAS_SKILL').map((e) => `${e.fromId}|${e.toId}`));
  for (const p of insertedProjects) for (const s of p.skills) {
    const k = `${p.user}|${s}`;
    if (!seen.has(k)) { seen.add(k); edges.push({ type: 'HAS_SKILL', fromKind: 'user', fromId: p.user, toKind: 'skill', toId: s, weight: 1, meta: { level: 1, sources: ['project'] } }); }
  }

  await Relationship.insertMany(edges, { ordered: false });
  resetContext();
  console.log(`[seed] done in ${((Date.now() - t0) / 1000).toFixed(1)}s - ${skillDocs.length} skills, ${careerDocs.length} careers, ${userDocs.length} users, ${insertedProjects.length} projects, ${insertedCerts.length} certifications, ${edges.length} graph edges`);
  return true;
}

module.exports = { seed, DEMO_PASSWORD };

if (require.main === module) {
  (async () => {
    const db = require('./db');
    await db.connect();
    await seed({ force: process.argv.includes('--force') });
    await db.disconnect();
    process.exit(0);
  })().catch((e) => { console.error(e); process.exit(1); });
}
