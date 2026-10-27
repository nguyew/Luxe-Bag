/**
 * Seed sample customer feedback (reviews) into MongoDB.
 *
 *   node scripts/seed-feedbacks.js          add sample reviews (safe to run again)
 *   node scripts/seed-feedbacks.js --reset  delete the sample reviews + sample reviewers
 *
 * - Uses the real Review / User / Product models of the Express Backend.
 * - Creates a few demo reviewer accounts (@luxebag.demo). They cannot log in.
 * - Adds 2-5 reviews to every PUBLISHED product. One review per reviewer per product.
 * - Never touches reviews written by real customers.
 */
const crypto = require('crypto');
const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

// Backend/.env first, Backend/src/.env as a fallback (same order as src/config/env.js)
[path.join(__dirname, '..', '.env'), path.join(__dirname, '..', 'src', '.env')]
  .forEach((envPath) => dotenv.config({ path: envPath, quiet: true }));

const DEMO_DOMAIN = 'luxebag.demo';

const REVIEWERS = [
  'Mai Tran', 'Linh Nguyen', 'Anh Pham', 'Khoa Le',
  'Hana Vo', 'Bao Dang', 'Thu Hoang', 'Minh Bui',
];

const COMMENTS = {
  5: [
    'Beautiful bag, the leather feels premium and the stitching is perfect.',
    'Exactly as pictured. Got lots of compliments on the very first day.',
    'Great quality and well packaged. Worth every dollar.',
    'Roomy enough for daily use and still looks elegant. Love it!',
  ],
  4: [
    'Very nice bag. Delivery was quick and the finish is lovely.',
    'Good quality for the price. The color is slightly different from the photo.',
    'Stylish and sturdy. I would have liked one more inner pocket.',
  ],
  3: [
    'Decent bag, but a little smaller than I expected.',
    'Looks good, though the strap feels a bit stiff at first.',
  ],
  2: ['The bag is okay, but the zipper felt rough out of the box.'],
};

// Small deterministic PRNG so running the script twice gives the same data.
function makeRandom(seedText) {
  let state = crypto.createHash('sha256').update(seedText).digest().readUInt32LE(0) || 1;
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return state / 0x100000000;
  };
}

const pick = (list, random) => list[Math.floor(random() * list.length)];

// Mostly 4-5 stars, with a few 3 and 2 so the star filter has something to show.
function pickRating(random) {
  const roll = random();
  if (roll < 0.5) return 5;
  if (roll < 0.82) return 4;
  if (roll < 0.95) return 3;
  return 2;
}

/** Pure function: which reviews should a product get. Exported for testing. */
function buildReviewsForProduct(productId, reviewerIds, now = Date.now()) {
  const random = makeRandom(`reviews:${productId}`);
  const count = 2 + Math.floor(random() * 4); // 2..5
  const chosen = [...reviewerIds].sort(() => random() - 0.5).slice(0, Math.min(count, reviewerIds.length));

  return chosen.map(({ id, name }) => {
    const rating = pickRating(random);
    const daysAgo = 1 + Math.floor(random() * 75);
    const createdAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000 - Math.floor(random() * 86400000));
    return {
      productId,
      userId: id,
      author: name,
      rating,
      comment: pick(COMMENTS[rating], random),
      createdAt,
    };
  });
}

async function connect() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI is required (set it in Backend/.env).');
    process.exit(1);
  }
  await mongoose.connect(mongoUri);
}

async function reset(User, Review) {
  const demoUsers = await User.find({ email: new RegExp(`@${DEMO_DOMAIN.replace('.', '\\.')}$`) }).select('_id');
  const ids = demoUsers.map((user) => user._id);
  const reviews = await Review.deleteMany({ userId: { $in: ids } });
  const users = await User.deleteMany({ _id: { $in: ids } });
  console.log(`Removed ${reviews.deletedCount} sample reviews and ${users.deletedCount} sample reviewers.`);
}

/**
 * `scripts/seed-mongodb.js` used an older Review schema (user/product/order) and left a
 * unique index `user_1_product_1_order_1` plus one legacy document in `reviews`.
 * The Express Backend does not use either, and the index makes every new review collide
 * on { user: null, product: null, order: null }. Remove both.
 */
async function removeLegacyReviewData(Review) {
  const indexes = await Review.collection.indexes();
  for (const index of indexes) {
    const keys = Object.keys(index.key || {});
    if (keys.includes('user') || keys.includes('product') || keys.includes('order')) {
      await Review.collection.dropIndex(index.name);
      console.log(`Dropped legacy index: ${index.name}`);
    }
  }
  const legacy = await Review.collection.deleteMany({ productId: { $exists: false } });
  if (legacy.deletedCount) console.log(`Removed ${legacy.deletedCount} legacy review document(s).`);
  await Review.init(); // make sure the real indexes (productId + userId) exist
}

async function seed(User, Product, Review) {
  await removeLegacyReviewData(Review);

  const products = await Product.find({ status: 'published' }).select('_id handbagName');
  if (!products.length) {
    console.error('No published products found. Add/publish products first (e.g. npm run seed).');
    process.exitCode = 1;
    return;
  }

  // 1) Demo reviewers (upsert by email; password is random and never used)
  const reviewers = [];
  for (const [index, name] of REVIEWERS.entries()) {
    const email = `demo.reviewer${index + 1}@${DEMO_DOMAIN}`;
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name,
        email,
        passwordHash: await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10),
        role: 'customer',
        status: 'active',
      });
    }
    reviewers.push({ id: user._id, name: user.name });
  }

  // 2) Reviews. $setOnInsert => existing reviews (including real ones) are never overwritten.
  const operations = products.flatMap((product) =>
    buildReviewsForProduct(product._id, reviewers).map((review) => ({
      updateOne: {
        filter: { productId: review.productId, userId: review.userId },
        update: {
          $setOnInsert: { ...review, hidden: false, updatedAt: review.createdAt },
        },
        upsert: true,
      },
    })));

  // Raw collection bulkWrite so the back-dated createdAt is kept as-is.
  const result = await Review.collection.bulkWrite(operations, { ordered: false });
  console.log(`Products: ${products.length}`);
  console.log(`Reviewers: ${reviewers.length}`);
  console.log(`New reviews added: ${result.upsertedCount} (already existing: ${operations.length - result.upsertedCount})`);
}

async function main() {
  await connect();
  const User = require('../src/models/User');
  const Product = require('../src/models/Product');
  const Review = require('../src/models/Review');
  try {
    if (process.argv.includes('--reset')) await reset(User, Review);
    else await seed(User, Product, Review);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Seeding feedbacks failed:', error.message);
    process.exit(1);
  });
}

module.exports = { buildReviewsForProduct };