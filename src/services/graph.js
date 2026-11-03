// Builds the user's Skill Knowledge Graph (nodes + links) and the hierarchical tree view.
const { careerReadiness } = require('./recommender');

/**
 * haveEntries: [{skill, level, sources}]
 * projects:    [{_id,title,skills:[ObjectId]}]  certs: [{_id,name,skills:[ObjectId]}]
 */
function buildGraph(ctx, user, haveEntries, projects = [], certs = [], { goalSlug } = {}) {
  const nodes = [];
  const links = [];
  const have = new Map(haveEntries.map((h) => [String(h.skill._id), h.level]));
  const domainIds = new Map();

  nodes.push({ id: `user:${user._id}`, label: user.name, type: 'user', val: 18 });

  const ensureDomain = (domain) => {
    if (domainIds.has(domain)) return domainIds.get(domain);
    const id = `domain:${domain}`;
    domainIds.set(domain, id);
    nodes.push({ id, label: domain, type: 'domain', val: 12, domain });
    links.push({ source: `user:${user._id}`, target: id, type: 'HAS_DOMAIN' });
    return id;
  };

  for (const h of haveEntries) {
    const did = ensureDomain(h.skill.domain);
    const id = `skill:${h.skill._id}`;
    nodes.push({ id, label: h.skill.name, type: 'skill', level: h.level, domain: h.skill.domain, group: h.skill.group, val: 4 + h.level * 2, sources: h.sources });
    links.push({ source: did, target: id, type: 'PART_OF' });
  }

  // prerequisite chains between skills the user holds
  for (const h of haveEntries) {
    for (const p of ctx.prereqs.get(String(h.skill._id)) || []) {
      if (have.has(p)) links.push({ source: `skill:${p}`, target: `skill:${h.skill._id}`, type: 'PREREQUISITE' });
    }
  }

  for (const p of projects) {
    const id = `project:${p._id}`;
    const linked = (p.skills || []).map(String).filter((s) => have.has(s));
    nodes.push({ id, label: p.title, type: 'project', val: 7 });
    for (const s of linked) links.push({ source: id, target: `skill:${s}`, type: 'USES' });
    if (!linked.length) links.push({ source: `user:${user._id}`, target: id, type: 'BUILT' });
  }
  for (const c of certs) {
    const id = `cert:${c._id}`;
    const linked = (c.skills || []).map(String).filter((s) => have.has(s));
    nodes.push({ id, label: c.name, type: 'cert', val: 7 });
    for (const s of linked) links.push({ source: id, target: `skill:${s}`, type: 'VALIDATES' });
    if (!linked.length) links.push({ source: `user:${user._id}`, target: id, type: 'EARNED' });
  }

  let goal = null;
  if (goalSlug && ctx.careerBySlug.has(goalSlug)) {
    const r = careerReadiness(ctx, ctx.careerBySlug.get(goalSlug), have);
    goal = { slug: goalSlug, title: r.career.title, readiness: r.readiness };
    for (const g of r.gaps.filter((x) => x.status === 'missing')) {
      const did = ensureDomain(g.domain);
      const id = `skill:${g.skillId}`;
      nodes.push({ id, label: g.name, type: 'missing', level: 0, need: g.need, domain: g.domain, val: 5 });
      links.push({ source: did, target: id, type: 'GAP' });
    }
  }

  // hierarchical tree: Domain -> Group -> Skills
  const tree = {};
  for (const h of haveEntries) {
    const d = (tree[h.skill.domain] = tree[h.skill.domain] || { domain: h.skill.domain, total: 0, groups: {} });
    d.total += h.level;
    const g = (d.groups[h.skill.group || 'General'] = d.groups[h.skill.group || 'General'] || []);
    const usedBy = projects.filter((p) => (p.skills || []).map(String).includes(String(h.skill._id))).map((p) => p.title);
    g.push({ name: h.skill.name, level: h.level, projects: usedBy });
  }
  const treeArr = Object.values(tree).map((d) => ({
    domain: d.domain,
    score: d.total,
    groups: Object.entries(d.groups).map(([group, skills]) => ({ group, skills: skills.sort((a, b) => b.level - a.level) })),
  })).sort((a, b) => b.score - a.score);

  return { nodes, links, tree: treeArr, goal, stats: { skills: haveEntries.length, projects: projects.length, certifications: certs.length, domains: domainIds.size } };
}

module.exports = { buildGraph };
