const mongoose = require('mongoose');

const removeLegacyPromotionIndexes = async () => {
  const collections = await mongoose.connection.db.listCollections({ name: 'promotions' }).toArray();
  if (!collections.length) return;

  const indexes = await mongoose.connection.collection('promotions').listIndexes().toArray();
  for (const index of indexes) {
    if (index.name === '_id_') continue;
    const keys = Object.keys(index.key || {});
    if (keys.length === 1 && keys[0] === 'code') {
      await mongoose.connection.collection('promotions').dropIndex(index.name);
      console.log(`Removed legacy promotions index ${index.name}`);
    }
  }
};

const normalizeProductCatalogValues = async () => {
  const Product = require('../models/Product');
  const CatalogTerm = require('../models/CatalogTerm');
  const terms = await CatalogTerm.find({}).select('_id type name slug').lean();
  for (const term of terms) {
    const id = String(term._id);
    for (const field of ['brand', 'category']) {
      if (term.type !== field) continue;
      await Product.updateMany(
        { [field]: { $in: [id, term.slug] } },
        { $set: { [field]: term.name } }
      );
    }
  }
};

const connectDatabase = async (mongoUri) => {
  if (!mongoUri) {
    console.warn('MONGODB_URI is not set; starting without a database connection.');
    return;
  }

  await mongoose.connect(mongoUri);
  await removeLegacyPromotionIndexes();
  await normalizeProductCatalogValues();
  console.log('MongoDB connected');
};

const disconnectDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
};

module.exports = {
  connectDatabase,
  disconnectDatabase,
};
