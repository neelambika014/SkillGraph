// Optional AI layer (Claude API). The whole app works without it; if ANTHROPIC_API_KEY is set it
//  1) finds extra skills the rule-based extractor missed, and 2) writes a short personalised career brief.
const cfg = require('../config');

const enabled = () => !!cfg.ANTHROPIC_API_KEY;

async function ask(system, user, maxTokens = 800) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': cfg.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: cfg.ANTHROPIC_MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
  const data = await res.json();
  return (data.content || []).map((b) => b.text || '').join('');
}

/** Returns [{name, level}] restricted to catalogue names, or [] on any failure. */
async function extraSkills(text, catalogueNames) {
  if (!enabled() || !text) return [];
  try {
    const out = await ask(
      'You extract skills from resumes. Reply with JSON only: {"skills":[{"name":"<exact catalogue name>","level":1-4}]}. Level 1=beginner, 2=intermediate, 3=advanced, 4=expert. Only use names from the catalogue.',
      `Catalogue: ${catalogueNames.join('; ')}\n\nResume:\n${text.slice(0, 9000)}`,
      900,
    );
    const json = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1));
    const ok = new Set(catalogueNames);
    return (json.skills || []).filter((s) => ok.has(s.name)).map((s) => ({ name: s.name, level: Math.max(1, Math.min(4, +s.level || 2)) }));
  } catch (e) {
    console.warn('[ai] extraSkills failed:', e.message);
    return [];
  }
}

async function careerBrief(summary) {
  if (!enabled()) return null;
  try {
    return (await ask(
      'You are a pragmatic career coach. In under 120 words, give a motivating, specific brief: strongest assets, the 2-3 highest-impact gaps, and the very next action. Plain text, no markdown.',
      JSON.stringify(summary),
      400,
    )).trim();
  } catch (e) {
    console.warn('[ai] careerBrief failed:', e.message);
    return null;
  }
}

module.exports = { enabled, extraSkills, careerBrief };
