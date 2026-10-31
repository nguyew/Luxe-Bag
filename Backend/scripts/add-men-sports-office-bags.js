const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error('MONGODB_URI is required.');
  process.exit(1);
}

const Product = require('../src/models/Product');

const brandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true, default: '' },
    logoUrl: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Brand = mongoose.models.Brand || mongoose.model('Brand', brandSchema);
const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);

const newBrands = [
  { name: 'Nike', slug: 'nike', description: 'World-leading sports and athletic gear.' },
  { name: 'Adidas', slug: 'adidas', description: 'Iconic sportswear and active lifestyle bags.' },
  { name: 'Under Armour', slug: 'under-armour', description: 'High-performance gym and athletic equipment.' },
  { name: 'Montblanc', slug: 'montblanc', description: 'Luxury German craftsmanship and leather briefcases.' },
  { name: 'Tumi', slug: 'tumi', description: 'Premium business and travel bags, luggage, and backpacks.' },
  { name: 'Samsonite', slug: 'samsonite', description: 'Renowned professional business cases and durable luggage.' },
];

const newCategories = [
  { name: 'Briefcase', slug: 'briefcase', description: 'Professional work cases and business document holders.' },
  { name: 'Duffle Bag', slug: 'duffle-bag', description: 'Spacious sports, gym, and weekend travel bags.' },
  { name: 'Business Backpack', slug: 'business-backpack', description: 'Ergonomic laptop and business commute backpacks.' },
  { name: 'Messenger Bag', slug: 'messenger-bag', description: 'Versatile shoulder messenger bags for daily commuting.' },
  { name: 'Gym Bag', slug: 'gym-bag', description: 'Lightweight and breathable athletic training bags.' },
  { name: 'Sport Backpack', slug: 'sport-backpack', description: 'Durable sports and casual outdoor backpacks.' },
];

const menBags = [
  // Phong cách thể thao (Sports / Athleisure)
  {
    handbagName: 'Nike Brasilia 9.5 Training Duffel',
    brand: 'Nike',
    category: 'Duffle Bag',
    cost: 1120000,
    percentOff: 0.10,
    color: ['Black', 'Anthracite'],
    gender: false, // Men / Nam
    stock: 20,
    status: 'published',
    uri: 'https://images.unsplash.com/photo-1546938576-6e6a64f317cc?w=800',
  },
  {
    handbagName: 'Nike Heritage Crossbody Bag',
    brand: 'Nike',
    category: 'Crossbody',
    cost: 800000,
    percentOff: 0.05,
    color: ['Black', 'White'],
    gender: false,
    stock: 18,
    status: 'published',
    uri: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800',
  },
  {
    handbagName: 'Adidas Essentials Linear Duffel Bag',
    brand: 'Adidas',
    category: 'Duffle Bag',
    cost: 950000,
    percentOff: 0.15,
    color: ['Navy', 'White'],
    gender: false,
    stock: 22,
    status: 'published',
    uri: 'https://images.unsplash.com/photo-1577733966973-d680bffd2e80?w=800',
  },
  {
    handbagName: 'Adidas Adicolor Classic Sport Backpack',
    brand: 'Adidas',
    category: 'Sport Backpack',
    cost: 1380000,
    percentOff: 0.08,
    color: ['Black', 'White'],
    gender: false,
    stock: 16,
    status: 'published',
    uri: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=800',
  },
  {
    handbagName: 'Under Armour Undeniable 5.0 Gym Bag',
    brand: 'Under Armour',
    category: 'Gym Bag',
    cost: 1200000,
    percentOff: 0.12,
    color: ['Pitch Grey', 'Black'],
    gender: false,
    stock: 15,
    status: 'published',
    uri: 'https://images.unsplash.com/photo-1628149455678-16f37bc392f4?w=800',
  },

  // Phong cách công sở / Doanh nhân (Office / Business)
  {
    handbagName: 'Montblanc Meisterstück Leather Briefcase',
    brand: 'Montblanc',
    category: 'Briefcase',
    cost: 8500000,
    percentOff: 0.05,
    color: ['Black', 'Silver'],
    gender: false,
    stock: 8,
    status: 'published',
    uri: 'https://images.unsplash.com/photo-1581605405669-fcdf81165afa?w=800',
  },
  {
    handbagName: 'Montblanc Sartorial Leather Document Case',
    brand: 'Montblanc',
    category: 'Document Case',
    cost: 7250000,
    percentOff: 0.10,
    color: ['Black'],
    gender: false,
    stock: 10,
    status: 'published',
    uri: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800',
  },
  {
    handbagName: 'Tumi Alpha 3 Business Laptop Backpack',
    brand: 'Tumi',
    category: 'Business Backpack',
    cost: 6500000,
    percentOff: 0.15,
    color: ['Black', 'Gunmetal'],
    gender: false,
    stock: 12,
    status: 'published',
    uri: 'https://images.unsplash.com/photo-1509762774605-f07235a08f1f?w=800',
  },
  {
    handbagName: 'Tumi Organizer Expandable Leather Brief',
    brand: 'Tumi',
    category: 'Briefcase',
    cost: 5500000,
    percentOff: 0.08,
    color: ['Espresso Brown'],
    gender: false,
    stock: 14,
    status: 'published',
    uri: 'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?w=800',
  },
  {
    handbagName: 'Samsonite Classic Leather Flap Messenger',
    brand: 'Samsonite',
    category: 'Messenger Bag',
    cost: 3380000,
    percentOff: 0.12,
    color: ['Cognac Brown', 'Dark Brown'],
    gender: false,
    stock: 18,
    status: 'published',
    uri: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800',
  },
  {
    handbagName: 'Samsonite Modern Utility Double Shot Duffel',
    brand: 'Samsonite',
    category: 'Duffle Bag',
    cost: 2750000,
    percentOff: 0.10,
    color: ['Charcoal Grey', 'Black'],
    gender: false,
    stock: 15,
    status: 'published',
    uri: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800',
  },
  {
    handbagName: 'Coach Metropolitan Leather Messenger Bag',
    brand: 'Coach',
    category: 'Messenger Bag',
    cost: 4880000,
    percentOff: 0.06,
    color: ['Saddle Brown', 'Black'],
    gender: false,
    stock: 11,
    status: 'published',
    uri: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800',
  },
];

async function run() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  // Upsert Brands
  for (const b of newBrands) {
    await Brand.updateOne({ slug: b.slug }, { $set: b }, { upsert: true });
    console.log(`Brand upserted: ${b.name}`);
  }

  // Upsert Categories
  for (const c of newCategories) {
    await Category.updateOne({ slug: c.slug }, { $set: c }, { upsert: true });
    console.log(`Category upserted: ${c.name}`);
  }

  // Upsert Products
  // Upsert Products
  for (const bag of menBags) {
    const slug = bag.handbagName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    await Product.updateOne(
      { handbagName: bag.handbagName },
      {
        $set: {
          ...bag,
          slug,
        },
      },
      { upsert: true }
    );

    console.log(
      `Men Bag upserted: ${bag.handbagName} (${bag.brand} - ${bag.category})`
    );
  }

  const totalProducts = await Product.countDocuments();
  const menCount = await Product.countDocuments({ gender: false });
  console.log(`\nDone! Total products in DB: ${totalProducts} (Men bags: ${menCount})`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Error seeding men/sports/office bags:', err);
  process.exit(1);
});
