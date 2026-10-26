const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const User = require('../models/User');
const { publicUser } = require('../utils/user');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateCustomer = ({ name, email, password }, requirePassword) => {
  const errors = [];
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
    errors.push('Name must be between 2 and 100 characters.');
  }
  if (typeof email !== 'string' || !emailPattern.test(email.trim())) {
    errors.push('A valid email is required.');
  }
  if (requirePassword && (typeof password !== 'string' || password.length < 8)) {
    errors.push('Password must be at least 8 characters.');
  }
  if (!requirePassword && password !== undefined && (typeof password !== 'string' || password.length < 8)) {
    errors.push('Password must be at least 8 characters when provided.');
  }
  return errors;
};

const isValidId = (id) => mongoose.isValidObjectId(id);

const findCustomer = async (id) => {
  if (!isValidId(id)) {
    return null;
  }
  return User.findOne({ _id: id, role: 'customer' });
};

const createCustomer = async (req, res) => {
  const { name, email, password, phone, avatarUrl } = req.body || {};
  const errors = validateCustomer({ name, email, password }, true);
  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed.', details: errors });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(password, 12),
    phone: typeof phone === 'string' ? phone.trim() : '',
    avatarUrl: typeof avatarUrl === 'string' ? avatarUrl.trim() : '',
    role: 'customer',
  });

  return res.status(201).json({ user: publicUser(user) });
};

const listCustomers = async (req, res) => {
  const page = Math.max(Number.parseInt(req.query.page || '1', 10), 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit || '20', 10), 1), 100);
  const filter = { role: 'customer' };

  if (typeof req.query.search === 'string' && req.query.search.trim()) {
    const search = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }
  if (req.query.status === 'active' || req.query.status === 'disabled') {
    filter.status = req.query.status;
  }

  const [customers, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);

  return res.json({
    customers: customers.map(publicUser),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
};

const getCustomer = async (req, res) => {
  const customer = await findCustomer(req.params.id);
  if (!customer) {
    return res.status(isValidId(req.params.id) ? 404 : 400).json({
      error: isValidId(req.params.id) ? 'Customer not found.' : 'Invalid customer id.',
    });
  }
  return res.json({ customer: publicUser(customer) });
};

const updateCustomer = async (req, res) => {
  const { name, email, phone, avatarUrl, password } = req.body || {};
  const customer = await findCustomer(req.params.id);
  if (!customer) {
    return res.status(isValidId(req.params.id) ? 404 : 400).json({
      error: isValidId(req.params.id) ? 'Customer not found.' : 'Invalid customer id.',
    });
  }

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email;
  if (password !== undefined) updates.password = password;
  if (Object.keys(updates).length === 0 && phone === undefined && avatarUrl === undefined) {
    return res.status(400).json({ error: 'At least one customer field is required.' });
  }
  const errors = validateCustomer(
    {
      name: updates.name === undefined ? customer.name : updates.name,
      email: updates.email === undefined ? customer.email : updates.email,
      password: updates.password,
    },
    false
  );
  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed.', details: errors });
  }

  if (updates.email !== undefined) {
    updates.email = updates.email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: updates.email, _id: { $ne: customer._id } });
    if (existingUser) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }
  }
  if (updates.name !== undefined) updates.name = updates.name.trim();
  if (updates.password !== undefined) {
    updates.passwordHash = await bcrypt.hash(updates.password, 12);
    delete updates.password;
  }
  if (phone !== undefined) updates.phone = typeof phone === 'string' ? phone.trim() : '';
  if (avatarUrl !== undefined) updates.avatarUrl = typeof avatarUrl === 'string' ? avatarUrl.trim() : '';

  const updatedCustomer = await User.findOneAndUpdate(
    { _id: customer._id, role: 'customer' },
    { $set: updates },
    { new: true, runValidators: true }
  );
  return res.json({ customer: publicUser(updatedCustomer) });
};

const disableCustomer = async (req, res) => {
  const customer = await findCustomer(req.params.id);
  if (!customer) {
    return res.status(isValidId(req.params.id) ? 404 : 400).json({
      error: isValidId(req.params.id) ? 'Customer not found.' : 'Invalid customer id.',
    });
  }
  if (customer.status === 'disabled') {
    return res.status(409).json({ error: 'Customer account is already disabled.' });
  }

  customer.status = 'disabled';
  await customer.save();
  return res.json({ customer: publicUser(customer) });
};

module.exports = {
  createCustomer,
  disableCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
};
