// Profile, skills, projects and certifications (the user's career portfolio).
const express = require('express');
const mongoose = require('mongoose');
const { User, Skill, Project, Certification, Relationship, link, unlink, getUserSkills, setUserSkill } = require('../models');
const { requireAuth } = require('./auth');
const { getContext, readJson } = require('../services/context');

const router = express.Router();
router.use(requireAuth);

const isId = (v) => mongoose.isValidObjectId(v);

/** Accepts ids or names; returns ObjectIds of known catalogue skills. */
async function resolveSkills(list = []) {
  const ctx = await getContext();
  const out = new Set();
  for (const x of list) {
    if (isId(x) && ctx.byId.has(String(x))) out.add(String(x));
    else if (ctx.byName.has(x)) out.add(String(ctx.byName.get(x)._id));
    else {
      const low = String(x).toLowerCase();
      const hit = ctx.skills.find((s) => s.name.toLowerCase() === low || (s.aliases || []).some((a) => a.toLowerCase() === low));
      if (hit) out.add(String(hit._id));
    }
  }
  return [...out].map((i) => new mongoose.Types.ObjectId(i));
}

async function syncEdges(type, kind, doc) {
  await Relationship.deleteMany({ type, fromId: doc._id });
  const rows = doc.skills.map((s) => ({ type, fromKind: kind, fromId: doc._id, toKind: 'skill', toId: s, weight: 1 }));
  if (rows.length) await Relationship.insertMany(rows, { ordered: false });
}

async function ensureUserHas(userId, skillIds, source) {
  for (const s of skillIds) {
    const exists = await Relationship.exists({ type: 'HAS_SKILL', fromId: userId, toId: s });
    if (!exists) await setUserSkill(userId, s, 1, { source });
  }
}

// ---- profile ------------------------------------------------------------------------
router.get('/profile', async (req, res) => {
  const u = req.user.toObject();
  delete u.passwordHash; delete u.resumeText; delete u.shortlist;
  const [skills, projects, certs] = await Promise.all([getUserSkills(u._id), Project.countDocuments({ user: u._id }), Certification.countDocuments({ user: u._id })]);
  res.json({ profile: u, counts: { skills: skills.length, projects, certifications: certs }, interestCatalog: readJson('interests.json').map(({ id, label }) => ({ id, label })) });
});

router.put('/profile', async (req, res) => {
  const allowed = ['name', 'headline', 'bio', 'location', 'experienceYears', 'interests', 'hobbies', 'goalCareer', 'links', 'education'];
  for (const k of allowed) if (req.body[k] !== undefined) req.user[k] = req.body[k];
  if (req.body.goalCareer) {
    const ctx = await getContext();
    if (!ctx.careerBySlug.has(req.body.goalCareer)) return res.status(400).json({ error: 'Unknown career' });
  }
  await req.user.save();
  res.json({ ok: true });
});

// ---- skills ---------------------------------------------------------------------------
router.get('/skills', async (req, res) => {
  const ctx = await getContext();
  const q = String(req.query.q || '').toLowerCase();
  let list = ctx.skills;
  if (q) list = list.filter((s) => s.name.toLowerCase().includes(q) || (s.aliases || []).some((a) => a.includes(q)));
  if (req.query.domain) list = list.filter((s) => s.domain === req.query.domain);
  res.json({ skills: list.slice(0, +req.query.limit || 500).map((s) => ({ id: String(s._id), name: s.name, domain: s.domain, group: s.group })), domains: [...new Set(ctx.skills.map((s) => s.domain))] });
});

router.get('/skills/mine', async (req, res) => {
  const mine = await getUserSkills(req.user._id);
  res.json({ skills: mine.map((m) => ({ id: String(m.skill._id), name: m.skill.name, domain: m.skill.domain, group: m.skill.group, level: m.level, sources: m.sources, evidence: m.evidence })).sort((a, b) => b.level - a.level || a.name.localeCompare(b.name)) });
});

router.put('/skills/mine', async (req, res) => {
  const items = Array.isArray(req.body.skills) ? req.body.skills : [];
  for (const it of items) {
    const [id] = await resolveSkills([it.skillId || it.id || it.name]);
    if (!id) continue;
    if (!it.level) await unlink('HAS_SKILL', req.user._id, id);
    else await setUserSkill(req.user._id, id, +it.level, { source: it.source || 'manual', evidence: it.evidence || '' });
  }
  res.json({ ok: true });
});

router.delete('/skills/mine/:skillId', async (req, res) => {
  if (!isId(req.params.skillId)) return res.status(400).json({ error: 'Bad skill id' });
  await unlink('HAS_SKILL', req.user._id, req.params.skillId);
  res.json({ ok: true });
});

// ---- projects -------------------------------------------------------------------------
const projectOut = async (rows) => {
  const ctx = await getContext();
  return rows.map((p) => ({ id: String(p._id), title: p.title, description: p.description, url: p.url, repo: p.repo, stars: p.stars, source: p.source, skills: (p.skills || []).map((s) => ({ id: String(s), name: ctx.byId.get(String(s))?.name })).filter((s) => s.name) }));
};

router.get('/projects', async (req, res) => res.json({ projects: await projectOut(await Project.find({ user: req.user._id }).sort('-createdAt').lean()) }));

async function saveProject(doc, body, userId) {
  doc.title = body.title ?? doc.title;
  doc.description = body.description ?? doc.description;
  doc.url = body.url ?? doc.url;
  doc.repo = body.repo ?? doc.repo;
  if (body.skills) doc.skills = await resolveSkills(body.skills);
  await doc.save();
  await syncEdges('USES', 'project', doc);
  await ensureUserHas(userId, doc.skills, 'project');
}

router.post('/projects', async (req, res) => {
  if (!req.body.title) return res.status(400).json({ error: 'Project title is required' });
  const doc = new Project({ user: req.user._id, source: req.body.source || 'manual', stars: req.body.stars || 0 });
  await saveProject(doc, req.body, req.user._id);
  res.status(201).json({ project: (await projectOut([doc]))[0] });
});

router.put('/projects/:id', async (req, res) => {
  const doc = isId(req.params.id) && (await Project.findOne({ _id: req.params.id, user: req.user._id }));
  if (!doc) return res.status(404).json({ error: 'Project not found' });
  await saveProject(doc, req.body, req.user._id);
  res.json({ project: (await projectOut([doc]))[0] });
});

router.delete('/projects/:id', async (req, res) => {
  const doc = isId(req.params.id) && (await Project.findOneAndDelete({ _id: req.params.id, user: req.user._id }));
  if (!doc) return res.status(404).json({ error: 'Project not found' });
  await Relationship.deleteMany({ type: 'USES', fromId: doc._id });
  res.json({ ok: true });
});

// ---- certifications ---------------------------------------------------------------------
const certOut = async (rows) => {
  const ctx = await getContext();
  return rows.map((c) => ({ id: String(c._id), name: c.name, issuer: c.issuer, year: c.year, url: c.url, skills: (c.skills || []).map((s) => ({ id: String(s), name: ctx.byId.get(String(s))?.name })).filter((s) => s.name) }));
};

router.get('/certifications', async (req, res) => res.json({ certifications: await certOut(await Certification.find({ user: req.user._id }).sort('-year').lean()), catalog: (await getContext()).certCatalog }));

async function saveCert(doc, body, userId) {
  for (const k of ['name', 'issuer', 'year', 'url']) if (body[k] !== undefined) doc[k] = body[k];
  if (body.skills) doc.skills = await resolveSkills(body.skills);
  await doc.save();
  await syncEdges('VALIDATES', 'cert', doc);
  await ensureUserHas(userId, doc.skills, 'certification');
}

router.post('/certifications', async (req, res) => {
  if (!req.body.name) return res.status(400).json({ error: 'Certification name is required' });
  const doc = new Certification({ user: req.user._id });
  await saveCert(doc, req.body, req.user._id);
  res.status(201).json({ certification: (await certOut([doc]))[0] });
});

router.delete('/certifications/:id', async (req, res) => {
  const doc = isId(req.params.id) && (await Certification.findOneAndDelete({ _id: req.params.id, user: req.user._id }));
  if (!doc) return res.status(404).json({ error: 'Certification not found' });
  await Relationship.deleteMany({ type: 'VALIDATES', fromId: doc._id });
  res.json({ ok: true });
});

module.exports = { router, resolveSkills, saveProject, saveCert, syncEdges, ensureUserHas };
