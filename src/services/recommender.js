// Skill-gap analysis, career ranking, roadmaps and recommendations. Pure functions over a "context".
const LEVELS = ['None', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];
const enc = encodeURIComponent;

/**
 * ctx = {
 *   skills:[{_id,name,domain,group,docs,aliases}],
 *   prereqs: Map<skillId, skillId[]>,
 *   careers:[{slug,title,domain,demand,description, requirements:[{skillId,level,weight}]}],
 *   interests:[{id,label,keywords,careers,skills,why}], ideas:[{title,description,skills:[name],difficulty,hours}]
 * }
 */
function buildContext({ skills, prereqs, careers, interests, ideas }) {
  const byId = new Map(skills.map((s) => [String(s._id), s]));
  const byName = new Map(skills.map((s) => [s.name, s]));
  return {
    skills, byId, byName,
    prereqs: prereqs || new Map(),
    careers, careerBySlug: new Map(careers.map((c) => [c.slug, c])),
    interests: interests || [], ideas: (ideas || []).map((i) => ({ ...i, skillIds: i.skills.map((n) => byName.get(n)).filter(Boolean).map((s) => String(s._id)) })),
  };
}

const levelLabel = (n) => LEVELS[n] || 'None';

function resourcesFor(skill) {
  return [
    { title: `${skill.name}: official docs & guides`, url: skill.docs || `https://www.google.com/search?q=${enc(skill.name + ' documentation')}`, kind: 'docs' },
    { title: `${skill.name} video tutorials`, url: `https://www.youtube.com/results?search_query=${enc(skill.name + ' tutorial for beginners')}`, kind: 'video' },
    { title: `Free practice & articles on ${skill.name}`, url: `https://www.freecodecamp.org/news/search/?query=${enc(skill.name)}`, kind: 'practice' },
  ];
}

// ---- readiness / gap analysis ---------------------------------------------------
function careerReadiness(ctx, career, have) {
  let got = 0, total = 0;
  const matched = [], gaps = [];
  for (const r of career.requirements) {
    const sk = ctx.byId.get(String(r.skillId));
    if (!sk) continue;
    const lvl = have.get(String(r.skillId)) || 0;
    total += r.weight;
    got += r.weight * Math.min(1, lvl / r.level);
    const row = { skillId: String(r.skillId), name: sk.name, domain: sk.domain, have: lvl, need: r.level, weight: r.weight, haveLabel: levelLabel(lvl), needLabel: levelLabel(r.level) };
    if (lvl >= r.level) matched.push({ ...row, status: 'met' });
    else gaps.push({ ...row, status: lvl === 0 ? 'missing' : 'weak' });
  }
  gaps.sort((a, b) => b.weight * (b.need - b.have) - a.weight * (a.need - a.have));
  return {
    career: { slug: career.slug, title: career.title, domain: career.domain, demand: career.demand, description: career.description },
    readiness: total ? Math.round((got / total) * 100) : 0,
    matched, gaps,
    counts: { required: career.requirements.length, met: matched.length, missing: gaps.filter((g) => g.status === 'missing').length, weak: gaps.filter((g) => g.status === 'weak').length },
  };
}

// ---- interests / hobbies ---------------------------------------------------------
function matchInterests(ctx, interestIds = [], hobbies = [], extraText = '') {
  const ids = new Set(interestIds);
  const text = `${(hobbies || []).join(' ')} ${extraText || ''}`.toLowerCase();
  const reasonFor = new Map();
  for (const it of ctx.interests) {
    if (ids.has(it.id)) reasonFor.set(it.id, 'selected');
    else if (text.trim() && it.keywords.some((k) => text.includes(k))) reasonFor.set(it.id, 'mentioned');
  }
  return ctx.interests.filter((i) => reasonFor.has(i.id));
}

function interestAffinity(matched) {
  const aff = new Map(); // slug -> {score, reasons}
  for (const it of matched) {
    it.careers.forEach((slug, idx) => {
      const a = aff.get(slug) || { score: 0, reasons: [] };
      a.score += 1 - idx * 0.15;
      a.reasons.push(it.label);
      aff.set(slug, a);
    });
  }
  return aff;
}

function rankCareers(ctx, have, matchedInterests = []) {
  const aff = interestAffinity(matchedInterests);
  const maxAff = Math.max(1, ...[...aff.values()].map((a) => a.score));
  return ctx.careers.map((c) => {
    const r = careerReadiness(ctx, c, have);
    const a = aff.get(c.slug);
    const interestBoost = a ? Math.round((a.score / maxAff) * 100) : 0;
    const fit = Math.round(0.7 * r.readiness + 0.2 * interestBoost + 0.1 * c.demand);
    return { ...r, interestReasons: a ? [...new Set(a.reasons)] : [], interestBoost, fit, topGaps: r.gaps.slice(0, 3).map((g) => g.name) };
  }).sort((a, b) => b.fit - a.fit);
}

function interestSuggestions(ctx, matched, have) {
  return matched.map((it) => ({
    interest: { id: it.id, label: it.label },
    why: it.why,
    careers: it.careers.map((slug) => {
      const c = ctx.careerBySlug.get(slug);
      return c ? { slug, title: c.title, readiness: careerReadiness(ctx, c, have).readiness } : null;
    }).filter(Boolean),
    skillsToTry: it.skills.filter((n) => ctx.byName.has(n) && !(have.get(String(ctx.byName.get(n)._id)) > 0)),
    skillsKnown: it.skills.filter((n) => ctx.byName.has(n) && have.get(String(ctx.byName.get(n)._id)) > 0),
  }));
}

// ---- roadmap ------------------------------------------------------------------------
function projectIdeaFor(ctx, skillName) {
  const c = ctx.ideas.filter((i) => i.skills.includes(skillName)).sort((a, b) => a.difficulty - b.difficulty || a.hours - b.hours);
  return c[0]?.title || '';
}

function buildRoadmap(ctx, career, have) {
  const gap = careerReadiness(ctx, career, have);
  const targets = new Map(); // skillId -> {target, reason, weight}
  for (const g of gap.gaps) targets.set(g.skillId, { target: g.need, reason: `Needed as ${levelLabel(g.need)} for ${career.title} (importance ${g.weight}/5)`, weight: g.weight });

  const addPrereqs = (id, parentName, seen = new Set()) => {
    for (const p of ctx.prereqs.get(id) || []) {
      if (seen.has(p)) continue;
      seen.add(p);
      const haveLvl = have.get(p) || 0;
      if (haveLvl < 2 && !targets.has(p)) {
        targets.set(p, { target: 2, reason: `Prerequisite for ${parentName}`, weight: 3 });
      } else if (haveLvl < 2 && targets.has(p) && targets.get(p).target < 2) {
        targets.get(p).target = 2;
      }
      if (haveLvl < 2) addPrereqs(p, ctx.byId.get(p)?.name || '', seen);
    }
  };
  for (const [id] of [...targets]) addPrereqs(id, ctx.byId.get(id)?.name || '');

  // depth = longest chain of unmet prerequisites inside the target set
  const depthMemo = new Map();
  const depth = (id, stack = new Set()) => {
    if (depthMemo.has(id)) return depthMemo.get(id);
    if (stack.has(id)) return 0;
    stack.add(id);
    let d = 0;
    for (const p of ctx.prereqs.get(id) || []) if (targets.has(p)) d = Math.max(d, 1 + depth(p, stack));
    stack.delete(id);
    depthMemo.set(id, d);
    return d;
  };

  const rows = [...targets.entries()].map(([id, t]) => {
    const sk = ctx.byId.get(id);
    return { id, sk, d: depth(id), ...t, cur: have.get(id) || 0 };
  }).filter((r) => r.sk);
  rows.sort((a, b) => a.d - b.d || b.weight - a.weight || a.sk.name.localeCompare(b.sk.name));

  const maxD = Math.max(0, ...rows.map((r) => r.d));
  const phaseName = (d) => (maxD === 0 ? 'Core skills' : d === 0 ? 'Phase 1 - Foundations' : d === maxD ? `Phase ${d + 1} - Advanced & specialisation` : `Phase ${d + 1} - Building blocks`);

  const steps = rows.map((r, i) => ({
    skillId: r.id,
    name: r.sk.name,
    domain: r.sk.domain,
    phase: phaseName(r.d),
    order: i + 1,
    currentLevel: r.cur,
    targetLevel: r.target,
    reason: r.reason,
    estHours: Math.max(8, (r.target - r.cur) * 18),
    resources: resourcesFor(r.sk),
    projectIdea: projectIdeaFor(ctx, r.sk.name),
    status: 'todo',
  }));
  return { gap, steps, totalHours: steps.reduce((s, x) => s + x.estHours, 0) };
}

// ---- learning + projects -------------------------------------------------------------
function recommendProjects(ctx, have, focusSkillIds, n = 6) {
  const focus = new Set(focusSkillIds.map(String));
  return ctx.ideas.map((idea) => {
    const teaches = idea.skillIds.filter((id) => focus.has(id));
    const reinforces = idea.skillIds.filter((id) => !focus.has(id) && (have.get(id) || 0) > 0);
    const unknown = idea.skillIds.length - teaches.length - reinforces.length;
    const score = teaches.length * 3 + reinforces.length - unknown * 1.5 - (idea.difficulty - 1) * 0.5;
    return {
      title: idea.title, description: idea.description, difficulty: idea.difficulty, hours: idea.hours,
      teaches: teaches.map((id) => ctx.byId.get(id).name),
      reinforces: reinforces.map((id) => ctx.byId.get(id).name),
      newToYou: unknown, score: +score.toFixed(1),
    };
  }).filter((p) => p.teaches.length > 0).sort((a, b) => b.score - a.score).slice(0, n);
}

function learningQueue(steps, n = 6) {
  return steps.filter((s) => s.status !== 'done').slice(0, n).map((s) => ({
    skill: s.name, domain: s.domain, from: levelLabel(s.currentLevel), to: levelLabel(s.targetLevel), why: s.reason, estHours: s.estHours, resources: s.resources, projectIdea: s.projectIdea, status: s.status,
  }));
}

function domainStrengths(ctx, haveEntries) {
  const m = new Map();
  for (const { skill, level } of haveEntries) {
    const d = m.get(skill.domain) || { domain: skill.domain, skills: 0, total: 0 };
    d.skills++; d.total += level;
    m.set(skill.domain, d);
  }
  return [...m.values()].map((d) => ({ domain: d.domain, skills: d.skills, avgLevel: +(d.total / d.skills).toFixed(2), score: d.total })).sort((a, b) => b.score - a.score);
}

module.exports = { buildContext, careerReadiness, rankCareers, matchInterests, interestSuggestions, buildRoadmap, recommendProjects, learningQueue, domainStrengths, resourcesFor, levelLabel, LEVELS };
