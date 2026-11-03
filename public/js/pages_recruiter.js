// Recruiter pages: Talent search (skill filters + ranking), Shortlist, Pool analytics, Candidate detail with graph
import { html, useState, useEffect, api, toast, useLoad, Loading, Spinner, Dots, Bar, Gauge, Chip, Empty, Modal, SkillPicker, LEVELS } from './lib.js';
import { ForceGraph } from './graph.js';

function CandidateDetail({ id, onClose }) {
  const { loading, data, error } = useLoad(() => api('/recruiter/candidates/' + id), [id]);
  const graph = useLoad(() => api('/graph/user/' + id + '?goal=1'), [id]);
  return html`<${Modal} onClose=${onClose}>
    <div class="inline"><h2 style="margin:0">${data ? data.candidate.name : 'Candidate'}</h2><button class="right" onClick=${onClose}>Close ✕</button></div>
    ${loading || error ? html`<${Loading} error=${error} />` : html`
      <div class="muted">${[data.candidate.headline, data.candidate.location, data.candidate.experienceYears + ' yrs exp', data.candidate.email].filter(Boolean).join(' - ')}</div>
      ${data.interests.length > 0 && html`<div style="margin-top:.3rem">${data.interests.map((i) => html`<${Chip}>♥ ${i}<//>`)}</div>`}
      <div class="grid g2" style="margin-top:1rem">
        <div><h3>Career fit</h3>${data.careerFit.map((c) => html`<div class="kv"><span class="k" style="width:170px">${c.title}</span><${Bar} pct=${c.readiness} /><span class="v">${c.readiness}%</span></div>${c.gaps.length ? html`<div class="small muted" style="margin:-.2rem 0 .3rem">gaps: ${c.gaps.join(', ')}</div>` : ''}`)}
          <h3 style="margin-top:1rem">Domain strengths</h3>${data.strengths.slice(0, 5).map((s) => html`<div class="kv"><span class="k">${s.domain}</span><${Bar} pct=${(s.score / data.strengths[0].score) * 100} /><span class="v">${s.skills}</span></div>`)}</div>
        <div><h3>Skills (${data.skills.length})</h3><div style="max-height:260px;overflow:auto">${data.skills.map((s) => html`<${Chip}>${s.name} <${Dots} level=${s.level} /><//>`)}</div></div>
      </div>
      <div class="grid g2" style="margin-top:1rem">
        <div><h3>Projects (${data.projects.length})</h3>${data.projects.map((p) => html`<div class="item"><b>${p.title}</b><div class="small muted">${p.description}</div>${p.skills.map((s) => html`<${Chip}>${s}<//>`)}</div>`)}</div>
        <div><h3>Certifications (${data.certifications.length})</h3>${data.certifications.length ? data.certifications.map((c) => html`<div class="item"><b>${c.name}</b> <span class="muted small">${[c.issuer, c.year].filter(Boolean).join(' - ')}</span></div>`) : html`<div class="muted small">None listed</div>`}</div>
      </div>
      <h3 style="margin-top:1rem">Skill knowledge graph</h3>
      ${graph.data ? html`<${ForceGraph} data=${graph.data} height=${440} />` : html`<${Loading} />`}`}
  <//>`;
}

export function RecruiterSearchPage({ shortlistOnly }) {
  const catalog = useLoad(() => api('/skills'), []);
  const careers = useLoad(() => api('/careers'), []);
  const [skills, setSkills] = useState([]);
  const [t, setT] = useState('');
  const [minLevel, setMinLevel] = useState(2);
  const [career, setCareer] = useState('');
  const [minExp, setMinExp] = useState(0);
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);

  const run = async () => {
    setBusy(true);
    try {
      if (shortlistOnly) setRes(await api('/recruiter/shortlist'));
      else setRes(await api(`/recruiter/candidates?skills=${encodeURIComponent(skills.join(','))}&minLevel=${minLevel}&career=${career}&minExp=${minExp}&q=${encodeURIComponent(q)}`));
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  useEffect(() => { run(); }, [shortlistOnly]);

  const addSkill = (v) => { const sk = (catalog.data?.skills || []).find((s) => s.name.toLowerCase() === v.trim().toLowerCase()); if (sk && !skills.includes(sk.name)) setSkills([...skills, sk.name]); setT(''); };
  const toggleShort = async (c) => {
    await api('/recruiter/shortlist/' + c.id, { method: c.shortlisted ? 'DELETE' : 'POST' });
    if (shortlistOnly) run(); else setRes({ ...res, candidates: res.candidates.map((x) => (x.id === c.id ? { ...x, shortlisted: !x.shortlisted } : x)) });
    toast(c.shortlisted ? 'Removed from shortlist' : 'Added to shortlist');
  };

  return html`<div>
    <div class="head"><div><h1>${shortlistOnly ? 'Shortlist' : 'Talent search'}</h1><div class="muted">${shortlistOnly ? 'Candidates you saved.' : 'Find candidates by verified skill levels, then compare their graphs.'}</div></div></div>
    ${!shortlistOnly && html`<div class="card" style="margin-bottom:1rem"><div class="grid g2"><div>
        <label>Required skills</label><div>${skills.map((s) => html`<${Chip} on=${true} onClick=${() => setSkills(skills.filter((x) => x !== s))}>${s} ✕<//>`)}</div>
        <div class="inline"><${SkillPicker} catalog=${catalog.data?.skills || []} value=${t} onInput=${setT} onCommit=${addSkill} placeholder="Type a skill, pick from list, e.g. React" id="dl-rec" /></div>
        <div class="row"><div class="grow"><label>Minimum level</label><select value=${minLevel} onChange=${(e) => setMinLevel(+e.target.value)}>${[1, 2, 3, 4].map((l) => html`<option value=${l}>${l} - ${LEVELS[l]}</option>`)}</select></div>
          <div class="grow"><label>Min. experience (yrs)</label><input type="number" min="0" value=${minExp} onInput=${(e) => setMinExp(+e.target.value)} /></div></div>
      </div><div>
        <label>Rank by readiness for role</label><select value=${career} onChange=${(e) => setCareer(e.target.value)}><option value="">- any -</option>${(careers.data?.careers || []).map((c) => html`<option value=${c.slug}>${c.title}</option>`)}</select>
        <label>Name / headline / location</label><input value=${q} onInput=${(e) => setQ(e.target.value)} placeholder="e.g. Chennai, senior" />
        <div style="margin-top:1rem"><button class="primary" disabled=${busy} onClick=${run}>${busy ? html`<${Spinner} />` : 'Search candidates'}</button></div>
      </div></div></div>`}

    ${!res ? html`<${Loading} />` : html`<div class="muted small" style="margin-bottom:.5rem">${shortlistOnly ? res.candidates.length : res.total} candidate${(shortlistOnly ? res.candidates.length : res.total) === 1 ? '' : 's'} ${!shortlistOnly && res.total > res.candidates.length ? `(showing top ${res.candidates.length})` : ''}</div>
      ${res.candidates.length === 0 ? html`<div class="card"><${Empty}>${shortlistOnly ? 'Nobody shortlisted yet.' : 'No candidates match. Loosen the filters.'}<//></div>` : html`<div class="grid g2">${res.candidates.map((c) => html`<div class="card" key=${c.id}>
        <div class="inline"><b style="font-size:1.05rem">${c.name}</b><span class="muted small">${c.headline}</span>${c.score !== undefined && html`<span class="right"><b style="font-size:1.3rem">${c.score}</b><span class="muted small">/100</span></span>`}</div>
        <div class="muted small">${[c.location, c.experienceYears + ' yrs', c.skillCount + ' skills', c.projects !== undefined ? c.projects + ' projects' : '', c.certifications ? c.certifications + ' certs' : ''].filter(Boolean).join(' - ')}</div>
        ${c.score !== undefined && html`<div style="margin:.4rem 0"><${Bar} pct=${c.score} /></div>`}
        ${c.matchedSkills && c.matchedSkills.length > 0 && html`<div>${c.matchedSkills.map((s) => html`<${Chip} kind="ok">✓ ${s}<//>`)}${c.missingSkills.map((s) => html`<${Chip} kind="bad">✗ ${s}<//>`)}</div>`}
        ${c.readiness !== null && c.readiness !== undefined && html`<div class="small muted">Role readiness: <b>${c.readiness}%</b></div>`}
        <div style="margin-top:.3rem">${c.topSkills.map((s) => html`<${Chip}>${s.name} <${Dots} level=${s.level} /><//>`)}</div>
        <div class="inline" style="margin-top:.5rem"><button class="primary small" onClick=${() => setOpen(c.id)}>View profile & graph</button><button class="small" onClick=${() => toggleShort(c)}>${c.shortlisted ? '★ Shortlisted' : '☆ Shortlist'}</button></div>
      </div>`)}</div>`}`}
    ${open && html`<${CandidateDetail} id=${open} onClose=${() => setOpen(null)} />`}
  </div>`;
}

export function RecruiterStatsPage() {
  const { loading, data, error } = useLoad(() => api('/recruiter/stats'), []);
  if (loading || error) return html`<${Loading} error=${error} />`;
  const mx = Math.max(1, ...data.topSkills.map((s) => s.candidates));
  const md = Math.max(1, ...data.advancedByDomain.map((s) => s.candidates));
  const mp = Math.max(1, ...data.talentPool.map((s) => s.ready + s.near));
  return html`<div>
    <div class="head"><div><h1>Talent pool analytics</h1><div class="muted">What skills your candidate pool really has.</div></div></div>
    <div class="grid g4"><div class="card stat"><b>${data.candidates}</b><span>Candidates</span></div><div class="card stat"><b>${data.avgSkills}</b><span>Avg skills per candidate</span></div>
      <div class="card stat"><b>${data.topSkills[0]?.name || '-'}</b><span>Most common skill</span></div><div class="card stat"><b>${data.talentPool[0]?.ready ?? 0}</b><span>Candidates ready for ${data.talentPool[0]?.title || '-'}</span></div></div>
    <div class="grid g2" style="margin-top:1rem">
      <div class="card"><h2>Most common skills</h2>${data.topSkills.map((s) => html`<div class="kv"><span class="k">${s.name}</span><${Bar} pct=${(s.candidates / mx) * 100} /><span class="v">${s.candidates}</span></div>`)}</div>
      <div class="card"><h2>Advanced talent by domain</h2><div class="small muted">Candidates with at least one Advanced/Expert skill in the domain</div>${data.advancedByDomain.map((s) => html`<div class="kv"><span class="k">${s.domain}</span><${Bar} pct=${(s.candidates / md) * 100} /><span class="v">${s.candidates}</span></div>`)}</div>
    </div>
    <div class="card" style="margin-top:1rem"><h2>Hiring-ready pool by role</h2><div class="small muted">Ready = at least 75% of the role's weighted requirements. Near = 55-74%.</div>
      <table><tr><th>Role</th><th style="width:40%">Pool</th><th>Ready</th><th>Near</th></tr>${data.talentPool.map((p) => html`<tr><td><b>${p.title}</b></td><td><${Bar} pct=${((p.ready + p.near) / mp) * 100} /></td><td>${p.ready}</td><td>${p.near}</td></tr>`)}</table></div>
  </div>`;
}
