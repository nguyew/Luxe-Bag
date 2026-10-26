const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { jwtExpiresIn, jwtSecret } = require('../config/env');
const { publicUser } = require('../utils/user');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const issueToken = (user) => jwt.sign(
  { sub: user._id.toString(), role: user.role },
  jwtSecret,
  { expiresIn: jwtExpiresIn }
);

const validateCredentials = ({ name, email, password }, isRegistration) => {
  const errors = [];
  if (isRegistration && (typeof name !== 'string' || name.trim().length < 2)) {
    errors.push('Name must be at least 2 characters.');
  }
  if (typeof email !== 'string' || !emailPattern.test(email.trim())) {
    errors.push('A valid email is required.');
  }
  if (typeof password !== 'string' || password.length < 8) {
    errors.push('Password must be at least 8 characters.');
  }
  return errors;
};

const register = async (req, res) => {
  const { name, email, password } = req.body || {};
  const errors = validateCredentials({ name, email, password }, true);
  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed.', details: errors });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
  });

  return res.status(201).json({ token: issueToken(user), user: publicUser(user) });
};

const login = async (req, res) => {
  const { email, password } = req.body || {};
  const errors = validateCredentials({ email, password }, false);
  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed.', details: errors });
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  if (user.status !== 'active') {
    return res.status(403).json({ error: 'This account is disabled.' });
  }

  return res.json({ token: issueToken(user), user: publicUser(user) });
};

const getCurrentUser = (req, res) => res.json({ user: publicUser(req.user) });

module.exports = {
  getCurrentUser,
  login,
  register,
};
