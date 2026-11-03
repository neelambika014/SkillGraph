// Recruiter dashboard: search candidates by skill, rank them, shortlist, and see pool analytics.
const express = require('express');
const mongoose = require('mongoose');
const { User, Project, Certification, Relationship } = require('../models');
const { requireAuth, requireRole } = require('./auth');
const { getContext } = require('../services/context');
const R = require('../services/recommender');

const router = express.Router();
router.use(requireAuth, requireRole('recruiter'));

// Builds an in-memory index of every candidate and their skill levels (fine at demo scale: thousands of users).
async function index() {
  const ctx = await getContext();
  const users = await User.find({ role: 'candidate' }).select('name email headline location experienceYears goalCareer interests links').lean();
  const edges = await Relationship.find({ type: 'HAS_SKILL', fromId: { $in: users.map((u) => u._id) } }).select('fromId toId meta weight').lean();
  const skillsOf = new Map();
  for (const e of edges) {
    const k = String(e.fromId);
    if (!skillsOf.has(k)) skillsOf.set(k, new Map());
    skillsOf.get(k).set(String(e.toId), e.meta?.level || e.weight || 1);
  }
  const projCounts = new Map((await Project.aggregate([{ $group: { _id: '$user', n: { $sum: 1 } } }])).map((x) => [String(x._id), x.n]));
  const certCounts = new Map((await Certification.aggregate([{ $group: { _id: '$user', n: { $sum: 1 } } }])).map((x) => [String(x._id), x.n]));
  return { ctx, users, skillsOf, projCounts, certCounts };
}

const summarize = (ctx, u, have, extra = {}) => ({
  id: String(u._id), name: u.name, email: u.email, headline: u.headline, location: u.location, experienceYears: u.experienceYears, goalCareer: u.goalCareer,
  skillCount: have.size,
  topSkills: [...have.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, level]) => ({ name: ctx.byId.get(id)?.name, level })).filter((s) => s.name),
  ...extra,
});

router.get('/candidates', async (req, res) => {
  const { ctx, users, skillsOf, projCounts, certCounts } = await index();
  const wanted = String(req.query.skills || '').split(',').map((s) => s.trim()).filter(Boolean).map((n) => ctx.byName.get(n) || ctx.skills.find((s) => s.name.toLowerCase() === n.toLowerCase())).filter(Boolean);
  const minLevel = Math.max(1, +req.query.minLevel || 1);
  const career = req.query.career ? ctx.careerBySlug.get(req.query.career) : null;
  const q = String(req.query.q || '').toLowerCase();
  const minExp = +req.query.minExp || 0;

  let rows = users.map((u) => {
    const have = skillsOf.get(String(u._id)) || new Map();
    let match = 100, matched = [], missing = [];
    if (wanted.length) {
      let got = 0;
      for (const s of wanted) {
        const lvl = have.get(String(s._id)) || 0;
        if (lvl >= minLevel) { got += 1; matched.push(s.name); }
        else { got += lvl / minLevel * 0.5; missing.push(s.name); }
      }
      match = Math.round((got / wanted.length) * 100);
    }
    const readiness = career ? R.careerReadiness(ctx, career, have).readiness : null;
    const score = career && wanted.length ? Math.round(0.5 * match + 0.5 * readiness) : career ? readiness : match;
    return { u, have, match, matched, missing, readiness, score };
  });

  if (wanted.length) rows = rows.filter((r) => r.matched.length > 0 || r.match >= 25);
  if (q) rows = rows.filter((r) => `${r.u.name} ${r.u.headline} ${r.u.location}`.toLowerCase().includes(q));
  if (minExp) rows = rows.filter((r) => (r.u.experienceYears || 0) >= minExp);
  rows.sort((a, b) => b.score - a.score || b.have.size - a.have.size);

  const me = await User.findById(req.user._id).select('shortlist').lean();
  const sl = new Set((me.shortlist || []).map(String));
  const total = rows.length;
  rows = rows.slice(0, Math.min(+req.query.limit || 40, 100));
  res.json({
    total,
    candidates: rows.map((r) => summarize(ctx, r.u, r.have, { score: r.score, matchPct: r.match, readiness: r.readiness, matchedSkills: r.matched, missingSkills: r.missing, projects: projCounts.get(String(r.u._id)) || 0, certifications: certCounts.get(String(r.u._id)) || 0, shortlisted: sl.has(String(r.u._id)) })),
  });
});

router.get('/candidates/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Bad id' });
  const u = await User.findOne({ _id: req.params.id, role: 'candidate' }).select('-passwordHash -resumeText -shortlist').lean();
  if (!u) return res.status(404).json({ error: 'Candidate not found' });
  const ctx = await getContext();
  const { getUserSkills } = require('../models');
  const entries = await getUserSkills(u._id);
  const have = new Map(entries.map((e) => [String(e.skill._id), e.level]));
  const [projects, certs] = await Promise.all([Project.find({ user: u._id }).lean(), Certification.find({ user: u._id }).lean()]);
  const matched = R.matchInterests(ctx, u.interests, u.hobbies, '');
  res.json({
    candidate: u,
    skills: entries.map((e) => ({ name: e.skill.name, domain: e.skill.domain, level: e.level, label: R.levelLabel(e.level), sources: e.sources })).sort((a, b) => b.level - a.level),
    projects: projects.map((p) => ({ title: p.title, description: p.description, url: p.url, skills: (p.skills || []).map((s) => ctx.byId.get(String(s))?.name).filter(Boolean) })),
    certifications: certs.map((c) => ({ name: c.name, issuer: c.issuer, year: c.year })),
    strengths: R.domainStrengths(ctx, entries),
    careerFit: R.rankCareers(ctx, have, matched).slice(0, 4).map((r) => ({ slug: r.career.slug, title: r.career.title, readiness: r.readiness, gaps: r.topGaps })),
    interests: matched.map((m) => m.label),
  });
});

router.get('/shortlist', async (req, res) => {
  const me = await User.findById(req.user._id).select('shortlist').lean();
  const { ctx, users, skillsOf } = await index();
  const ids = new Set((me.shortlist || []).map(String));
  res.json({ candidates: users.filter((u) => ids.has(String(u._id))).map((u) => summarize(ctx, u, skillsOf.get(String(u._id)) || new Map(), { shortlisted: true })) });
});

router.post('/shortlist/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Bad id' });
  await User.updateOne({ _id: req.user._id }, { $addToSet: { shortlist: req.params.id } });
  res.json({ ok: true });
});
router.delete('/shortlist/:id', async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $pull: { shortlist: req.params.id } });
  res.json({ ok: true });
});

router.get('/stats', async (req, res) => {
  const { ctx, users, skillsOf } = await index();
  const skillCount = new Map();
  const domainCount = new Map();
  for (const u of users) {
    const have = skillsOf.get(String(u._id)) || new Map();
    const doms = new Set();
    for (const [id, lvl] of have) {
      skillCount.set(id, (skillCount.get(id) || 0) + 1);
      if (lvl >= 3) doms.add(ctx.byId.get(id)?.domain);
    }
    for (const d of doms) if (d) domainCount.set(d, (domainCount.get(d) || 0) + 1);
  }
  const pool = ctx.careers.map((c) => {
    let ready = 0, near = 0;
    for (const u of users) {
      const r = R.careerReadiness(ctx, c, skillsOf.get(String(u._id)) || new Map()).readiness;
      if (r >= 75) ready++; else if (r >= 55) near++;
    }
    return { slug: c.slug, title: c.title, ready, near };
  }).sort((a, b) => b.ready - a.ready);
  res.json({
    candidates: users.length,
    avgSkills: +(users.reduce((a, u) => a + (skillsOf.get(String(u._id))?.size || 0), 0) / Math.max(1, users.length)).toFixed(1),
    topSkills: [...skillCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([id, n]) => ({ name: ctx.byId.get(id)?.name, candidates: n })),
    advancedByDomain: [...domainCount.entries()].sort((a, b) => b[1] - a[1]).map(([domain, n]) => ({ domain, candidates: n })),
    talentPool: pool,
  });
});

module.exports = { router };
