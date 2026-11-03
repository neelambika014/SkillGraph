// Shared helpers: Preact + htm (loaded from a CDN, no build step), API client, tiny components.
import { h, render } from 'https://esm.sh/preact@10.24.3';
import { useState, useEffect, useRef, useMemo, useCallback } from 'https://esm.sh/preact@10.24.3/hooks';
import htm from 'https://esm.sh/htm@3.1.1';

export const html = htm.bind(h);
export { h, render, useState, useEffect, useRef, useMemo, useCallback };

// ---- session ------------------------------------------------------------------------------
export const session = {
  get token() { try { return localStorage.getItem('sg_token'); } catch { return null; } },
  get user() { try { return JSON.parse(localStorage.getItem('sg_user') || 'null'); } catch { return null; } },
  set(token, user) { localStorage.setItem('sg_token', token); localStorage.setItem('sg_user', JSON.stringify(user)); },
  clear() { localStorage.removeItem('sg_token'); localStorage.removeItem('sg_user'); },
};

// ---- API ------------------------------------------------------------------------------------
export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  if (session.token) headers.Authorization = `Bearer ${session.token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(`/api${path}`, { method, headers, body: payload });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) { session.clear(); location.hash = '#/login'; }
    throw new Error((data && data.error) || `Request failed (${res.status})`);
  }
  return data;
}

// ---- toast ------------------------------------------------------------------------------------
export const toast = (msg, kind = 'ok') => window.dispatchEvent(new CustomEvent('sg-toast', { detail: { msg, kind } }));

export function Toasts() {
  const [t, setT] = useState(null);
  useEffect(() => {
    let timer;
    const on = (e) => { setT(e.detail); clearTimeout(timer); timer = setTimeout(() => setT(null), 3800); };
    window.addEventListener('sg-toast', on);
    return () => window.removeEventListener('sg-toast', on);
  }, []);
  return t ? html`<div class=${'toast ' + (t.kind === 'err' ? 'err' : '')}>${t.msg}</div>` : null;
}

// ---- data hook ------------------------------------------------------------------------------------
export function useLoad(fn, deps = []) {
  const [state, set] = useState({ loading: true, data: null, error: null });
  const reload = useCallback(async () => {
    set((s) => ({ ...s, loading: true, error: null }));
    try { set({ loading: false, data: await fn(), error: null }); }
    catch (e) { set({ loading: false, data: null, error: e.message }); }
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload, setData: (d) => set((s) => ({ ...s, data: typeof d === 'function' ? d(s.data) : d })) };
}

// ---- small components -----------------------------------------------------------------------------------
export const LEVELS = ['None', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];

export const Spinner = () => html`<span class="spin"></span>`;
export const Loading = ({ error }) => (error ? html`<div class="card empty">${error}</div>` : html`<div class="empty"><${Spinner} /> Loading...</div>`);

export const Dots = ({ level = 0, max = 4 }) => html`<span class="dots" title=${LEVELS[level]}>${Array.from({ length: max }, (_, i) => html`<i class=${i < level ? 'f' : ''}></i>`)}</span>`;

export const Bar = ({ pct = 0, warn }) => html`<div class=${'bar ' + (warn ? 'warn' : '')}><div style=${{ width: Math.max(0, Math.min(100, pct)) + '%' }}></div></div>`;

export const Gauge = ({ pct = 0 }) => html`<div class="gauge" style=${{ '--p': pct }}><div>${pct}%</div></div>`;

export const Chip = ({ children, kind = '', onClick, on }) => html`<span class=${`chip ${kind} ${on ? 'on' : ''} ${onClick ? 'sel' : ''}`} onClick=${onClick}>${children}</span>`;

export const Empty = ({ children }) => html`<div class="empty">${children}</div>`;

export function Modal({ onClose, children }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  return html`<div class="modal" onClick=${(e) => e.target.classList.contains('modal') && onClose()}><div class="card">${children}</div></div>`;
}

export const go = (path) => { location.hash = '#' + path; };
export const levelOptions = (min = 1) => LEVELS.map((l, i) => (i >= min ? html`<option value=${i}>${i} - ${l}</option>` : null));

/** Datalist-backed skill picker that returns the chosen skill name. */
export function SkillPicker({ catalog = [], value, onInput, onCommit, placeholder = 'Type a skill...', id = 'skills-list' }) {
  return html`<span style="flex:1;min-width:160px">
    <input list=${id} value=${value} placeholder=${placeholder} onInput=${(e) => onInput(e.target.value)} onChange=${(e) => onCommit && onCommit(e.target.value)} />
    <datalist id=${id}>${catalog.map((s) => html`<option value=${s.name}>${s.domain}</option>`)}</datalist>
  </span>`;
}
