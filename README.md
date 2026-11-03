# SkillGraph - Living Resume & Career Intelligence Platform

Upload a resume, certificates and GitHub profile. SkillGraph builds a **Skill Knowledge Graph** in MongoDB,
finds your skill gaps for a target career, and generates a personalised roadmap, project ideas and hobby-based career suggestions. Recruiters get a talent dashboard.

## Run it (3 steps)

Requires **Node.js 18+** and an internet connection (see notes).

```bash
npm install
npm start
# open http://localhost:4000
```

- **MongoDB**: nothing to set up. If a MongoDB is running on `localhost:27017` it is used; otherwise an embedded
  MongoDB starts automatically (first run downloads the mongod binary, so wait a minute). To use Atlas or your own
  server, copy `.env.example` to `.env` and set `MONGO_URI`.
- On first start the dataset in `data/` is loaded automatically (108 skills, 14 careers, 150 sample candidates).
- **Demo logins** (password `demo1234`): `demo@skillgraph.dev` (candidate), `recruiter@skillgraph.dev` (recruiter).
  The login page also has one-click demo buttons.

## All 12 features and where they live

| # | Feature | Where |
|---|---|---|
| 1 | User profile & career portfolio | Profile page, `routes/profile.js` |
| 2 | Resume & document parsing (PDF, DOCX, TXT) | Import page, `services/fileparser.js`, `services/extractor.js` |
| 3 | AI-based skill extraction | context-aware rule engine (levels from years, "expert", "basic"...), optional Claude enrichment via `ANTHROPIC_API_KEY` |
| 4 | Skill Knowledge Graph | My Graph page (interactive graph + tree), `services/graph.js` |
| 5 | Project-skill mapping | `USES` edges; projects link to skills in the graph |
| 6 | Skill gap detection | Careers page, weighted readiness score |
| 7 | Career goal selection | Careers page |
| 8 | AI-based career recommendations | Recommendations page, ranking = readiness + interests + demand |
| 9 | Hobby & interest-based suggestions | Profile interests, Recommendations page |
| 10 | Personalised career roadmaps | Roadmap page, prerequisite-ordered phases with resources |
| 11 | Career progress tracking | Roadmap step status; finishing a step levels the skill up in the graph |
| 12 | Learning & project recommendations | Recommendations page |

Plus: GitHub import, recruiter dashboard (skill search, ranking, shortlist, pool analytics, candidate graph view).

## MongoDB design (graph in MongoDB)

Collections: `users`, `skills`, `careers`, `projects`, `certifications`, `relationships`, `recommendations`, `roadmaps`.

`relationships` holds typed edges `{type, fromKind, fromId, toKind, toId, weight, meta}` with a unique index on `(type, fromId, toId)`:

- `HAS_SKILL` user -> skill (`meta.level` 1-4, `meta.sources`, `meta.evidence`)
- `USES` project -> skill, `VALIDATES` certification -> skill
- `PREREQUISITE` skill -> skill, `REQUIRES` career -> skill (`meta.level`, `weight`)
- `RELATED_TO` skill <-> skill (co-occurrence across careers)

## Dataset (`data/`)

JSON and CSV: `skills`, `careers` (+ `career_requirements.csv`), `interests` (+ `interest_career_map.csv`),
`project_ideas`, `certifications`, `candidates` (150 synthetic, + `candidate_skills.csv`), and 3 `sample_resumes/` (TXT, one PDF).
Regenerate with `npm run dataset`; reload into MongoDB with `npm run seed`. Candidates are synthetic and use example.com emails.

## Optional: AI

Set `ANTHROPIC_API_KEY` in `.env` to add AI skill extraction on top of the rules and an AI-written career brief. Everything works without it.

## Tests

`npm test` runs an offline check of the dataset, resume parser, extractor, gap analysis, roadmap and graph builder (no database needed).

## Notes

- The UI is a no-build app (Preact + htm) loaded from the esm.sh CDN, so the browser needs internet on first load.
- GitHub import calls the public GitHub API (rate-limited, public repos only).
- Scanned/image-only PDFs have no text to read; paste the text instead.
- Change `JWT_SECRET` in `.env` before any real deployment.
