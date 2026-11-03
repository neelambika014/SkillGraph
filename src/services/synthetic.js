// Deterministic synthetic candidate generator (used by data/build.js and the seeder).
const FIRST = ['Aarav','Aditi','Akash','Ananya','Arjun','Bhavna','Chitra','Deepak','Divya','Farhan','Gita','Harish','Isha','Jayant','Kavya','Karthik','Lakshmi','Manoj','Meera','Naveen','Nisha','Omkar','Priya','Pranav','Rahul','Riya','Sanjay','Sneha','Suresh','Tanvi','Uma','Varun','Vidya','Yash','Zoya','Emma','Liam','Noah','Olivia','Sofia','Lucas','Mia','Ethan','Ava','Mateo','Chloe','Hiro','Yuki','Amara','Kofi'];
const LAST = ['Sharma','Iyer','Nair','Reddy','Patel','Gupta','Menon','Rao','Das','Singh','Khan','Verma','Pillai','Joshi','Kapoor','Mehta','Bose','Chopra','Krishnan','Subramanian','Smith','Johnson','Garcia','Kim','Tanaka','Okafor','Silva','Muller','Rossi','Nguyen'];
const CITIES = ['Chennai','Bengaluru','Hyderabad','Pune','Mumbai','Delhi','Kochi','Coimbatore','Ahmedabad','Kolkata','Remote','London','Singapore','Berlin','Toronto'];

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateCandidates({ skills, careers, ideas, certs, interests, count = 150, seed = 42 }) {
  const r = rng(seed);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const byName = new Map(skills.map((s) => [s.name, s]));
  const out = [];

  for (let i = 0; i < count; i++) {
    const career = pick(careers);
    const tier = r() < 0.4 ? 0 : r() < 0.7 ? 1 : 2; // junior / mid / senior
    const first = pick(FIRST);
    const last = pick(LAST);
    const has = new Map();

    for (const req of career.requirements) {
      if (r() < 0.45 + 0.17 * tier) {
        has.set(req.skill, clamp(req.level + int(-2, 0) + (tier === 2 ? 1 : 0), 1, 4));
      }
    }
    // a few extras from the same domain + general skills
    const sameDomain = skills.filter((s) => s.domain === career.domain && !has.has(s.name));
    for (let k = 0; k < int(1, 4) && sameDomain.length; k++) has.set(pick(sameDomain).name, int(1, 3));
    for (const g of ['Git', 'Problem Solving', 'Communication', 'Teamwork']) if (r() < 0.45 && !has.has(g)) has.set(g, int(1, 3));
    for (let k = 0; k < int(0, 2); k++) has.set(pick(skills).name, 1);

    const names = new Set(has.keys());
    const fitIdeas = ideas.filter((idea) => idea.skills.filter((s) => names.has(s)).length >= Math.ceil(idea.skills.length / 2));
    const projects = [];
    const nProj = int(1, 3);
    const pool = fitIdeas.length ? fitIdeas : ideas;
    for (let k = 0; k < nProj; k++) {
      const idea = pick(pool);
      if (projects.some((p) => p.title === idea.title)) continue;
      projects.push({ title: idea.title, description: idea.description, skills: idea.skills.slice() });
      for (const s of idea.skills) if (!has.has(s)) has.set(s, 1);
    }

    const myCerts = certs.filter((c) => c.skills.some((s) => names.has(s)) && r() < 0.35).slice(0, 2)
      .map((c) => ({ name: c.name, issuer: c.issuer, year: 2020 + int(0, 6), skills: c.skills }));

    const myInterests = [];
    const likely = interests.filter((it) => it.careers.includes(career.slug));
    if (likely.length && r() < 0.7) myInterests.push(pick(likely).id);
    const other = pick(interests).id;
    if (!myInterests.includes(other)) myInterests.push(other);

    out.push({
      name: `${first} ${last}`,
      email: `${first}.${last}${i + 1}@example.com`.toLowerCase(),
      headline: `${['Junior', 'Mid-level', 'Senior'][tier]} ${career.title}`,
      location: pick(CITIES),
      experienceYears: tier === 0 ? int(0, 1) : tier === 1 ? int(2, 4) : int(5, 10),
      targetCareer: r() < 0.7 ? career.slug : pick(careers).slug,
      interests: myInterests,
      skills: [...has.entries()].filter(([n]) => byName.has(n)).map(([name, level]) => ({ name, level })),
      projects,
      certifications: myCerts,
    });
  }
  return out;
}

module.exports = { generateCandidates, rng };
