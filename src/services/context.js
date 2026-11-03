// Loads the static catalogue (skills, careers, prerequisite edges) from MongoDB into an in-memory context.
const fs = require('fs');
const path = require('path');
const cfg = require('../config');
const { Skill, Career, Relationship } = require('../models');
const { buildContext } = require('./recommender');
const { buildMatchers } = require('./extractor');

const readJson = (f) => JSON.parse(fs.readFileSync(path.join(cfg.DATA_DIR, f), 'utf8'));

let cache = null;

async function getContext() {
  if (cache) return cache;
  const [skills, careers, edges] = await Promise.all([
    Skill.find().lean(),
    Career.find().lean(),
    Relationship.find({ type: { $in: ['PREREQUISITE', 'REQUIRES'] } }).lean(),
  ]);
  const prereqs = new Map();
  const reqs = new Map();
  for (const e of edges) {
    if (e.type === 'PREREQUISITE') {
      const k = String(e.fromId);
      prereqs.set(k, [...(prereqs.get(k) || []), String(e.toId)]);
    } else {
      const k = String(e.fromId);
      reqs.set(k, [...(reqs.get(k) || []), { skillId: String(e.toId), level: e.meta?.level || 1, weight: e.weight || 1 }]);
    }
  }
  const careerList = careers.map((c) => ({ ...c, requirements: reqs.get(String(c._id)) || [] }));
  const ctx = buildContext({ skills, prereqs, careers: careerList, interests: readJson('interests.json'), ideas: readJson('project_ideas.json') });
  ctx.matchers = buildMatchers(skills);
  ctx.certCatalog = readJson('certifications.json');
  cache = ctx;
  return ctx;
}

function resetContext() { cache = null; }

module.exports = { getContext, resetContext, readJson };
