// Candidate pages: Login, Dashboard, Import (resume + GitHub), Profile (skills, projects, certifications)
import { html, useState, useEffect, api, session, toast, go, useLoad, Loading, Spinner, Dots, Bar, Gauge, Chip, Empty, SkillPicker, LEVELS } from './lib.js';

// ============================== LOGIN ==============================
export function LoginPage({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'candidate' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e, creds) => {
    e && e.preventDefault();
    setBusy(true);
    try {
      const body = creds || f;
      const out = await api(mode === 'login' || creds ? '/auth/login' : '/auth/register', { method: 'POST', body });
      session.set(out.token, out.user);
      onAuth(out.user);
    } catch (err) { toast(err.message, 'err'); } finally { setBusy(false); }
  };

  return html`<div class="login">
    <div class="card">
      <h1>Skill<span style="color:var(--brand)">Graph</span></h1>
      <p class="muted">Your living resume: upload once, get a skill knowledge graph, gap analysis and a personalised career roadmap.</p>
      <div class="tabs" style="margin:.5rem 0 .2rem">
        <button class=${mode === 'login' ? 'on' : ''} onClick=${() => setMode('login')}>Sign in</button>
        <button class=${mode === 'register' ? 'on' : ''} onClick=${() => setMode('register')}>Create account</button>
      </div>
      <form onSubmit=${submit}>
        ${mode === 'register' && html`<label>Full name</label><input value=${f.name} onInput=${set('name')} required />`}
        <label>Email</label><input type="email" value=${f.email} onInput=${set('email')} required />
        <label>Password</label><input type="password" value=${f.password} onInput=${set('password')} required minlength="6" />
        ${mode === 'register' && html`<label>I am a</label><select value=${f.role} onChange=${set('role')}><option value="candidate">Candidate / student</option><option value="recruiter">Recruiter</option></select>`}
        <div style="margin-top:1rem"><button class="primary" style="width:100%" disabled=${busy}>${busy ? html`<${Spinner} />` : mode === 'login' ? 'Sign in' : 'Create account'}</button></div>
      </form>
      <hr style="border:0;border-top:1px solid var(--line);margin:1.1rem 0" />
      <div class="small muted" style="margin-bottom:.4rem">Just exploring? Use a demo account (150 sample candidates are pre-loaded):</div>
      <div class="inline">
        <button onClick=${() => { setMode('login'); submit(null, { email: 'demo@skillgraph.dev', password: 'demo1234' }); }}>Demo candidate</button>
        <button onClick=${() => { setMode('login'); submit(null, { email: 'recruiter@skillgraph.dev', password: 'demo1234' }); }}>Demo recruiter</button>
      </div>
    </div>
  </div>`;
}

// ============================== DASHBOARD ==============================
export function DashboardPage() {
  const { loading, data, error } = useLoad(() => api('/dashboard'), []);
  if (loading || error) return html`<${Loading} error=${error} />`;
  const d = data;
  const maxScore = Math.max(1, ...d.strengths.map((s) => s.score));

  return html`<div>
    <div class="head"><div><h1>Welcome back, ${d.user.name.split(' ')[0]}</h1><div class="muted">${d.user.headline || 'Your career intelligence overview'}</div></div></div>

    ${!d.hasProfileData && html`<div class="card brief" style="margin-bottom:1rem"><h2>Start here</h2><p>Your graph is empty. Upload a resume or import your GitHub to build it in seconds.</p><button class="primary" onClick=${() => go('/import')}>Import resume / GitHub</button></div>`}

    <div class="grid g4">
      <div class="card stat"><b>${d.counts.skills}</b><span>Skills in your graph</span></div>
      <div class="card stat"><b>${d.counts.advanced}</b><span>Advanced / expert skills</span></div>
      <div class="card stat"><b>${d.counts.projects}</b><span>Projects</span></div>
      <div class="card stat"><b>${d.counts.certifications}</b><span>Certifications</span></div>
    </div>

    <div class="grid g2" style="margin-top:1rem">
      <div class="card">
        <h2>Career goal</h2>
        ${d.goal ? html`
          <div class="inline" style="gap:1.2rem;align-items:center">
            <${Gauge} pct=${d.goal.readiness} />
            <div style="flex:1;min-width:180px"><h3 style="margin:0">${d.goal.title}</h3>
              <div class="muted small">${d.goal.counts.met}/${d.goal.counts.required} required skills met</div>
              <div style="margin-top:.5rem">${d.goal.topGaps.map((g) => html`<${Chip} kind=${g.status === 'missing' ? 'bad' : 'warn'}>${g.name}<//>`)}</div>
              <div class="small muted">Top gaps to close</div></div>
          </div>
          <div style="margin-top:.8rem" class="inline"><button onClick=${() => go('/careers')}>Gap analysis</button><button class="primary" onClick=${() => go('/roadmap')}>Open roadmap</button></div>
        ` : html`<${Empty}>No goal yet. <a href="#/careers">Pick a target career</a>.<//>`}
      </div>

      <div class="card">
        <h2>Roadmap progress</h2>
        ${d.roadmap ? html`
          <div class="muted small">${d.roadmap.careerTitle} - started at ${d.roadmap.readinessAtStart}% ready</div>
          <div style="margin:.5rem 0"><${Bar} pct=${d.roadmap.progress.percent} /></div>
          <div><b>${d.roadmap.progress.done}</b> of ${d.roadmap.progress.total} steps done - ${d.roadmap.progress.hoursDone}/${d.roadmap.progress.hoursTotal} est. hours</div>
          <div style="margin-top:.6rem"><div class="small muted">Up next</div>${d.roadmap.next.map((s) => html`<div class="item"><b>${s.name}</b> <span class="muted small">~${s.estHours}h ${s.status === 'in_progress' ? '- in progress' : ''}</span></div>`)}</div>
          <button style="margin-top:.4rem" onClick=${() => go('/roadmap')}>Continue learning</button>
        ` : html`<${Empty}>No roadmap yet.<br /><button class="primary" style="margin-top:.5rem" onClick=${() => go('/roadmap')}>Generate my roadmap</button><//>`}
      </div>
    </div>

    <div class="grid g2" style="margin-top:1rem">
      <div class="card"><h2>Domain strengths</h2>
        ${d.strengths.length ? d.strengths.map((s) => html`<div class="kv"><span class="k">${s.domain}</span><${Bar} pct=${(s.score / maxScore) * 100} /><span class="v">${s.skills} skills</span></div>`) : html`<${Empty}>Nothing yet.<//>`}
      </div>
      <div class="card"><h2>Best-fit careers right now</h2>
        ${d.topCareers.map((c) => html`<div class="kv"><span class="k" style="width:190px">${c.title}</span><${Bar} pct=${c.readiness} /><span class="v">${c.readiness}%</span></div>`)}
        <button class="ghost" onClick=${() => go('/recommendations')}>See all recommendations →</button>
      </div>
    </div>

    <div class="card" style="margin-top:1rem"><h2>Top skills</h2>
      ${d.topSkills.length ? d.topSkills.map((s) => html`<${Chip}>${s.name} <${Dots} level=${s.level} /><//>`) : html`<${Empty}>Add skills to see them here.<//>`}
    </div>
  </div>`;
}

// ============================== IMPORT ==============================
function ImportReview({ result, source, onDone }) {
  const [skills, setSkills] = useState(() => result.skills.map((s) => ({ ...s, on: true })));
  const [projects, setProjects] = useState(() => (result.projects || []).map((p) => ({ ...p, on: true })));
  const [certs, setCerts] = useState(() => (result.certifications || []).map((c) => ({ ...c, on: true })));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setSkills(result.skills.map((s) => ({ ...s, on: true })));
    setProjects((result.projects || []).map((p) => ({ ...p, on: true })));
    setCerts((result.certifications || []).map((c) => ({ ...c, on: true })));
  }, [result]);

  const apply = async () => {
    setBusy(true);
    try {
      const out = await api('/resume/apply', { method: 'POST', body: { source, profile: result.profile, skills: skills.filter((s) => s.on), projects: projects.filter((p) => p.on), certifications: certs.filter((c) => c.on) } });
      toast(`Saved: ${out.added.skills} skills, ${out.added.projects} projects, ${out.added.certifications} certifications`);
      onDone();
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const p = result.profile || {};

  return html`<div class="card" style="margin-top:1rem">
    <h2>Review what we found ${result.aiUsed ? html`<${Chip} kind="ok">AI-enhanced<//>` : ''}</h2>
    <div class="muted small">${[p.name, p.email, p.headline, p.experienceYears ? p.experienceYears + ' yrs experience' : '', p.github && 'github: ' + p.github].filter(Boolean).join(' - ')}</div>
    <h3 style="margin-top:1rem">Skills (${skills.filter((s) => s.on).length}/${skills.length})</h3>
    <div class="small muted">Untick anything wrong and adjust levels before saving. Levels are inferred from how often and how strongly each skill appears.</div>
    <div style="max-height:380px;overflow:auto;margin-top:.4rem"><table>
      <tr><th></th><th>Skill</th><th>Domain</th><th>Level</th><th>Evidence</th></tr>
      ${skills.map((s, i) => html`<tr key=${s.skillId}>
        <td><input type="checkbox" checked=${s.on} onChange=${(e) => setSkills(skills.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} /></td>
        <td><b>${s.name}</b></td><td class="muted small">${s.domain}</td>
        <td><select style="width:130px" value=${s.level} onChange=${(e) => setSkills(skills.map((x, j) => (j === i ? { ...x, level: +e.target.value } : x)))}>${[1, 2, 3, 4].map((l) => html`<option value=${l}>${l} - ${LEVELS[l]}</option>`)}</select></td>
        <td class="muted small">${s.evidence}</td></tr>`)}
    </table></div>
    ${projects.length > 0 && html`<h3 style="margin-top:1rem">Projects</h3>${projects.map((pr, i) => html`<div class="item"><label style="display:flex;gap:.5rem;align-items:flex-start;text-transform:none;margin:0;font-size:.95rem;color:var(--ink);font-weight:400"><input type="checkbox" checked=${pr.on} onChange=${(e) => setProjects(projects.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} /><span><b>${pr.title}</b> ${pr.stars ? html`<span class="muted small">★ ${pr.stars}</span>` : ''}<div class="muted small">${pr.description}</div>${pr.skills.map((s) => html`<${Chip}>${s}<//>`)}</span></label></div>`)}`}
    ${certs.length > 0 && html`<h3 style="margin-top:1rem">Certifications</h3>${certs.map((c, i) => html`<div class="item"><label style="display:flex;gap:.5rem;text-transform:none;margin:0;font-size:.95rem;color:var(--ink);font-weight:400"><input type="checkbox" checked=${c.on} onChange=${(e) => setCerts(certs.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} /><span><b>${c.name}</b> <span class="muted small">${[c.issuer, c.year].filter(Boolean).join(' - ')}</span> ${c.skills.map((s) => html`<${Chip}>${s}<//>`)}</span></label></div>`)}`}
    <div style="margin-top:1rem" class="inline"><button class="primary" disabled=${busy} onClick=${apply}>${busy ? html`<${Spinner} />` : 'Save to my profile & graph'}</button><span class="muted small">Existing higher levels are never lowered.</span></div>
  </div>`;
}

export function ImportPage() {
  const [tab, setTab] = useState('resume');
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [gh, setGh] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [src, setSrc] = useState('resume');

  const parse = async () => {
    setBusy(true); setRes(null);
    try {
      let out;
      if (file) { const form = new FormData(); form.append('file', file); out = await api('/resume/parse', { method: 'POST', form }); }
      else out = await api('/resume/parse', { method: 'POST', body: { text } });
      setSrc('resume'); setRes(out);
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const importGh = async () => {
    setBusy(true); setRes(null);
    try { const out = await api('/github/preview', { method: 'POST', body: { username: gh.replace(/^.*github\.com\//, '').replace(/\/.*$/, '').trim() } }); setSrc('github'); setRes(out); }
    catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const loadSample = async (name) => {
    try { const r = await fetch(`/samples/${name}`); setText(await r.text()); setFile(null); toast('Sample loaded - click Analyze'); } catch { toast('Could not load sample', 'err'); }
  };

  return html`<div>
    <div class="head"><div><h1>Import your resume & profiles</h1><div class="muted">We parse documents, extract skills with context-aware levels, and map projects and certificates to skills.</div></div></div>
    <div class="tabs"><button class=${tab === 'resume' ? 'on' : ''} onClick=${() => setTab('resume')}>Resume / document</button><button class=${tab === 'github' ? 'on' : ''} onClick=${() => setTab('github')}>GitHub profile</button></div>

    ${tab === 'resume' && html`<div class="card" style="margin-top:1rem">
      <label>Upload PDF, DOCX or TXT</label>
      <input type="file" accept=".pdf,.docx,.txt,.md" onChange=${(e) => setFile(e.target.files[0] || null)} />
      <label>…or paste resume / certificate text</label>
      <textarea placeholder="Paste your resume text here" value=${text} onInput=${(e) => { setText(e.target.value); setFile(null); }}></textarea>
      <div class="inline" style="margin-top:.7rem"><button class="primary" disabled=${busy || (!file && text.trim().length < 40)} onClick=${parse}>${busy ? html`<${Spinner} />` : 'Analyze'}</button>
        <span class="muted small">Try a sample:</span>
        <button class="small" onClick=${() => loadSample('ananya_fullstack.txt')}>Full-stack</button>
        <button class="small" onClick=${() => loadSample('rahul_datascience.txt')}>Data analyst</button>
        <button class="small" onClick=${() => loadSample('sam_devops.txt')}>DevOps</button></div>
    </div>`}

    ${tab === 'github' && html`<div class="card" style="margin-top:1rem">
      <label>GitHub username or profile URL</label>
      <div class="inline"><input style="flex:1;min-width:220px" placeholder="e.g. torvalds" value=${gh} onInput=${(e) => setGh(e.target.value)} /><button class="primary" disabled=${busy || !gh.trim()} onClick=${importGh}>${busy ? html`<${Spinner} />` : 'Fetch profile'}</button></div>
      <div class="muted small" style="margin-top:.4rem">Reads public repositories only: languages, topics and descriptions become skills and projects. (Needs internet access from the server.)</div>
    </div>`}

    ${res && html`<${ImportReview} result=${res} source=${src} onDone=${() => go('/graph')} />`}
  </div>`;
}

// ============================== PROFILE ==============================
export function ProfilePage() {
  const prof = useLoad(() => api('/profile'), []);
  const skills = useLoad(() => api('/skills/mine'), []);
  const projects = useLoad(() => api('/projects'), []);
  const certs = useLoad(() => api('/certifications'), []);
  const catalog = useLoad(() => api('/skills'), []);
  const [form, setForm] = useState(null);

  useEffect(() => { if (prof.data) setForm({ ...prof.data.profile, github: prof.data.profile.links?.github || '', linkedin: prof.data.profile.links?.linkedin || '', hobbiesText: (prof.data.profile.hobbies || []).join(', ') }); }, [prof.data]);
  if (!form || !skills.data || !projects.data || !certs.data || !catalog.data) return html`<${Loading} error=${prof.error || skills.error} />`;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const toggleInterest = (id) => setForm({ ...form, interests: form.interests.includes(id) ? form.interests.filter((x) => x !== id) : [...form.interests, id] });
  const save = async () => {
    try {
      await api('/profile', { method: 'PUT', body: { name: form.name, headline: form.headline, bio: form.bio, location: form.location, experienceYears: +form.experienceYears || 0, interests: form.interests, hobbies: form.hobbiesText.split(',').map((s) => s.trim()).filter(Boolean), links: { github: form.github, linkedin: form.linkedin } } });
      toast('Profile saved');
    } catch (e) { toast(e.message, 'err'); }
  };

  return html`<div>
    <div class="head"><div><h1>Profile & portfolio</h1><div class="muted">Everything here feeds your skill graph, recommendations and what recruiters see.</div></div></div>
    <div class="grid g2">
      <div class="card"><h2>About you</h2>
        <label>Name</label><input value=${form.name} onInput=${set('name')} />
        <label>Headline</label><input value=${form.headline} placeholder="e.g. Final-year CS student into web dev" onInput=${set('headline')} />
        <label>Bio</label><textarea style="min-height:80px;font-family:inherit" value=${form.bio} onInput=${set('bio')}></textarea>
        <div class="row"><div class="grow"><label>Location</label><input value=${form.location} onInput=${set('location')} /></div><div class="grow"><label>Years of experience</label><input type="number" min="0" max="50" value=${form.experienceYears} onInput=${set('experienceYears')} /></div></div>
        <div class="row"><div class="grow"><label>GitHub username</label><input value=${form.github} onInput=${set('github')} /></div><div class="grow"><label>LinkedIn handle</label><input value=${form.linkedin} onInput=${set('linkedin')} /></div></div>
      </div>
      <div class="card"><h2>Hobbies & interests</h2>
        <div class="muted small">Used for hobby-based career suggestions. Pick what fits, and add anything else in your own words.</div>
        <div style="margin:.6rem 0">${prof.data.interestCatalog.map((it) => html`<${Chip} on=${form.interests.includes(it.id)} onClick=${() => toggleInterest(it.id)}>${it.label}<//>`)}</div>
        <label>Other hobbies (comma separated)</label><input value=${form.hobbiesText} placeholder="cricket, origami, astronomy" onInput=${set('hobbiesText')} />
        <div style="margin-top:1rem"><button class="primary" onClick=${save}>Save profile</button></div>
      </div>
    </div>

    <${SkillsManager} skills=${skills} catalog=${catalog.data.skills} />
    <${ProjectsManager} projects=${projects} catalog=${catalog.data.skills} onChange=${skills.reload} />
    <${CertsManager} certs=${certs} catalog=${catalog.data.skills} onChange=${skills.reload} />
  </div>`;
}

function SkillsManager({ skills, catalog }) {
  const [name, setName] = useState('');
  const [level, setLevel] = useState(2);
  const list = skills.data.skills;
  const setLvl = async (id, lvl) => { try { await api('/skills/mine', { method: 'PUT', body: { skills: [{ skillId: id, level: lvl }] } }); skills.reload(); } catch (e) { toast(e.message, 'err'); } };
  const add = async () => {
    const sk = catalog.find((s) => s.name.toLowerCase() === name.trim().toLowerCase());
    if (!sk) return toast('Pick a skill from the suggestions list', 'err');
    await setLvl(sk.id, +level); setName('');
  };
  return html`<div class="card" style="margin-top:1rem"><h2>Skills (${list.length})</h2>
    <div class="inline" style="margin-bottom:.8rem"><${SkillPicker} catalog=${catalog} value=${name} onInput=${setName} placeholder="Add a skill (e.g. Docker)" id="dl-skills" />
      <select style="width:150px" value=${level} onChange=${(e) => setLevel(e.target.value)}>${[1, 2, 3, 4].map((l) => html`<option value=${l}>${l} - ${LEVELS[l]}</option>`)}</select><button class="primary" onClick=${add}>Add</button></div>
    ${list.length === 0 ? html`<${Empty}>No skills yet - add some or <a href="#/import">import your resume</a>.<//>` : html`<div style="max-height:360px;overflow:auto"><table>
      <tr><th>Skill</th><th>Domain</th><th>Level</th><th>Source</th><th></th></tr>
      ${list.map((s) => html`<tr key=${s.id}><td><b>${s.name}</b></td><td class="muted small">${s.domain}</td>
        <td><select style="width:140px" value=${s.level} onChange=${(e) => setLvl(s.id, +e.target.value)}>${[1, 2, 3, 4].map((l) => html`<option value=${l}>${l} - ${LEVELS[l]}</option>`)}</select></td>
        <td class="muted small">${(s.sources || []).join(', ')}</td>
        <td><button class="small danger" onClick=${async () => { await api('/skills/mine/' + s.id, { method: 'DELETE' }); skills.reload(); }}>Remove</button></td></tr>`)}
    </table></div>`}
  </div>`;
}

function SkillTags({ catalog, value, onChange, id }) {
  const [t, setT] = useState('');
  const add = (v) => { const sk = catalog.find((s) => s.name.toLowerCase() === v.trim().toLowerCase()); if (sk && !value.includes(sk.name)) { onChange([...value, sk.name]); setT(''); } };
  return html`<div><div>${value.map((v) => html`<${Chip} onClick=${() => onChange(value.filter((x) => x !== v))}>${v} ✕<//>`)}</div>
    <div class="inline"><${SkillPicker} catalog=${catalog} value=${t} onInput=${setT} onCommit=${add} placeholder="Type, then pick from the list" id=${id} /></div></div>`;
}

function ProjectsManager({ projects, catalog, onChange }) {
  const [f, setF] = useState({ title: '', description: '', url: '', skills: [] });
  const add = async () => {
    if (!f.title.trim()) return toast('Give the project a title', 'err');
    try { await api('/projects', { method: 'POST', body: f }); setF({ title: '', description: '', url: '', skills: [] }); projects.reload(); onChange(); toast('Project added'); } catch (e) { toast(e.message, 'err'); }
  };
  return html`<div class="card" style="margin-top:1rem"><h2>Projects (${projects.data.projects.length})</h2>
    <div class="grid g2"><div>
      <label>Title</label><input value=${f.title} onInput=${(e) => setF({ ...f, title: e.target.value })} />
      <label>Description</label><textarea style="min-height:70px;font-family:inherit" value=${f.description} onInput=${(e) => setF({ ...f, description: e.target.value })}></textarea>
      <label>Link (optional)</label><input value=${f.url} onInput=${(e) => setF({ ...f, url: e.target.value })} />
    </div><div><label>Skills used</label><${SkillTags} catalog=${catalog} value=${f.skills} onChange=${(skills) => setF({ ...f, skills })} id="dl-proj" />
      <div style="margin-top:.8rem"><button class="primary" onClick=${add}>Add project</button></div></div></div>
    ${projects.data.projects.map((p) => html`<div class="item" key=${p.id}><div class="inline"><b>${p.title}</b>${p.url ? html`<a class="small" href=${p.url} target="_blank" rel="noopener">link</a>` : ''}<span class="muted small">${p.source}</span>
      <button class="small danger right" onClick=${async () => { await api('/projects/' + p.id, { method: 'DELETE' }); projects.reload(); onChange(); }}>Delete</button></div>
      <div class="muted small">${p.description}</div>${p.skills.map((s) => html`<${Chip}>${s.name}<//>`)}</div>`)}
  </div>`;
}

function CertsManager({ certs, catalog, onChange }) {
  const [f, setF] = useState({ name: '', issuer: '', year: new Date().getFullYear(), skills: [] });
  const pickCatalog = (e) => {
    const c = certs.data.catalog.find((x) => x.name === e.target.value);
    if (c) setF({ ...f, name: c.name, issuer: c.issuer, skills: c.skills });
  };
  const add = async () => {
    if (!f.name.trim()) return toast('Certification name is required', 'err');
    try { await api('/certifications', { method: 'POST', body: { ...f, year: +f.year || undefined } }); setF({ ...f, name: '', issuer: '', skills: [] }); certs.reload(); onChange(); toast('Certification added'); } catch (e) { toast(e.message, 'err'); }
  };
  return html`<div class="card" style="margin-top:1rem"><h2>Certifications (${certs.data.certifications.length})</h2>
    <div class="grid g2"><div>
      <label>Quick pick from catalogue</label><select onChange=${pickCatalog}><option value="">- choose -</option>${certs.data.catalog.map((c) => html`<option value=${c.name}>${c.name}</option>`)}</select>
      <label>Name</label><input value=${f.name} onInput=${(e) => setF({ ...f, name: e.target.value })} />
      <div class="row"><div class="grow"><label>Issuer</label><input value=${f.issuer} onInput=${(e) => setF({ ...f, issuer: e.target.value })} /></div><div class="grow"><label>Year</label><input type="number" value=${f.year} onInput=${(e) => setF({ ...f, year: e.target.value })} /></div></div>
    </div><div><label>Skills it validates</label><${SkillTags} catalog=${catalog} value=${f.skills} onChange=${(skills) => setF({ ...f, skills })} id="dl-cert" />
      <div style="margin-top:.8rem"><button class="primary" onClick=${add}>Add certification</button></div></div></div>
    ${certs.data.certifications.map((c) => html`<div class="item" key=${c.id}><div class="inline"><b>${c.name}</b><span class="muted small">${[c.issuer, c.year].filter(Boolean).join(' - ')}</span>
      <button class="small danger right" onClick=${async () => { await api('/certifications/' + c.id, { method: 'DELETE' }); certs.reload(); onChange(); }}>Delete</button></div>${c.skills.map((s) => html`<${Chip}>${s.name}<//>`)}</div>`)}
  </div>`;
}
