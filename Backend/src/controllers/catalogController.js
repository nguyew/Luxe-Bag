const mongoose = require('mongoose');
const CatalogTerm = require('../models/CatalogTerm');
const Product = require('../models/Product');

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function validType(type) {
  return type === 'brand' || type === 'category';
}

function rejectInvalidType(req, res) {
  if (validType(req.params.type)) return false;
  res.status(400).json({ error: 'Catalog type must be brand or category.' });
  return true;
}

async function listTerms(req, res) {
  if (rejectInvalidType(req, res)) return;
  const terms = await CatalogTerm.find({ type: req.params.type })
    .sort({ sortOrder: 1, name: 1 });
  return res.json({ terms });
}

async function listPublicTerms(req, res) {
  if (rejectInvalidType(req, res)) return;
  const terms = await CatalogTerm.find({ type: req.params.type, active: true })
    .select('type name slug sortOrder')
    .sort({ sortOrder: 1, name: 1 });
  return res.json({ terms });
}

async function createTerm(req, res) {
  if (rejectInvalidType(req, res)) return;
  const name = String(req.body?.name || '').trim();
  const slug = slugify(name);
  if (name.length < 2 || name.length > 100 || !slug) {
    return res.status(400).json({ error: 'Name must be between 2 and 100 characters.' });
  }
  try {
    const term = await CatalogTerm.create({
      type: req.params.type,
      name,
      slug,
      active: req.body?.active !== false,
      sortOrder: Number.isFinite(Number(req.body?.sortOrder)) ? Number(req.body.sortOrder) : 0,
    });
    return res.status(201).json({ term });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'This catalog name already exists.' });
    }
    throw error;
  }
}

async function updateTerm(req, res) {
  if (rejectInvalidType(req, res)) return;
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid catalog id.' });
  }
  const term = await CatalogTerm.findOne({ _id: req.params.id, type: req.params.type });
  if (!term) return res.status(404).json({ error: 'Catalog item not found.' });

  const oldName = term.name;
  if (req.body?.name !== undefined) {
    const name = String(req.body.name).trim();
    const slug = slugify(name);
    if (name.length < 2 || name.length > 100 || !slug) {
      return res.status(400).json({ error: 'Name must be between 2 and 100 characters.' });
    }
    term.name = name;
    term.slug = slug;
  }
  if (typeof req.body?.active === 'boolean') term.active = req.body.active;
  if (req.body?.sortOrder !== undefined) {
    const sortOrder = Number(req.body.sortOrder);
    if (!Number.isFinite(sortOrder)) return res.status(400).json({ error: 'sortOrder must be a number.' });
    term.sortOrder = sortOrder;
  }

  try {
    await term.save();
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'This catalog name already exists.' });
    }
    throw error;
  }

  if (oldName !== term.name) {
    await Product.updateMany({ [term.type]: oldName }, { $set: { [term.type]: term.name } });
  }
  return res.json({ term });
}

async function deleteTerm(req, res) {
  if (rejectInvalidType(req, res)) return;
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid catalog id.' });
  }
  const term = await CatalogTerm.findOne({ _id: req.params.id, type: req.params.type });
  if (!term) return res.status(404).json({ error: 'Catalog item not found.' });

  const inUse = await Product.exists({ [term.type]: term.name });
  if (inUse) {
    return res.status(409).json({
      error: 'This catalog item is used by products and cannot be deleted.',
      code: 'catalog_in_use',
    });
  }
  await term.deleteOne();
  return res.json({ success: true, id: String(term._id) });
}

module.exports = {
  createTerm,
  deleteTerm,
  listPublicTerms,
  listTerms,
  slugify,
  updateTerm,
};
