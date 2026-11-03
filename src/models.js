const mongoose = require('mongoose');
const { Schema } = mongoose;
const OID = Schema.Types.ObjectId;

// ---- users -----------------------------------------------------------------
const User = mongoose.model('User', new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['candidate', 'recruiter'], default: 'candidate', index: true },
  headline: { type: String, default: '' },
  bio: { type: String, default: '' },
  location: { type: String, default: '' },
  links: { github: String, linkedin: String, portfolio: String },
  education: [{ school: String, degree: String, year: String }],
  experienceYears: { type: Number, default: 0 },
  interests: [String],          // ids from interests.json
  hobbies: [String],            // free text
  goalCareer: { type: String, default: '' }, // career slug
  resumeText: { type: String, default: '' },
  shortlist: [{ type: OID, ref: 'User' }],
  synthetic: { type: Boolean, default: false },
}, { timestamps: true }));

// ---- skills (catalogue) -----------------------------------------------------
const Skill = mongoose.model('Skill', new Schema({
  name: { type: String, required: true, unique: true },
  slug: { type: String, index: true },
  domain: { type: String, index: true },
  group: String,
  aliases: [String],
  docs: String,
}));

// ---- careers (catalogue) ----------------------------------------------------
const Career = mongoose.model('Career', new Schema({
  slug: { type: String, unique: true },
  title: String,
  domain: String,
  demand: Number,
  description: String,
}));

// ---- projects ----------------------------------------------------------------
const Project = mongoose.model('Project', new Schema({
  user: { type: OID, ref: 'User', index: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  url: String,
  repo: String,
  stars: { type: Number, default: 0 },
  source: { type: String, enum: ['manual', 'resume', 'github', 'seed'], default: 'manual' },
  skills: [{ type: OID, ref: 'Skill' }],
}, { timestamps: true }));

// ---- certifications ------------------------------------------------------------
const Certification = mongoose.model('Certification', new Schema({
  user: { type: OID, ref: 'User', index: true },
  name: { type: String, required: true },
  issuer: { type: String, default: '' },
  year: Number,
  url: String,
  skills: [{ type: OID, ref: 'Skill' }],
}, { timestamps: true }));

// ---- relationships: the knowledge graph edges ---------------------------------
//  HAS_SKILL      user   -> skill   (meta: level 1-4, sources, evidence)
//  USES           project-> skill
//  VALIDATES      cert   -> skill
//  PREREQUISITE   skill  -> skill   (from requires "to" first)
//  REQUIRES       career -> skill   (meta: level, weight)
//  RELATED_TO     skill  <-> skill  (weight = number of careers that need both)
const relationshipSchema = new Schema({
  type: { type: String, required: true, index: true },
  fromKind: String, fromId: { type: OID, index: true },
  toKind: String, toId: { type: OID, index: true },
  weight: { type: Number, default: 1 },
  meta: Schema.Types.Mixed,
}, { timestamps: true });
relationshipSchema.index({ type: 1, fromId: 1, toId: 1 }, { unique: true });
const Relationship = mongoose.model('Relationship', relationshipSchema);

// ---- recommendations (stored snapshots) ----------------------------------------
const Recommendation = mongoose.model('Recommendation', new Schema({
  user: { type: OID, ref: 'User', index: true },
  kind: { type: String, default: 'bundle' },
  goalCareer: String,
  payload: Schema.Types.Mixed,
}, { timestamps: true }));

// ---- roadmaps + progress tracking -----------------------------------------------
const Roadmap = mongoose.model('Roadmap', new Schema({
  user: { type: OID, ref: 'User', index: true },
  career: String,
  careerTitle: String,
  readinessAtStart: Number,
  active: { type: Boolean, default: true },
  steps: [{
    skillId: OID,
    name: String,
    domain: String,
    phase: String,
    order: Number,
    currentLevel: Number,
    targetLevel: Number,
    reason: String,
    estHours: Number,
    resources: [{ title: String, url: String, kind: String }],
    projectIdea: String,
    status: { type: String, enum: ['todo', 'in_progress', 'done'], default: 'todo' },
    completedAt: Date,
  }],
}, { timestamps: true }));

// ---- helpers -----------------------------------------------------------------
async function link(type, fromKind, fromId, toKind, toId, weight = 1, meta = undefined) {
  const set = { fromKind, toKind, weight };
  if (meta !== undefined) set.meta = meta;
  await Relationship.updateOne({ type, fromId, toId }, { $set: set }, { upsert: true });
}

async function unlink(type, fromId, toId) {
  await Relationship.deleteOne({ type, fromId, toId });
}

// Returns [{ skill (lean doc), level, sources, evidence }]
async function getUserSkills(userId) {
  const edges = await Relationship.find({ type: 'HAS_SKILL', fromId: userId }).lean();
  const skills = await Skill.find({ _id: { $in: edges.map((e) => e.toId) } }).lean();
  const byId = new Map(skills.map((s) => [String(s._id), s]));
  return edges
    .map((e) => ({ skill: byId.get(String(e.toId)), level: e.meta?.level || e.weight || 1, sources: e.meta?.sources || [], evidence: e.meta?.evidence || '' }))
    .filter((x) => x.skill);
}

// Sets (or raises) a user's level for a skill. mode 'max' never lowers an existing level.
async function setUserSkill(userId, skillId, level, { source = 'manual', evidence = '', mode = 'set' } = {}) {
  const existing = await Relationship.findOne({ type: 'HAS_SKILL', fromId: userId, toId: skillId }).lean();
  let lvl = Math.max(1, Math.min(4, Math.round(level)));
  const sources = new Set(existing?.meta?.sources || []);
  sources.add(source);
  if (existing && mode === 'max') lvl = Math.max(lvl, existing.meta?.level || 1);
  await link('HAS_SKILL', 'user', userId, 'skill', skillId, lvl, {
    level: lvl,
    sources: [...sources],
    evidence: evidence || existing?.meta?.evidence || '',
  });
  return lvl;
}

module.exports = { User, Skill, Career, Project, Certification, Relationship, Recommendation, Roadmap, link, unlink, getUserSkills, setUserSkill };
