const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cfg = require('../config');
const { User } = require('../models');

const router = express.Router();

const sign = (u) => jwt.sign({ id: String(u._id), role: u.role }, cfg.JWT_SECRET, { expiresIn: '14d' });
const publicUser = (u) => ({ id: String(u._id), name: u.name, email: u.email, role: u.role, headline: u.headline, goalCareer: u.goalCareer });

async function requireAuth(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Not signed in' });
    const payload = jwt.verify(token, cfg.JWT_SECRET);
    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ error: 'Account no longer exists' });
    req.user = user;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Session expired - please sign in again' });
  }
}

const requireRole = (role) => (req, res, next) => (req.user?.role === role ? next() : res.status(403).json({ error: `${role} access only` }));

router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (await User.findOne({ email: String(email).toLowerCase() })) return res.status(409).json({ error: 'An account with this email already exists' });
  const user = await User.create({
    name: String(name).trim(), email, passwordHash: await bcrypt.hash(password, 10),
    role: role === 'recruiter' ? 'recruiter' : 'candidate',
  });
  res.status(201).json({ token: sign(user), user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = await User.findOne({ email: String(email || '').toLowerCase() });
  if (!user || !(await bcrypt.compare(String(password || ''), user.passwordHash))) return res.status(401).json({ error: 'Invalid email or password' });
  res.json({ token: sign(user), user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

module.exports = { router, requireAuth, requireRole, publicUser };
