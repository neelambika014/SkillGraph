// Career pages: Graph, Careers (goal + gap detection), Roadmap (+ progress tracking), Recommendations
import { html, useState, useEffect, api, toast, go, useLoad, Loading, Spinner, Dots, Bar, Gauge, Chip, Empty, LEVELS } from './lib.js';
import { ForceGraph, SkillTree } from './graph.js';

// ============================== GRAPH ==============================
export function GraphPage() {
  const [view, setView] = useState('graph');
  const [goal, setGoal] = useState(true);
  const { loading, data, error } = useLoad(() => api(`/graph/me?goal=${goal ? 1 : 0}`), [goal]);

  return html`<div>
    <div class="head"><div><h1>My skill knowledge graph</h1><div class="muted">Skills grouped by domain, linked to the projects and certifications that prove them.</div></div>
      <div class="inline right"><label style="margin:0;display:flex;gap:.4rem;align-items:center;text-transform:none;font-size:.88rem"><input type="checkbox" checked=${goal} onChange=${(e) => setGoal(e.target.checked)} /> Show gaps for my goal</label>
        <div class="tabs"><button class=${view === 'graph' ? 'on' : ''} onClick=${() => setView('graph')}>Graph</button><button class=${view === 'tree' ? 'on' : ''} onClick=${() => setView('tree')}>Tree</button></div></div></div>
    ${loading || error ? html`<${Loading} error=${error} />` : data.nodes.length <= 1 ? html`<div class="card"><${Empty}>Your graph is empty. <a href="#/import">Import a resume</a> or <a href="#/profile">add skills</a>.<//></div>` : html`
      <div class="row" style="margin-bottom:.8rem">
        <${Chip}>${data.stats.skills} skills<//><${Chip}>${data.stats.domains} domains<//><${Chip}>${data.stats.projects} projects<//><${Chip}>${data.stats.certifications} certifications<//>
        ${data.goal && html`<${Chip} kind=${data.goal.readiness >= 70 ? 'ok' : 'warn'}>${data.goal.readiness}% ready for ${data.goal.title}<//>`}
      </div>
      ${view === 'graph' ? html`<${ForceGraph} data=${data} /><div class="muted small" style="margin-top:.4rem">Drag nodes, drag the background to pan, scroll to zoom, hover to highlight connections. Dashed red nodes are required skills you're missing.</div>`
        : html`<div class="card"><${SkillTree} tree=${data.tree} /></div>`}`}
  </div>`;
}

// ============================== CAREERS ==============================
export function CareersPage() {
  const { loading, data, error, reload } = useLoad(() => api('/careers'), []);
  const [sel, setSel] = useState(null);
  const [gap, setGap] = useState(null);

  useEffect(() => { if (data && !sel) setSel(data.goalCareer || data.careers[0]?.slug); }, [data]);
  useEffect(() => { if (sel) { setGap(null); api(`/careers/${sel}/gap`).then(setGap).catch((e) => toast(e.message, 'err')); } }, [sel]);

  if (loading || error) return html`<${Loading} error=${error} />`;
  const setGoal = async (slug) => { await api('/careers/goal', { method: 'PUT', body: { slug } }); toast('Career goal updated'); reload(); };

  return html`<div>
    <div class="head"><div><h1>Career goals & skill-gap detection</h1><div class="muted">Careers ranked by how ready you are, nudged by your interests and market demand.</div></div></div>
    <div class="row">
      <div class="grow" style="flex:1 1 360px"><div class="card" style="padding:.4rem .9rem">
        ${data.careers.map((c) => html`<div class="item" style=${{ cursor: 'pointer', background: sel === c.slug ? 'color-mix(in srgb, var(--brand) 8%, transparent)' : '', margin: '0 -.5rem', padding: '.7rem .5rem' }} onClick=${() => setSel(c.slug)}>
          <div class="inline"><b>${c.title}</b>${data.goalCareer === c.slug ? html`<${Chip} kind="ok">Your goal<//>` : ''}<span class="right muted small">${c.readiness}% ready</span></div>
          <${Bar} pct=${c.readiness} warn=${c.readiness < 40} />
          <div class="small muted" style="margin-top:.2rem">${c.topGaps.length ? 'Top gaps: ' + c.topGaps.join(', ') : 'No gaps - you meet every requirement'}</div>
          ${c.interestReasons.length > 0 && html`<div>${c.interestReasons.map((r) => html`<${Chip} kind="ok">♥ ${r}<//>`)}</div>`}
        </div>`)}
      </div></div>

      <div class="grow" style="flex:1 1 440px">${!gap ? html`<${Loading} />` : html`<div class="card">
        <div class="inline" style="gap:1.2rem"><${Gauge} pct=${gap.readiness} /><div style="flex:1;min-width:200px"><h2 style="margin:0">${gap.career.title}</h2><div class="muted small">${gap.career.description}</div>
          <div class="small" style="margin-top:.3rem">Market demand <b>${gap.career.demand}</b>/100 - ${gap.counts.met}/${gap.counts.required} requirements met - ~${gap.estimatedHours}h to close the gap</div></div></div>
        <div class="inline" style="margin:.8rem 0"><button class="primary" disabled=${data.goalCareer === gap.career.slug} onClick=${() => setGoal(gap.career.slug)}>${data.goalCareer === gap.career.slug ? 'Current goal' : 'Set as my goal'}</button>
          <button onClick=${async () => { try { await api('/roadmap/generate', { method: 'POST', body: { career: gap.career.slug } }); go('/roadmap'); } catch (e) { toast(e.message, 'err'); } }}>Generate roadmap</button></div>

        ${gap.gaps.length > 0 && html`<h3>Skill gaps</h3><table><tr><th>Skill</th><th>You</th><th>Need</th><th>Importance</th></tr>
          ${gap.gaps.map((g) => html`<tr><td><b>${g.name}</b> ${g.status === 'missing' ? html`<${Chip} kind="bad">missing<//>` : html`<${Chip} kind="warn">weak<//>`}</td><td><${Dots} level=${g.have} /></td><td><${Dots} level=${g.need} /></td><td class="muted small">${'★'.repeat(g.weight)}</td></tr>`)}</table>`}
        ${gap.prerequisitesToAdd.length > 0 && html`<div style="margin-top:.7rem" class="small"><b>Prerequisites to learn first:</b> ${gap.prerequisitesToAdd.map((p) => html`<${Chip}>${p}<//>`)}</div>`}
        ${gap.matched.length > 0 && html`<h3 style="margin-top:1rem">Requirements you already meet</h3>${gap.matched.map((m) => html`<${Chip} kind="ok">${m.name}<//>`)}`}
      </div>`}</div>
    </div>
  </div>`;
}

// ============================== ROADMAP ==============================
export function RoadmapPage() {
  const { loading, data, error, reload, setData } = useLoad(() => api('/roadmap'), []);
  const careers = useLoad(() => api('/careers'), []);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (careers.data && !pick) setPick(careers.data.goalCareer || careers.data.careers[0]?.slug || ''); }, [careers.data]);

  if (loading || error || !careers.data) return html`<${Loading} error=${error || careers.error} />`;
  const generate = async () => {
    setBusy(true);
    try { const out = await api('/roadmap/generate', { method: 'POST', body: { career: pick } }); setData({ roadmap: out.roadmap, progress: out.progress }); toast('Roadmap generated'); }
    catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const setStatus = async (skillId, status) => {
    try { const out = await api(`/roadmap/steps/${skillId}`, { method: 'PATCH', body: { status } }); setData({ roadmap: out.roadmap, progress: out.progress }); if (status === 'done') toast('Nice! Skill levelled up in your graph'); }
    catch (e) { toast(e.message, 'err'); }
  };

  const selector = html`<div class="inline"><select style="width:260px" value=${pick} onChange=${(e) => setPick(e.target.value)}>${careers.data.careers.map((c) => html`<option value=${c.slug}>${c.title} (${c.readiness}% ready)</option>`)}</select>
    <button class="primary" disabled=${busy || !pick} onClick=${generate}>${busy ? html`<${Spinner} />` : data.roadmap ? 'Regenerate' : 'Generate roadmap'}</button></div>`;

  if (!data.roadmap) return html`<div><div class="head"><div><h1>Personalised career roadmap</h1><div class="muted">Pick a target career and we'll sequence exactly what you still need to learn, prerequisites first.</div></div></div><div class="card">${selector}</div></div>`;

  const rm = data.roadmap;
  const pr = data.progress;
  const phases = [...new Set(rm.steps.map((s) => s.phase))];
  return html`<div>
    <div class="head"><div><h1>Roadmap: ${rm.careerTitle}</h1><div class="muted">Started at ${rm.readinessAtStart}% ready. Mark steps done to level up your graph automatically.</div></div><div class="right">${selector}</div></div>
    <div class="card"><div class="inline"><b style="font-size:1.4rem">${pr.percent}%</b><span class="muted">${pr.done}/${pr.total} steps - ${pr.inProgress} in progress - ${pr.hoursDone}/${pr.hoursTotal} est. hours</span></div><div style="margin-top:.4rem"><${Bar} pct=${pr.percent} /></div></div>
    ${rm.steps.length === 0 ? html`<div class="card" style="margin-top:1rem"><${Empty}>🎉 You already meet every requirement for this career.<//></div>` : ''}
    ${phases.map((ph) => html`<div class="phase">${ph}</div>${rm.steps.filter((s) => s.phase === ph).map((s) => html`<div class=${'step ' + s.status} key=${s.skillId}>
      <div class="inline"><b>${s.order}. ${s.name}</b><span class="muted small">${s.domain}</span><span class="muted small">${LEVELS[s.currentLevel]} → <b>${LEVELS[s.targetLevel]}</b></span><span class="muted small">~${s.estHours}h</span>
        <span class="right tabs">${[['todo', 'To do'], ['in_progress', 'In progress'], ['done', 'Done']].map(([k, l]) => html`<button class=${s.status === k ? 'on' : ''} onClick=${() => setStatus(s.skillId, k)}>${l}</button>`)}</span></div>
      <div class="muted small">${s.reason}</div>
      <div class="small" style="margin-top:.3rem">${s.resources.map((r) => html`<a href=${r.url} target="_blank" rel="noopener" style="margin-right:.9rem">${r.kind === 'video' ? '▶' : r.kind === 'docs' ? '📘' : '✍'} ${r.title}</a>`)}</div>
      ${s.projectIdea && html`<div class="small" style="margin-top:.2rem">🛠 Practice project: <b>${s.projectIdea}</b></div>`}
    </div>`)}`)}
  </div>`;
}

// ============================== RECOMMENDATIONS ==============================
export function RecommendationsPage() {
  const { loading, data, error, reload } = useLoad(() => api('/recommendations'), []);
  if (loading || error) return html`<${Loading} error=${error} />`;
  const d = data;
  return html`<div>
    <div class="head"><div><h1>Recommendations</h1><div class="muted">Careers, learning and projects personalised from your skill graph${d.goalCareer ? ' and your goal: ' + d.goalCareer.title : ''}.</div></div><button class="right" onClick=${reload}>Refresh</button></div>
    ${d.aiBrief && html`<div class="card brief" style="margin-bottom:1rem"><h2>✨ AI career brief</h2><p style="margin:0">${d.aiBrief}</p></div>`}
    ${!d.aiEnabled && html`<div class="muted small" style="margin-bottom:.6rem">Tip: set <code>ANTHROPIC_API_KEY</code> in your .env to enable AI-written career briefs and AI skill extraction.</div>`}

    <div class="card"><h2>Best-fit careers</h2><div class="grid g3">${d.careers.map((c) => html`<div class="card" style="box-shadow:none"><b>${c.title}</b>
      <div class="muted small">fit score ${c.fit} - ${c.readiness}% ready</div><${Bar} pct=${c.readiness} />
      <div style="margin-top:.4rem">${c.interestReasons.map((r) => html`<${Chip} kind="ok">♥ ${r}<//>`)}</div>
      <div class="small muted">${c.topGaps.length ? 'Learn: ' + c.topGaps.join(', ') : 'Ready!'}</div></div>`)}</div></div>

    <div class="card" style="margin-top:1rem"><h2>Hobby & interest-based suggestions</h2>
      ${d.interestBased.length === 0 ? html`<${Empty}>Add hobbies in your <a href="#/profile">profile</a> to unlock careers that match what you love.<//>` : html`<div class="grid g2">${d.interestBased.map((i) => html`<div class="card" style="box-shadow:none"><h3>♥ ${i.interest.label}</h3><div class="small">${i.why}</div>
        <div style="margin-top:.4rem">${i.careers.map((c) => html`<${Chip} kind=${c.readiness >= 60 ? 'ok' : ''}>${c.title} - ${c.readiness}%<//>`)}</div>
        ${i.skillsToTry.length > 0 && html`<div class="small muted" style="margin-top:.3rem">Skills to try: ${i.skillsToTry.join(', ')}</div>`}
        ${i.skillsKnown.length > 0 && html`<div class="small muted">You already have: ${i.skillsKnown.join(', ')}</div>`}</div>`)}</div>`}
    </div>

    <div class="grid g2" style="margin-top:1rem">
      <div class="card"><h2>What to learn next</h2>${d.learning.length === 0 ? html`<${Empty}>Nothing pending - nice work!<//>` : d.learning.map((l) => html`<div class="item"><div class="inline"><b>${l.skill}</b><span class="muted small">${l.from} → ${l.to} - ~${l.estHours}h</span></div><div class="small muted">${l.why}</div>
        <div class="small">${l.resources.map((r) => html`<a href=${r.url} target="_blank" rel="noopener" style="margin-right:.8rem">${r.kind === 'video' ? '▶' : r.kind === 'docs' ? '📘' : '✍'} ${r.kind}</a>`)}</div></div>`)}
        <button class="ghost" onClick=${() => go('/roadmap')}>Full roadmap →</button></div>
      <div class="card"><h2>Projects to build</h2>${d.projects.length === 0 ? html`<${Empty}>No project suggestions yet.<//>` : d.projects.map((p) => html`<div class="item"><div class="inline"><b>${p.title}</b><span class="muted small">${'●'.repeat(p.difficulty)}${'○'.repeat(3 - p.difficulty)} - ~${p.hours}h</span></div><div class="small muted">${p.description}</div>
        <div>${p.teaches.map((s) => html`<${Chip} kind="warn">learn: ${s}<//>`)}${p.reinforces.map((s) => html`<${Chip}>${s}<//>`)}</div></div>`)}</div>
    </div>
  </div>`;
}
