// App shell + tiny hash router
import { html, render, useState, useEffect, session, Toasts, go } from './lib.js';
import { LoginPage, DashboardPage, ImportPage, ProfilePage } from './pages_candidate.js';
import { GraphPage, CareersPage, RoadmapPage, RecommendationsPage } from './pages_career.js';
import { RecruiterSearchPage, RecruiterStatsPage } from './pages_recruiter.js';

const CANDIDATE_NAV = [
  ['/dashboard', 'Dashboard'], ['/import', 'Import'], ['/profile', 'Profile'], ['/graph', 'My Graph'],
  ['/careers', 'Careers'], ['/roadmap', 'Roadmap'], ['/recommendations', 'Recommendations'],
];
const RECRUITER_NAV = [['/talent', 'Talent search'], ['/shortlist', 'Shortlist'], ['/analytics', 'Analytics']];

const useRoute = () => {
  const [r, setR] = useState(location.hash.slice(1) || '/');
  useEffect(() => {
    const on = () => setR(location.hash.slice(1) || '/');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r.split('?')[0];
};

function App() {
  const [user, setUser] = useState(session.token ? session.user : null);
  const route = useRoute();

  useEffect(() => {
    if (!user && route !== '/login') go('/login');
    else if (user && (route === '/' || route === '/login')) go(user.role === 'recruiter' ? '/talent' : '/dashboard');
  }, [user, route]);

  const logout = () => { session.clear(); setUser(null); go('/login'); };

  if (!user) return html`<${LoginPage} onAuth=${(u) => { setUser(u); go(u.role === 'recruiter' ? '/talent' : '/dashboard'); }} /><${Toasts} />`;

  const nav = user.role === 'recruiter' ? RECRUITER_NAV : CANDIDATE_NAV;
  const pages = user.role === 'recruiter'
    ? { '/talent': () => html`<${RecruiterSearchPage} key="t" />`, '/shortlist': () => html`<${RecruiterSearchPage} key="s" shortlistOnly=${true} />`, '/analytics': () => html`<${RecruiterStatsPage} />` }
    : { '/dashboard': () => html`<${DashboardPage} />`, '/import': () => html`<${ImportPage} />`, '/profile': () => html`<${ProfilePage} />`, '/graph': () => html`<${GraphPage} />`, '/careers': () => html`<${CareersPage} />`, '/roadmap': () => html`<${RoadmapPage} />`, '/recommendations': () => html`<${RecommendationsPage} />` };
  const Page = pages[route];

  return html`<div>
    <div class="nav"><span class="brand"><i></i>SkillGraph</span>
      ${nav.map(([p, l]) => html`<a class=${'link ' + (route === p ? 'active' : '')} href=${'#' + p}>${l}</a>`)}
      <span class="right small muted">${user.name} (${user.role})</span><button class="small" onClick=${logout}>Sign out</button></div>
    <div class="page">${Page ? Page() : html`<div class="empty">Page not found.</div>`}</div>
    <${Toasts} />
  </div>`;
}

const root = document.getElementById('app');
root.innerHTML = '';   // remove the "Loading..." placeholder
render(html`<${App} />`, root);