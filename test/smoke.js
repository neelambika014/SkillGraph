// Offline smoke test (no MongoDB needed): dataset integrity, resume parsing, extraction, gap analysis, roadmap, graph.
//   npm test
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const D = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', f), 'utf8'));
const { buildMatchers, parseResume } = require('../src/services/extractor');
const R = require('../src/services/recommender');
const { buildGraph } = require('../src/services/graph');

const skillsRaw = D('skills.json');
const skills = skillsRaw.map((s) => ({ ...s, _id: s.name }));
const byName = new Map(skills.map((s) => [s.name, s]));
const prereqs = new Map(skills.filter((s) => s.prerequisites.length).map((s) => [s.name, s.prerequisites]));
const careers = D('careers.json').map((c) => ({ ...c, requirements: c.requirements.map((r) => ({ skillId: r.skill, level: r.level, weight: r.weight })) }));
const ctx = R.buildContext({ skills, prereqs, careers, interests: D('interests.json'), ideas: D('project_ideas.json') });
const matchers = buildMatchers(skills);

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('  ok -', name); };

t('dataset sizes', () => {
  assert(skills.length >= 100); assert(careers.length >= 12); assert(D('candidates.json').length >= 100);
});

const resume = fs.readFileSync(path.join(__dirname, '..', 'data', 'sample_resumes', 'ananya_fullstack.txt'), 'utf8');
const parsed = parseResume(resume, matchers);

t('profile fields parsed', () => {
  assert.strictEqual(parsed.profile.name, 'Ananya Krishnan');
  assert.strictEqual(parsed.profile.email, 'ananya.krishnan@example.com');
  assert.strictEqual(parsed.profile.github, 'ananya-k');
  assert.strictEqual(parsed.profile.experienceYears, 2);
  assert(parsed.profile.education.length >= 1, 'education');
});
t('core skills detected', () => {
  const names = new Set(parsed.skills.map((s) => s.name));
  for (const n of ['React', 'Node.js', 'Express.js', 'MongoDB', 'PostgreSQL', 'Docker', 'JavaScript', 'TypeScript', 'Git', 'Authentication', 'CI/CD', 'WebSockets', 'Tailwind CSS', 'Unit Testing']) assert(names.has(n), `missing ${n}`);
});
t('no false positives (React Native, C, R, Go)', () => {
  const names = new Set(parsed.skills.map((s) => s.name));
  for (const n of ['React Native', 'C', 'R', 'Go', 'Java']) assert(!names.has(n), `false positive ${n}`);
});
t('levels reflect context ("learning" => beginner)', () => {
  const lvl = Object.fromEntries(parsed.skills.map((s) => [s.name, s.level]));
  assert(lvl['React'] >= 3, 'React should be strong, got ' + lvl['React']);
  assert(lvl['Next.js'] <= 2, 'Next.js is being learned');
});
t('projects + certifications parsed with skills', () => {
  assert(parsed.projects.length >= 3, 'projects ' + parsed.projects.length);
  const taskly = parsed.projects.find((p) => /Taskly/.test(p.title));
  assert(taskly && taskly.skills.includes('React') && taskly.skills.includes('MongoDB'));
  assert(parsed.certifications.length >= 2);
  assert(parsed.certifications.some((c) => /MongoDB/.test(c.name) && c.skills.includes('MongoDB')));
});

const devops = parseResume(fs.readFileSync(path.join(__dirname, '..', 'data', 'sample_resumes', 'sam_devops.txt'), 'utf8'), matchers);
t('years / "expert" push level to 4', () => {
  const lvl = Object.fromEntries(devops.skills.map((s) => [s.name, s.level]));
  assert.strictEqual(lvl['Kubernetes'], 4); assert.strictEqual(lvl['AWS'], 4);
});
const ds = parseResume(fs.readFileSync(path.join(__dirname, '..', 'data', 'sample_resumes', 'rahul_datascience.txt'), 'utf8'), matchers);
t('data resume maps to data skills', () => {
  const names = new Set(ds.skills.map((s) => s.name));
  for (const n of ['Python', 'SQL', 'Pandas', 'Machine Learning', 'Data Visualization', 'Excel', 'Statistics']) assert(names.has(n), `missing ${n}`);
  assert.strictEqual(ds.skills.find((s) => s.name === 'TensorFlow').level, 1, 'basic knowledge => 1');
});

const have = new Map(parsed.skills.map((s) => [s.skillId, s.level]));
t('career ranking puts full-stack first for the full-stack resume', () => {
  const ranked = R.rankCareers(ctx, have, []);
  assert.strictEqual(ranked[0].career.slug, 'full-stack-developer', 'got ' + ranked[0].career.slug);
  assert(ranked[0].readiness > 50);
});
t('gap analysis lists missing skills', () => {
  const g = R.careerReadiness(ctx, ctx.careerBySlug.get('devops-engineer'), have);
  assert(g.gaps.some((x) => x.name === 'Kubernetes' && x.status === 'missing'));
  assert(g.readiness < 50);
});
t('roadmap adds prerequisites and orders them first', () => {
  const plan = R.buildRoadmap(ctx, ctx.careerBySlug.get('ml-engineer'), new Map());
  const idx = (n) => plan.steps.findIndex((s) => s.name === n);
  assert(idx('Python') < idx('Machine Learning'), 'Python before ML');
  assert(idx('Machine Learning') < idx('Deep Learning'), 'ML before DL');
  assert(idx('Deep Learning') < idx('TensorFlow'), 'DL before TF');
  assert(plan.steps.every((s) => s.resources.length === 3));
  assert(plan.steps.some((s) => s.projectIdea));
});
t('hobby-based suggestions', () => {
  const m = R.matchInterests(ctx, ['chess'], ['I love photography and cricket'], '');
  assert(m.some((x) => x.id === 'chess') && m.some((x) => x.id === 'photography') && m.some((x) => x.id === 'sports'));
  const ranked = R.rankCareers(ctx, new Map(), m);
  assert(ranked.some((r) => r.interestReasons.length));
  assert(R.interestSuggestions(ctx, m, have).length === m.length);
});
t('project recommendations target gaps', () => {
  const plan = R.buildRoadmap(ctx, ctx.careerBySlug.get('devops-engineer'), have);
  const recs = R.recommendProjects(ctx, have, plan.steps.map((s) => s.skillId), 5);
  assert(recs.length >= 3 && recs.every((r) => r.teaches.length > 0));
});
t('graph builds domain -> skill hierarchy with goal gaps', () => {
  const entries = parsed.skills.map((s) => ({ skill: byName.get(s.name), level: s.level, sources: s.sources }));
  const g = buildGraph(ctx, { _id: 'u1', name: 'Ananya' }, entries, parsed.projects.map((p, i) => ({ _id: 'p' + i, title: p.title, skills: p.skills.map((n) => byName.get(n)._id) })), [], { goalSlug: 'full-stack-developer' });
  assert(g.nodes.some((n) => n.type === 'domain' && n.label === 'Web Development'));
  assert(g.links.some((l) => l.type === 'PREREQUISITE'));
  assert(g.links.some((l) => l.type === 'USES'));
  assert(g.tree[0].groups.length >= 1);
  assert(g.goal && g.goal.slug === 'full-stack-developer');
});

console.log(`\n${passed} checks passed`);
