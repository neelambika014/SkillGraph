// Resume / document parsing, AI skill extraction, GitHub import, and "apply to my profile".
const express = require('express');
const multer = require('multer');
const { Project, Certification } = require('../models');
const { setUserSkill } = require('../models');
const { requireAuth } = require('./auth');
const { getContext } = require('../services/context');
const { parseResume, extractSkills } = require('../services/extractor');
const { fileToText } = require('../services/fileparser');
const { importGithub } = require('../services/github');
const ai = require('../services/ai');
const { resolveSkills, saveProject, saveCert, ensureUserHas } = require('./profile');

const router = express.Router();
router.use(requireAuth);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

// Parse a resume (file upload "file" or JSON {text}). Nothing is saved until /apply is called.
router.post('/resume/parse', upload.single('file'), async (req, res) => {
  const ctx = await getContext();
  let text = req.body?.text || '';
  if (req.file) text = await fileToText(req.file);
  text = String(text || '').trim();
  if (text.length < 40) return res.status(422).json({ error: 'Could not read any text from that file. If it is a scanned image, paste the text instead.' });

  const parsed = parseResume(text, ctx.matchers);

  // optional AI enrichment: adds skills the rules missed
  let aiUsed = false;
  if (ai.enabled()) {
    const extra = await ai.extraSkills(text, ctx.skills.map((s) => s.name));
    const have = new Map(parsed.skills.map((s) => [s.name, s]));
    for (const e of extra) {
      aiUsed = true;
      const sk = ctx.byName.get(e.name);
      if (have.has(e.name)) { const cur = have.get(e.name); cur.level = Math.max(cur.level, e.level); cur.sources = [...new Set([...cur.sources, 'ai'])]; }
      else parsed.skills.push({ skillId: String(sk._id), name: sk.name, domain: sk.domain, level: e.level, confidence: 0.7, mentions: 0, evidence: 'Inferred by AI from context', sources: ['ai'] });
    }
    parsed.skills.sort((a, b) => b.level - a.level || b.confidence - a.confidence);
  }

  req.user.resumeText = text.slice(0, 60000);
  await req.user.save();
  res.json({ ...parsed, aiUsed, source: req.file ? req.file.originalname : 'pasted text' });
});

router.post('/github/preview', async (req, res) => {
  const ctx = await getContext();
  const out = await importGithub(String(req.body.username || '').trim(), ctx.matchers, ctx.byName);
  res.json(out);
});

// Save the reviewed extraction into the user's portfolio + graph.
router.post('/resume/apply', async (req, res) => {
  const { profile = {}, skills = [], projects = [], certifications = [], source = 'resume' } = req.body || {};
  const u = req.user;
  let added = { skills: 0, projects: 0, certifications: 0 };

  if (profile.headline && !u.headline) u.headline = profile.headline;
  if (profile.bio && !u.bio) u.bio = profile.bio;
  if (profile.location && !u.location) u.location = profile.location;
  if (profile.experienceYears && !u.experienceYears) u.experienceYears = profile.experienceYears;
  if (profile.github) u.links = { ...(u.links?.toObject?.() || u.links || {}), github: profile.github };
  if (profile.linkedin) u.links = { ...(u.links?.toObject?.() || u.links || {}), linkedin: profile.linkedin };
  if (profile.education?.length && !u.education?.length) u.education = profile.education;
  await u.save();

  for (const s of skills) {
    const [id] = await resolveSkills([s.skillId || s.name]);
    if (!id) continue;
    await setUserSkill(u._id, id, +s.level || 1, { source: (s.sources && s.sources[0]) || source, evidence: s.evidence || '', mode: 'max' });
    added.skills++;
  }
  const existingTitles = new Set((await Project.find({ user: u._id }).select('title').lean()).map((p) => p.title.toLowerCase()));
  for (const p of projects) {
    if (!p.title || existingTitles.has(p.title.toLowerCase())) continue;
    const doc = new Project({ user: u._id, source: p.repo ? 'github' : source === 'github' ? 'github' : 'resume', stars: p.stars || 0 });
    await saveProject(doc, p, u._id);
    existingTitles.add(p.title.toLowerCase());
    added.projects++;
  }
  const existingCerts = new Set((await Certification.find({ user: u._id }).select('name').lean()).map((c) => c.name.toLowerCase()));
  for (const c of certifications) {
    if (!c.name || existingCerts.has(c.name.toLowerCase())) continue;
    await saveCert(new Certification({ user: u._id }), c, u._id);
    existingCerts.add(c.name.toLowerCase());
    added.certifications++;
  }
  res.json({ ok: true, added });
});

module.exports = { router };
