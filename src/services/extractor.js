// Rule-based resume parsing + skill extraction. Pure functions, no DB access.
const AMBIGUOUS = new Set(['c', 'r', 'go']);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const B_BEFORE = '(?<![A-Za-z0-9+#.])';
const B_AFTER = '(?![A-Za-z0-9+#])';

const HEADINGS = {
  skills: ['(technical )?skills?( & tools)?', 'core competencies', 'technologies', 'tech stack', 'tools( & technologies)?', 'languages? (&|and) frameworks?', 'technical proficiency'],
  projects: ['(personal |academic |key |side )?projects?'],
  experience: ['(work |professional |relevant )?experience', 'employment( history)?', 'internships?'],
  education: ['education(al background)?', 'academics?', 'qualifications?'],
  certifications: ['certifications?', 'certificates?', 'licenses?( (&|and) certifications?)?', 'courses?'],
  summary: ['(professional )?summary', 'objective', 'career objective', 'profile', 'about( me)?'],
  interests: ['interests?', 'hobbies', 'hobbies (&|and) interests', 'extracurricular(s| activities)?'],
  other: ['achievements?', 'awards?', 'publications?', 'references?', 'languages?', 'volunteering'],
};
const HEADING_RES = Object.entries(HEADINGS).map(([k, alts]) => [k, new RegExp(`^(?:${alts.join('|')})$`, 'i')]);

function headingOf(line) {
  const t = line.trim().replace(/[:\-–—_=*#]+$/g, '').replace(/^[#*\s]+/, '').trim();
  if (!t || t.length > 40) return null;
  for (const [k, re] of HEADING_RES) if (re.test(t)) return k;
  return null;
}

/** Build one matcher per catalogue skill. skills: [{_id|id, name, aliases, domain}] */
function buildMatchers(skills) {
  return skills.map((s) => {
    const terms = [s.name, ...(s.aliases || [])];
    const normal = terms.filter((t) => !AMBIGUOUS.has(t.toLowerCase()));
    const ambiguous = terms.filter((t) => AMBIGUOUS.has(t.toLowerCase()));
    return {
      skill: s,
      re: normal.length ? new RegExp(`${B_BEFORE}(?:${normal.map(esc).join('|')})(?:s|es)?${B_AFTER}`, 'gi') : null,
      ambRe: ambiguous.length ? new RegExp(`${B_BEFORE}(?:${ambiguous.map(esc).join('|')})${B_AFTER}`, 'g') : null,
    };
  });
}

const LIST_LINE = /([,|;•·]|\s\/\s).*([,|;•·]|\s\/\s)/; // line that looks like a skill list

function* matchesIn(line, m) {
  if (m.re) {
    m.re.lastIndex = 0;
    let x;
    while ((x = m.re.exec(line))) {
      if (m.skill.name === 'React' && /^\s*native/i.test(line.slice(x.index + x[0].length))) continue;
      yield { i: x.index, len: x[0].length };
    }
  }
  if (m.ambRe && LIST_LINE.test(line)) {
    m.ambRe.lastIndex = 0;
    let x;
    while ((x = m.ambRe.exec(line))) yield { i: x.index, len: x[0].length };
  }
}

/** The comma/semicolon-delimited clause around a match, so "learning X" or "5 years of Y" only affects that skill. */
function clauseAround(line, idx, len) {
  let start = 0, end = line.length, b;
  const re = /[,;:|()•·]|\.(?=\s|$)|\s[-–—]\s/g;
  while ((b = re.exec(line))) {
    if (b.index + b[0].length <= idx) start = b.index + b[0].length;
    else if (b.index >= idx + len) { end = b.index; break; }
  }
  return line.slice(start, end);
}

function inferLevel({ count, inSkills, inProjects, inExperience, contexts }) {
  let lvl = 1;
  if (count >= 3) lvl = 2;
  if (count >= 6 || (count >= 3 && inProjects >= 2)) lvl = 3;
  if (inSkills) lvl = Math.max(lvl, 2);
  if (inExperience >= 2) lvl = Math.max(lvl, 3);
  let years = 0;
  let strong = false;
  let weak = false;
  for (const c of contexts) {
    const y = c.match(/(\d{1,2})\+?\s*(?:years?|yrs?)/i);
    if (y) years = Math.max(years, +y[1]);
    if (/\b(expert|advanced|proficient|extensive|strong|mastery)\b/i.test(c)) strong = true;
    if (/\b(basic|beginner|familiar(ity)?|exposure|learning|currently learning|elementary)\b/i.test(c)) weak = true;
  }
  if (years >= 5) lvl = 4;
  else if (years >= 3) lvl = Math.max(lvl, 3);
  else if (years >= 1) lvl = Math.max(lvl, 2);
  if (strong) lvl = Math.min(4, Math.max(lvl, 3) + (/expert|mastery/i.test(contexts.join(' ')) ? 1 : 0));
  if (weak && !years && !strong) lvl = 1;
  return Math.max(1, Math.min(4, lvl));
}

/** Core skill extraction over free text. Returns array sorted by level then confidence. */
function extractSkills(text, matchers, { source = 'resume' } = {}) {
  const lines = String(text || '').split(/\r?\n/);
  const acc = new Map();
  let section = 'other';
  for (const raw of lines) {
    const h = headingOf(raw);
    if (h) { section = h; continue; }
    const line = raw.trim();
    if (!line) continue;
    for (const m of matchers) {
      const hits = [...matchesIn(line, m)];
      const c = hits.length;
      if (!c) continue;
      const id = String(m.skill._id || m.skill.id);
      const a = acc.get(id) || { skill: m.skill, count: 0, inSkills: false, inProjects: 0, inExperience: 0, contexts: [], evidence: '' };
      a.count += c;
      if (section === 'skills') a.inSkills = true;
      if (section === 'projects') a.inProjects += 1;
      if (section === 'experience') a.inExperience += 1;
      for (const h of hits) if (a.contexts.length < 8) a.contexts.push(clauseAround(line, h.i, h.len));
      if (!a.evidence || (section !== 'skills' && a.evidenceSection === 'skills')) {
        a.evidence = line.length > 140 ? line.slice(0, 137) + '...' : line;
        a.evidenceSection = section;
      }
      acc.set(id, a);
    }
  }
  return [...acc.values()]
    .map((a) => ({
      skillId: String(a.skill._id || a.skill.id),
      name: a.skill.name,
      domain: a.skill.domain,
      level: inferLevel(a),
      confidence: Math.min(1, +(0.35 + 0.12 * a.count + (a.inSkills ? 0.2 : 0) + (a.inProjects ? 0.1 : 0)).toFixed(2)),
      mentions: a.count,
      evidence: a.evidence,
      sources: [source],
    }))
    .sort((x, y) => y.level - x.level || y.confidence - x.confidence || x.name.localeCompare(y.name));
}

function sectionize(text) {
  const out = {};
  let cur = 'header';
  for (const raw of String(text || '').split(/\r?\n/)) {
    const h = headingOf(raw);
    if (h) { cur = h; out[cur] = out[cur] || []; continue; }
    (out[cur] = out[cur] || []).push(raw);
  }
  return out;
}

const BULLET = /^\s*[-•*–·▪●■]\s*/;
const DEGREE = /\b(b\.?\s?tech|b\.?\s?e\.?|b\.?\s?sc|b\.?\s?s\.?|b\.?\s?a\.?|b\.?\s?c\.?a|m\.?\s?tech|m\.?\s?sc|m\.?\s?s\.?|m\.?\s?b\.?\s?a|m\.?\s?c\.?a|ph\.?\s?d|bachelor|master|diploma|associate degree|high school|hsc|ssc)\b/i;
const INSTITUTION = /\b(university|college|institute|school|academy|iit|nit|bits)\b/i;

function parseProjects(lines, matchers) {
  const projects = [];
  let cur = null;
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const isBullet = BULLET.test(raw);
    const text = raw.replace(BULLET, '').trim();
    if (!isBullet && text.length < 100 && !/^[a-z]/.test(text)) {
      if (cur) projects.push(cur);
      const [title, ...rest] = text.split(/\s+[|–—-]\s+/);
      cur = { title: title.trim().replace(/[:]+$/, ''), description: rest.join(' - ') };
    } else if (cur) {
      cur.description += (cur.description ? ' ' : '') + text;
    } else {
      cur = { title: text.slice(0, 60), description: '' };
    }
  }
  if (cur) projects.push(cur);
  return projects.filter((p) => p.title).map((p) => {
    const found = extractSkills(`${p.title}\n${p.description}`, matchers, { source: 'project' });
    const url = (p.description.match(/https?:\/\/\S+/) || [])[0];
    return { title: p.title, description: p.description.slice(0, 500), url, skills: found.map((s) => s.name) };
  });
}

function parseCerts(lines, matchers) {
  return lines.map((l) => l.replace(BULLET, '').trim()).filter((l) => l.length > 3).map((l) => {
    const year = (l.match(/\b(19|20)\d{2}\b/) || [])[0];
    const clean = l.replace(/\(?\b(19|20)\d{2}\b\)?/g, '').replace(/\s{2,}/g, ' ').trim();
    const [name, issuer = ''] = clean.split(/\s+[|–—-]\s+|,\s+(?=[A-Z])/);
    const skills = extractSkills(clean, matchers, { source: 'certification' }).map((s) => s.name);
    return { name: name.trim().replace(/[,;:]+$/, ''), issuer: issuer.trim(), year: year ? +year : undefined, skills };
  }).filter((c) => c.name);
}

function parseEducation(lines) {
  const ls = lines.map((l) => l.replace(BULLET, '').trim()).filter(Boolean);
  const out = [];
  ls.forEach((l, i) => {
    if (!DEGREE.test(l)) return;
    const near = [ls[i - 1], ls[i + 1]].find((x) => x && INSTITUTION.test(x) && !DEGREE.test(x));
    const inline = INSTITUTION.test(l) ? l : '';
    out.push({ degree: l.slice(0, 120), school: (near || inline || '').slice(0, 120), year: (l.match(/\b(19|20)\d{2}\b/g) || []).pop() || (near || '').match(/\b(19|20)\d{2}\b/g)?.pop() || '' });
  });
  return out.slice(0, 4);
}

function parseResume(text, matchers) {
  text = String(text || '');
  const sections = sectionize(text);
  const firstLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const email = (text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [])[0] || '';
  const phone = (text.match(/(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{3,5}\)?[\s-]?)\d{3,5}[\s-]?\d{3,5}/) || [])[0] || '';
  const github = (text.match(/github\.com\/([A-Za-z0-9-]+)/i) || [])[1] || '';
  const linkedin = (text.match(/linkedin\.com\/in\/([A-Za-z0-9-_%]+)/i) || [])[1] || '';
  let name = '';
  for (const l of firstLines.slice(0, 4)) {
    if (l.length < 50 && !/@|http|\d{4}/.test(l) && !headingOf(l) && /^[A-Za-z][A-Za-z .'-]+$/.test(l)) { name = l; break; }
  }
  const exp = text.match(/(\d{1,2})\+?\s+years?\s+of\s+(?:professional\s+)?experience/i);
  const summary = (sections.summary || []).join(' ').trim().slice(0, 400);

  return {
    profile: {
      name, email, phone, github, linkedin,
      experienceYears: exp ? +exp[1] : 0,
      headline: firstLines.slice(1, 3).find((l) => l.length < 80 && !/@|http|\d{5}/.test(l) && !headingOf(l) && l !== name) || '',
      bio: summary,
      education: parseEducation(sections.education || []),
      interestsText: (sections.interests || []).join(', ').replace(BULLET, '').slice(0, 200),
    },
    skills: extractSkills(text, matchers),
    projects: parseProjects(sections.projects || [], matchers),
    certifications: parseCerts(sections.certifications || [], matchers),
    stats: { characters: text.length, lines: firstLines.length, sections: Object.keys(sections).filter((k) => k !== 'header') },
  };
}

module.exports = { buildMatchers, extractSkills, parseResume, headingOf };
