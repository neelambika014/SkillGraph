// Graph, careers + gap analysis, recommendations, roadmaps, progress tracking and dashboard stats.
const express = require('express');
const { User, Project, Certification, Recommendation, Roadmap, getUserSkills, setUserSkill } = require('../models');
const { requireAuth } = require('./auth');
const { getContext } = require('../services/context');
const R = require('../services/recommender');
const { buildGraph } = require('../services/graph');
const ai = require('../services/ai');

const router = express.Router();
router.use(requireAuth);

async function userState(user) {
  const ctx = await getContext();
  const entries = await getUserSkills(user._id);
  const have = new Map(entries.map((e) => [String(e.skill._id), e.level]));
  const matched = R.matchInterests(ctx, user.interests, user.hobbies, '');
  return { ctx, entries, have, matched };
}

// ---- Skill Knowledge Graph ------------------------------------------------------------------
async function graphFor(user, withGoal) {
  const { ctx, entries } = await userState(user);
  const [projects, certs] = await Promise.all([Project.find({ user: user._id }).lean(), Certification.find({ user: user._id }).lean()]);
  return buildGraph(ctx, user, entries, projects, certs, { goalSlug: withGoal ? user.goalCareer : null });
}

router.get('/graph/me', async (req, res) => res.json(await graphFor(req.user, req.query.goal === '1')));

router.get('/graph/user/:id', async (req, res) => {
  if (req.user.role !== 'recruiter' && String(req.user._id) !== req.params.id) return res.status(403).json({ error: 'Not allowed' });
  const u = await User.findById(req.params.id);
  if (!u || u.role !== 'candidate') return res.status(404).json({ error: 'Candidate not found' });
  res.json(await graphFor(u, req.query.goal === '1'));
});

// ---- careers / gap detection --------------------------------------------------------------------
router.get('/careers', async (req, res) => {
  const { ctx, have, matched } = await userState(req.user);
  const ranked = R.rankCareers(ctx, have, matched);
  res.json({
    goalCareer: req.user.goalCareer,
    careers: ranked.map((r) => ({ ...r.career, readiness: r.readiness, fit: r.fit, counts: r.counts, topGaps: r.topGaps, interestReasons: r.interestReasons })),
  });
});

router.put('/careers/goal', async (req, res) => {
  const ctx = await getContext();
  if (!ctx.careerBySlug.has(req.body.slug)) return res.status(400).json({ error: 'Unknown career' });
  req.user.goalCareer = req.body.slug;
  await req.user.save();
  res.json({ ok: true, goalCareer: req.user.goalCareer });
});

router.get('/careers/:slug/gap', async (req, res) => {
  const { ctx, have } = await userState(req.user);
  const career = ctx.careerBySlug.get(req.params.slug);
  if (!career) return res.status(404).json({ error: 'Unknown career' });
  const gap = R.careerReadiness(ctx, career, have);
  const plan = R.buildRoadmap(ctx, career, have);
  res.json({ ...gap, prerequisitesToAdd: plan.steps.filter((s) => s.reason.startsWith('Prerequisite')).map((s) => s.name), estimatedHours: plan.totalHours });
});

// ---- recommendations (careers, hobby-based, learning, projects) ----------------------------------
router.get('/recommendations', async (req, res) => {
  const { ctx, entries, have, matched } = await userState(req.user);
  const ranked = R.rankCareers(ctx, have, matched);
  const goalSlug = req.user.goalCareer || ranked[0]?.career.slug;
  const goal = ctx.careerBySlug.get(goalSlug);
  const plan = goal ? R.buildRoadmap(ctx, goal, have) : { steps: [], gap: null };

  // reflect saved progress when an active roadmap exists
  const rm = await Roadmap.findOne({ user: req.user._id, active: true, career: goalSlug }).lean();
  const steps = rm ? rm.steps : plan.steps;

  const focus = plan.steps.map((s) => s.skillId);
  const payload = {
    goalCareer: goal ? { slug: goal.slug, title: goal.title } : null,
    careers: ranked.slice(0, 5).map((r) => ({ ...r.career, readiness: r.readiness, fit: r.fit, topGaps: r.topGaps, interestReasons: r.interestReasons, counts: r.counts })),
    interestBased: R.interestSuggestions(ctx, matched, have),
    learning: R.learningQueue(steps, 6),
    projects: R.recommendProjects(ctx, have, focus, 6),
    strengths: R.domainStrengths(ctx, entries).slice(0, 5),
  };
  if (req.query.brief !== '0') {
    payload.aiBrief = await ai.careerBrief({
      goal: goal?.title, readiness: plan.gap?.readiness, topSkills: entries.sort((a, b) => b.level - a.level).slice(0, 8).map((e) => `${e.skill.name} (${R.levelLabel(e.level)})`),
      gaps: (plan.gap?.gaps || []).slice(0, 5).map((g) => `${g.name} (${g.haveLabel} -> ${g.needLabel})`), interests: matched.map((m) => m.label),
    });
  }
  await Recommendation.create({ user: req.user._id, kind: 'bundle', goalCareer: goalSlug, payload });
  res.json({ ...payload, generatedAt: new Date(), aiEnabled: ai.enabled() });
});

// ---- roadmap + progress tracking ----------------------------------------------------------------------
const progressOf = (rm) => {
  const total = rm.steps.length;
  const done = rm.steps.filter((s) => s.status === 'done').length;
  const doing = rm.steps.filter((s) => s.status === 'in_progress').length;
  const hoursTotal = rm.steps.reduce((a, s) => a + (s.estHours || 0), 0);
  const hoursDone = rm.steps.filter((s) => s.status === 'done').reduce((a, s) => a + (s.estHours || 0), 0);
  return { total, done, inProgress: doing, percent: total ? Math.round((done / total) * 100) : 100, hoursTotal, hoursDone };
};

router.get('/roadmap', async (req, res) => {
  const rm = await Roadmap.findOne({ user: req.user._id, active: true }).sort('-createdAt').lean();
  if (!rm) return res.json({ roadmap: null });
  res.json({ roadmap: rm, progress: progressOf(rm) });
});

router.post('/roadmap/generate', async (req, res) => {
  const { ctx, have } = await userState(req.user);
  const slug = req.body.career || req.user.goalCareer;
  const career = ctx.careerBySlug.get(slug);
  if (!career) return res.status(400).json({ error: 'Pick a target career first' });
  const plan = R.buildRoadmap(ctx, career, have);
  await Roadmap.updateMany({ user: req.user._id, active: true }, { $set: { active: false } });
  const rm = await Roadmap.create({ user: req.user._id, career: career.slug, careerTitle: career.title, readinessAtStart: plan.gap.readiness, steps: plan.steps });
  if (req.user.goalCareer !== career.slug) { req.user.goalCareer = career.slug; await req.user.save(); }
  res.status(201).json({ roadmap: rm.toObject(), progress: progressOf(rm), gap: plan.gap });
});

router.patch('/roadmap/steps/:skillId', async (req, res) => {
  const status = req.body.status;
  if (!['todo', 'in_progress', 'done'].includes(status)) return res.status(400).json({ error: 'Bad status' });
  const rm = await Roadmap.findOne({ user: req.user._id, active: true });
  const step = rm?.steps.find((s) => String(s.skillId) === req.params.skillId);
  if (!step) return res.status(404).json({ error: 'Step not found' });
  step.status = status;
  step.completedAt = status === 'done' ? new Date() : undefined;
  await rm.save();
  // finishing a step levels the skill up in the knowledge graph
  if (status === 'done') await setUserSkill(req.user._id, step.skillId, step.targetLevel, { source: 'roadmap', mode: 'max' });
  res.json({ roadmap: rm.toObject(), progress: progressOf(rm) });
});

// ---- dashboard -----------------------------------------------------------------------------------------
router.get('/dashboard', async (req, res) => {
  const { ctx, entries, have, matched } = await userState(req.user);
  const goal = ctx.careerBySlug.get(req.user.goalCareer);
  const gap = goal ? R.careerReadiness(ctx, goal, have) : null;
  const rm = await Roadmap.findOne({ user: req.user._id, active: true }).sort('-createdAt').lean();
  const [projects, certs] = await Promise.all([Project.countDocuments({ user: req.user._id }), Certification.countDocuments({ user: req.user._id })]);
  const top = R.rankCareers(ctx, have, matched).slice(0, 3).map((r) => ({ slug: r.career.slug, title: r.career.title, readiness: r.readiness, fit: r.fit }));
  res.json({
    user: { name: req.user.name, headline: req.user.headline },
    counts: { skills: entries.length, projects, certifications: certs, advanced: entries.filter((e) => e.level >= 3).length },
    goal: gap ? { slug: gap.career.slug, title: gap.career.title, readiness: gap.readiness, topGaps: gap.gaps.slice(0, 4), counts: gap.counts } : null,
    strengths: R.domainStrengths(ctx, entries),
    topSkills: entries.sort((a, b) => b.level - a.level).slice(0, 8).map((e) => ({ name: e.skill.name, level: e.level, label: R.levelLabel(e.level) })),
    roadmap: rm ? { careerTitle: rm.careerTitle, progress: progressOf(rm), next: rm.steps.filter((s) => s.status !== 'done').slice(0, 3).map((s) => ({ skillId: s.skillId, name: s.name, status: s.status, estHours: s.estHours })), readinessAtStart: rm.readinessAtStart } : null,
    topCareers: top,
    hasProfileData: entries.length > 0,
  });
});

module.exports = { router };
