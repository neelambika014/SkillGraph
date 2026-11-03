// Interactive force-directed Skill Knowledge Graph (canvas, no libraries): drag nodes, drag background to pan, wheel to zoom, hover to highlight.
import { html, useEffect, useRef, useState, LEVELS } from './lib.js';

const TYPE_COLOR = { user: '#6c5ce7', domain: '#0984e3', project: '#e17055', cert: '#e0a100', missing: '#d63031' };
const LEVEL_COLOR = ['#b2bec3', '#74d6c4', '#2ec4a6', '#00a383', '#00695c'];
const LINK_LEN = { HAS_DOMAIN: 150, PART_OF: 80, USES: 95, VALIDATES: 95, PREREQUISITE: 70, GAP: 85, BUILT: 120, EARNED: 120 };
const LINK_STR = { PREREQUISITE: 0.015, HAS_DOMAIN: 0.05 };
const radius = (n) => (n.type === 'user' ? 17 : n.type === 'domain' ? 13 : n.type === 'skill' ? 5 + n.level * 2 : n.type === 'missing' ? 7 : 7);
const colorOf = (n) => (n.type === 'skill' ? LEVEL_COLOR[n.level] || LEVEL_COLOR[1] : TYPE_COLOR[n.type]);

export function ForceGraph({ data, height = 580 }) {
  const wrap = useRef();
  const canvasRef = useRef();
  const [tip, setTip] = useState(null);

  useEffect(() => {
    if (!data || !data.nodes.length) return undefined;
    const canvas = canvasRef.current;
    const g = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const cs = getComputedStyle(document.body);
    const ink = cs.getPropertyValue('--ink').trim() || '#222';
    const line = cs.getPropertyValue('--line').trim() || '#ccc';
    const card = cs.getPropertyValue('--card').trim() || '#fff';
    let W = wrap.current.clientWidth;
    const H = height;
    const fit = () => { W = wrap.current.clientWidth; canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.height = H + 'px'; dirty = true; };
    let dirty = true;

    const nodes = data.nodes.map((n, i) => ({ ...n, r: radius(n), x: W / 2 + Math.cos(i * 2.399) * (40 + i * 4), y: H / 2 + Math.sin(i * 2.399) * (40 + i * 4), vx: 0, vy: 0 }));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const links = data.links.map((l) => ({ ...l, s: byId.get(l.source), t: byId.get(l.target) })).filter((l) => l.s && l.t);
    const nbr = new Map(nodes.map((n) => [n.id, new Set([n.id])]));
    for (const l of links) { nbr.get(l.s.id).add(l.t.id); nbr.get(l.t.id).add(l.s.id); }

    let alpha = 1;
    let view = { k: 1, x: 0, y: 0 };
    let hover = null;
    let drag = null;
    let pan = null;
    let raf;

    const step = () => {
      const N = nodes.length;
      for (let i = 0; i < N; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < N; j++) {
          const b = nodes[j];
          let dx = a.x - b.x, dy = a.y - b.y;
          let d2 = dx * dx + dy * dy;
          if (d2 > 160000) continue;
          if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
          const d = Math.sqrt(d2);
          const f = (1400 * alpha) / d2;
          const fx = (dx / d) * f, fy = (dy / d) * f;
          a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
        }
      }
      for (const l of links) {
        const dx = l.t.x - l.s.x, dy = l.t.y - l.s.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = ((d - (LINK_LEN[l.type] || 90)) / d) * (LINK_STR[l.type] || 0.06) * alpha * 4;
        l.s.vx += dx * f; l.s.vy += dy * f; l.t.vx -= dx * f; l.t.vy -= dy * f;
      }
      for (const n of nodes) {
        n.vx += (W / 2 - n.x) * 0.004 * alpha; n.vy += (H / 2 - n.y) * 0.004 * alpha;
        if (n === drag) { n.vx = 0; n.vy = 0; continue; }
        n.vx *= 0.82; n.vy *= 0.82;
        n.x += n.vx; n.y += n.vy;
      }
      alpha *= 0.988;
    };

    const draw = () => {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      g.translate(view.x, view.y); g.scale(view.k, view.k);
      const focus = hover ? nbr.get(hover.id) : null;
      for (const l of links) {
        const dim = focus && !(focus.has(l.s.id) && focus.has(l.t.id) && (hover.id === l.s.id || hover.id === l.t.id));
        g.globalAlpha = dim ? 0.08 : l.type === 'PREREQUISITE' ? 0.5 : 0.55;
        g.strokeStyle = l.type === 'GAP' ? TYPE_COLOR.missing : l.type === 'PREREQUISITE' ? '#a29bfe' : line;
        g.lineWidth = l.type === 'HAS_DOMAIN' ? 2 : 1.2;
        g.setLineDash(l.type === 'PREREQUISITE' || l.type === 'GAP' ? [4, 4] : []);
        g.beginPath(); g.moveTo(l.s.x, l.s.y); g.lineTo(l.t.x, l.t.y); g.stroke();
      }
      g.setLineDash([]);
      for (const n of nodes) {
        const dim = focus && !focus.has(n.id);
        g.globalAlpha = dim ? 0.15 : 1;
        g.beginPath(); g.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        if (n.type === 'missing') { g.fillStyle = card; g.fill(); g.setLineDash([3, 3]); g.strokeStyle = TYPE_COLOR.missing; g.lineWidth = 2; g.stroke(); g.setLineDash([]); }
        else { g.fillStyle = colorOf(n); g.fill(); if (n === hover) { g.lineWidth = 3; g.strokeStyle = ink; g.stroke(); } }
        if (n.type === 'project' || n.type === 'cert') { g.fillStyle = card; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n.type === 'project' ? 'P' : 'C', n.x, n.y + 0.5); }
        const showLabel = n.type !== 'skill' || view.k > 0.65 || n.level >= 3 || n === hover || (focus && focus.has(n.id));
        if (showLabel) {
          g.fillStyle = n.type === 'missing' ? TYPE_COLOR.missing : ink;
          g.font = `${n.type === 'domain' || n.type === 'user' ? '700 12px' : '11px'} -apple-system, Segoe UI, sans-serif`;
          g.textAlign = 'center'; g.textBaseline = 'top';
          const label = n.label.length > 26 ? n.label.slice(0, 25) + '…' : n.label;
          g.fillText(label, n.x, n.y + n.r + 3);
        }
      }
      g.globalAlpha = 1;
    };

    const loop = () => {
      if (alpha > 0.012 || drag) { step(); dirty = true; }
      if (dirty) { draw(); dirty = false; }
      raf = requestAnimationFrame(loop);
    };

    const toWorld = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left - view.x) / view.k, y: (e.clientY - r.top - view.y) / view.k, sx: e.clientX - r.left, sy: e.clientY - r.top };
    };
    const hit = (p) => { for (let i = nodes.length - 1; i >= 0; i--) { const n = nodes[i]; const d = (n.x - p.x) ** 2 + (n.y - p.y) ** 2; if (d <= (n.r + 3) ** 2) return n; } return null; };

    const onDown = (e) => {
      const p = toWorld(e);
      const n = hit(p);
      canvas.setPointerCapture(e.pointerId);
      if (n) { drag = n; alpha = Math.max(alpha, 0.3); } else pan = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
      canvas.style.cursor = 'grabbing';
    };
    const onMove = (e) => {
      const p = toWorld(e);
      if (drag) { drag.x = p.x; drag.y = p.y; alpha = Math.max(alpha, 0.2); dirty = true; return; }
      if (pan) { view.x = pan.vx + (e.clientX - pan.sx); view.y = pan.vy + (e.clientY - pan.sy); dirty = true; return; }
      const n = hit(p);
      if (n !== hover) {
        hover = n; dirty = true;
        setTip(n ? { x: p.sx + 14, y: p.sy + 14, node: n } : null);
      } else if (n) setTip({ x: p.sx + 14, y: p.sy + 14, node: n });
      canvas.style.cursor = n ? 'pointer' : 'grab';
    };
    const onUp = () => { drag = null; pan = null; canvas.style.cursor = 'grab'; };
    const onWheel = (e) => {
      e.preventDefault();
      const p = toWorld(e);
      const k = Math.max(0.3, Math.min(3, view.k * (e.deltaY < 0 ? 1.12 : 0.89)));
      view.x = p.sx - p.x * k; view.y = p.sy - p.y * k; view.k = k; dirty = true;
    };
    const onLeave = () => { hover = null; setTip(null); dirty = true; };

    fit();
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', fit);
    for (let i = 0; i < 120; i++) step(); // warm start
    loop();
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', fit);
    };
  }, [data, height]);

  const n = tip && tip.node;
  const text = n && (n.type === 'skill' ? `${n.label} - ${LEVELS[n.level]} (${n.domain})` : n.type === 'missing' ? `${n.label} - missing (needs ${LEVELS[n.need]})` : n.type === 'domain' ? `${n.label} (domain)` : n.type === 'project' ? `Project: ${n.label}` : n.type === 'cert' ? `Certification: ${n.label}` : n.label);
  return html`<div class="graphbox" ref=${wrap}>
    <canvas ref=${canvasRef}></canvas>
    ${tip && html`<div class="tip" style=${{ left: tip.x + 'px', top: tip.y + 'px' }}>${text}</div>`}
    <div class="legend">
      <span style="--c:#6c5ce7">You</span><span style="--c:#0984e3">Domain</span>
      <span style="--c:#74d6c4">Beginner</span><span style="--c:#2ec4a6">Intermediate</span><span style="--c:#00a383">Advanced</span><span style="--c:#00695c">Expert</span>
      <span style="--c:#e17055">Project</span><span style="--c:#e0a100">Certification</span><span style="--c:#d63031">Missing for goal</span>
    </div>
  </div>`;
}

export function SkillTree({ tree }) {
  if (!tree || !tree.length) return html`<div class="empty">No skills yet.</div>`;
  const max = Math.max(...tree.map((d) => d.score));
  return html`<div class="tree"><ul>${tree.map((d) => html`<li>
      <b>${d.domain}</b> <span class="muted small">strength ${Math.round((d.score / max) * 100)}%</span>
      <ul>${d.groups.map((gr) => html`<li><span class="muted">${gr.group}</span>
        <ul>${gr.skills.map((s) => html`<li>${s.name} <span class="dots">${[1, 2, 3, 4].map((i) => html`<i class=${i <= s.level ? 'f' : ''}></i>`)}</span>
          ${s.projects.length ? html` <span class="muted small">used in ${s.projects.slice(0, 2).join(', ')}${s.projects.length > 2 ? '…' : ''}</span>` : ''}</li>`)}</ul></li>`)}</ul>
    </li>`)}</ul></div>`;
}
